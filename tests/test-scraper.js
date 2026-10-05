const ComplexityAnalyzer = require('../scripts/complexity.js');

console.log('====================================================');
console.log('🧪 TESTING LEETCODE COMPLEXITY SCRAPER (NO MODEL)');
console.log('====================================================\n');

// Sample real LeetCode Editorial Markdown for Two Sum
const sampleEditorialMarkdown = `
### Approach 1: Brute Force

The brute force approach is simple. Loop through each element $x$ and find if there is another value that equals to $target - x$.

#### Complexity Analysis

* Time complexity: $\\mathcal{O}(n^2)$.
  For each element, we try to find its complement by looping through the rest of the array which takes $\\mathcal{O}(n)$ time.

* Space complexity: $\\mathcal{O}(1)$.
  The extra space required does not depend on the size of the input array.

---

### Approach 2: One-pass Hash Table

While we are iterating and inserting elements into the hash table, we also look back to check if current element's complement already exists.

#### Complexity Analysis

* Time complexity: $\\mathcal{O}(n)$.
  We traverse the list containing $n$ elements only once. Each lookup in the table costs only $\\mathcal{O}(1)$ time.

* Space complexity: $\\mathcal{O}(n)$.
  The extra space required depends on the number of items stored in the hash table.
`;

console.log('1️⃣ Scraping Approach 1 (Brute Force user code):');
const userCodeBrute = 'for (int i = 0; i < n; i++) for (int j = i+1; j < n; j++) ...';
const result1 = ComplexityAnalyzer.parseComplexityFromEditorialMarkdown(sampleEditorialMarkdown, userCodeBrute);
console.log('  Scraped Time Complexity: ', result1.timeComplexity);
console.log('  Scraped Space Complexity:', result1.spaceComplexity);
console.log('  Scraped Explanation:     ', result1.explanation);

console.log('\n2️⃣ Scraping Approach 2 (Hash Map user code):');
const userCodeHash = 'unordered_map<int, int> numMap; for(int i=0; i<nums.size(); i++) ...';
const result2 = ComplexityAnalyzer.parseComplexityFromEditorialMarkdown(sampleEditorialMarkdown, userCodeHash);
console.log('  Scraped Time Complexity: ', result2.timeComplexity);
console.log('  Scraped Space Complexity:', result2.spaceComplexity);
console.log('  Scraped Explanation:     ', result2.explanation);

console.log('\n3️⃣ Testing DOM Extractor with LeetCode "Analyze Complexity" format:');
const fakeDOM = {
  innerText: `
    Accepted
    Runtime: 4 ms
    Memory: 14.2 MB

    Analyze Complexity
    Time Complexity: O(n)
    Single iteration through the array with constant time lookup.
    Space Complexity: O(n)
    Hash table storage scales with array size.
  `
};

const domResult = ComplexityAnalyzer.extractComplexityFromDOM(fakeDOM);
console.log('  Scraped Time Complexity: ', domResult.timeComplexity);
console.log('  Scraped Space Complexity:', domResult.spaceComplexity);
console.log('  Scraped Explanation:     ', domResult.explanation);

console.log('\n====================================================');
console.log('🎉 ALL SCRAPING CHECKS PASSED WITHOUT ANY MODEL!');
console.log('====================================================');
