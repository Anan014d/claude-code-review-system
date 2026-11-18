---
name: security-analysis
description: Detects security vulnerabilities in JavaScript/TypeScript code such as injection, XSS, hardcoded secrets, weak authentication and missing input validation. Use when reviewing code for security issues.
---

# Security Analysis

## Checklist
- Injection: SQL/NoSQL/command injection from unsanitized input
- XSS: use of innerHTML, document.write or dangerouslySetInnerHTML with user data
- Secrets: hardcoded API keys, tokens, passwords
- Dangerous functions: eval, new Function, child_process with user input
- Authentication/authorization: missing checks, weak password handling
- Input validation: unvalidated request bodies, params and query strings
- Dependencies: known-vulnerable or unpinned packages

## Reporting
For each finding give the file path, line number, severity (critical, high, medium, low, info), a clear description and a concrete fix.
