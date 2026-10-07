# 301. Remove Invalid Parentheses

![Difficulty: Hard](https://img.shields.io/badge/Difficulty-Hard-red)
**Tags:** `String` `Backtracking` `Breadth-First Search`  
**LeetCode Link:** [Remove Invalid Parentheses](https://leetcode.com/problems/remove-invalid-parentheses/)

---

### Problem Description
Given a string `s` that contains parentheses and letters, remove the minimum number of invalid parentheses to make the input string valid.



Return *a list of **unique strings** that are valid with the minimum number of removals*. You may return the answer in **any order**.



 


Example 1:**


```

**Input:** s = "()())()"
**Output:** ["(())()","()()()"]

```




Example 2:**


```

**Input:** s = "(a)())()"
**Output:** ["(a())()","(a)()()"]

```




Example 3:**


```

**Input:** s = ")("
**Output:** [""]

```




 


**Constraints:**



	- `1 <= s.length <= 25`

	- `s` consists of lowercase English letters and parentheses `'('` and `')'`.

	- There will be at most `20` parentheses in `s`.

---

### Solutions

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | cpp | `O(N)` | `to know if we have foud the better solution and run time in ms is pretty much not a useful info for our preparation` | 4 ms | 14.2 MB | 2026-10-07 |
