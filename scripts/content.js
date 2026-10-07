/**
 * LeetCode Sync - Content Script
 * Injected on leetcode.com/problems/*
 * Coordinates between page network hook, GraphQL API, Complexity Analyzer, and GitHub Sync.
 */

(function () {
  console.log('[LeetCode Sync] Content script active.');

  let processedSubmissions = new Set();
  let currentToastEl = null;

  /**
   * Grammarly-style Floating Sync Widget
   */
  const GrammarlyWidget = {
    rootEl: null,
    bubbleEl: null,
    badgeEl: null,
    teaserEl: null,
    cardEl: null,
    syncBtn: null,
    syncText: null,
    spinner: null,
    statusMsg: null,
    successBox: null,
    githubLink: null,
    isOpen: false,
    isSyncing: false,
    pendingSubmission: null,
    currentSlug: '',

    init() {
      if (document.getElementById('lc-grammarly-root')) {
        this.rootEl = document.getElementById('lc-grammarly-root');
        return;
      }

      const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
      if (!match) return; // Only show on problem pages
      this.currentSlug = match[1];

      this.createDom();
      this.bindEvents();
      console.log('[LeetCode Sync] Grammarly-style floating widget initialized.');
    },

    createDom() {
      this.rootEl = document.createElement('div');
      this.rootEl.id = 'lc-grammarly-root';

      this.rootEl.innerHTML = `
        <!-- Floating Circular Bubble (Grammarly style) -->
        <div id="lc-gm-bubble" class="lc-gm-bubble" title="LeetCode Sync Pro (Click to open)">
          <div class="lc-gm-bubble-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#ffa116" stroke="#ffa116"></polygon>
            </svg>
          </div>
          <div id="lc-gm-badge" class="lc-gm-badge lc-hidden">✓</div>
        </div>

        <!-- Speech-Bubble Teaser (shown on Accepted) -->
        <div id="lc-gm-teaser" class="lc-gm-teaser lc-hidden">
          <div class="lc-gm-teaser-dot"></div>
          <div>
            <div class="lc-gm-teaser-title">Accepted!</div>
            <div class="lc-gm-teaser-sub">Click to sync to GitHub</div>
          </div>
          <button id="lc-gm-teaser-close" class="lc-gm-teaser-close" title="Dismiss">✕</button>
        </div>

        <!-- Expanded Pop Card -->
        <div id="lc-gm-card" class="lc-gm-card lc-hidden">
          <div class="lc-gm-card-header">
            <div class="lc-gm-brand">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#ffa116" stroke="#ffa116"></polygon>
              </svg>
              <span>LeetCode Sync</span>
              <span id="lc-gm-status-tag" class="lc-gm-status-tag">Ready</span>
            </div>
            <div class="lc-gm-card-actions">
              <button id="lc-gm-minimize-btn" class="lc-gm-btn-icon" title="Minimize">–</button>
              <button id="lc-gm-close-btn" class="lc-gm-btn-icon" title="Close">✕</button>
            </div>
          </div>

          <div class="lc-gm-problem-row">
            <span id="lc-gm-problem-title" class="lc-gm-problem-title">Loading problem...</span>
            <span id="lc-gm-diff" class="lc-gm-diff-pill easy">Easy</span>
          </div>

          <div class="lc-gm-complexities">
            <div class="lc-gm-comp-pill time" title="Time Complexity">
              <span>⏱️ Time</span>
              <span id="lc-gm-time-val" class="lc-gm-comp-val">O(N)</span>
            </div>
            <div class="lc-gm-comp-pill space" title="Space Complexity">
              <span>💾 Space</span>
              <span id="lc-gm-space-val" class="lc-gm-comp-val">O(1)</span>
            </div>
          </div>

          <div class="lc-gm-folder-target">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>Destination: <code id="lc-gm-target-folder">problems/...</code></span>
          </div>

          <button type="button" id="lc-gm-sync-btn" class="lc-gm-sync-btn">
            <span id="lc-gm-sync-text">⚡ Sync to GitHub</span>
            <div id="lc-gm-spinner" class="lc-gm-spinner lc-hidden"></div>
          </button>

          <div id="lc-gm-status-msg" class="lc-gm-status-msg lc-hidden"></div>

          <div id="lc-gm-success-box" class="lc-gm-success-box lc-hidden">
            <span id="lc-gm-success-text">🎉 Pushed Solution 1</span>
            <a href="#" target="_blank" id="lc-gm-github-link" class="lc-gm-github-link">View on GitHub ↗</a>
          </div>
        </div>
      `;

      document.body.appendChild(this.rootEl);

      this.bubbleEl = this.rootEl.querySelector('#lc-gm-bubble');
      this.badgeEl = this.rootEl.querySelector('#lc-gm-badge');
      this.teaserEl = this.rootEl.querySelector('#lc-gm-teaser');
      this.cardEl = this.rootEl.querySelector('#lc-gm-card');
      this.syncBtn = this.rootEl.querySelector('#lc-gm-sync-btn');
      this.syncText = this.rootEl.querySelector('#lc-gm-sync-text');
      this.spinner = this.rootEl.querySelector('#lc-gm-spinner');
      this.statusMsg = this.rootEl.querySelector('#lc-gm-status-msg');
      this.successBox = this.rootEl.querySelector('#lc-gm-success-box');
      this.githubLink = this.rootEl.querySelector('#lc-gm-github-link');
    },

    bindEvents() {
      this.bubbleEl?.addEventListener('click', () => {
        this.toggleCard();
      });

      this.teaserEl?.addEventListener('click', (e) => {
        if (e.target.id === 'lc-gm-teaser-close') {
          this.teaserEl.classList.add('lc-hidden');
          return;
        }
        this.openCard();
      });

      this.rootEl.querySelector('#lc-gm-minimize-btn')?.addEventListener('click', () => {
        this.closeCard();
      });

      this.rootEl.querySelector('#lc-gm-close-btn')?.addEventListener('click', () => {
        this.closeCard();
      });

      this.syncBtn?.addEventListener('click', async () => {
        await this.handleUserSyncClick();
      });
    },

    onAccepted(payload) {
      this.pendingSubmission = payload;
      this.badgeEl?.classList.remove('lc-hidden');
      this.teaserEl?.classList.remove('lc-hidden');

      // Update card preview with current problem and scraped complexities
      this.refreshCardInfo();

      // Auto-dismiss teaser popup after 7 seconds, keeping the bubble indicator
      setTimeout(() => {
        if (!this.isOpen) {
          this.teaserEl?.classList.add('lc-hidden');
        }
      }, 7000);
    },

    async openCard() {
      this.isOpen = true;
      this.teaserEl?.classList.add('lc-hidden');
      this.cardEl?.classList.remove('lc-hidden');
      await this.refreshCardInfo();
    },

    closeCard() {
      this.isOpen = false;
      this.cardEl?.classList.add('lc-hidden');
    },

    toggleCard() {
      if (this.isOpen) {
        this.closeCard();
      } else {
        this.openCard();
      }
    },

    async refreshCardInfo() {
      const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
      const slug = match ? match[1] : this.currentSlug;
      if (!slug) return;

      const titleEl = this.rootEl.querySelector('#lc-gm-problem-title');
      const diffEl = this.rootEl.querySelector('#lc-gm-diff');
      const folderEl = this.rootEl.querySelector('#lc-gm-target-folder');
      const timeVal = this.rootEl.querySelector('#lc-gm-time-val');
      const spaceVal = this.rootEl.querySelector('#lc-gm-space-val');

      // Settings
      const settings = await chrome.storage.local.get(['folderPrefix']);
      const prefix = settings.folderPrefix || 'problems';

      // Question metadata
      const meta = await fetchQuestionMetadata(slug);
      const paddedId = String(meta.frontendId || '0').padStart(4, '0');
      const problemSlug = `${paddedId}-${slug}`;

      if (titleEl) titleEl.textContent = `${meta.frontendId ? `${meta.frontendId}. ` : ''}${meta.title || slug}`;
      if (diffEl) {
        diffEl.textContent = meta.difficulty || 'Medium';
        diffEl.className = `lc-gm-diff-pill ${(meta.difficulty || 'medium').toLowerCase()}`;
      }
      if (folderEl) folderEl.textContent = `${prefix}/${problemSlug}/`;

      // Complexity preview
      if (this.pendingSubmission?.code) {
        const comp = await ComplexityAnalyzer.analyze({
          code: this.pendingSubmission.code,
          lang: this.pendingSubmission.lang || 'python3',
          title: meta.title,
          titleSlug: slug
        });
        if (timeVal) timeVal.textContent = comp.timeComplexity || 'O(N)';
        if (spaceVal) spaceVal.textContent = comp.spaceComplexity || 'O(1)';
      } else {
        if (timeVal) timeVal.textContent = 'Auto (on Sync)';
        if (spaceVal) spaceVal.textContent = 'Auto (on Sync)';
      }
    },

    async handleUserSyncClick() {
      if (this.isSyncing) return;
      this.isSyncing = true;
      this.syncBtn.disabled = true;
      this.syncText.textContent = 'Syncing...';
      this.spinner?.classList.remove('lc-hidden');
      this.statusMsg?.classList.add('lc-hidden');
      this.successBox?.classList.add('lc-hidden');

      try {
        const result = await triggerSyncFromCurrentPage((progress) => {
          if (this.statusMsg) {
            this.statusMsg.textContent = progress;
            this.statusMsg.classList.remove('lc-hidden');
            this.statusMsg.classList.remove('error');
          }
        });

        if (!result || !result.success) {
          throw new Error(result?.error || 'Failed to sync solution.');
        }

        // Success state!
        this.syncText.textContent = `✓ Pushed Solution ${result.solutionNum || 1}`;
        this.badgeEl?.classList.add('lc-hidden');
        if (this.statusMsg) this.statusMsg.classList.add('lc-hidden');

        if (this.successBox) {
          this.successBox.classList.remove('lc-hidden');
          const successText = this.rootEl.querySelector('#lc-gm-success-text');
          if (successText) successText.textContent = `🎉 Solution ${result.solutionNum || 1} Pushed!`;
          if (this.githubLink && result.commitUrl) {
            this.githubLink.href = result.commitUrl;
          }
        }
      } catch (err) {
        console.error('[LeetCode Sync] Grammarly widget sync error:', err);
        if (this.statusMsg) {
          this.statusMsg.textContent = err.message || 'Error syncing solution.';
          this.statusMsg.className = 'lc-gm-status-msg error';
          this.statusMsg.classList.remove('lc-hidden');
        }
      } finally {
        this.isSyncing = false;
        this.syncBtn.disabled = false;
        this.spinner?.classList.add('lc-hidden');
        setTimeout(() => {
          if (!this.successBox || this.successBox.classList.contains('lc-hidden')) {
            this.syncText.textContent = '⚡ Sync to GitHub';
          }
        }, 3500);
      }
    }
  };

  // 1. Listen for messages and CustomEvents from inject.js
  const handleAcceptedEvent = (payload) => {
    if (!payload || !payload.code) return;
    const subId = payload.submissionId || `${payload.slug}-${Date.now()}`;
    if (processedSubmissions.has(subId)) return;
    processedSubmissions.add(subId);

    console.log('[LeetCode Sync] Accepted submission detected (ready for user to sync):', payload.slug);
    GrammarlyWidget.onAccepted(payload);
  };

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'LEETCODE_SYNC_ACCEPTED') {
      handleAcceptedEvent(event.data.payload);
    }
  });

  window.addEventListener('LeetCodeSync:Accepted', (e) => handleAcceptedEvent(e.detail));
  document.addEventListener('LeetCodeSync:Accepted', (e) => handleAcceptedEvent(e.detail));

  // 2. Fallback DOM MutationObserver for "Accepted" banner
  let lastDomCheckTimestamp = 0;
  const observer = new MutationObserver(() => {
    if (Date.now() - lastDomCheckTimestamp < 4000) return;

    // Check if "Accepted" appears in any submission result element
    const acceptedElements = Array.from(document.querySelectorAll('*')).filter(el => {
      return el.children.length === 0 && (el.innerText || el.textContent || '').trim() === 'Accepted';
    });

    for (const el of acceptedElements) {
      const container = el.closest('[data-e2e-locator="submission-result"], [class*="result"], [class*="submission"], div');
      if (container) {
        const text = container.innerText || '';
        if (/runtime/i.test(text) || /beats/i.test(text) || /memory/i.test(text) || /passed/i.test(text)) {
          lastDomCheckTimestamp = Date.now();
          console.log('[LeetCode Sync] DOM detected Accepted banner! Notifying Grammarly widget...');
          prepareAcceptedForWidget();
          break;
        }
      }
    }
  });

  async function prepareAcceptedForWidget() {
    const slugMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1];

    const subData = await fetchLatestAcceptedSubmission(slug);
    if (subData && subData.code) {
      GrammarlyWidget.onAccepted({ ...subData, slug });
    } else {
      const editorCode = await getCodeFromEditor();
      if (editorCode && editorCode.trim().length > 0) {
        const domMetrics = extractMetricsFromDOM();
        GrammarlyWidget.onAccepted({
          submissionId: `dom-${slug}-${Date.now()}`,
          code: editorCode,
          lang: detectLanguage(),
          runtime: domMetrics.runtime || '4 ms',
          runtimePercentile: domMetrics.runtimePercentile,
          memory: domMetrics.memory || '14.2 MB',
          memoryPercentile: domMetrics.memoryPercentile,
          slug,
          status: 'Accepted'
        });
      }
    }
  }

  function extractMetricsFromDOM() {
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

    return { runtime, memory, runtimePercentile, memoryPercentile };
  }

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
  async function triggerSyncFromCurrentPage(onProgress) {
    const slugMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    if (!slugMatch) {
      return { success: false, error: 'Could not detect problem slug from current URL.' };
    }
    const slug = slugMatch[1];

    const settings = await chrome.storage.local.get([
      'githubToken',
      'githubUsername',
      'repoName',
      'branch',
      'folderPrefix'
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

    // Step 1: Use pending submission from Grammarly widget if present, or fetch from LeetCode GraphQL
    let subData = null;
    if (GrammarlyWidget?.pendingSubmission && GrammarlyWidget.pendingSubmission.slug === slug) {
      console.log('[LeetCode Sync] Using captured accepted submission for:', slug);
      subData = GrammarlyWidget.pendingSubmission;
    } else {
      console.log('[LeetCode Sync] Checking LeetCode submission history for:', slug);
      subData = await fetchLatestAcceptedSubmission(slug);
    }

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
    const result = await handleAcceptedSubmission(payload, onProgress);
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
  async function handleAcceptedSubmission(submission, onProgress) {
    const settings = await chrome.storage.local.get([
      'githubToken',
      'githubUsername',
      'repoName',
      'branch',
      'folderPrefix'
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

    const username = settings.githubUsername;
    const repoName = (settings.repoName && settings.repoName !== 'Leetcode_Sync') ? settings.repoName : 'LeetCode-Solutions';
    const branch = settings.branch || 'main';
    const folderPrefix = settings.folderPrefix || 'problems';

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
        folderPrefix,
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
        onProgress: (status) => {
          updateToastStatus(status);
          if (onProgress) onProgress(status);
        }
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

  // Initialize Grammarly-style floating widget on problem pages & listen for SPA URL navigations
  function initGrammarlyWidget() {
    if (window.location.pathname.includes('/problems/')) {
      GrammarlyWidget.init();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrammarlyWidget);
  } else {
    initGrammarlyWidget();
  }

  // SPA Navigation listener (LeetCode uses Next.js / client-side routing)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      initGrammarlyWidget();
    }
  }, 1000);
})();
