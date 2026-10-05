# ⚡ LeetCode Sync Pro

> **Automate pushing LeetCode solutions directly to your GitHub repository with automatic multi-solution versioning (`Solution 1`, `Solution 2`...) and real-time Time & Space Complexity analysis.**

---

## ✨ Highlights & Features

- 🚀 **Blazing Fast Browser Extension (Manifest V3)**  
  Runs directly in Chrome, Brave, Edge, and other Chromium browsers. Intercepts LeetCode network submissions in real-time with zero external servers or middleware required.

- 🔁 **Smart Multi-Solution Versioning (Repeated Questions)**  
  When you solve a question repeatedly (to optimize your code, practice again, or try another language):
  - Automatically detects previous attempts in the GitHub folder.
  - Names the files `Solution_1`, `Solution_2`, `Solution_3`, etc.
  - Updates the problem's `README.md` with a solutions comparison table comparing **Time Complexity**, **Space Complexity**, **Runtime**, and **Memory** across all attempts.

- ⏱️ **Direct LeetCode Complexity Scraper (No Model / No API Keys)**  
  Complexity is scraped directly from authentic LeetCode data:
  - **Live Submission DOM Scraping**: Automatically clicks and scrapes LeetCode's on-screen **"Analyze Complexity"** feature directly from the submission panel.
  - **Official Editorial Data Scraping**: Extracts verified Big-O Time & Space complexities from LeetCode's official problem solution articles via GraphQL.
  - **Zero External AI Models**: No Gemini, OpenAI, or API keys needed.
  - Complexity is documented in:
    1. **Code file header**: Injected docstring comment at the top of the file.
    2. **Problem `README.md`**: Solutions comparison table.
    3. **Git commit message**: e.g., `feat(0001-two-sum): add Solution 2 [Time: O(n), Space: O(n)]`.
    4. **Live floating HUD Toast**: Notification card right on LeetCode web.
    5. **Extension Popup**: Activity feed with complexity pills.

- 📊 **Automated Portfolio Dashboard**  
  Maintains a root `README.md` in your GitHub repository with live progress badges (Total Solved, Easy, Medium, Hard) and a master index table linking to all your solutions.

---

## 📁 Repository Structure

```
Leetcode_Sync/
├── manifest.json              # Chrome Extension Manifest V3
├── popup/
│   ├── popup.html             # Extension popup UI (Dashboard, Settings, Guide)
│   ├── popup.css              # Dark-mode styling with glassmorphism
│   └── popup.js               # Authentication, settings, and activity controller
├── scripts/
│   ├── inject.js              # Main-world script: hooks fetch/XHR & Monaco editor
│   ├── content.js             # Content script: handles Accepted events & floating HUD
│   ├── complexity.js          # Dual-engine Time & Space Complexity analyzer
│   ├── github.js              # GitHub REST API client (commits, multi-solution, READMEs)
│   └── background.js          # Service worker & badge management
├── styles/
│   └── toast.css              # Floating LeetCode HUD notification toast styles
├── icons/                     # Extension branding icons (16px, 32px, 48px, 128px, SVG)
└── tests/
    └── test-e2e-simulation.js # End-to-end pipeline verification test
```

---

## 🚀 Quick Setup (Under 60 Seconds)

### Step 1: Load the Extension into Your Browser
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions` in Edge, `brave://extensions` in Brave).
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the directory:  
   `C:\Users\AYUSH SINHA\Leetcode_Sync`
5. The **LeetCode Sync Pro** icon will appear in your browser extensions toolbar! (Pin it for easy access).

---

### Step 2: Configure Your GitHub Token
1. Click the **LeetCode Sync Pro** extension icon in your toolbar.
2. Switch to the **Settings** tab.
3. Click the **[Create Token ↗]** link, or go to:  
   👉 [https://github.com/settings/tokens/new?description=LeetCode-Sync&scopes=repo](https://github.com/settings/tokens/new?description=LeetCode-Sync&scopes=repo)
4. Ensure the **`repo`** scope checkbox is checked, and click **Generate token**.
5. Copy the generated token (`ghp_...`) and paste it into the **GitHub Personal Access Token** field in the extension popup.
6. The repository name defaults to `Leetcode-Sync`. (If the repo doesn't exist on your GitHub yet, the extension will **automatically create it for you**!).
7. Click **Save & Verify Connection**. You will see:  
   `✅ Connected successfully! Synced to username/Leetcode-Sync`

---

### Step 3: Zero Configuration for Complexity
- **No API keys or model setup required!**
- The extension automatically scrapes the official Big-O Time & Space Complexity directly from LeetCode's submission analysis and official problem solution data.

---

## 🎯 How It Works in Action

1. **Open LeetCode**: Go to any problem on [leetcode.com](https://leetcode.com/problems/two-sum/).
2. **Solve and Submit**: Write your solution and click **Submit**.
3. **Instant Auto-Sync**:
   - As soon as the submission status is **Accepted**, an animated toast HUD appears in the bottom-right corner.
   - It calculates **Time Complexity** (e.g. `O(N)`) and **Space Complexity** (e.g. `O(N)`).
   - It checks existing files in your GitHub repo for that problem.
   - **First attempt**: Creates `0001-two-sum/Solution_1.cpp`.
   - **Repeated attempt**: Creates `0001-two-sum/Solution_2.cpp`!
   - Updates the folder's `README.md` and repo dashboard.
   - The on-screen toast provides a direct link: **[View on GitHub ↗]**.

---

## 📄 Example GitHub Output

### Problem Folder (`0001-two-sum/`)

```
0001-two-sum/
├── README.md
├── Solution_1.cpp   <-- Brute Force (O(N^2))
└── Solution_2.cpp   <-- Optimized Hash Map (O(N))
```

#### Problem `README.md` Solutions Table:

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | C++ | `O(N^2)` | `O(1)` | 45 ms | 10.4 MB | 2026-10-05 |
| [Solution 2](./Solution_2.cpp) | C++ | `O(N)` | `O(N)` | 4 ms | 14.2 MB | 2026-10-05 |

#### Generated Code Header:

```cpp
/**
 * ============================================================================
 * Problem: 1. Two Sum
 * Link: https://leetcode.com/problems/two-sum/
 * Difficulty: Easy
 * Language: cpp
 * Submission: Solution 2
 *
 * ⏱️ Time Complexity:  O(N)
 * 💾 Space Complexity: O(N)
 * 💡 Complexity Notes: Single pass using unordered_map for O(1) average lookup.
 *
 * 📊 Performance:
 * - Runtime: 4 ms (Beats 85.2%)
 * - Memory:  14.2 MB (Beats 78.1%)
 *
 * 📅 Solved: 2026-10-05 22:30:00
 * ============================================================================
 */

class Solution {
    // Your code here...
};
```

---

## 🧪 Verification & Testing

To run the end-to-end simulation from terminal:
```bash
node tests/test-e2e-simulation.js
```
