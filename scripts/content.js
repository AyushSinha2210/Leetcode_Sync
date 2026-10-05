/**
 * LeetCode Sync - Content Script
 * Injected on leetcode.com/problems/*
 * Coordinates between page network hook, GraphQL API, Complexity Analyzer, and GitHub Sync.
 */

(function () {
  console.log('[LeetCode Sync] Content script active.');

  let processedSubmissions = new Set();
  let currentToastEl = null;

  // 1. Listen for messages and CustomEvents from inject.js
  const handleAcceptedEvent = async (payload) => {
    if (!payload || !payload.code) return;
    const subId = payload.submissionId || `${payload.slug}-${Date.now()}`;
    if (processedSubmissions.has(subId)) return;
    processedSubmissions.add(subId);

    console.log('[LeetCode Sync] Processing Accepted submission for:', payload.slug);
    await handleAcceptedSubmission(payload);
  };

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'LEETCODE_SYNC_ACCEPTED') {
      handleAcceptedEvent(event.data.payload);
    }
  });

  window.addEventListener('LeetCodeSync:Accepted', (e) => handleAcceptedEvent(e.detail));
  document.addEventListener('LeetCodeSync:Accepted', (e) => handleAcceptedEvent(e.detail));

  // 2. Fallback DOM MutationObserver for "Accepted" banner
  let lastDomSyncTimestamp = 0;
  const observer = new MutationObserver(() => {
    if (Date.now() - lastDomSyncTimestamp < 12000) return;

    // Check if "Accepted" appears in any submission result element
    const acceptedElements = Array.from(document.querySelectorAll('*')).filter(el => {
      return el.children.length === 0 && (el.innerText || el.textContent || '').trim() === 'Accepted';
    });

    for (const el of acceptedElements) {
      const container = el.closest('[data-e2e-locator="submission-result"], [class*="result"], [class*="submission"], div');
      if (container) {
        const text = container.innerText || '';
        if (/runtime/i.test(text) || /beats/i.test(text) || /memory/i.test(text) || /passed/i.test(text)) {
          console.log('[LeetCode Sync] DOM MutationObserver detected Accepted banner!');
          lastDomSyncTimestamp = Date.now();
          triggerSyncFromCurrentPage();
          break;
        }
      }
    }
  });

  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  // 3. Listen for manual sync commands from extension popup
  chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.type === 'SYNC_CURRENT_PAGE') {
      triggerSyncFromCurrentPage().then(() => sendResponse({ success: true }));
      return true;
    }
  });

  /**
   * Scrape current editor code and page metadata to trigger sync
   */
  async function triggerSyncFromCurrentPage() {
    const slugMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1];

    let runtime = '';
    let memory = '';
    let runtimePercentile = null;
    let memoryPercentile = null;

    const pageText = document.body.innerText || '';
    const runtimeMatch = pageText.match(/Runtime\s*[:：]?\s*([0-9]+\s*(?:ms|s))/i);
    if (runtimeMatch) runtime = runtimeMatch[1];

    const memoryMatch = pageText.match(/Memory\s*[:：]?\s*([0-9.]+\s*(?:MB|KB|GB))/i);
    if (memoryMatch) memory = memoryMatch[1];

    const beatsMatch = pageText.match(/Beats\s*([0-9.]+)%/i);
    if (beatsMatch) runtimePercentile = parseFloat(beatsMatch[1]);

    const code = await getCodeFromEditor();
    if (!code || code.trim().length === 0) {
      console.warn('[LeetCode Sync] Could not extract code from editor.');
      return;
    }

    const lang = detectLanguage();
    const payload = {
      submissionId: `sync-${slug}-${Date.now()}`,
      status: 'Accepted',
      runtime: runtime || '4 ms',
      runtimePercentile,
      memory: memory || '14.2 MB',
      memoryPercentile,
      lang,
      code,
      slug
    };

    if (processedSubmissions.has(payload.submissionId)) return;
    processedSubmissions.add(payload.submissionId);

    console.log('[LeetCode Sync] Auto-triggering sync for:', payload);
    await handleAcceptedSubmission(payload);
  }

  /**
   * Extract code from Monaco editor or DOM
   */
  async function getCodeFromEditor() {
    // 1. Monaco lines from DOM
    const lines = document.querySelectorAll('.monaco-editor .view-line');
    if (lines && lines.length > 0) {
      const code = Array.from(lines).map(l => l.textContent).join('\n');
      if (code.trim().length > 0) return code;
    }

    // 2. Request from inject.js
    const fromInject = await new Promise(resolve => {
      const handler = (e) => {
        window.removeEventListener('LeetCodeSync:ResponseCode', handler);
        resolve(e.detail?.code || '');
      };
      window.addEventListener('LeetCodeSync:ResponseCode', handler);
      window.dispatchEvent(new CustomEvent('LeetCodeSync:RequestCode'));
      setTimeout(() => {
        window.removeEventListener('LeetCodeSync:ResponseCode', handler);
        resolve('');
      }, 400);
    });

    if (fromInject && fromInject.trim().length > 0) return fromInject;

    // 3. Fallback textarea / code tag
    const textarea = document.querySelector('textarea.inputarea');
    if (textarea && textarea.value) return textarea.value;

    return '';
  }

  /**
   * Detect programming language from DOM or code
   */
  function detectLanguage() {
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      if (text === 'c++') return 'cpp';
      if (text === 'python3' || text === 'python') return 'python3';
      if (text === 'c#') return 'csharp';
      if (text === 'go') return 'golang';
      if (text === 'java') return 'java';
      if (text === 'javascript') return 'javascript';
      if (text === 'typescript') return 'typescript';
      if (text === 'rust') return 'rust';
    }

    const code = document.querySelector('.monaco-editor')?.innerText || '';
    if (code.includes('#include') || code.includes('vector<') || code.includes('std::')) return 'cpp';
    if (code.includes('def ') || code.includes('import ') || code.includes('self.')) return 'python3';
    if (code.includes('public class') || code.includes('System.out')) return 'java';
    if (code.includes('function') || code.includes('const ') || code.includes('let ')) return 'javascript';

    return 'python3';
  }

  /**
   * Main handler for accepted submissions
   */
  async function handleAcceptedSubmission(submission) {
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
        title: 'LeetCode Sync: Token Needed',
        message: 'Please paste your GitHub Personal Access Token in the LeetCode Sync extension popup settings.',
        solutionNum: null,
        timeComplexity: null,
        spaceComplexity: null
      });
      return;
    }

    const username = settings.githubUsername || 'AyushSinha2210';
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
