# A durable decision is recorded in the tree, in the PR that makes it, not in the PR description

- **Status:** Accepted
- **Revisions:** v1 2026-10-08 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `scripts/harness/check_decision_records.py` for the bookkeeping; reviewer
  (`.gitar/review/decision-records.md`) for whether a record was needed
- **Related:** `docs/decisions/README.md`;
  ADR:ai-platform/2026-08-27-an-unrecorded-decision-is-a-review-finding,
  ADR:ai-platform/2026-08-31-a-record-is-addressed-by-slug-and-the-folder-is-the-index

## Context

The repository squash-merges. `git log` keeps a PR's subject line; its description, where the
reasoning behind a default, a limit, a contract or an ordering usually lives, stays on github.com
behind a number nobody greps. The next contributor re-derives the rule or quietly undoes it.

Records existed, but by accident: `docs/adr/` held two, in two header styles; nothing said when to
write one and nothing checked them. Citations had already rotted — `pom.xml` cited an ai-platform
record by a number ai-platform has since retired, and a plan cited another by a path that does not
exist in this tree.

ai-platform has kept records this way since August 2026: 128 by eight authors, cited from 173 files
as of this record. Two of its lessons carry over. Sequential numbers and an index table are shared
state that parallel branches collide on — it took 19 renumberings across 12 branches before it moved
to dated slugs. And checking only whether a PR *contradicts* a record leaves the other half
unasked: a PR that decides something new and records nothing.

## Decision

- **Records live in `docs/decisions/`**, one file per decision, named `YYYY-MM-DD-short-kebab-slug.md`.
  The filename is the identity and `ls` is the index: no number, no table. `docs/adr/` is retired;
  its two records moved here with their filenames and dates unchanged.
- **A citation is a path.** `ADR:<date>-<slug>` resolves to `docs/decisions/<date>-<slug>.md`, and a
  record in a sibling repository is `ADR:<repo>/<date>-<slug>`. A record is never renamed or
  deleted, and its date never moves.
- **A PR that makes a durable decision adds the record in the same PR**, by the triggers in
  `docs/decisions/README.md`. Contradicting an Accepted record and leaving a decision unrecorded are
  both blocking review findings, raised once and settled when the author answers that no rule
  survives the diff.
- **The bookkeeping is checked mechanically; the judgment is not.** Whether a PR needed a record is
  asked on every PR by the automated reviewer and by the review skills, never by a diff heuristic.

## Consequences

- A rule outlives the PR that made it, and a reader who meets an `ADR:` citation opens the record
  directly. Adding a record conflicts with nothing.
- Review will sometimes ask for a record the author judges unnecessary; raising it once keeps that
  from becoming a tax on contributors.
- Mechanizing *whether* a PR needed a record stays ruled out: a diff heuristic is wrong most of the
  time and trains contributors to satisfy it with empty records.
- The guard warns rather than blocks in CI, like every harness check, until maintainers promote it.
  Until then a dangling citation in a PR that touches no doc is caught by the pre-commit hook, not
  by CI.
- A cross-repository citation is checked for shape only; the other tree is not on disk.
