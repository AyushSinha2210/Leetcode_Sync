/**
 * ============================================================================
 * Problem: 20. Valid Parentheses
 * Link: https://leetcode.com/problems/valid-parentheses/
 * Difficulty: Easy
 * Language: cpp
 * Submission: Solution 1
 *
 * ⏱️ Time Complexity:  O(N)
 * 💾 Space Complexity: O(1)
 * 💡 Complexity Notes: Linear iteration over input elements; Constant auxiliary space using only primitive variables.
 *
 * 📊 Performance:
 * - Runtime: 2 ms (Beats 14.4%)
 * - Memory:  8.7 MB (Beats 95.1%)
 *
 * 📅 Solved: 2026-10-07 05:07:04
 * ============================================================================
 */

class Solution {
public:
    bool isValid(string s) {
        stack<char> st;
        for(int i=0;i<s.length();i++){
            if(s[i]=='('||s[i]=='{'||s[i]=='['){
                st.push(s[i]);
            }
            else{
                if(st.empty()||(st.top()=='('&&s[i]!=')')||(st.top()=='{'&&s[i]!='}')||(st.top()=='['&&s[i]!=']')){
                    return false;
                }
                st.pop();
            }
        }
        return st.empty();
    }
};
