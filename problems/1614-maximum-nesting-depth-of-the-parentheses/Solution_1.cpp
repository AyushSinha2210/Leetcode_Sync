/**
 * ============================================================================
 * Problem: 1614. Maximum Nesting Depth of the Parentheses
 * Link: https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/
 * Difficulty: Easy
 * Language: cpp
 * Submission: Solution 1
 *
 * ⏱️ Time Complexity:  O(N)
 * 💾 Space Complexity: O(1)
 * 💡 Complexity Notes: We are iterating over each character in the string s, and hence the time complexity will be equal to O(N).
 *
 * 📊 Performance:
 * - Runtime: 0 ms (Beats 100.0%)
 * - Memory:  8.3 MB (Beats 60.5%)
 *
 * 📅 Solved: 2026-10-07 04:21:51
 * ============================================================================
 */

class Solution {
public:
    int maxDepth(string s) {
        int c=0;
        int a=0;
        for(int i=0;i<s.size();i++){
            if(s[i]=='('){ c++;a=max(a,c);}
            else if(s[i]==')'&&c>0){
                c--;
            }
        }
        return a;
    }
};
