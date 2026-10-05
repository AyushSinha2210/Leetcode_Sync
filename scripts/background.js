/**
 * LeetCode Sync - Background Service Worker
 * Manages extension lifecycle, storage defaults, and badge status.
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[LeetCode Sync] Extension installed/updated:', details.reason);

  const existing = await chrome.storage.local.get([
    'repoName',
    'branch',
    'enableAI',
    'syncHistory'
  ]);

  const updates = {};
  if (!existing.repoName) updates.repoName = 'Leetcode_Sync';
  if (!existing.branch) updates.branch = 'main';
  if (!existing.githubUsername) updates.githubUsername = 'AyushSinha2210';
  if (!existing.syncHistory) updates.syncHistory = [];

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  updateBadge();
});

// Update badge count whenever sync history changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.syncHistory) {
    updateBadge();
  }
});

async function updateBadge() {
  try {
    const { syncHistory = [] } = await chrome.storage.local.get('syncHistory');
    const count = syncHistory.length;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald green
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    // Ignore badge errors
  }
}
