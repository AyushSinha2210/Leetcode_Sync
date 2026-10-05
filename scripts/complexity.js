/**
 * LeetCode Sync - Complexity Scraper Module
 * Scrapes Time and Space Complexity directly from LeetCode data:
 *  1) LeetCode Submission DOM ("Analyze Complexity" button & rendered results)
 *  2) LeetCode Official Editorial / Solution Data (GraphQL solution content)
 *  3) LeetCode Solution Articles / Community Data
 *  4) Deterministic static syntax heuristic (fallback when no LeetCode editorial exists)
 * 
 * NO EXTERNAL AI MODELS OR API KEYS REQUIRED.
 */

const ComplexityAnalyzer = {
  /**
   * Main entry point to get complexity from LeetCode data
   */
  async analyze({ code, lang, title = '', titleSlug = '' }) {
    console.log('[LeetCode Sync] Scraping complexity from LeetCode data for:', titleSlug || title);

    // 1. Try scraping from active LeetCode Submission DOM ("Analyze Complexity")
    if (typeof document !== 'undefined') {
      try {
        const domResult = await this.scrapeFromSubmissionDOM();
        if (domResult && domResult.timeComplexity) {
          console.log('[LeetCode Sync] Scraped from LeetCode Submission DOM:', domResult);
          return {
            ...domResult,
            source: 'LeetCode Submission Data (Scraped)'
          };
        }
      } catch (e) {
        console.warn('[LeetCode Sync] DOM scraping skipped or failed:', e);
      }
    }

    // 2. Try scraping from LeetCode Official Editorial / Solution GraphQL Data
    if (titleSlug) {
      try {
        const editorialResult = await this.scrapeFromLeetCodeEditorialData(titleSlug, code);
        if (editorialResult && editorialResult.timeComplexity) {
          console.log('[LeetCode Sync] Scraped from LeetCode Official Solution data:', editorialResult);
          return {
            ...editorialResult,
            source: 'LeetCode Official Editorial (Scraped)'
          };
        }
      } catch (e) {
        console.warn('[LeetCode Sync] Editorial GraphQL scraping failed:', e);
      }
    }

    // 3. Fallback: deterministic static code analysis (no AI model)
    const staticResult = this.analyzeStatic(code, lang);
    return {
      ...staticResult,
      source: 'Static Analysis (Deterministic)'
    };
  },

  /**
   * Layer 1: Scrape from LeetCode's on-screen Submission Detail & "Analyze Complexity" DOM
   */
  async scrapeFromSubmissionDOM() {
    if (typeof document === 'undefined') return null;

    // Check if complexity is already rendered in the DOM
    let existing = this.extractComplexityFromDOM(document.body);
    if (existing && existing.timeComplexity) {
      return existing;
    }

    // Look for the "Analyze Complexity" button on the submission detail page
    const analyzeBtn = this.findAnalyzeComplexityButton();
    if (analyzeBtn) {
      console.log('[LeetCode Sync] Found "Analyze Complexity" button in DOM, clicking...');
      analyzeBtn.click();

      // Poll for up to 3.5 seconds waiting for LeetCode to render complexity
      const startTime = Date.now();
      while (Date.now() - startTime < 3500) {
        await new Promise(r => setTimeout(r, 400));
        const scraped = this.extractComplexityFromDOM(document.body);
        if (scraped && scraped.timeComplexity) {
          return scraped;
        }
      }
    }

    return null;
  },

  /**
   * Find "Analyze Complexity" button across common LeetCode UI selectors
   */
  findAnalyzeComplexityButton() {
    // 1. Check by button text
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/Analyze\s+Complexity/i.test(text) || /分析复杂度/i.test(text)) {
        return btn;
      }
    }

    // 2. Check XPath
    try {
      const xpathResult = document.evaluate(
        "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'analyze complexity')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      if (xpathResult.singleNodeValue) {
        return xpathResult.singleNodeValue;
      }
    } catch (e) {}

    return null;
  },

  /**
   * Extract Time and Space Complexity text from a DOM element
   */
  extractComplexityFromDOM(root) {
    if (!root) return null;

    const textContent = root.innerText || root.textContent || '';
    if (!/time\s+complexity/i.test(textContent) && !/时间复杂度/i.test(textContent)) {
      return null;
    }

    // Regex to match Time Complexity line
    const timeMatch = textContent.match(/(?:Time\s+Complexity|time\s+complexity|时间复杂度)\s*[:：\-]?\s*([^\n\r,]+)/i);
    // Regex to match Space Complexity line
    const spaceMatch = textContent.match(/(?:Space\s+Complexity|space\s+complexity|空间复杂度)\s*[:：\-]?\s*([^\n\r,]+)/i);

    if (timeMatch && timeMatch[1]) {
      const timeComplexity = this.cleanComplexityString(timeMatch[1]);
      const spaceComplexity = spaceMatch && spaceMatch[1] ? this.cleanComplexityString(spaceMatch[1]) : 'O(1)';

      // Look for explanation sentence following the match
      let explanation = 'Scraped directly from LeetCode submission complexity analysis.';
      const expMatch = textContent.match(/(?:Time\s+Complexity[^\n]*\n)([\s\S]{10,250}?)(?:\n\s*\n|Space\s+Complexity|$)/i);
      if (expMatch && expMatch[1]) {
        explanation = expMatch[1].replace(/\s+/g, ' ').trim();
      }

      return {
        timeComplexity,
        spaceComplexity,
        explanation
      };
    }

    return null;
  },

  /**
   * Layer 2: Scrape from LeetCode's Official Solution / Editorial GraphQL data
   */
  async scrapeFromLeetCodeEditorialData(titleSlug, userCode = '') {
    const query = `
      query getQuestionEditorial($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          solution {
            content
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

    if (!res.ok) return null;

    const data = await res.json();
    const editorialContent = data?.data?.question?.solution?.content;
    if (!editorialContent) return null;

    return this.parseComplexityFromEditorialMarkdown(editorialContent, userCode);
  },

  /**
   * Parse complexity analysis blocks from LeetCode editorial markdown
   */
  parseComplexityFromEditorialMarkdown(markdown, userCode = '') {
    if (!markdown) return null;

    // Split into approaches (e.g. ### Approach 1, ### Approach 2...)
    const approaches = markdown.split(/(?=###?\s+Approach|\n---\n)/gi);

    let candidates = [];

    for (const approachText of approaches) {
      // Look for Complexity Analysis section
      const compSectionMatch = approachText.match(/Complexity\s+Analysis[\s\S]*?(?=(?:###?\s+Approach|$))/i);
      const textToSearch = compSectionMatch ? compSectionMatch[0] : approachText;

      const timeMatch = textToSearch.match(/(?:Time\s+[Cc]omplexity|time\s+complexity|时间复杂度)\s*[:：\-]?\s*([^\n\r]+)/i);
      const spaceMatch = textToSearch.match(/(?:Space\s+[Cc]omplexity|space\s+complexity|空间复杂度)\s*[:：\-]?\s*([^\n\r]+)/i);

      if (timeMatch && timeMatch[1]) {
        const timeComplexity = this.cleanComplexityString(timeMatch[1]);
        const spaceComplexity = spaceMatch && spaceMatch[1] ? this.cleanComplexityString(spaceMatch[1]) : 'O(1)';

        // Extract explanation sentence
        let explanation = 'Extracted directly from LeetCode official editorial complexity analysis.';
        const expMatch = textToSearch.match(/(?:Time\s+[Cc]omplexity[^\n]*\n)([\s\S]{10,250}?)(?:\n\s*\n|Space\s+[Cc]omplexity|\*|$)/i);
        if (expMatch && expMatch[1]) {
          explanation = expMatch[1]
            .replace(/\\mathcal\{O\}\(([^)]+)\)/gi, 'O($1)')
            .replace(/\\mathcal\{O\}/gi, 'O')
            .replace(/[$`*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        }

        candidates.push({
          timeComplexity,
          spaceComplexity,
          explanation,
          text: approachText
        });
      }
    }

    if (candidates.length === 0) return null;

    // If multiple approaches exist, pick the one matching user's code patterns
    if (candidates.length > 1 && userCode) {
      const isBrute = /(?:for[^{;\n]*\{?[^}]*for|while[^{;\n]*\{?[^}]*while|for\s*\(.*\)\s*for\s*\()/i.test(userCode);
      const isHash = /(?:unordered_map|HashMap|HashSet|unordered_set|dict|set\(|\bmap\b)/i.test(userCode);
      const isSort = /(?:\.sort|sorted|Arrays\.sort|std::sort)/i.test(userCode);
      const isTwoPointer = /(?:left\s*<|right\s*>|two\s*pointer)/i.test(userCode);

      for (const cand of candidates) {
        if (isBrute && /brute/i.test(cand.text)) return cand;
        if (isHash && /hash/i.test(cand.text)) return cand;
        if (isSort && /sort/i.test(cand.text)) return cand;
        if (isTwoPointer && /two\s*pointer/i.test(cand.text)) return cand;
      }

      // Default to the last (typically most optimal) approach in LeetCode editorial
      return candidates[candidates.length - 1];
    }

    return candidates[candidates.length - 1];
  },

  /**
   * Cleans LaTeX and math symbols from LeetCode complexity strings into standard Big-O
   * e.g. "$\mathcal{O}(n \log n)$" -> "O(n log n)"
   */
  cleanComplexityString(raw) {
    if (!raw) return 'O(N)';
    let cleaned = raw
      .replace(/\$+\s*\\mathcal\{O\}\s*\(([^)]+)\)\s*\$+/gi, 'O($1)')
      .replace(/\$+\s*O\s*\(([^)]+)\)\s*\$+/gi, 'O($1)')
      .replace(/\\mathcal\{O\}/gi, 'O')
      .replace(/\\log/gi, 'log')
      .replace(/\\le/gi, '<=')
      .replace(/\\times/gi, ' * ')
      .replace(/\\cdot/gi, ' * ')
      .replace(/[$`*]/g, '')
      .trim();

    // Look for exact O(...)
    const match = cleaned.match(/\bO\s*\([^)]+\)/i);
    if (match) {
      return match[0].replace(/\s+/g, ' ');
    }

    return cleaned.split(/[,.;\n]/)[0].trim() || 'O(N)';
  },

  /**
   * Deterministic static code analysis (no AI model, zero network fallback)
   */
  analyzeStatic(code, lang) {
    const cleanCode = this.stripCommentsAndStrings(code);
    let timeComplexity = 'O(N)';
    let spaceComplexity = 'O(1)';
    let reasons = [];

    const hasSorting = /(?:\.sort\(|Arrays\.sort|std::sort|sorted\(|Collections\.sort|sort\.Slice|qsort)/i.test(cleanCode);
    const hasBinarySearch = /(?:while\s*\([a-zA-Z0-9_]+\s*<=\s*[a-zA-Z0-9_]+\)|(?:\+\s*[a-zA-Z0-9_]+\s*\)\s*\/\s*2)|>>\s*1|bisect_left|lower_bound|binary_search)/i.test(cleanCode);
    const maxLoopDepth = this.getLoopNestingDepth(cleanCode);
    const isRecursive = this.detectRecursion(cleanCode, lang);
    const hasTreeOrGraph = /(?:TreeNode|ListNode|root\.left|root\.right|head\.next|adj\[|graph\[|deque|queue|bfs|dfs)/i.test(cleanCode);
    const isBitwiseMath = /^[^{}]*(?:\^|&|\||<<|>>|\+|\-|\*|\/)[^{}]*$/i.test(cleanCode.trim()) && maxLoopDepth === 0 && !isRecursive;

    if (isBitwiseMath || (maxLoopDepth === 0 && !isRecursive && !hasSorting && !hasTreeOrGraph)) {
      timeComplexity = 'O(1)';
      reasons.push('Constant time execution (no loops or recursion)');
    } else if (hasBinarySearch && maxLoopDepth <= 1 && !hasSorting) {
      timeComplexity = 'O(log N)';
      reasons.push('Binary search space reduction');
    } else if (hasSorting && maxLoopDepth <= 1) {
      timeComplexity = 'O(N log N)';
      reasons.push('Sorting operations dominate execution');
    } else if (maxLoopDepth >= 3) {
      timeComplexity = 'O(N^3)';
      reasons.push('Triple nested iteration structure');
    } else if (maxLoopDepth === 2) {
      timeComplexity = 'O(N^2)';
      reasons.push('Nested loop iteration over input elements');
    } else if (isRecursive && !cleanCode.includes('memo') && !cleanCode.includes('dp')) {
      timeComplexity = 'O(2^N)';
      reasons.push('Branching recursive tree');
    } else {
      timeComplexity = 'O(N)';
      reasons.push('Linear iteration over input elements');
    }

    const codeWithoutMethods = cleanCode.replace(/(?:class\s+[a-zA-Z0-9_]+|public:|private:|protected:|[a-zA-Z0-9_*<>]+\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{)/g, '');
    const has2DArray = /(?:vector\s*<\s*vector|new\s+[a-zA-Z0-9_]+\[[^\]]+\]\[[^\]]+\]|\[\s*\[[^\]]*\]\s*for\s+)/i.test(codeWithoutMethods);
    const hasDataStructures = /(?:vector\s*<[a-zA-Z0-9_*\s,<>]+>\s+[a-zA-Z0-9_]+\s*(?:=|\{|;)|new\s+[a-zA-Z0-9_]+\[|new\s+HashMap|new\s+HashSet|new\s+ArrayList|unordered_map<|unordered_set<|[a-zA-Z0-9_]+\s*=\s*(?:dict\(|set\(|list\(|\[\]|\{[^}]*:[^}]*\})|make\s*\(\s*(?:map|\[\]))/i.test(codeWithoutMethods);

    if (has2DArray) {
      spaceComplexity = 'O(M * N)';
      reasons.push('2D matrix / DP table allocation');
    } else if (hasDataStructures) {
      spaceComplexity = 'O(N)';
      reasons.push('Linear auxiliary storage (hash table or array)');
    } else if (isRecursive) {
      spaceComplexity = 'O(N)';
      reasons.push('Call stack depth proportional to recursion depth');
    } else {
      spaceComplexity = 'O(1)';
      reasons.push('Constant auxiliary space using only primitive variables');
    }

    return {
      timeComplexity,
      spaceComplexity,
      explanation: reasons.join('; ') + '.'
    };
  },

  stripCommentsAndStrings(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/#.*/g, '')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  },

  getLoopNestingDepth(code) {
    let maxDepth = 0;
    let currentDepth = 0;
    for (const line of code.split('\n')) {
      const trimmed = line.trim();
      const isLoop = /^(?:for|while)\b/i.test(trimmed) || /(?:for\s*\(|while\s*\(|for\s+[a-zA-Z0-9_]+\s+in\s+)/i.test(trimmed);
      if (isLoop) {
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
      }
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      if (closeBraces > openBraces && currentDepth > 0) {
        currentDepth = Math.max(0, currentDepth - (closeBraces - openBraces));
      }
    }
    return maxDepth;
  },

  detectRecursion(code, lang) {
    const funcMatches = code.match(/(?:function\s+([a-zA-Z0-9_]+)|def\s+([a-zA-Z0-9_]+)|(?:int|void|bool|string|vector<[^>]+>|ListNode\*|TreeNode\*)\s+([a-zA-Z0-9_]+)\s*\()/g);
    if (!funcMatches) return false;
    for (const match of funcMatches) {
      const nameMatch = match.match(/(?:function|def|[a-zA-Z0-9_*<>]+\s+)\s*([a-zA-Z0-9_]+)/);
      if (nameMatch && nameMatch[1]) {
        const fnName = nameMatch[1];
        if (['for', 'while', 'if', 'switch'].includes(fnName)) continue;
        const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
        const calls = (code.match(callRegex) || []).length;
        if (calls > 1) return true;
      }
    }
    return false;
  }
};

// Export for extension content scripts or node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComplexityAnalyzer;
}
