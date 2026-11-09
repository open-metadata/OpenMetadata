# Keeping pull_request_target workflows available

[`pull-request-target.json`](pull-request-target.json) is a repository Actions event policy
payload for `open-metadata/OpenMetadata`. **Committing this file does not activate it.** A
repository administrator must apply it through GitHub's Actions policies API or reproduce it
under **Settings → Actions → Policies**.

GitHub's default event policy blocks a workflow before any job can run. A `safe to test` label
or an `allow-unsafe-pr-checkout` input therefore cannot resolve that startup failure. See
[GitHub's default policy documentation](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target).

## Scope and existing approval

The payload targets the 20 existing workflow entry points that use `pull_request_target`,
including Team Label, PR metadata automation, and merge-queue maintenance. It allows the union
of their existing events so that merge-queue, push, scheduled, and manual runs remain possible.
It does not add triggers to a workflow. There is no wildcard that would automatically opt new
workflow files into the exception.

The event policy and the in-workflow authorization serve different purposes:

- [`.github/teams.yml`](../teams.yml) contains the **automatic approval** list.
- [Team Label](../workflows/team-labeler.yml) removes `safe to test` on a fork's `synchronize`
  event, then reapplies it for allowlisted authors. A contributor outside the list can still
  receive manual approval through the label; GitHub's label permissions control who can grant it.
- CI such as [the shared Python pipeline](../workflows/py-tests-shared.yml) waits for Team Label
  on the PR head and verifies the label before dependent jobs execute PR code.
- Metadata and maintenance workflows have their own controls; they do not all use the CI label
  gate. For example, PR auto-assignment uses API data, and backports require a merged PR.

Retain these controls, the existing checkout opt-ins, token permissions, and credential/cache
restrictions. The label is an authorization to execute the approved PR code, not a sandbox.
This change preserves that trust decision; it does not certify every workflow as secure.
See ADR:2026-11-09-pull-request-target-uses-an-explicit-event-policy.

## Apply as a repository administrator

Run these commands from a reviewed checkout. The token needs repository Administration write
permission. The API payload format and permissions are documented in
[GitHub's Actions policies API](https://docs.github.com/en/rest/actions/policies#create-a-repository-actions-policy).

First inspect existing policies, including inherited organization or enterprise policies:
```bash
gh api --paginate \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  'repos/open-metadata/OpenMetadata/actions/policies?per_page=100&has_parents=true'
```

Use the returned policy IDs and source URLs to inspect applicable rules. Preserve existing actor
restrictions. Policies layer: a repository exception cannot override an explicit denial in an
organization or enterprise policy. If an existing policy already governs these workflows, update
its event rule at the owning level while retaining its other rules and conditions. Do not replace
such a policy with this event-only payload.

If there is no existing custom policy to update, create this dedicated policy once:
```bash
gh api --method POST \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  repos/open-metadata/OpenMetadata/actions/policies \
  --input .github/actions-policies/pull-request-target.json
```

Record the returned ID. For later changes to this dedicated policy, first read its current
configuration, then use `PUT repos/open-metadata/OpenMetadata/actions/policies/POLICY_ID` with
the reviewed payload. Repeated `POST` calls create additional policies.

See [GitHub's policy administration guide](https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution)
for the equivalent UI and Policy insights.

## Validate and recover affected PRs

Before applying an updated payload, use a Python environment with pytest and PyYAML:
```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -q -o addopts='' \
  .github/scripts/tests/test_actions_event_policy.py
```
This local check compares the payload's paths and events with the workflow files and rejects
actor/bypass additions. It is not a live GitHub policy evaluation or an automatically scheduled
CI check. When adding or changing an entry point, review and update the payload and reapply it.

After activation, read back the policy and check that enforcement is `active`, paths match the
payload, and `pull_request_target` is permitted. Then use a maintainer-approved PR to verify
that Team Label starts and the CI jobs pass their authorization step. Also verify that an
unapproved external PR does not reach code-executing jobs.

Startup-failed runs may reject GitHub's rerun API. A maintainer can remove and reapply `safe to
test` to trigger workflows listening for `labeled`; this authorizes the **current** head, so review
it first. Team Label itself listens for opened, synchronized, and reopened PRs, not label events.
If its check is also missing, a fresh opened/synchronized/reopened event is needed. A manual
dispatch is not equivalent to a PR run and may not report the required check on the PR head.

To roll back the new exception, disable this dedicated policy through its settings or update its
enforcement to `disabled`. The default protection may then block these workflows again.
