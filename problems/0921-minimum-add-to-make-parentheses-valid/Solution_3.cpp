/**
 * ============================================================================
 * Problem: 921. Minimum Add to Make Parentheses Valid
 * Link: https://leetcode.com/problems/minimum-add-to-make-parentheses-valid/
 * Difficulty: Medium
 * Language: cpp
 * Submission: Solution 3
 *
 * ⏱️ Time Complexity:  O(N)
 * 💾 Space Complexity: O(1)
 * 💡 Complexity Notes: I think this is better solution
 *
 * 📊 Performance:
 * - Runtime: 0 ms
 * - Memory:  7.8 MB
 *
 * 📅 Solved: 2026-10-06 17:21:26
 * ============================================================================
 */

class Solution {
public:
    int minAddToMakeValid(string s) {
        int c=0;
        int ans=0;
        for(int i=0;i<s.size();i++){
            if(s[i]=='(') c++;
            else{
                if(c>0) c--;
                else{
                    ans++;
                }
            }
        }
        return c+ans;
    }
};
