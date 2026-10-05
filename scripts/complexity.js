/**
 * LeetCode Sync - Complexity Analyzer Module
 * Analyzes Time and Space Complexity using:
 *  1) Google Gemini Flash API (AI-powered, ultra-accurate Big-O & reasoning)
 *  2) Built-in Static Analysis Engine (offline, instant zero-config fallback)
 */

const ComplexityAnalyzer = {
  /**
   * Main entry point to analyze code complexity
   */
  async analyze({ code, lang, title = '', difficulty = '', apiKey = '', useAI = true }) {
    // 1. Try Gemini AI if enabled and key provided
    if (useAI && apiKey && apiKey.trim().length > 0) {
      try {
        const aiResult = await this.analyzeWithGemini(code, lang, title, apiKey.trim());
        if (aiResult && aiResult.timeComplexity) {
          return {
            ...aiResult,
            source: 'Gemini AI'
          };
        }
      } catch (err) {
        console.warn('[LeetCode Sync] Gemini API complexity analysis failed, falling back to static analysis:', err);
      }
    }

    // 2. Fallback to offline static analysis
    const staticResult = this.analyzeStatic(code, lang);
    return {
      ...staticResult,
      source: 'Static Analysis Engine'
    };
  },

  /**
   * Call Gemini 2.5 Flash / 1.5 Flash to compute exact Big-O and explanation
   */
  async analyzeWithGemini(code, lang, title, apiKey) {
    const prompt = `You are a computer science algorithms expert.
Analyze the worst-case TIME COMPLEXITY and AUXILIARY SPACE COMPLEXITY of the following ${lang} code for the LeetCode problem "${title}".

Requirements:
- Format Time Complexity as standard Big-O notation, e.g. "O(1)", "O(log N)", "O(N)", "O(N log N)", "O(N^2)", "O(2^N)", "O(V + E)".
- Format Auxiliary Space Complexity as standard Big-O notation, e.g. "O(1)", "O(log N)", "O(N)", "O(N * M)".
- Keep the explanation concise (1 to 2 sentences max) explaining the dominant operations.
- Return ONLY a valid JSON object matching this schema, without markdown formatting or code fences:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "explanation": "..."
}

Code:
${code}`;

    // Try gemini-2.5-flash first, fallback to gemini-1.5-flash
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[LeetCode Sync] Model ${model} returned ${response.status}:`, errText);
          continue;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.timeComplexity && parsed.spaceComplexity) {
          return {
            timeComplexity: parsed.timeComplexity,
            spaceComplexity: parsed.spaceComplexity,
            explanation: parsed.explanation || 'Analyzed via Gemini algorithm intelligence.'
          };
        }
      } catch (e) {
        console.warn(`[LeetCode Sync] Error calling ${model}:`, e);
      }
    }
    throw new Error('All Gemini models failed or returned invalid response');
  },

  /**
   * Offline static analysis of code syntax, AST patterns, loops, and allocations
   */
  analyzeStatic(code, lang) {
    // Strip comments and string literals
    const cleanCode = this.stripCommentsAndStrings(code);

    let timeComplexity = 'O(N)';
    let spaceComplexity = 'O(1)';
    let reasons = [];

    // Check for Sorting
    const hasSorting = /(?:\.sort\(|Arrays\.sort|std::sort|sorted\(|Collections\.sort|sort\.Slice|qsort)/i.test(cleanCode);

    // Check for Binary Search patterns
    const hasBinarySearch = /(?:while\s*\([a-zA-Z0-9_]+\s*<=\s*[a-zA-Z0-9_]+\)|(?:\+\s*[a-zA-Z0-9_]+\s*\)\s*\/\s*2)|>>\s*1|bisect_left|lower_bound|binary_search)/i.test(cleanCode);

    // Calculate maximum loop nesting
    const maxLoopDepth = this.getLoopNestingDepth(cleanCode);

    // Check for recursion
    const isRecursive = this.detectRecursion(cleanCode, lang);

    // Check for Tree / Graph traversals
    const hasTreeOrGraph = /(?:TreeNode|ListNode|root\.left|root\.right|head\.next|adj\[|graph\[|deque|queue|bfs|dfs)/i.test(cleanCode);

    // Check for Bit manipulation or Constant operations
    const isBitwiseMath = /^[^{}]*(?:\^|&|\||<<|>>|\+|\-|\*|\/)[^{}]*$/i.test(cleanCode.trim()) && maxLoopDepth === 0 && !isRecursive;

    // Determine Time Complexity
    if (isBitwiseMath || (maxLoopDepth === 0 && !isRecursive && !hasSorting && !hasTreeOrGraph)) {
      timeComplexity = 'O(1)';
      reasons.push('Constant time execution with no loops or recursion');
    } else if (hasBinarySearch && maxLoopDepth <= 1 && !hasSorting) {
      timeComplexity = 'O(log N)';
      reasons.push('Binary search division halves search space each iteration');
    } else if (hasSorting && maxLoopDepth <= 1) {
      timeComplexity = 'O(N log N)';
      reasons.push('Sorting dominates the runtime with O(N log N)');
    } else if (maxLoopDepth >= 3) {
      timeComplexity = 'O(N^3)';
      reasons.push('Triple nested loop structure detected');
    } else if (maxLoopDepth === 2) {
      timeComplexity = 'O(N^2)';
      reasons.push('Nested loop iteration over input elements');
    } else if (isRecursive && !cleanCode.includes('memo') && !cleanCode.includes('dp') && !cleanCode.includes('@cache')) {
      if (/(?:return\s+[a-zA-Z0-9_]+\([^)]*\)\s*\+\s*[a-zA-Z0-9_]+\([^)]*\))/i.test(cleanCode)) {
        timeComplexity = 'O(2^N)';
        reasons.push('Branching recursive tree without memoization');
      } else {
        timeComplexity = 'O(N)';
        reasons.push('Linear recursive call depth');
      }
    } else if (hasTreeOrGraph) {
      timeComplexity = 'O(N)';
      reasons.push('Single pass traversal of graph/tree nodes');
    } else {
      timeComplexity = 'O(N)';
      reasons.push('Linear iteration over input dataset');
    }

    // Strip method declarations (e.g. vector<int> twoSum(...) { )
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

  /**
   * Remove comments and strings to prevent false pattern matches
   */
  stripCommentsAndStrings(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')     // Block comments
      .replace(/\/\/.*/g, '')               // Line comments
      .replace(/#.*/g, '')                  // Python/Ruby comments
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')  // Double quotes
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")  // Single quotes
      .replace(/`(?:[^`\\]|\\.)*`/g, '``'); // Backticks
  },

  /**
   * Estimate loop nesting depth using token scanning
   */
  getLoopNestingDepth(code) {
    let maxDepth = 0;
    let currentDepth = 0;
    const lines = code.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const isLoop = /^(?:for|while)\b/i.test(trimmed) || /(?:for\s*\(|while\s*\(|for\s+[a-zA-Z0-9_]+\s+in\s+)/i.test(trimmed);
      
      if (isLoop) {
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
      }
      
      // Basic block endings
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      
      if (closeBraces > openBraces && currentDepth > 0) {
        currentDepth = Math.max(0, currentDepth - (closeBraces - openBraces));
      }
    }

    return maxDepth;
  },

  /**
   * Detect potential recursion by looking for self-calling functions
   */
  detectRecursion(code, lang) {
    // Look for function definitions
    const funcMatches = code.match(/(?:function\s+([a-zA-Z0-9_]+)|def\s+([a-zA-Z0-9_]+)|(?:int|void|bool|string|vector<[^>]+>|ListNode\*|TreeNode\*)\s+([a-zA-Z0-9_]+)\s*\()/g);
    if (!funcMatches) return false;

    for (const match of funcMatches) {
      const nameMatch = match.match(/(?:function|def|[a-zA-Z0-9_*<>]+\s+)\s*([a-zA-Z0-9_]+)/);
      if (nameMatch && nameMatch[1]) {
        const fnName = nameMatch[1];
        if (['for', 'while', 'if', 'switch'].includes(fnName)) continue;
        const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
        const calls = (code.match(callRegex) || []).length;
        if (calls > 1) { // 1 declaration + at least 1 recursive call
          return true;
        }
      }
    }
    return false;
  }
};

// Export for extension content scripts or node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComplexityAnalyzer;
}
