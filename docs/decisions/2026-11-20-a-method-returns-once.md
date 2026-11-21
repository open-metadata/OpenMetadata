# A Java method returns once, at the end

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** reviewer, per the `REVIEW.md` "Do not report" exception for the return rule
- **Related:** ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context
`.claude/rules/java.md` asked authors to *prefer* one successful return and explicitly allowed
direct early returns where a result variable felt heavier. In practice that wording let guard
clauses accumulate: the shared vector index service extracted for Elasticsearch parity carried
sixteen methods with two or three exits, `void` methods among them, and review stopped on
`updateEntityEmbedding`, which returned from two places before doing its work. A reader has to
trace every exit to know what a method does on each path, and a later edit placed after an early
return silently runs on only some of them.

## Decision
A Java method has at most one `return`, and it is the last statement. A value-returning method
computes its result through `if`/`else`, a ternary or a `switch` expression. A `void` method has no
`return`; its work sits inside the condition that allows it. Throwing a specific exception for
invalid input is allowed. When conditions nest past three levels, the condition or the branch
moves into a named helper rather than gaining an early exit. Returns inside lambdas, `switch`
expression arms and anonymous classes belong to those bodies.

## Consequences
Every method reads top to bottom with one exit, so code added before the `return` runs on every
path. Some methods gain a local result variable or one more `if` level; the nesting limit keeps
that bounded by pushing branches into named helpers. Existing code is not rewritten wholesale; a
change that touches a method brings it into line. Revisit if the nesting limit and this rule start
forcing helpers that exist only to satisfy each other.
