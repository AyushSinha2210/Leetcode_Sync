# 921. Minimum Add to Make Parentheses Valid

![Difficulty: Medium](https://img.shields.io/badge/Difficulty-Medium-orange)
**Tags:** `String` `Stack` `Greedy` `Bracket Sequences`  
**LeetCode Link:** [Minimum Add to Make Parentheses Valid](https://leetcode.com/problems/minimum-add-to-make-parentheses-valid/)

---

### Problem Description
A parentheses string is valid if and only if:



	- It is the empty string,

	- It can be written as `AB` (`A` concatenated with `B`), where `A` and `B` are valid strings, or

	- It can be written as `(A)`, where `A` is a valid string.






You are given a parentheses string `s`. In one move, you can insert a parenthesis at any position of the string.



	- For example, if `s = "()))"`, you can insert an opening parenthesis to be `"(**(**)))"` or a closing parenthesis to be `"())**)**)"`.






Return *the minimum number of moves required to make *`s`* valid*.



 


Example 1:**


```

**Input:** s = "())"
**Output:** 1

```




Example 2:**


```

**Input:** s = "((("
**Output:** 3

```




 


**Constraints:**



	- `1 <= s.length <= 1000`

	- `s[i]` is either `'('` or `')'`.

---

### Solutions

| Solution | Language | Time Complexity | Space Complexity | Runtime | Memory | Date Solved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Solution 1](./Solution_1.cpp) | cpp | `O(N)` | `O(1)` | 4 ms | 14.2 MB | 2026-10-06 |
| [Solution 2](./Solution_2.cpp) | cpp | `O(N)` | `O(1)` | 0 ms | 7.6 MB | 2026-10-06 |
| [Solution 3](./Solution_3.cpp) | cpp | `O(N)` | `O(1)` | 0 ms | 7.8 MB | 2026-10-06 |
