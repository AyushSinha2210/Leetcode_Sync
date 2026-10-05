# 856. Score of Parentheses

![Difficulty: Medium](https://img.shields.io/badge/Difficulty-Medium-orange)
**Tags:** `String` `Stack` `Bracket Sequences`  
**LeetCode Link:** [Score of Parentheses](https://leetcode.com/problems/score-of-parentheses/)

---

### Problem Description
Given a balanced parentheses string `s`, return *the **score** of the string*.



The **score** of a balanced parentheses string is based on the following rule:



	- `"()"` has score `1`.

	- `AB` has score `A + B`, where `A` and `B` are balanced parentheses strings.

	- `(A)` has score `2 * A`, where `A` is a balanced parentheses string.






 


Example 1:**


```

**Input:** s = "()"
**Output:** 1

```




Example 2:**


```

**Input:** s = "(())"
**Output:** 2

```




Example 3:**


```

**Input:** s = "()()"
**Output:** 2

```




 


**Constraints:**



	- `2 <= s.length <= 50`

	- `s` consists of only `'('` and `')'`.

	- `s` is a balanced parentheses string.

---

### Solutions

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | cpp | `O(2^N)` | `O(N)` | 0 ms | 8.2 MB | 2026-10-05 |
