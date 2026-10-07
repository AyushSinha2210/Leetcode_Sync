/**
 * ============================================================================
 * Problem: 856. Score of Parentheses
 * Link: https://leetcode.com/problems/score-of-parentheses/
 * Difficulty: Medium
 * Language: cpp
 * Submission: Solution 1
 *
 * ⏱️ Time Complexity:  O(2^N)
 * 💾 Space Complexity: O(N)
 * 💡 Complexity Notes: Branching recursive tree; Call stack depth proportional to recursion depth.
 *
 * 📊 Performance:
 * - Runtime: 0 ms (Beats 100.0%)
 * - Memory:  8.2 MB (Beats 21.1%)
 *
 * 📅 Solved: 2026-10-05 18:29:18
 * ============================================================================
 */

class Solution {
public:
    int check(string s){
        int n=s.size();
        stack<int> st;
        st.push(0);

        for(int i=0;i<n;i++){
            if(s[i]=='('){
                st.push(0);
            }
            else{
                int x=st.top();
                st.pop();
                if(x==0){
                    x=1;
                }
                else{
                    x=x*2;
                }
                st.top()+=x;
            }
        }
        return st.top();
    }
    int scoreOfParentheses(string s) {
        return check(s);
    }
};
