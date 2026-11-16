# Tableau Pipeline signs in again once on a 401 and resends the call once

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Akash Verma
- **Guard:** `test_tableaupipeline_client.py::TestLifecycle::test_a_session_ended_by_another_sign_in_is_renewed`, `::test_a_call_refused_after_signing_in_again_is_not_retried_again`, `::test_a_refused_sign_in_is_not_repeated`
- **Related:** open-metadata/OpenMetadata#36839

## Context

Tableau keeps one session per personal access token: a sign-in with the same token anywhere else
ends the session already open. The `tableaupipeline` client signed in once, so once another process
signed in with its token, every later call answered `401002: Unauthorized Access`. Every flow after
that point got no status or lineage update, and the run exited 1. Tableau Server sessions also
expire on their own during a long run.

## Decision

A 401 on any call except `/auth/` makes the client sign in once with the same credentials and send
that call once more with the new token. The resend carries no hook, so a second 401 reaches the
caller instead of another sign-in, and a refused sign-in raises at once. Each such sign-in logs a
WARNING.

## Consequences

A run survives a session another sign-in ended, or one that expired. The new sign-in ends the
other holder's session in turn. Two pipeline ingestions sharing a token both finish, but each signs
in again on most calls (about 20 times in a run of 18 pipelines). The Tableau dashboard connector does
not sign in again, so when it shares the token it is the one that fails. The README therefore asks
for one token per ingestion. A Metadata API call caught while the session changes can answer 400
with an empty body rather than 401; it is not renewed, so that flow keeps its stored tasks and
misses one lineage refresh. To revisit: Connected App (JWT) authentication allows concurrent
sessions and would make this rule unnecessary.
