# Existing pull_request_target workflows use an explicit event policy

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `.github/scripts/tests/test_actions_event_policy.py` (local validation); administrator read-back and Policy insights for live state
- **Related:** https://github.com/open-metadata/OpenMetadata/actions/runs/42653592538

## Context

GitHub's default event policy prevented the Python workflow from starting on PR #37295.
The failure happens before Team Label or any `safe to test` check can execute. Retaining
`pull_request_target` requires an explicit Actions event policy outside the workflow YAML.
The requested direction is to preserve the existing maintainer approval model.

## Decision

Keep the existing workflow triggers and authorization gates. Store the administrator-applied
event policy in `.github/actions-policies/pull-request-target.json`, targeting the existing
`pull_request_target` entry points by exact path and retaining all of their declared events.
Include Team Label because CI waits for its check. Do not add a repository-wide wildcard or
replace inherited actor restrictions with the in-workflow label check.

The automatic approval list remains `.github/teams.yml`. Manual `safe to test` approval remains
possible for outside contributors, and fork synchronization continues to invalidate the label.
Metadata and maintenance workflows retain their separate controls. Authorizing execution of
PR code is a trust decision, not isolation from that code.

## Consequences

Repository changes alone do not unblock Actions. An administrator must apply the reviewed
payload, preserve other applicable policies, and verify live execution. New workflow entry
points require a scope review and policy update. Local validation detects path/event drift but
does not prove that GitHub's deployed policy matches the file.

The [activation runbook](../../.github/actions-policies/README.md) links the GitHub policy
documentation and describes inspection, application, validation, recovery, and rollback.
