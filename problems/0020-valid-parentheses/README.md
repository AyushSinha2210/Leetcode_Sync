# 20. Valid Parentheses

![Difficulty: Easy](https://img.shields.io/badge/Difficulty-Easy-brightgreen)
**Tags:** `String` `Stack` `Bracket Sequences`  
**LeetCode Link:** [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/)

---

### Problem Description
Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.



An input string is valid if:


	- Open brackets must be closed by the same type of brackets.

	- Open brackets must be closed in the correct order.

	- Every close bracket has a corresponding open bracket of the same type.





 


Example 1:**




**Input:** s = "()"



**Output:** true




Example 2:**




**Input:** s = "()[]{}"



**Output:** true




Example 3:**




**Input:** s = "(]"



**Output:** false




Example 4:**




**Input:** s = "([])"



**Output:** true




Example 5:**




**Input:** s = "([)]"



**Output:** false




 


**Constraints:**



	- `1 4`

	- `s` consists of parentheses only `'()[]{}'`.

---

### Solutions

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | cpp | `O(N)` | `O(1)` | 2 ms | 8.7 MB | 2026-10-07 |
