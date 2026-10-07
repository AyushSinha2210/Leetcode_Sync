# ⚡ LeetCode Sync Pro

> **A high-performance, open-source Chrome Extension (Manifest V3) that syncs your accepted LeetCode solutions directly to a dedicated GitHub repository — featuring a Grammarly-style floating widget, zero-model Time & Space complexity scraping, and multi-solution versioning.**

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![GitHub API](https://img.shields.io/badge/GitHub-REST%20API%20v3-181717?style=for-the-badge&logo=github&logoColor=white)](https://docs.github.com/en/rest)
[![No AI API Key](https://img.shields.io/badge/Complexity%20Engine-Zero%20AI%20Keys-10B981?style=for-the-badge&logo=speedtest&logoColor=white)](#-zero-model-complexity-scraper)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

---

## 💡 Why LeetCode Sync Pro?

Most existing LeetCode sync extensions automatically commit every passing run in the background, polluting your git commits and cluttering repository root directories.

**LeetCode Sync Pro** is built for developers who want complete control, clean repositories, and deep insights:
- 🟢 **No Annoying Auto-Pushes**: A floating Grammarly-style widget appears on your LeetCode problem page when a submission is accepted. You preview your Big-O complexity and choose when to sync with a single click.
- 📁 **Dedicated Solutions Repository**: Keeps this extension source code completely clean and pushes your solved code to a dedicated repository (`LeetCode-Solutions`) on your GitHub.
- ⏱️ **Free Complexity Analysis**: Scrapes official Big-O Time ($\mathcal{O}(N)$, $\mathcal{O}(N \log N)$) and Auxiliary Space Complexity directly from LeetCode data — **no external AI APIs, OpenAI keys, or subscriptions needed**.
- 🔁 **Multi-Solution Tracking**: Solved a problem using Brute Force first, then optimized with a Hash Map or Two Pointers? The extension detects repeat submissions and automatically commits `Solution_1`, `Solution_2`, `Solution_3`... while generating a comparison matrix in `README.md`.

---

## 🚀 60-Second Quick Start

You can load and use this extension in Google Chrome in less than a minute:

### 1. Clone or Download this Repository
```bash
git clone https://github.com/AyushSinha2210/Leetcode_Sync.git
cd Leetcode_Sync
```
*(Or click **Code** → **Download ZIP** on GitHub and extract the folder).*

### 2. Load into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select this `Leetcode_Sync` folder.

### 3. Connect Your GitHub Account
1. Click the **LeetCode Sync Pro** icon in your Chrome toolbar.
2. Go to the **Settings** tab.
3. Enter your **GitHub Personal Access Token** ([Create a token with `repo` scope here](https://github.com/settings/tokens/new?description=LeetCode-Sync-Pro&scopes=repo)).
4. Leave the default repository as `LeetCode-Solutions` (or customize it).
5. Click **Save & Verify Connection**.
   > **Note:** If the repository does not exist on your GitHub account, the extension will **automatically create it for you**!

### 4. Solve & Sync on LeetCode
1. Open any problem on [LeetCode](https://leetcode.com/problems/two-sum/).
2. Write and submit your solution.
3. When LeetCode accepts your code, notice the floating circular bubble in the bottom-right corner!
4. Click the bubble to inspect the scraped Time & Space complexity and click **⚡ Sync to GitHub**.

---

## ✨ Feature Deep-Dive

### 🟢 Grammarly-Style Floating Widget
- An unobtrusive circular bubble floats quietly in the bottom-right corner of problem pages.
- When your solution is accepted:
  - The bubble displays a green checkmark badge.
  - A subtle speech-bubble teaser appears: *"Accepted! Click to sync to GitHub"*.
  - Clicking it expands a pop card with problem title, difficulty tag, scraped Big-O complexity, destination folder, and the **⚡ Sync to GitHub** button.

### ⏱️ Zero-Model Complexity Scraper
- Extracts algorithmic Time & Space complexity from:
  1. LeetCode submission metrics and runtime distributions.
  2. Official LeetCode editorial data and algorithmic approach breakdowns.
  3. Client-side AST and pattern matching fallback.
- **100% Free & Local**: No external LLM calls or API charges.

### 🔁 Multi-Solution Architecture
Whenever you re-solve an already solved problem, the extension:
1. Inspects the problem directory in your `LeetCode-Solutions` repository.
2. Identifies the highest solution index (`Solution_1.cpp`, `Solution_2.cpp`, etc.).
3. Increments the index and commits `Solution_N.ext`.
4. Appends the new approach to the problem's `README.md` comparison table:

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | cpp | `O(n^2)` | `O(1)` | 45 ms | 10.4 MB | 2026-10-07 |
| [Solution 2](./Solution_2.cpp) | cpp | `O(n)` | `O(n)` | 4 ms | 14.2 MB | 2026-10-07 |

---

## 📁 Repository Structure

```text
Leetcode_Sync/
├── manifest.json              # Chrome Extension Manifest V3
├── package.json               # Development scripts & test runner
├── LICENSE                    # MIT License
├── README.md                  # This documentation
├── icons/                     # Extension branding icons (16, 32, 48, 128px)
├── popup/
│   ├── popup.html             # Glassmorphic settings & dashboard modal
│   ├── popup.css              # Dark theme design system
│   └── popup.js               # GitHub PAT verification & dashboard logic
├── scripts/
│   ├── background.js          # Service worker for extension lifecycle
│   ├── complexity.js          # Zero-model algorithmic Big-O scraper
│   ├── content.js             # Grammarly floating widget DOM controller
│   ├── github.js              # GitHub REST API client & multi-solution engine
│   ├── inject.js              # Injected main-world network interceptor
│   └── sync-solutions-repo.js # Migration helper for previous problems
├── styles/
│   └── toast.css              # Floating bubble, pop card & notification styles
└── tests/
    ├── validate-extension.js  # Manifest V3 asset & reference validation
    ├── test-scraper.js        # Complexity extraction test suite
    ├── test-popup-runtime.js  # Popup controller runtime safety test
    └── test-e2e-simulation.js # Multi-solution simulation pipeline test
```

---

## 🛡️ Security & Privacy

- **Local Storage Only**: Your GitHub Personal Access Token is saved strictly inside Chrome's sandboxed `chrome.storage.local`.
- **Direct GitHub API**: API requests are dispatched directly from your browser to `api.github.com`.
- **Zero Third-Party Servers**: No intermediate proxy servers, tracking pixels, or data collection.

---

## 🛠️ Testing & Quality Assurance

To run the automated validation test suite:
```bash
npm test
```
Or run the full end-to-end simulation:
```bash
npm run test:all
```

---

## 🤝 Contributing & Forking

This project is open-source and welcoming to contributions! If you'd like to customize the extension:

1. **Fork the repository** on GitHub.
2. Clone your fork locally (`git clone https://github.com/<your-username>/Leetcode_Sync.git`).
3. Create a feature branch (`git checkout -b feature/my-cool-feature`).
4. Commit your changes (`git commit -m 'feat: add my feature'`).
5. Push to your branch and submit a **Pull Request**.

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
