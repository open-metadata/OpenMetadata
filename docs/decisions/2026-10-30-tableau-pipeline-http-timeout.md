# Tableau Pipeline calls time out after 10 s to connect and 60 s of read silence, and a read timeout is not retried

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Akash Verma
- **Guard:** `test_tableaupipeline_client.py::TestNetworkLimits::test_a_stalled_server_fails_instead_of_hanging`
- **Related:** open-metadata/OpenMetadata#26500

## Context

The `tableaupipeline` client gave tableauserverclient no `timeout`, so every REST and Metadata API
call could wait forever. Against a host that accepted the connection and never answered, the CLI
was still waiting after 20 minutes. UI Test Connection sat at "Establishing connection… 20%" past
15 minutes, although each step has a 180 s budget. urllib3 counted that budget's alarm as a read
error and retried it, so the budget never ended the step.

## Decision

Every call the client makes passes `timeout=(10, 60)`: 10 s to connect, as the shared OpenMetadata
REST client does, and 60 s without a byte from the server. Tableau Server cancels a Metadata API
query after `metadata.query.limits.time`, 20 s by default, and Tableau recommends raising it to no
more than 60 s; Tableau Cloud documents no value, and 30 s cancellations are seen in practice. The
REST calls the connector makes answered within 0.5 s on a live site. 60 s also keeps a stalled host
inside the 180 s Test Connection step: the version lookup and the sign-in time out one after the
other in about 120 s, where the shared client's 300 s would not. The retry policy raises a read timeout at once instead
of retrying it: the host took the request and went silent, and three more attempts would only
multiply the wait. Other read errors, such as a connection dropped part way, are retried as before.
The Test Connection step alarm reaches urllib3 as a read timeout too, so it now ends the step.

## Consequences

A host that stalls fails a call in about 60 s, and a step within its 180 s budget. Throttling and
restart answers (429, 502-504) are still retried. A Tableau Server slow enough to send nothing for
60 s on a read, such as one whose `metadata.query.limits.time` was raised past Tableau's recommended
60 s, will now fail where it used to wait. If that is ever seen, expose the read timeout in
the connection schema rather than raising the constant.
