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

  // 3. Listen for commands from extension popup
  chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.type === 'PING') {
      sendResponse({ pong: true });
      return true;
    }
    if (request.type === 'SYNC_CURRENT_PAGE') {
      triggerSyncFromCurrentPage()
        .then(result => sendResponse(result || { success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });

  /**
   * Fetch user's latest accepted submission directly from LeetCode's authenticated GraphQL
   */
  async function fetchLatestAcceptedSubmission(questionSlug) {
    if (!questionSlug) return null;

    try {
      const graphqlUrl = window.location.origin.includes('leetcode.cn')
        ? 'https://leetcode.cn/graphql/'
        : 'https://leetcode.com/graphql';

      const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      const headers = {
        'Content-Type': 'application/json'
      };
      if (csrfToken) {
        headers['x-csrftoken'] = csrfToken;
      }

      // 1. Get submission list for this question
      const listQuery = `
        query Submissions($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String!) {
          submissionList(offset: $offset, limit: $limit, lastKey: $lastKey, questionSlug: $questionSlug) {
            lastKey
            hasNext
            submissions {
              id
              statusDisplay
              lang
              runtime
              timestamp
              url
              isPending
              memory
            }
          }
        }
      `;

      const listRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          query: listQuery,
          variables: {
            offset: 0,
            limit: 10,
            lastKey: null,
            questionSlug
          }
        })
      });

      if (!listRes.ok) return null;
      const listData = await listRes.json();
      const subs = listData?.data?.submissionList?.submissions;
      if (!Array.isArray(subs) || subs.length === 0) return null;

      const accepted = subs.find(s => s && s.statusDisplay === 'Accepted');
      if (!accepted) return null;

      // 2. Get submission details (plural: submissionDetails) for the accepted submission
      const detailQuery = `
        query submissionDetails($submissionId: Int!) {
          submissionDetails(submissionId: $submissionId) {
            runtime
            runtimeDisplay
            runtimePercentile
            memory
            memoryDisplay
            memoryPercentile
            code
            timestamp
            statusCode
            lang {
              name
              verboseName
            }
          }
        }
      `;

      const detailRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          query: detailQuery,
          variables: {
            submissionId: parseInt(accepted.id, 10)
          }
        })
      });

      if (!detailRes.ok) return null;
      const detailData = await detailRes.json();
      const detail = detailData?.data?.submissionDetails;

      if (detail && detail.code) {
        return {
          id: accepted.id,
          code: detail.code,
          lang: detail.lang?.name || accepted.lang || 'python3',
          runtime: detail.runtimeDisplay || `${accepted.runtime || detail.runtime || ''}`.trim(),
          runtimePercentile: detail.runtimePercentile || null,
          memory: detail.memoryDisplay || `${accepted.memory || detail.memory || ''}`.trim(),
          memoryPercentile: detail.memoryPercentile || null,
          status: 'Accepted'
        };
      }
    } catch (err) {
      console.warn('[LeetCode Sync] fetchLatestAcceptedSubmission error:', err);
    }

    return null;
  }

  /**
   * Scrape current editor code and page metadata to trigger sync
   */
  async function triggerSyncFromCurrentPage() {
    const slugMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    if (!slugMatch) {
      return { success: false, error: 'Could not detect problem slug from current URL.' };
    }
    const slug = slugMatch[1];

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
      return { success: false, error: 'GitHub Token is missing. Please save it in extension settings.' };
    }

    // Step 1: Try fetching the authenticated user's latest accepted submission from LeetCode GraphQL
    console.log('[LeetCode Sync] Checking LeetCode submission history for:', slug);
    let subData = await fetchLatestAcceptedSubmission(slug);

    // Step 2: Fallback to editor DOM if no submission found via GraphQL (e.g. user hasn't submitted yet)
    if (!subData || !subData.code) {
      console.log('[LeetCode Sync] No submission from GraphQL, falling back to editor DOM...');
      const editorCode = await getCodeFromEditor();
      if (!editorCode || editorCode.trim().length === 0) {
        return {
          success: false,
          error: 'No accepted submission found for this problem, and the code editor is empty. Please submit your solution on LeetCode first!'
        };
      }

      // Extract runtime/memory from DOM
      const pageText = document.body.innerText || '';
      let runtime = '';
      let memory = '';
      let runtimePercentile = null;
      let memoryPercentile = null;

      const runtimeMatch = pageText.match(/(?:Runtime|执行用时)\s*[:：]?\s*([0-9.]+\s*(?:ms|s|毫秒))/i);
      if (runtimeMatch) runtime = runtimeMatch[1];

      const memoryMatch = pageText.match(/(?:Memory|内存)\s*[:：]?\s*([0-9.]+\s*(?:MB|KB|GB|兆字节))/i);
      if (memoryMatch) memory = memoryMatch[1];

      const beatsMatch = pageText.match(/(?:Beats|击败)\s*([0-9.]+)%/i);
      if (beatsMatch) runtimePercentile = parseFloat(beatsMatch[1]);

      subData = {
        id: `manual-${slug}-${Date.now()}`,
        code: editorCode,
        lang: detectLanguage(),
        runtime: runtime || '4 ms',
        runtimePercentile,
        memory: memory || '14.2 MB',
        memoryPercentile,
        status: 'Accepted'
      };
    }

    const payload = {
      submissionId: subData.id,
      status: 'Accepted',
      runtime: subData.runtime,
      runtimePercentile: subData.runtimePercentile,
      memory: subData.memory,
      memoryPercentile: subData.memoryPercentile,
      lang: subData.lang,
      code: subData.code,
      slug
    };

    console.log('[LeetCode Sync] Executing sync with payload:', payload);
    const result = await handleAcceptedSubmission(payload);
    return result || { success: true };
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

      return {
        success: true,
        solutionNum: pushResult.solutionNum,
        title: questionMeta.title,
        commitUrl: pushResult.commitUrl,
        timeComplexity: complexity.timeComplexity,
        spaceComplexity: complexity.spaceComplexity
      };

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
      return {
        success: false,
        error: err.message || 'An error occurred while pushing to GitHub.'
      };
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
