/**
 * LeetCode Sync - Content Script
 * Injected on leetcode.com/problems/*
 * Coordinates between page network hook, GraphQL API, Complexity Analyzer, and GitHub Sync.
 */

(function () {
  console.log('[LeetCode Sync] Content script active.');

  let processedSubmissions = new Set();
  let currentToastEl = null;

  // 1. Inject inject.js into the main world DOM
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('scripts/inject.js');
    s.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
  } catch (err) {
    console.error('[LeetCode Sync] Failed to inject page hook:', err);
  }

  // 2. Listen for messages from inject.js
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'LEETCODE_SYNC_ACCEPTED') {
      return;
    }

    const payload = event.data.payload;
    if (!payload || !payload.code) {
      console.warn('[LeetCode Sync] Empty payload received, ignoring.');
      return;
    }

    const subId = payload.submissionId || `${payload.slug}-${Date.now()}`;
    if (processedSubmissions.has(subId)) {
      console.log('[LeetCode Sync] Submission already processed:', subId);
      return;
    }
    processedSubmissions.add(subId);

    console.log('[LeetCode Sync] Processing Accepted submission for:', payload.slug);
    await handleAcceptedSubmission(payload);
  });

  /**
   * Main handler for accepted submissions
   */
  async function handleAcceptedSubmission(submission) {
    // Read extension settings
    const settings = await chrome.storage.local.get([
      'githubToken',
      'githubUsername',
      'repoName',
      'branch'
    ]);

    const token = settings.githubToken;
    if (!token) {
      showToast({
        status: 'error',
        title: 'LeetCode Sync Needs Setup',
        message: 'GitHub Token is missing. Click the LeetCode Sync extension icon in your browser toolbar to connect.',
        solutionNum: null,
        timeComplexity: null,
        spaceComplexity: null
      });
      return;
    }

    const repoName = settings.repoName || 'Leetcode_Sync';
    const branch = settings.branch || 'main';

    // Show initial syncing HUD
    showToast({
      status: 'syncing',
      title: 'LeetCode Sync',
      message: 'Scraping complexity from LeetCode data...',
      solutionNum: '...',
      timeComplexity: 'Scraping...',
      spaceComplexity: 'Scraping...'
    });

    try {
      // Fetch full question metadata from LeetCode GraphQL
      const questionMeta = await fetchQuestionMetadata(submission.slug);

      // Scrape Time & Space Complexity directly from LeetCode data
      updateToastStatus('Extracting complexity from LeetCode submission & editorial...');
      const complexity = await ComplexityAnalyzer.analyze({
        code: submission.code,
        lang: submission.lang || 'python3',
        title: questionMeta.title || submission.slug,
        titleSlug: submission.slug
      });

      // Update toast with analyzed complexity
      updateToastComplexity(complexity.timeComplexity, complexity.spaceComplexity, complexity.explanation);

      // Push to GitHub (handles Solution 1, Solution 2 incrementing automatically)
      updateToastStatus('Pushing to GitHub...');
      const pushResult = await GitHubSync.pushSolution({
        token,
        username: settings.githubUsername,
        repoName,
        branch,
        code: submission.code,
        lang: submission.lang || 'python3',
        title: questionMeta.title || submission.slug,
        frontendId: questionMeta.frontendId,
        difficulty: questionMeta.difficulty,
        titleSlug: submission.slug,
        questionHtml: questionMeta.content,
        topicTags: questionMeta.topicTags,
        timeComplexity: complexity.timeComplexity,
        spaceComplexity: complexity.spaceComplexity,
        explanation: complexity.explanation,
        runtime: submission.runtime,
        runtimePercentile: submission.runtimePercentile,
        memory: submission.memory,
        memoryPercentile: submission.memoryPercentile,
        onProgress: (status) => updateToastStatus(status)
      });

      // Save to recent activity in chrome.storage.local
      await recordActivity({
        id: submission.submissionId || Date.now(),
        frontendId: questionMeta.frontendId,
        title: questionMeta.title || submission.slug,
        slug: submission.slug,
        difficulty: questionMeta.difficulty,
        solutionNum: pushResult.solutionNum,
        lang: submission.lang,
        timeComplexity: complexity.timeComplexity,
        spaceComplexity: complexity.spaceComplexity,
        runtime: submission.runtime,
        memory: submission.memory,
        commitUrl: pushResult.commitUrl,
        timestamp: new Date().toISOString()
      });

      // Show final success toast
      showToast({
        status: 'success',
        title: `${questionMeta.frontendId ? `${questionMeta.frontendId}. ` : ''}${questionMeta.title}`,
        solutionNum: pushResult.solutionNum,
        timeComplexity: complexity.timeComplexity,
        spaceComplexity: complexity.spaceComplexity,
        explanation: complexity.explanation,
        runtime: submission.runtime,
        runtimePercentile: submission.runtimePercentile,
        memory: submission.memory,
        memoryPercentile: submission.memoryPercentile,
        commitUrl: pushResult.commitUrl,
        source: complexity.source
      });

    } catch (err) {
      console.error('[LeetCode Sync] Sync failed:', err);
      showToast({
        status: 'error',
        title: 'Sync Failed',
        message: err.message || 'An error occurred while pushing to GitHub.',
        solutionNum: null,
        timeComplexity: null,
        spaceComplexity: null
      });
    }
  }

  /**
   * Fetch question metadata from LeetCode GraphQL
   */
  async function fetchQuestionMetadata(titleSlug) {
    if (!titleSlug) return { title: 'Unknown Problem', frontendId: '0', difficulty: 'Easy', content: '', topicTags: [] };

    try {
      const query = `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            questionFrontendId
            title
            titleSlug
            difficulty
            content
            topicTags {
              name
              slug
            }
          }
        }
      `;

      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { titleSlug }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const q = data?.data?.question;
        if (q) {
          return {
            frontendId: q.questionFrontendId || q.questionId,
            title: q.title,
            titleSlug: q.titleSlug,
            difficulty: q.difficulty || 'Easy',
            content: q.content || '',
            topicTags: q.topicTags || []
          };
        }
      }
    } catch (e) {
      console.warn('[LeetCode Sync] Could not fetch question GraphQL details:', e);
    }

    // Fallback: extract title from slug
    const cleanTitle = titleSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return {
      frontendId: '0',
      title: cleanTitle,
      titleSlug,
      difficulty: 'Medium',
      content: '',
      topicTags: []
    };
  }

  /**
   * Record activity in chrome.storage.local
   */
  async function recordActivity(item) {
    try {
      const { syncHistory = [] } = await chrome.storage.local.get('syncHistory');
      // Keep most recent 50 submissions
      const updated = [item, ...syncHistory.filter(h => h.id !== item.id)].slice(0, 50);
      await chrome.storage.local.set({ syncHistory: updated });
    } catch (e) {
      console.warn('[LeetCode Sync] Could not save activity history:', e);
    }
  }

  /**
   * UI: Display floating Toast HUD on screen
   */
  function showToast({
    status = 'syncing',
    title = 'LeetCode Sync',
    message = '',
    solutionNum = 1,
    timeComplexity = 'O(N)',
    spaceComplexity = 'O(1)',
    explanation = '',
    runtime = '',
    runtimePercentile = null,
    memory = '',
    memoryPercentile = null,
    commitUrl = null,
    source = ''
  }) {
    if (currentToastEl) {
      currentToastEl.remove();
      currentToastEl = null;
    }

    const hud = document.createElement('div');
    hud.id = 'leetcode-sync-hud';

    const statusClass = status === 'success' ? 'success' : status === 'error' ? 'error' : 'syncing';
    const statusText = status === 'success' ? 'Pushed to GitHub' : status === 'error' ? 'Sync Error' : 'Syncing...';

    const runtimeBeats = runtimePercentile ? ` (Beats ${Number(runtimePercentile).toFixed(1)}%)` : '';
    const memoryBeats = memoryPercentile ? ` (Beats ${Number(memoryPercentile).toFixed(1)}%)` : '';

    hud.innerHTML = `
      <div class="lc-sync-toast">
        <div class="lc-sync-header">
          <div class="lc-sync-brand">
            <span class="lc-sync-status-dot ${statusClass}"></span>
            <span>LeetCode Sync • ${statusText}</span>
          </div>
          <button class="lc-sync-close-btn" title="Close">✕</button>
        </div>

        <div class="lc-sync-title">
          <span>${title}</span>
          ${solutionNum && solutionNum !== '...' ? `<span class="lc-sync-solution-badge">Solution ${solutionNum}</span>` : ''}
        </div>

        ${timeComplexity ? `
          <div class="lc-sync-complexities">
            <div class="lc-sync-pill time" title="Time Complexity">
              <span>⏱️ Time:</span>
              <span class="lc-sync-pill-val" id="lc-time-val">${timeComplexity}</span>
            </div>
            <div class="lc-sync-pill space" title="Auxiliary Space Complexity">
              <span>💾 Space:</span>
              <span class="lc-sync-pill-val" id="lc-space-val">${spaceComplexity}</span>
            </div>
          </div>
        ` : ''}

        ${explanation ? `<div class="lc-sync-explanation" id="lc-explanation">${explanation}</div>` : ''}
        ${message ? `<div class="lc-sync-explanation">${message}</div>` : ''}

        ${runtime || commitUrl ? `
          <div class="lc-sync-footer">
            <div class="lc-sync-perf">
              ${runtime ? `Runtime: <strong>${runtime}${runtimeBeats}</strong>` : ''}
              ${memory ? ` • Mem: <strong>${memory}${memoryBeats}</strong>` : ''}
            </div>
            ${commitUrl ? `
              <a href="${commitUrl}" target="_blank" rel="noopener noreferrer" class="lc-sync-github-btn">
                <span>View on GitHub</span> ↗
              </a>
            ` : ''}
          </div>
        ` : ''}

        ${status === 'success' ? '<div class="lc-sync-progress"></div>' : ''}
      </div>
    `;

    document.body.appendChild(hud);
    currentToastEl = hud;

    // Close button
    hud.querySelector('.lc-sync-close-btn')?.addEventListener('click', () => {
      hud.remove();
      currentToastEl = null;
    });

    // Auto dismiss after 7.5 seconds on success
    if (status === 'success') {
      setTimeout(() => {
        if (currentToastEl === hud) {
          hud.style.opacity = '0';
          hud.style.transform = 'translateY(15px)';
          setTimeout(() => hud.remove(), 300);
        }
      }, 7500);
    }
  }

  function updateToastStatus(text) {
    if (!currentToastEl) return;
    const exp = currentToastEl.querySelector('.lc-sync-explanation');
    if (exp) exp.textContent = text;
  }

  function updateToastComplexity(time, space, explanation) {
    if (!currentToastEl) return;
    const timeEl = currentToastEl.querySelector('#lc-time-val');
    const spaceEl = currentToastEl.querySelector('#lc-space-val');
    const expEl = currentToastEl.querySelector('#lc-explanation');
    if (timeEl) timeEl.textContent = time;
    if (spaceEl) spaceEl.textContent = space;
    if (expEl && explanation) expEl.textContent = explanation;
  }
})();
