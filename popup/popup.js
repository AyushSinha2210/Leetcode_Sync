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

  // Load existing settings
  const settings = await chrome.storage.local.get([
    'githubToken',
    'githubUsername',
    'repoName',
    'branch',
    'syncHistory'
  ]);

  if (settings.githubToken) tokenInput.value = settings.githubToken;
  if (settings.repoName) repoInput.value = settings.repoName;
  if (settings.branch) branchInput.value = settings.branch;

  // Update UI with status and activity
  updateConnectionBadge(settings.githubUsername, settings.repoName);
  renderDashboard(settings.syncHistory || [], settings.githubUsername, settings.repoName);

  // Form submission: Save & Test Connection
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('', 'hidden');

    const token = tokenInput.value.trim();
    const repoName = repoInput.value.trim() || 'Leetcode-Sync';
    const branch = branchInput.value.trim() || 'main';

    if (!token) {
      showAlert('Please enter your GitHub Personal Access Token.', 'error');
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
        branch
      });
        geminiApiKey: geminiKey
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
        repoFullName.textContent = `${username}/${repoName || 'Leetcode-Sync'}`;
        repoLink.href = `https://github.com/${username}/${repoName || 'Leetcode-Sync'}`;
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
