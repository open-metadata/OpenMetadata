# A new PR is assigned to one owner: its author, or a write-capable member of its heaviest code owner

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer
- **Related:** #37048

## Context

PRs sat unmerged because nobody owned driving them through review and CI. Assigning one person per
PR makes the owner visible. GitHub can only assign users with access to the repository, never a
team or an outside contributor.

## Decision

`.github/workflows/pr-auto-assign.yml` runs on `pull_request_target: opened` and skips a PR that
already has an assignee.

- Author has `write` or `admin` permission → the author.
- Otherwise each changed file resolves to its `.github/CODEOWNERS` owner set (last match wins);
  the set covering the most changed lines is chosen. Only that set is tried: if none of its
  members is assignable, the PR stays unassigned rather than falling back to a lighter owner.
- A team owner `@open-metadata/<slug>` expands to the members under the `.github/teams.yml` key
  equal to `<slug>`, compared case-insensitively. Candidates rotate by PR number and the first
  with write access is assigned.

## Consequences

`teams.yml` is now a contract with `CODEOWNERS`: a CODEOWNERS team without a matching key (today
`@open-metadata/mergers`) silently contributes no candidates, and a stale member list skews who
gets external PRs. Reading team membership from the GitHub API instead would need an org-scoped
token, which the default `GITHUB_TOKEN` can't provide.
