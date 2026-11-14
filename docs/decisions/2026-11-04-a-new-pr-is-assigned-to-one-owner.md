# A new PR is assigned to one owner: its author, or a write-capable member of its heaviest code owner

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial) · v2 2026-11-12 (team owners resolve through GitHub teams listed in `team-config.yml`)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer
- **Related:** #37048, #37131, ADR:2026-10-14-pr-code-never-runs-on-pull-request-target

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

## Amendment — v2: team owners resolve through GitHub teams

`.github/teams.yml` is removed; it had drifted from the GitHub team rosters. That also ends the
`teams.yml` retention noted in ADR:2026-10-14-pr-code-never-runs-on-pull-request-target v3.

- A team owner `@open-metadata/<slug>` contributes candidates only if `<slug>` is listed under
  `assign.teams` in `.github/team-config.yml`. It then expands to the members of that GitHub team
  (child teams included), read with a `members:read` token from the org bot App
  (`secrets.GH_BOT_ID` / `secrets.GH_BOT_PK`). Logins under `assign.exclude` are dropped.
- Any other CODEOWNERS team contributes no candidates. `mergers`, which gates approval of CI
  changes, is deliberately not listed, so external PRs touching workflows go to the individual
  owners on those rules. An allow list keeps a future approval-only team out by default.
- Rotation by PR number, the write-access check, and the heaviest-owner-set rule are unchanged.
  Without the token, a team owner contributes no candidates and the PR can stay unassigned.
