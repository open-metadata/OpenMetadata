# Tableau connected apps sign in with a direct trust HS256 JWT that carries a fixed scope set and lives five minutes

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Akash Verma
- **Guard:** `ingestion/tests/unit/source/dashboard/tableau/test_connection.py`, `ingestion/tests/unit/topology/pipeline/test_tableaupipeline_connection.py`, the `connected_app` runs of `ingestion/tests/integration/tableau/` and `ingestion/tests/integration/tableaupipeline/`
- **Related:** [#33371](https://github.com/open-metadata/OpenMetadata/issues/33371)

## Context
The Tableau dashboard and pipeline connectors signed in only with a username and password or a
personal access token, both tied to one person. A Tableau connected app lets an administrator issue
credentials that sign in as a chosen user without that user's password. On Tableau Cloud 2026.3.2
(REST API 3.30) we measured the following:

- A direct trust connected app accepts only HS256 tokens signed with the app's secret value.
  RS256 is rejected at sign-in with `401001`. RSA keys belong to OAuth 2.0 trust (EAS).
- Every call the two connectors make, including both Metadata API queries, returned the same result
  as a PAT sign-in when the token carried `tableau:content:read`, `tableau:users:read`,
  `tableau:server:read`, `tableau:flows:read`, `tableau:flow_runs:read`, `tableau:jobs:read` and
  `tableau:tasks:read`. With only `tableau:content:read`, the owner, flow, flow run, job and task
  calls fail with `401002 "Invalid authentication credentials were provided."`, the same answer as
  bad credentials.
- Each client signs in once, and the session it gets outlives the token. The pipeline client's
  transport retries a sign-in that Tableau answers with 429 or 5xx, re-sending the same token, which
  Tableau accepts only until it expires.

## Decision
- A new `authType`, `TableauConnectedAppAuth` (`clientId`, `secretId`, `secretValue`, `username`),
  is shared by `tableauConnection.json` and `tableauPipelineConnection.json`.
- `build_server_config` signs an HS256 JWT with the secret value: header `kid` = secret ID and
  `iss` = client ID; claims `iss` = client ID, `sub` = username, `aud` = `tableau`, a new `jti` per
  sign-in, `scp` = the seven scopes above, and `exp` five minutes after signing. It passes the token
  as `TSC.JWTAuth(jwt=..., site_id=...)`. `site_id` is a keyword because the second positional
  parameter is `isUat`.
- The scope set and the five-minute lifetime are module constants
  (`CONNECTED_APP_SCOPES`, `CONNECTED_APP_JWT_LIFETIME`), not configuration.
- A connected-app connection gets its own test-connection error pack: a 401 names the app's checks and the
  scopes, and unresolved owners name `tableau:users:read`. Basic and PAT connections keep their hints.
- The supported floor is Tableau Cloud and Tableau Server 2023.3, per Tableau's documentation:
  Server 2022.3 to 2023.2 accepts connected app tokens for the REST API but not the Metadata API,
  so data models and lineage are missing. Server was not tested live.

## Consequences
An administrator can give OpenMetadata a credential that is not a person's password or PAT, but the
calls still run as `username`, with that user's permissions. On Tableau Cloud that is the user's
email address; on Tableau Server, the user name. The host clock must be correct, because Tableau
rejects a token outside its validity window, and Tableau Cloud caps that window at ten minutes.
OAuth 2.0 trust, unified access tokens, impersonation, per-site scopes and token refresh are not
supported. Revisit the fixed scope set if a connector starts calling an endpoint outside it, or if a
site must issue tokens with fewer scopes. Revisit the lifetime if a client ever signs in again
during a run.
