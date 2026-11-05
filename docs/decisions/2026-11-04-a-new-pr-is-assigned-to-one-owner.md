# A new PR is assigned to one owner: its author, or a write-capable member of its heaviest code owner

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial) · v2 2026-11-05 (team owners resolve through the GitHub API minus `assign-exclude`)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer
- **Related:** #37048, ADR:2026-11-05-pr-labels-follow-paths-and-ci-trust-follows-org-membership

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

## Amendment — 2026-11-05: team owners resolve through the GitHub API

`.github/teams.yml` is removed. A team owner `@open-metadata/<slug>` now expands to the members of
the GitHub team `<slug>` (child teams included), read with the members:read App token described in
ADR:2026-11-05-pr-labels-follow-paths-and-ci-trust-follows-org-membership. Logins listed under
`assign-exclude` in `.github/team-config.yml` are then dropped. Rotation by PR number and the
write-access check are unchanged.

This removes the `teams.yml`↔`CODEOWNERS` contract: every CODEOWNERS team, `@open-metadata/mergers`
included, now contributes its real members. Without the token a team owner contributes no
candidates and the PR stays unassigned; an individual owner still resolves as before.
