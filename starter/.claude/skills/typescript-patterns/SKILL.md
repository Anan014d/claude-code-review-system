---
name: typescript-patterns
description: Guidance on idiomatic TypeScript and design patterns, including strict typing, discriminated unions, generics and modern syntax. Use when suggesting refactorings in TypeScript code.
---

# TypeScript Patterns

## Look for
- Use of any that should be a specific type or unknown
- Missing return types on exported functions
- Repeated type shapes that should be an interface or type alias
- Boolean flags that should be a discriminated union
- Callback-heavy code that should use async/await
- Optional chaining and nullish coalescing instead of manual checks
- Large functions that should be split (extract method/class)

## Reporting
Show a short before and after snippet and explain the benefit.
