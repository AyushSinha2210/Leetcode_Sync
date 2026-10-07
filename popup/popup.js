/**
 * LeetCode Sync - Popup Controller
 * Manages dashboard metrics, settings persistence, connection validation, and activity history.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const statusBadge = document.getElementById('connection-status-badge');
  const statusText = document.getElementById('status-text');
  const repoBanner = document.getElementById('repo-banner');
  const repoFullName = document.getElementById('repo-full-name');
  const repoLink = document.getElementById('repo-link');

  // Stats elements
  const totalCountEl = document.getElementById('total-count');
  const easyCountEl = document.getElementById('easy-count');
  const mediumCountEl = document.getElementById('medium-count');
  const hardCountEl = document.getElementById('hard-count');
  const activityListEl = document.getElementById('activity-list');
  const activityCountEl = document.getElementById('activity-count');

  // Form elements
  const form = document.getElementById('settings-form');
  const tokenInput = document.getElementById('github-token');
  const toggleTokenBtn = document.getElementById('toggle-token-visibility');
  const repoInput = document.getElementById('repo-name');
  const branchInput = document.getElementById('branch-name');
  const folderPrefixInput = document.getElementById('folder-prefix');
  const saveBtn = document.getElementById('save-btn');
  const saveBtnText = document.getElementById('save-btn-text');
  const saveSpinner = document.getElementById('save-spinner');
  const alertBox = document.getElementById('alert-box');

  // Tab switching
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // Toggle token input visibility
  toggleTokenBtn.addEventListener('click', () => {
    if (tokenInput.type === 'password') {
      tokenInput.type = 'text';
      toggleTokenBtn.textContent = '🔒';
    } else {
      tokenInput.type = 'password';
      toggleTokenBtn.textContent = '👁️';
    }
  });

  /**
   * Ensure content scripts and main-world hooks are injected in the active tab
   */
  async function ensureTabScripts(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (res && res.pong) return true;
    } catch (e) {
      // Content script not yet active on tab, inject programmatically
    }

    // Check if chrome.scripting is available in the current extension runtime
    if (!chrome.scripting || !chrome.scripting.executeScript) {
      throw new Error('Permissions update needed: Please go to chrome://extensions and click the ↻ (Reload) icon on LeetCode Sync Pro, then refresh your LeetCode tab.');
    }

    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['styles/toast.css']
      });
    } catch (e) {}

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'scripts/complexity.js',
        'scripts/github.js',
        'scripts/content.js'
      ]
    });

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['scripts/inject.js']
      });
    } catch (e) {}

    // Allow 200ms for event listeners to bind
    await new Promise(r => setTimeout(r, 200));
    return true;
  }

  // Manual Sync Button
  const manualSyncBtn = document.getElementById('manual-sync-btn');
  const manualSyncText = document.getElementById('manual-sync-text');
  const manualSyncSpinner = document.getElementById('manual-sync-spinner');

  manualSyncBtn?.addEventListener('click', async () => {
    manualSyncBtn.disabled = true;
    manualSyncText.textContent = 'Checking settings...';
    manualSyncSpinner?.classList.remove('hidden');
    showAlert('', 'hidden');

    try {
      // 1. Verify token is configured
      const settings = await chrome.storage.local.get([
        'githubToken',
        'githubUsername',
        'repoName',
        'branch',
        'folderPrefix'
      ]);

      if (!settings.githubToken) {
        showAlert('Please enter and save your GitHub Personal Access Token in Settings first!', 'error');
        const settingsTabBtn = document.querySelector('[data-tab="settings-tab"]');
        if (settingsTabBtn) settingsTabBtn.click();
        return;
      }

      // 2. Query active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || (!tab.url.includes('leetcode.com/problems/') && !tab.url.includes('leetcode.cn/problems/'))) {
        showAlert('Please open an active LeetCode problem tab (e.g. leetcode.com/problems/two-sum/) to sync.', 'error');
        return;
      }

      // 3. Ensure content scripts are active on the tab
      manualSyncText.textContent = 'Connecting to tab...';
      await ensureTabScripts(tab.id);

      // 4. Send sync request to content script
      manualSyncText.textContent = 'Scraping & Pushing...';
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'SYNC_CURRENT_PAGE' });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to sync. Please make sure you have submitted the question on LeetCode first.');
      }

      manualSyncText.textContent = `⚡ Pushed Solution ${response.solutionNum || 1}!`;
      showAlert(`🎉 Successfully synced "${response.title || 'problem'}" (Solution ${response.solutionNum || 1}) to ${settings.githubUsername || 'your repo'}/${settings.repoName || 'LeetCode-Solutions'}!`, 'success');

      // Refresh dashboard view with updated activity
      const { syncHistory = [] } = await chrome.storage.local.get('syncHistory');
      renderDashboard(syncHistory, settings.githubUsername || '', settings.repoName || 'LeetCode-Solutions');

    } catch (e) {
      console.warn('[LeetCode Sync] Manual sync message error:', e);
      showAlert(`Sync failed: ${e.message || 'Could not trigger sync on tab.'}`, 'error');
    } finally {
      manualSyncBtn.disabled = false;
      manualSyncSpinner?.classList.add('hidden');
      setTimeout(() => {
        manualSyncText.textContent = '⚡ Sync Current LeetCode Solution';
      }, 4000);
    }
  });

  // Load existing settings
  const settings = await chrome.storage.local.get([
    'githubToken',
    'githubUsername',
    'repoName',
    'branch',
    'folderPrefix',
    'syncHistory'
  ]);

  const activeToken = settings.githubToken || '';
  const activeUser = settings.githubUsername || '';
  const isDefaultOrOld = !settings.repoName || settings.repoName.toLowerCase() === 'leetcode_sync';
  const activeRepo = isDefaultOrOld ? 'LeetCode-Solutions' : settings.repoName;
  const activeBranch = settings.branch || 'main';
  const activeFolderPrefix = settings.folderPrefix || 'problems';

  if (isDefaultOrOld) {
    chrome.storage.local.set({ repoName: 'LeetCode-Solutions' }).catch(() => {});
  }

  if (activeToken) tokenInput.value = activeToken;
  repoInput.value = activeRepo;
  branchInput.value = activeBranch;
  if (folderPrefixInput) folderPrefixInput.value = activeFolderPrefix;

  // Update UI with status and activity
  updateConnectionBadge(activeToken ? activeUser : null, activeRepo);
  renderDashboard(settings.syncHistory || [], activeUser, activeRepo);

  // Form submission: Save & Test Connection
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('', 'hidden');

    const token = tokenInput.value.trim();
    const repoName = repoInput.value.trim() || 'LeetCode-Solutions';
    const branch = branchInput.value.trim() || 'main';
    const folderPrefix = (folderPrefixInput?.value || 'problems').trim() || 'problems';

    if (!token) {
      showAlert('Please enter your Personal Access Token.', 'error');
      return;
    }

    // Set loading state
    saveBtn.disabled = true;
    saveBtnText.textContent = 'Verifying connection...';
    saveSpinner.classList.remove('hidden');

    try {
      // 1. Test GitHub Authentication
      const user = await GitHubSync.getUser(token);
      const username = user.login;

      // 2. Test / Ensure Repository exists
      saveBtnText.textContent = 'Checking repository...';
      await GitHubSync.ensureRepo(token, username, repoName);

      // Save to chrome.storage.local
      await chrome.storage.local.set({
        githubToken: token,
        githubUsername: username,
        repoName,
        branch,
        folderPrefix
      });

      showAlert(`Connected successfully! Synced to ${username}/${repoName}`, 'success');
      updateConnectionBadge(username, repoName);
      
      const { syncHistory = [] } = await chrome.storage.local.get('syncHistory');
      renderDashboard(syncHistory, username, repoName);

    } catch (err) {
      console.error('[LeetCode Sync] Connection test error:', err);
      showAlert(`Connection failed: ${err.message}`, 'error');
      updateConnectionBadge(null, null);
    } finally {
      saveBtn.disabled = false;
      saveBtnText.textContent = 'Save & Verify Connection';
      saveSpinner.classList.add('hidden');
    }
  });

  function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = `alert-box ${type}`;
    if (type === 'hidden') alertBox.classList.add('hidden');
  }

  function updateConnectionBadge(username, repoName) {
    if (username) {
      statusBadge.className = 'status-badge connected';
      statusText.textContent = `@${username}`;
      if (repoBanner && repoFullName && repoLink) {
        repoBanner.classList.remove('hidden');
        repoFullName.textContent = `${username}/${repoName || 'LeetCode-Solutions'}`;
        repoLink.href = `https://github.com/${username}/${repoName || 'LeetCode-Solutions'}`;
      }
    } else {
      statusBadge.className = 'status-badge disconnected';
      statusText.textContent = 'Disconnected';
      if (repoBanner) repoBanner.classList.add('hidden');
    }
  }

  function renderDashboard(history, username, repoName) {
    activityCountEl.textContent = String(history.length);
    totalCountEl.textContent = String(history.length);

    let easy = 0, med = 0, hard = 0;
    history.forEach(item => {
      const d = (item.difficulty || '').toLowerCase();
      if (d === 'easy') easy++;
      else if (d === 'medium') med++;
      else if (d === 'hard') hard++;
    });

    easyCountEl.textContent = String(easy);
    mediumCountEl.textContent = String(med);
    hardCountEl.textContent = String(hard);

    if (!history || history.length === 0) {
      activityListEl.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <p>No synced problems yet.</p>
          <span>Solve and submit any problem on LeetCode to see it automatically appear here!</span>
        </div>
      `;
      return;
    }

    activityListEl.innerHTML = history.map(item => {
      const diffClass = (item.difficulty || 'easy').toLowerCase();
      const solBadge = item.solutionNum ? `<span class="activity-sol-badge">Solution ${item.solutionNum}</span>` : '';
      const timeBadge = item.timeComplexity ? `<span class="pill-time" title="Time Complexity">${item.timeComplexity}</span>` : '';
      const spaceBadge = item.spaceComplexity ? `<span class="pill-space" title="Space Complexity">${item.spaceComplexity}</span>` : '';
      const link = item.commitUrl || (username && repoName ? `https://github.com/${username}/${repoName}` : '#');

      return `
        <div class="activity-item">
          <div class="activity-top">
            <span class="activity-title">${item.frontendId ? `${item.frontendId}. ` : ''}${item.title}</span>
            ${solBadge}
          </div>
          <div class="activity-meta">
            <span class="pill-diff ${diffClass}">${item.difficulty || 'Easy'}</span>
            ${timeBadge}
            ${spaceBadge}
            <a href="${link}" target="_blank" class="activity-link" title="Open on GitHub">↗</a>
          </div>
        </div>
      `;
    }).join('');
  }
});
