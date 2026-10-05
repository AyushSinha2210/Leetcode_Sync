// Mock browser environment to test popup.js execution
global.document = {
  addEventListener: (event, handler) => {
    if (event === 'DOMContentLoaded') {
      setTimeout(handler, 10);
    }
  },
  querySelectorAll: (selector) => [],
  getElementById: (id) => ({
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {} },
    value: '',
    textContent: '',
    innerHTML: '',
    style: {}
  })
};

global.chrome = {
  storage: {
    local: {
      get: async (keys) => ({
        githubToken: 'ghp_mock_token',
        githubUsername: 'AyushSinha2210',
        repoName: 'Leetcode_Sync',
        branch: 'main',
        syncHistory: []
      }),
      set: async (obj) => {}
    }
  }
};

global.GitHubSync = {
  getUser: async () => ({ login: 'AyushSinha2210' }),
  ensureRepo: async () => {}
};

try {
  require('../popup/popup.js');
  console.log('✅ popup.js loaded and executed with ZERO syntax errors!');
} catch (err) {
  console.error('❌ Error executing popup.js:', err);
  process.exit(1);
}
