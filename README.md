# ⚡ LeetCode Sync Pro

> **A modern, open-source Chrome Extension that tracks and syncs your LeetCode submissions to a dedicated GitHub repository — featuring a Grammarly-style floating widget, zero-model Time & Space complexity scraping, and multi-solution versioning.**

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![GitHub API](https://img.shields.io/badge/GitHub-REST%20API%20v3-181717?style=for-the-badge&logo=github&logoColor=white)](https://docs.github.com/en/rest)
[![No Model Required](https://img.shields.io/badge/Complexity%20Engine-Zero%20AI%20API%20Keys-10B981?style=for-the-badge&logo=speedtest&logoColor=white)](#-algorithmic-complexity-scraper)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

---

## 🌟 Why LeetCode Sync Pro?

Most LeetCode sync extensions automatically commit every passing run in the background, cluttering your GitHub timeline and creating messy root directories.

**LeetCode Sync Pro** gives you complete control and clean organization:
1. **No unwanted auto-pushes**: A sleek Grammarly-style floating badge notifies you when a solution is accepted. You review the Big-O metrics and click to sync only when you're satisfied.
2. **Dedicated Solutions Repository**: Your solved problems are kept completely separate from this extension source code, automatically pushed to your personal `LeetCode-Solutions` repository.
3. **Repeated Problem Versioning**: Tracks multiple approaches (`Solution 1`, `Solution 2`, `Solution 3`...) with automated comparison tables.

---

## ✨ Key Features

### 🟢 Grammarly-Style Floating Widget
- An unobtrusive circular bubble rests at the bottom-right of your LeetCode window.
- When your solution is accepted, it lights up with a green badge and teaser toast: *"Accepted! Click to sync to GitHub"*.
- Clicking it opens an elegant pop card displaying problem metadata, scraped Big-O complexities, destination path, and a one-click **⚡ Sync to GitHub** button.

### ⏱️ Algorithmic Complexity Scraper (Zero AI Models)
- Automatically extracts official **Time Complexity** ($\mathcal{O}(N)$, $\mathcal{O}(N \log N)$, etc.) and **Auxiliary Space Complexity** directly from LeetCode's submission data and official editorial analysis.
- **No external AI APIs or paid keys required** — runs 100% locally in your browser.

### 🔁 Multi-Solution Tracking
- Solved a problem with Brute Force first, then optimized with a Hash Map or Two Pointers?
- The extension automatically detects repeated submissions for the same problem and saves them sequentially:
  ```text
  problems/0001-two-sum/
  ├── README.md        <-- Problem description & comparison table
  ├── Solution_1.cpp   <-- Brute Force (O(N^2) Time, O(1) Space)
  └── Solution_2.cpp   <-- Hash Map (O(N) Time, O(N) Space)
  ```

### 📁 Clean, Uncluttered Repository Architecture
- Problems are neatly organized inside a configurable subfolder (default `problems/XXXX-slug/`).
- The root of your solutions repository maintains an interactive dashboard `README.md` with problem badges, links, and difficulty counters.

### 🛡️ 100% Private & Secure
- Your GitHub Personal Access Token is stored strictly inside Chrome's sandboxed `chrome.storage.local`.
- No third-party servers, no analytics, no tracking.

---

## 🚀 Quick Start (Installation)

### 1. Clone or Fork this Repository
```bash
git clone https://github.com/AyushSinha2210/Leetcode_Sync.git
cd Leetcode_Sync
```

### 2. Load into Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `Leetcode_Sync` directory.

### 3. Configure Your GitHub Token
1. Click the **LeetCode Sync Pro** icon in your Chrome toolbar.
2. Go to the **Settings** tab.
3. Enter your **GitHub Personal Access Token** ([Generate token with `repo` scope](https://github.com/settings/tokens/new?description=LeetCode-Sync-Pro&scopes=repo)).
4. Specify your preferred solutions repository (defaults to `LeetCode-Solutions`).
5. Click **Save & Verify Connection**.
   > *Note:* If the repository does not exist on your GitHub account, the extension will **automatically create it for you**!

### 4. Solve & Sync!
1. Open any problem on [LeetCode](https://leetcode.com/problems/two-sum/).
2. Submit your code.
3. When accepted, click the floating widget in the bottom-right corner to preview metrics and push!

---

## 📂 Project Architecture

```text
Leetcode_Sync/
├── manifest.json          # Chrome Extension Manifest V3 configuration
├── popup/
│   ├── popup.html         # Settings, dashboard & connection manager UI
│   ├── popup.css          # Glassmorphic dark theme styles
│   └── popup.js           # Settings persistence, validation & stats logic
├── scripts/
│   ├── background.js      # Service worker for extension lifecycle
│   ├── complexity.js      # Algorithmic complexity parser & scraper
│   ├── content.js         # Grammarly widget DOM controller & page coordinator
│   ├── github.js          # GitHub REST API client (commits, multi-solution versioning)
│   └── inject.js          # Injected hook to capture LeetCode submission events
├── styles/
│   └── toast.css          # Floating Grammarly bubble, pop card & toast styles
└── tests/
    ├── validate-extension.js
    ├── test-scraper.js
    └── test-popup-runtime.js
```

---

## 🛠️ Development & Testing

To test the extension components locally:
```bash
# Validate manifest integrity and file references
node tests/validate-extension.js

# Test Big-O complexity scraper logic
node tests/test-scraper.js

# Verify popup runtime safety
node tests/test-popup-runtime.js
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the [issues page](https://github.com/AyushSinha2210/Leetcode_Sync/issues).

1. Fork the Project (`https://github.com/AyushSinha2210/Leetcode_Sync/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
