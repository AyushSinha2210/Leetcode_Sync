/**
 * LeetCode Sync - GitHub Sync Engine
 * Handles direct GitHub REST API operations:
 * - Token verification & user discovery
 * - Automatic repository creation if missing
 * - Multi-solution detection (Solution_1, Solution_2, Solution_3...)
 * - Commits solution files, updates problem README.md, and maintains root stats dashboard
 */

const LANG_CONFIG = {
  python: { ext: 'py', commentType: 'hash' },
  python3: { ext: 'py', commentType: 'hash' },
  cpp: { ext: 'cpp', commentType: 'block' },
  'c++': { ext: 'cpp', commentType: 'block' },
  java: { ext: 'java', commentType: 'block' },
  c: { ext: 'c', commentType: 'block' },
  csharp: { ext: 'cs', commentType: 'block' },
  'c#': { ext: 'cs', commentType: 'block' },
  javascript: { ext: 'js', commentType: 'block' },
  typescript: { ext: 'ts', commentType: 'block' },
  golang: { ext: 'go', commentType: 'block' },
  go: { ext: 'go', commentType: 'block' },
  rust: { ext: 'rs', commentType: 'block' },
  kotlin: { ext: 'kt', commentType: 'block' },
  swift: { ext: 'swift', commentType: 'block' },
  ruby: { ext: 'rb', commentType: 'hash' },
  scala: { ext: 'scala', commentType: 'block' },
  php: { ext: 'php', commentType: 'block' },
  racket: { ext: 'rkt', commentType: 'semi' },
  erlang: { ext: 'erl', commentType: 'percent' },
  elixir: { ext: 'ex', commentType: 'hash' },
  dart: { ext: 'dart', commentType: 'block' },
  sql: { ext: 'sql', commentType: 'dash' },
  mysql: { ext: 'sql', commentType: 'dash' },
  mssql: { ext: 'sql', commentType: 'dash' },
  oraclesql: { ext: 'sql', commentType: 'dash' },
  postgresql: { ext: 'sql', commentType: 'dash' }
};

