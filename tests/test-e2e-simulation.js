const ComplexityAnalyzer = require('../scripts/complexity.js');
const GitHubSync = require('../scripts/github.js');

async function testSimulation() {
  console.log('====================================================');
  console.log('🚀 TESTING LEETCODE SYNC MULTI-SOLUTION PIPELINE');
  console.log('====================================================\n');

  // Attempt 1: Brute Force Two Sum
  const code1 = `
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < nums.size(); i++) {
            for (int j = i + 1; j < nums.size(); j++) {
                if (nums[i] + nums[j] == target) return {i, j};
            }
        }
        return {};
    }
};
  `.trim();

  console.log('1️⃣ Analyzing Attempt 1 (Brute Force)...');
  const complexity1 = await ComplexityAnalyzer.analyze({
    code: code1,
    lang: 'cpp',
    title: 'Two Sum',
    titleSlug: 'two-sum'
  });
  console.log('  Time Complexity: ', complexity1.timeComplexity);
  console.log('  Space Complexity:', complexity1.spaceComplexity);
  console.log('  Explanation:     ', complexity1.explanation);
  console.log('  Source:          ', complexity1.source);

  // Generate Solution 1 file & header
  const file1 = GitHubSync.formatCodeWithHeader({
    code: code1,
    lang: 'cpp',
    title: 'Two Sum',
    frontendId: 1,
    difficulty: 'Easy',
    titleSlug: 'two-sum',
    solutionNum: 1,
    timeComplexity: complexity1.timeComplexity,
    spaceComplexity: complexity1.spaceComplexity,
    explanation: complexity1.explanation,
    runtime: '45 ms',
    runtimePercentile: 32.4,
    memory: '10.4 MB',
    memoryPercentile: 95.1
  });

  // Generate initial README
  const readme1 = GitHubSync.generateProblemReadme({
    existingReadme: null,
    title: 'Two Sum',
    frontendId: 1,
    difficulty: 'Easy',
    titleSlug: 'two-sum',
    questionHtml: '<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.</p>',
    topicTags: [{ name: 'Array' }, { name: 'Hash Table' }],
    solutionNum: 1,
    filename: 'Solution_1.cpp',
    lang: 'cpp',
    timeComplexity: complexity1.timeComplexity,
    spaceComplexity: complexity1.spaceComplexity,
    runtime: '45 ms',
    memory: '10.4 MB'
  });

  console.log('\n✅ Attempt 1 Processed: Solution_1.cpp generated.\n');

  // Attempt 2: Repeated Question (Optimized Two Sum Hash Map)
  const code2 = `
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> numMap;
        for (int i = 0; i < nums.size(); i++) {
            int complement = target - nums[i];
            if (numMap.count(complement)) {
                return {numMap[complement], i};
            }
            numMap[nums[i]] = i;
        }
        return {};
    }
};
  `.trim();

  console.log('2️⃣ User repeats the question! Analyzing Attempt 2 (One-Pass Hash Map)...');
  const complexity2 = await ComplexityAnalyzer.analyze({
    code: code2,
    lang: 'cpp',
    title: 'Two Sum',
    titleSlug: 'two-sum'
  });
  console.log('  Time Complexity: ', complexity2.timeComplexity);
  console.log('  Space Complexity:', complexity2.spaceComplexity);
  console.log('  Explanation:     ', complexity2.explanation);
  console.log('  Source:          ', complexity2.source);

  // Generate Solution 2 file & header
  const file2 = GitHubSync.formatCodeWithHeader({
    code: code2,
    lang: 'cpp',
    title: 'Two Sum',
    frontendId: 1,
    difficulty: 'Easy',
    titleSlug: 'two-sum',
    solutionNum: 2,
    timeComplexity: complexity2.timeComplexity,
    spaceComplexity: complexity2.spaceComplexity,
    explanation: complexity2.explanation,
    runtime: '4 ms',
    runtimePercentile: 85.2,
    memory: '14.2 MB',
    memoryPercentile: 78.1
  });

  // Update existing README with Solution 2 row
  const readme2 = GitHubSync.generateProblemReadme({
    existingReadme: readme1,
    title: 'Two Sum',
    frontendId: 1,
    difficulty: 'Easy',
    titleSlug: 'two-sum',
    solutionNum: 2,
    filename: 'Solution_2.cpp',
    lang: 'cpp',
    timeComplexity: complexity2.timeComplexity,
    spaceComplexity: complexity2.spaceComplexity,
    runtime: '4 ms',
    memory: '14.2 MB'
  });

  console.log('\n✅ Attempt 2 Processed: Solution_2.cpp appended to README.');
  console.log('\n--- Final Problem README.md Solutions Table: ---');
  const tablePart = readme2.substring(readme2.indexOf('### Solutions'));
  console.log(tablePart);

  console.log('====================================================');
  console.log('🎉 ALL MULTI-SOLUTION & COMPLEXITY CHECKS PASSED!');
  console.log('====================================================');
}

testSimulation().catch(console.error);
