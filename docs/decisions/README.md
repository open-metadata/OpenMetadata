# Decision records

Append-only records of the choices that shape this codebase — the ones a reader would otherwise
re-derive, re-litigate, or silently undo. When a choice in the code looks arbitrary, **find its
record before re-deciding it**. When a pull request makes a choice of that kind, it adds the record
**in the same PR**: the repository squash-merges, so the PR description never reaches `git log`.

`ls docs/decisions/` is the index. The filename carries the date and the decision; there is no
table to keep current, and adding a record touches no file anyone else is editing.

## When to write one

- **A contract another component or repository has to agree with** — a JSON Schema field or enum
  value, a REST path or parameter, an event or payload shape, or a derived format (an FQN encoding,
  a hash, an index or alias name) that the server, the UI, ingestion, the SDKs, or a downstream
  distribution reads or writes.
- **A new default, limit, batch size, cap, timeout or retry budget** whose value was a judgment
  call — record the value and why.
- **An ordering or mutual exclusion that must hold for correctness** and is not visible from any
  single file: migration order, registration or initialization order, lock order.
- **A rule the PR description states in prose that exists nowhere in the tree.** If it was worth
  explaining to a reviewer, it is worth explaining to the next contributor.
- **A reversal of an earlier record** — write a new record and point the old one's `Status` at it;
  never rewrite the original.
- **The third PR iterating on the same trade-off.**

Not every PR needs one. A bug fix whose correctness is evident from the diff does not, nor does a
refactor with no behavior change, a dependency bump, a test-only change, or a change that merely
complies with a record already here. A maintainer can write the record on a contributor's behalf.

## Format

One file per decision, **`YYYY-MM-DD-short-kebab-slug.md`**, dated the day it is decided. The
filename is the record's identity: cite it anywhere in the tree — prose, a code comment, a schema
description — as **`ADR:<date>-<slug>`**, which is the path `docs/decisions/<date>-<slug>.md`. A
slug describes its decision, so two branches never contend for a name.

**A record is never renamed or deleted**, because its citations would dangle, and **its date never
moves**. `Revisions` carries the history: `v1` is the birth date and matches the filename; each
amendment adds an entry dated when it landed and an `## Amendment` section below. A superseded
record stays where it is, with its `Status` naming the successor.

```markdown
# <The decision, stated as a sentence>

- **Status:** Accepted | Superseded by ADR:<date>-<slug>
- **Revisions:** v1 YYYY-MM-DD (initial) · v2 YYYY-MM-DD (what changed)
- **Deciders:** <who>
- **Guard:** <the test or check that fails when this is violated — or `reviewer`>
- **Related:** <issues, PRs, records>

## Context
Why a decision was needed — the forces, the measurement, the failure.

## Decision
What was decided, stated so a reader can check code against it.

## Consequences
What this makes easier, what it forbids, what it costs, and what would have to be true to
revisit it.
```

`Guard` names what catches a violation — the one fact a record's own text does not otherwise
state. Keep a record short enough to read in two minutes: the PR description tells the story of a
change; the record states the rule that survives it.

### Citing a record in another repository

Collate's `openmetadata-collate` and `ai-platform` repositories keep records the same way. Cite one
of theirs as **`ADR:<repo>/<date>-<slug>`** — for example
ADR:ai-platform/2026-08-27-transitive-only-cves-are-fixed-by-an-explicit-override — and find it at
`docs/decisions/<date>-<slug>.md` in that repository. Its tree is not on disk here, so only the
citation's shape is checked.

## Enforcement

The bookkeeping is mechanical. `scripts/harness/check_decision_records.py` fails on a record whose
name or header breaks the format or whose `v1` date disagrees with its filename, and on an `ADR:`
citation or a `docs/decisions/` path in any tracked file that resolves to nothing. It runs as a
pre-commit hook, as check 9 of `make harness-check` (warnings in CI, like every harness check), and
standalone; its tests are `scripts/harness/test_check_decision_records.py`.

Whether a change needed a record is judgment, and stays with review:
`.gitar/review/decision-records.md` has the automated reviewer raise both **contradicting** an
Accepted record and **making a decision without one** as blocking findings, and the `code-review`,
`openmetadata-pr-review` and `pr-checklist` skills and the PR template ask the same. The reasons
are ADR:2026-10-08-a-decision-is-recorded-in-the-tree-not-in-the-pr-body.
