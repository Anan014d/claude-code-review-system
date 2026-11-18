---
name: python-code-review
description: Reviews Python code for correctness, security and style, including PEP 8, type hints, exception handling and unsafe patterns. Use when the changed files are Python.
---

# Python Code Review

## Checklist
- PEP 8 style and naming
- Missing type hints and docstrings
- Bare except clauses and swallowed exceptions
- Mutable default arguments
- Unsafe functions: eval, exec, pickle on untrusted data, shell=True
- Resource handling: use context managers (with open)
- Missing tests for public functions

## Reporting
Give file path, line number, severity and a concrete fix.
