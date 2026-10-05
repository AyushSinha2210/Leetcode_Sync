/**
 * ============================================================================
 * Problem: 1. Two Sum
 * Link: https://leetcode.com/problems/two-sum/
 * Difficulty: Easy
 * Language: cpp
 * Submission: Solution 1
 *
 * ⏱️ Time Complexity:  O(n)
 * 💾 Space Complexity: O(n)
 * 💡 Complexity Notes: Single pass with hash table lookup.
 *
 * 📊 Performance:
 * - Runtime: 3 ms (Beats 91.2%)
 * - Memory:  14.1 MB (Beats 82.5%)
 *
 * 📅 Solved: 2026-10-05 18:14:03
 * ============================================================================
 */

// LeetCode Problem 1: Two Sum
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> numMap;
        for (int i = 0; i < nums.size(); i++) {
            int complement = target - nums[i];
            if (numMap.count(complement)) return {numMap[complement], i};
            numMap[nums[i]] = i;
        }
        return {};
    }
};
