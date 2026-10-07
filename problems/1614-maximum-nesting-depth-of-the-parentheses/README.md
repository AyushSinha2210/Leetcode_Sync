# 1614. Maximum Nesting Depth of the Parentheses

![Difficulty: Easy](https://img.shields.io/badge/Difficulty-Easy-brightgreen)
**Tags:** `String` `Stack` `Bracket Sequences`  
**LeetCode Link:** [Maximum Nesting Depth of the Parentheses](https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/)

---

### Problem Description
Given a **valid parentheses string** `s`, return the **nesting depth** of* *`s`. The nesting depth is the **maximum** number of nested parentheses.



 


Example 1:**




**Input:** s = "(1+(2*3)+((8)/4))+1"



**Output:** 3



**Explanation:**



Digit 8 is inside of 3 nested parentheses in the string.




Example 2:**




**Input:** s = "(1)+((2))+(((3)))"



**Output:** 3



**Explanation:**



Digit 3 is inside of 3 nested parentheses in the string.




Example 3:**




**Input:** s = "()(())((()()))"



**Output:** 3




 


**Constraints:**



	- `1 <= s.length <= 100`

	- `s` consists of digits `0-9` and characters `'+'`, `'-'`, `'*'`, `'/'`, `'('`, and `')'`.

	- It is guaranteed that parentheses expression `s` is a VPS.

---

### Solutions

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | cpp | `O(N)` | `O(1)` | 0 ms | 8.3 MB | 2026-10-07 |
