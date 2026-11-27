# UI Jest runs sharded without coverage on pull requests and in the merge queue

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial); v2 2026-11-26 (Jest runs from the `ui-unit` composite, gated by `ui-tests-status`)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer; `.github/actions/ui-unit` (a failed shard fails the `ui` job, so `ui-tests-status` fails; see the v2 amendment)
- **Related:** ADR:2026-11-11-python-ci-selects-workloads-by-event,
  ADR:2026-11-23-browser-tests-run-by-impact-on-pull-requests-and-in-full-in-the-merge-queue,
  ADR:2026-11-25-ui-sonar-coverage-is-jest-plus-the-browser-suite-from-one-nightly-run

## Context
`ui-coverage-tests` ran the whole Jest suite (2,218 files) with `--coverage` on one runner: about
14 of its 16.5 minutes. Nothing read the result. The PR comment had been hidden since PR runs lost
their write token, the Sonar PR scan was removed in the same change, and there is no
`coverageThreshold`. The same run wrote 1.8M log lines (148 MB), more than half of them a single
query-builder warning repeated 43,701 times.

## Decision
- On pull requests and in the merge queue, `yarn-coverage.yml` runs Jest without `--coverage`,
  split with `--shard=N/4` across four runners, with `--silent`. The SSO dev-server node test runs
  in shard 1 only.
- Jest coverage is collected only by `ui-sonarcloud-nightly.yml` on main, with `--silent` and
  the `lcov` reporter that `sonar-project.properties` reads. This matches Python CI, where
  coverage and Sonar run nightly on main only.
- The required check stays `ui-coverage`. It passes only when every shard succeeds or the tests
  were skipped because no UI path changed.
- `ui-checkstyle.yml` runs `yarn i18n` (`sync-i18n`, about 2 CPU-minutes) only when a file under
  `src/locale/languages/` or `yarn.lock` changed. The tool reads nothing else, so unchanged locale
  files can only drift when the tool's version changes.

## Consequences
PR feedback from Jest drops from about 16 minutes to setup plus a quarter of an uninstrumented run,
at the cost of three more runners' setup time. A coverage drop is not visible before merge. Adding a
coverage gate back means collecting coverage per shard, merging it, and comparing against main.
Report it in the job summary and fail the check; PR jobs post no comments
(ADR:2026-11-10-pr-jobs-never-receive-credentials). If main's locale files ever drift, only the
next PR that touches a locale file or `yarn.lock` reports it.

## Amendment v2 (2026-11-26)
`yarn-coverage.yml` is gone. The `unit` job of `ui-ci.yml`, called as the `ui` job of `ci-pr.yml`
and `ci-merge-queue.yml`, runs the same four shards through the `.github/actions/ui-unit` composite, under
ADR:2026-11-26-ui-ci-runs-from-the-event-entrypoints-behind-one-required-check, and its result
feeds `ui-tests-status` instead of `ui-coverage`. The checkstyle steps, including the i18n rule,
moved to `.github/actions/ui-checkstyle`. Coverage, `--silent` and the nightly are unchanged.
