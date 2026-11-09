# Check persona context filters before upgrading

This release validates saved search-scoped filters when materializing persona context, including
filters created before write-time validation existed. An invalid enabled filter makes context
materialization return HTTP 503 and marks the context cache Failed. Chat cannot use that persona's
context until an administrator corrects or disables the rule. The server retains this explicit
failure rather than silently removing a configured search default.

Before rollout, check existing personas in Context Center → AI Context. Preview each enabled rule
in every enabled persona. Correct filters that return an invalid-query error, or disable those
rules. Disabling an unchanged rule is allowed even if its stored filter is invalid or search is
unavailable. Check the remaining rules and regenerate the persona's document successfully before
finishing rollout.

For an API preflight, page through `GET /api/v1/personas?fields=contextDefinition&limit=100`, using
`paging.after` until it is absent. For every enabled rule in an enabled definition, submit the
unchanged rule body to `POST /api/v1/personas/{id}/aiContext/rules/preview` as an administrator.
Preview does not save or activate the rule. Treat every non-200 response as a failed preflight;
HTTP 400 identifies an invalid filter, while HTTP 503 requires restoring search availability and
retrying. Run this check against staging with a copy of the existing definitions before upgrading
production. The same preview endpoint can check existing definitions on the previous release.

After rollout, regenerating a persona with a missed legacy filter returns HTTP 503 with the
failing rule's name. Open the rule, correct or disable it, then regenerate. Removing a search default does not
change the user's asset permissions, but can change relevance; review the replacement scope with
the persona's owner.

See ADR:2026-11-09-persona-context-keeps-access-preloading-and-search-independent for the access,
preload and search contracts.
