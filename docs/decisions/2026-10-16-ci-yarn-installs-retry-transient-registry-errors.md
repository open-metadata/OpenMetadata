# CI yarn installs retry transient registry errors

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer
- **Related:** #35556; RDF Playwright run 38749383300 attempt 1

## Context
Yarn v1 does not retry HTTP 5xx responses on tarball fetches. One `502 Bad Gateway` from
`registry.yarnpkg.com` aborts the whole install and fails the job before any test runs, as it did
in the RDF Playwright run above. `playwright-e2e-reusable.yml` already wrapped its installs in a
retry loop; the other workflows did not.

## Decision
Every CI yarn v1 install whose failure fails the job runs in a 3-attempt loop with 15s then 30s
linear backoff and `--network-timeout 100000`. The loop is written inline in each workflow step,
not in a shared composite action or script: several of these workflows run on
`pull_request_target` with the PR head checked out, where a shared helper would execute the PR's
own copy of it.

Exempt: installs marked `continue-on-error` (their failure cannot fail the job) and the
`frontend-maven-plugin` installs in the poms.

## Consequences
A registry blip costs up to ~45s of waiting instead of a red job. A real outage fails after three
attempts, at most about three install durations plus the waits. A new workflow that runs
`yarn install` copies the same block. Revisit when the UI moves to yarn ≥2, which retries network
errors itself, at which point the loops can go.
