# PR area labels follow the changed paths; `safe to test` follows org membership

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer
- **Related:** ADR:2026-11-04-a-new-pr-is-assigned-to-one-owner

## Context

`.github/teams.yml` listed people by hand, and `JulienKode/team-labeler-action` labeled each PR from
its author's groups. People who left the org stayed listed. One of them still got `safe to test`,
the label that lets a fork's code run CI with secrets under `pull_request_target`. The area labels
also described the author rather than the change: a UI developer's backend fix was labeled `UI`.
`.github/labeler.yml` had been dead config since its workflow was removed in #17839, and the org
already maintains its rosters as GitHub teams.

## Decision

The `Team Label` job in `.github/workflows/team-labeler.yml` labels a PR in two independent ways.

- **Area labels** (`UI`, `backend`, `Ingestion`, `devops`, `spec`, `documentation`) come from the
  changed files through `actions/labeler` and `.github/labeler.yml`. A PR gets every area it
  touches. No person is listed anywhere.
- **`safe to test`** is added when the author is an active member of the org, checked through the
  API, or is on `safe-to-test.allow` in `.github/team-config.yml`. Authors on `safe-to-test.deny`
  never get it. The fork-sync step still removes the label on every push to a fork, before the
  author is checked again.
- Reading private org membership needs `members:read`, which the default `GITHUB_TOKEN` lacks. A
  GitHub App token minted from `vars.TEAM_READER_APP_CLIENT_ID` and
  `secrets.TEAM_READER_APP_PRIVATE_KEY` provides it, scoped to that one permission.
- `.github/team-config.yml` holds only exceptions: the people the GitHub rosters can't express.

## Consequences

Offboarding is one action: removing someone from the org removes their CI trust on their next PR
event. Labels need no upkeep beyond adding a glob to `labeler.yml` when a top-level module is added;
a path matching no glob gets no area label. A missing or failing token fails closed: only
allow-listed authors are trusted and a maintainer adds the label by hand. The job never fails on
it, because six CI workflows wait on the `Team Label` check. Runs triggered by Dependabot get no
Actions secrets, which is why the bots trust through the allow list rather than membership.