const GitHubSync = {
  /**
   * Safe base64 encoding that supports UTF-8 and unicode code strings
   */
  encodeBase64(str) {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    return Buffer.from(str, 'utf-8').toString('base64');
  },

  /**
   * Safe base64 decoding for UTF-8
   */
  decodeBase64(b64) {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
    }
    return Buffer.from(b64.replace(/\n/g, ''), 'base64').toString('utf-8');
  },

  /**
   * Helper to perform GitHub REST API calls
   */
  async request(endpoint, token, options = {}) {
    const url = endpoint.startsWith('https://') ? endpoint : `https://api.github.com${endpoint}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token.trim()}`,
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, { ...options, headers });
    return res;
  },

  /**
   * Verify GitHub Token and get user profile
   */
  async getUser(token) {
    const res = await this.request('/user', token);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub Auth failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * Ensure target repository exists, create it automatically if not
   */
  async ensureRepo(token, username, repoName) {
    const getRes = await this.request(`/repos/${username}/${repoName}`, token);
    if (getRes.ok) {
      return getRes.json();
    }

    if (getRes.status === 404) {
      console.log(`[LeetCode Sync] Repo "${repoName}" not found. Creating it now...`);
      const createRes = await this.request('/user/repos', token, {
        method: 'POST',
        body: {
          name: repoName,
          description: 'LeetCode Solutions automatically synced with LeetCode Sync (Multi-solution & Time Complexity tracking)',
          private: false,
          auto_init: true
        }
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(`Failed to create repository "${repoName}": ${err.message || createRes.statusText}`);
      }

      // Allow 1.5 seconds for GitHub to initialize branch
      await new Promise(r => setTimeout(r, 1500));
      return createRes.json();
    }

    throw new Error(`Error accessing repository ${repoName}: ${getRes.statusText}`);
  },

  /**
   * Check problem folder on GitHub and determine next solution index
   * (e.g. Solution 1, Solution 2, Solution 3...)
   */
  async getNextSolutionNumber(token, username, repoName, folderPath, branch = 'main') {
    let res = await this.request(`/repos/${username}/${repoName}/contents/${folderPath}?ref=${branch}`, token);
    
    // If not found in subfolder (e.g. problems/0001-two-sum), check if it was previously at root (0001-two-sum)
    if (res.status === 404 && folderPath.includes('/')) {
      const rootSlug = folderPath.split('/').pop();
      const legacyRes = await this.request(`/repos/${username}/${repoName}/contents/${rootSlug}?ref=${branch}`, token);
      if (legacyRes.ok) {
        res = legacyRes;
      }
    }

    if (res.status === 404 || !res.ok) {
      return { nextNum: 1, existingFiles: [], readmeSha: null, readmeContent: null };
    }

    const files = await res.json();
    if (!Array.isArray(files)) {
      return { nextNum: 1, existingFiles: [], readmeSha: null, readmeContent: null };
    }

    let maxNum = 0;
    let readmeSha = null;
    let readmeContent = null;

    for (const file of files) {
      if (file.name.toLowerCase() === 'readme.md') {
        readmeSha = file.sha;
        try {
          const rRes = await this.request(file.url, token);
          if (rRes.ok) {
            const rData = await rRes.json();
            readmeContent = this.decodeBase64(rData.content);
          }
        } catch (e) {
          console.warn('[LeetCode Sync] Error reading existing problem README:', e);
        }
        continue;
      }

      // Check for Solution_N or SolutionN or Solution.ext
      const match = file.name.match(/solution[_-]?(\d+)\.[a-zA-Z0-9]+/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      } else if (/^solution\.[a-zA-Z0-9]+/i.test(file.name)) {
        if (maxNum < 1) maxNum = 1;
      }
    }

    const nextNum = maxNum + 1;
    return { nextNum, existingFiles: files, readmeSha, readmeContent };
  },

  /**
   * Create comment header with Time & Space Complexity and Problem Metadata
   */
  formatCodeWithHeader({
    code,
    lang,
    title,
    frontendId,
    difficulty,
    titleSlug,
    solutionNum,
    timeComplexity,
    spaceComplexity,
    explanation,
    runtime,
    runtimePercentile,
    memory,
    memoryPercentile,
    timestamp
  }) {
    const config = LANG_CONFIG[lang.toLowerCase()] || { ext: 'txt', commentType: 'block' };
    const dateStr = timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const link = `https://leetcode.com/problems/${titleSlug}/`;

    const runtimeText = runtime ? `${runtime}${runtimePercentile ? ` (Beats ${Number(runtimePercentile).toFixed(1)}%)` : ''}` : 'N/A';
    const memoryText = memory ? `${memory}${memoryPercentile ? ` (Beats ${Number(memoryPercentile).toFixed(1)}%)` : ''}` : 'N/A';

    if (config.commentType === 'hash') {
      return `# ============================================================================
# Problem: ${frontendId ? `${frontendId}. ` : ''}${title}
# Link: ${link}
# Difficulty: ${difficulty || 'N/A'}
# Language: ${lang}
# Submission: Solution ${solutionNum}
#
# ⏱️ Time Complexity:  ${timeComplexity}
# 💾 Space Complexity: ${spaceComplexity}
# 💡 Complexity Notes: ${explanation}
#
# 📊 Performance:
# - Runtime: ${runtimeText}
# - Memory:  ${memoryText}
#
# 📅 Solved: ${dateStr}
# ============================================================================

${code}
`;
    }

    if (config.commentType === 'dash') {
      return `-- ============================================================================
-- Problem: ${frontendId ? `${frontendId}. ` : ''}${title}
-- Link: ${link}
-- Difficulty: ${difficulty || 'N/A'}
-- Language: ${lang}
-- Submission: Solution ${solutionNum}
--
-- ⏱️ Time Complexity:  ${timeComplexity}
-- 💾 Space Complexity: ${spaceComplexity}
-- 💡 Complexity Notes: ${explanation}
--
-- 📊 Performance:
-- - Runtime: ${runtimeText}
-- - Memory:  ${memoryText}
--
-- 📅 Solved: ${dateStr}
-- ============================================================================

${code}
`;
    }

    // Default: C-style block comment
    return `/**
 * ============================================================================
 * Problem: ${frontendId ? `${frontendId}. ` : ''}${title}
 * Link: ${link}
 * Difficulty: ${difficulty || 'N/A'}
 * Language: ${lang}
 * Submission: Solution ${solutionNum}
 *
 * ⏱️ Time Complexity:  ${timeComplexity}
 * 💾 Space Complexity: ${spaceComplexity}
 * 💡 Complexity Notes: ${explanation}
 *
 * 📊 Performance:
 * - Runtime: ${runtimeText}
 * - Memory:  ${memoryText}
 *
 * 📅 Solved: ${dateStr}
 * ============================================================================
 */

${code}
`;
  },

  /**
   * Generate or update problem README.md with solutions comparison table
   */
  generateProblemReadme({
    existingReadme,
    title,
    frontendId,
    difficulty,
    titleSlug,
    questionHtml,
    topicTags = [],
    solutionNum,
    filename,
    lang,
    timeComplexity,
    spaceComplexity,
    runtime,
    memory,
    timestamp
  }) {
    const dateStr = (timestamp || new Date().toISOString()).substring(0, 10);
    const link = `https://leetcode.com/problems/${titleSlug}/`;
    const solutionRow = `| [Solution ${solutionNum}](./${filename}) | ${lang} | \`${timeComplexity}\` | \`${spaceComplexity}\` | ${runtime || 'N/A'} | ${memory || 'N/A'} | ${dateStr} |`;

    if (existingReadme && existingReadme.includes('### Solutions')) {
      // Append row to existing solutions table
      if (existingReadme.includes(filename)) {
        return existingReadme; // Already has this file
      }
      return `${existingReadme.trim()}\n${solutionRow}\n`;
    }

    // Convert LeetCode HTML content to clean readable Markdown
    let cleanContent = questionHtml || '';
    cleanContent = cleanContent
      .replace(/<pre>/gi, '\n```\n')
      .replace(/<\/pre>/gi, '\n```\n')
      .replace(/<code>/gi, '`')
      .replace(/<\/code>/gi, '`')
      .replace(/<strong>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<em>/gi, '*')
      .replace(/<\/em>/gi, '*')
      .replace(/<p>/gi, '\n\n')
      .replace(/<\/p>/gi, '')
      .replace(/<ul>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/<[^>]+>/g, '')
      .trim();

    const tagBadges = topicTags.map(t => `\`${t.name || t}\``).join(' ') || '`Algorithms`';
    const diffColor = difficulty === 'Easy' ? 'brightgreen' : difficulty === 'Medium' ? 'orange' : 'red';
    const diffBadge = `![Difficulty: ${difficulty}](https://img.shields.io/badge/Difficulty-${difficulty}-${diffColor})`;

    return `# ${frontendId ? `${frontendId}. ` : ''}${title}

${diffBadge}
**Tags:** ${tagBadges}  
**LeetCode Link:** [${title}](${link})

---

### Problem Description
${cleanContent || 'No description available.'}

---

### Solutions

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${solutionRow}
`;
  },

  /**
   * Update the repository's root README.md dashboard with overall solved statistics
   */
  async updateRootReadme(token, username, repoName, problemInfo, branch = 'main') {
    if (!repoName || repoName.toLowerCase() === 'leetcode_sync') {
      return; // Safety guard: never overwrite extension codebase README.md
    }
    let rootReadmeSha = null;
    let rootReadmeContent = '';

    try {
      const res = await this.request(`/repos/${username}/${repoName}/contents/README.md?ref=${branch}`, token);
      if (res.ok) {
        const data = await res.json();
        rootReadmeSha = data.sha;
        rootReadmeContent = this.decodeBase64(data.content);
      }
    } catch (e) {
      console.warn('[LeetCode Sync] Could not fetch root README.md:', e);
    }

    const { frontendId, title, difficulty, folderName, folderPath, solutionNum, timeComplexity, spaceComplexity, lang } = problemInfo;
    const paddedId = String(frontendId || '0').padStart(4, '0');
    const targetFolder = folderPath || folderName;
    const folderLink = `[${title}](./${targetFolder})`;
    const solLink = `[Solution ${solutionNum}](./${targetFolder}/Solution_${solutionNum}.${LANG_CONFIG[lang.toLowerCase()]?.ext || 'txt'})`;

    let lines = rootReadmeContent ? rootReadmeContent.split('\n') : [];
    let problemRows = [];
    let inTable = false;

    // Parse existing problem rows from root README if available
    for (const line of lines) {
      if (line.includes('| # | Problem | Difficulty |')) {
        inTable = true;
        continue;
      }
      if (inTable) {
        if (line.trim().startsWith('| :---') || line.trim().startsWith('|:--')) continue;
        if (line.trim().startsWith('|') && line.includes('|')) {
          problemRows.push(line.trim());
        } else if (line.trim().length === 0) {
          // Keep parsing or break
        }
      }
    }

    // Map existing rows by ID
    const problemMap = new Map();
    for (const row of problemRows) {
      const parts = row.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        problemMap.set(parts[0], {
          id: parts[0],
          nameLink: parts[1],
          diff: parts[2],
          solutionLink: parts[3] || '',
          time: parts[4] || '',
          space: parts[5] || '',
          lang: parts[6] || ''
        });
      }
    }

    // Insert or update current problem
    problemMap.set(paddedId, {
      id: paddedId,
      nameLink: folderLink,
      diff: difficulty,
      solutionLink: solLink,
      time: `\`${timeComplexity}\``,
      space: `\`${spaceComplexity}\``,
      lang: lang
    });

    // Sort by problem ID
    const sortedProblems = Array.from(problemMap.values()).sort((a, b) => a.id.localeCompare(b.id));

    // Calculate statistics
    let easyCount = 0, mediumCount = 0, hardCount = 0;
    sortedProblems.forEach(p => {
      if (p.diff.toLowerCase() === 'easy') easyCount++;
      else if (p.diff.toLowerCase() === 'medium') mediumCount++;
      else if (p.diff.toLowerCase() === 'hard') hardCount++;
    });
    const totalSolved = sortedProblems.length;

    // Generate new root README content
    const updatedTable = sortedProblems.map(p => 
      `| ${p.id} | ${p.nameLink} | ${p.diff} | ${p.solutionLink} | ${p.time} | ${p.space} | ${p.lang} |`
    ).join('\n');

    const newRootReadme = `# ⚡ LeetCode Sync

> Automated LeetCode solution tracker with multi-solution versioning and Time & Space Complexity analysis.

[![Total Solved](https://img.shields.io/badge/Total%20Solved-${totalSolved}-brightgreen?style=for-the-badge&logo=leetcode)](https://leetcode.com)
[![Easy](https://img.shields.io/badge/Easy-${easyCount}-teal?style=for-the-badge)](https://leetcode.com)
[![Medium](https://img.shields.io/badge/Medium-${mediumCount}-orange?style=for-the-badge)](https://leetcode.com)
[![Hard](https://img.shields.io/badge/Hard-${hardCount}-red?style=for-the-badge)](https://leetcode.com)

---

### 📚 Solved Problems Dashboard

| # | Problem | Difficulty | Latest Solution | Time Complexity | Space Complexity | Language |
| :---: | :--- | :---: | :--- | :---: | :---: | :--- |
${updatedTable}

---
*Created automatically by [LeetCode Sync](https://github.com).*
`;

    // Commit updated root README
    await this.commitFile(
      token,
      username,
      repoName,
      'README.md',
      newRootReadme,
      `docs: update root progress dashboard [${totalSolved} Solved]`,
      branch,
      rootReadmeSha
    );
  },

  /**
   * Commit a single file to GitHub repository
   */
  async commitFile(token, username, repoName, path, content, message, branch = 'main', sha = null) {
    const body = {
      message,
      content: this.encodeBase64(content),
      branch
    };

    if (sha) {
      body.sha = sha;
    }

    const res = await this.request(`/repos/${username}/${repoName}/contents/${path}`, token, {
      method: 'PUT',
      body
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to commit "${path}": ${err.message || res.statusText}`);
    }

    return res.json();
  },

  /**
   * Master function: Push a solution to GitHub with automatic Solution 2/3 incrementing,
   * problem README update, and root dashboard update.
   */
  async pushSolution({
    token,
    username,
    repoName = 'LeetCode-Solutions',
    branch = 'main',
    folderPrefix = 'problems',
    code,
    lang,
    title,
    frontendId,
    difficulty,
    titleSlug,
    questionHtml,
    topicTags = [],
    timeComplexity,
    spaceComplexity,
    explanation,
    runtime,
    runtimePercentile,
    memory,
    memoryPercentile,
    onProgress
  }) {
    if (!token) throw new Error('GitHub Personal Access Token is required');
    if (!username) {
      const user = await this.getUser(token);
      username = user.login;
    }

    // Safety guard: Always push solutions to dedicated solutions repository, never the extension code repo
    if (!repoName || repoName.toLowerCase() === 'leetcode_sync') {
      repoName = 'LeetCode-Solutions';
    }

    onProgress?.('Verifying GitHub repository...');
    await this.ensureRepo(token, username, repoName);

    // Format clean subfolder path: e.g. problems/0001-two-sum
    const paddedId = String(frontendId || '0').padStart(4, '0');
    const problemSlug = `${paddedId}-${titleSlug || 'unknown-problem'}`;
    const cleanPrefix = (folderPrefix || 'problems').replace(/^\/+|\/+$/g, '');
    const folderPath = cleanPrefix ? `${cleanPrefix}/${problemSlug}` : problemSlug;

    onProgress?.('Checking existing solutions...');
    const { nextNum, readmeSha, readmeContent } = await this.getNextSolutionNumber(
      token,
      username,
      repoName,
      folderPath,
      branch
    );

    const config = LANG_CONFIG[lang.toLowerCase()] || { ext: 'txt', commentType: 'block' };
    const filename = `Solution_${nextNum}.${config.ext}`;
    const filePath = `${folderPath}/${filename}`;

    // 1. Format code with complete docstring header
    const formattedCode = this.formatCodeWithHeader({
      code,
      lang,
      title,
      frontendId,
      difficulty,
      titleSlug,
      solutionNum: nextNum,
      timeComplexity,
      spaceComplexity,
      explanation,
      runtime,
      runtimePercentile,
      memory,
      memoryPercentile
    });

    onProgress?.(`Committing ${filename} to ${folderPath}...`);
    const commitMsg = `feat(${problemSlug}): add Solution ${nextNum} [Time: ${timeComplexity}, Space: ${spaceComplexity}]`;
    const commitResult = await this.commitFile(
      token,
      username,
      repoName,
      filePath,
      formattedCode,
      commitMsg,
      branch
    );

    // 2. Generate or update folder README
    onProgress?.('Updating problem README...');
    const updatedProblemReadme = this.generateProblemReadme({
      existingReadme: readmeContent,
      title,
      frontendId,
      difficulty,
      titleSlug,
      questionHtml,
      topicTags,
      solutionNum: nextNum,
      filename,
      lang,
      timeComplexity,
      spaceComplexity,
      runtime,
      memory
    });

    await this.commitFile(
      token,
      username,
      repoName,
      `${folderPath}/README.md`,
      updatedProblemReadme,
      `docs(${problemSlug}): update README with Solution ${nextNum} metrics`,
      branch,
      readmeSha
    ).catch(e => console.warn('[LeetCode Sync] Folder README commit error (non-fatal):', e));

    // 3. Update root README dashboard
    onProgress?.('Updating repository dashboard...');
    await this.updateRootReadme(
      token,
      username,
      repoName,
      {
        frontendId,
        title,
        difficulty,
        folderName: problemSlug,
        folderPath,
        solutionNum: nextNum,
        timeComplexity,
        spaceComplexity,
        lang
      },
      branch
    ).catch(e => console.warn('[LeetCode Sync] Root README update error (non-fatal):', e));

    return {
      success: true,
      solutionNum: nextNum,
      filename,
      filePath,
      folderPath,
      commitUrl: commitResult?.commit?.html_url || `https://github.com/${username}/${repoName}/tree/${branch}/${folderPath}`,
      repoUrl: `https://github.com/${username}/${repoName}`
    };
  }
};

// Export for node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubSync;
}
