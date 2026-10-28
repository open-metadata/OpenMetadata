# The flaky-test triage agent drafts fixes and replies; a separate job without agent code publishes them

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `.github/scripts/tests/test_flaky_triage.py`; `fix_problem` and the pending-thread check in `.github/scripts/flaky_triage.py`
- **Related:** open-metadata/OpenMetadata#36468, `.github/workflows/flaky-test-triage.yml`, `skills/flaky-test-triage/SKILL.md`

## Context
An agent triages the flaky Playwright tests posted in #pw-health and opens fix PRs. It reads text anyone
can write: Slack messages, other people's PR titles and bodies, test output. Any token in its environment,
or reachable through a tool it may run, can be leaked by a prompt injection in that text. Opening PRs that
trigger CI needs a PAT, and replying needs the Slack bot token.

## Decision
- The agent job holds only the read-only `github.token` and no Slack token. It leaves fix branches (as a
  git bundle), PR bodies and reply drafts as files.
- A `publish` job that runs no agent code pushes and opens the PRs with the PAT and posts the replies. It
  publishes a fix only if its branch matches `flaky-fix/…` and changes only files under
  `openmetadata-ui/src/main/resources/ui/playwright/`. It posts a reply only under an alert from this run's
  pending list, and only if the reply contains `Flaky triage`.
- A #pw-health alert thread counts as triaged once it has a reply containing `Flaky triage`. That text
  is the contract between runs; a human can add it to stop the agent.
- A fix is drafted only after 10 consecutive retry-free runs of the spec against the job's own stack. The
  agent stops after two red rounds, and fixes never add retries, waits, longer timeouts or skips.
- A fix for the same spec from the last 7 days is reused instead of opening another PR.
- Scheduled runs look back 7 hours: the 300-minute triage timeout plus the hourly cron. A queued run then
  misses no alert, and the marker prevents double replies.

## Consequences
The agent cannot push, open PRs, post to Slack, or change anything outside `playwright/`, whatever text
it reads. A fix that needs a product change is out of scope by construction: the agent reports the RCA
instead. Widening the path allowlist, or giving the agent a write token, needs a new record.
