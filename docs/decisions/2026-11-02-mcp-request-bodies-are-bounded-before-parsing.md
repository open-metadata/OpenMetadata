# MCP request bodies are bounded before they are parsed: 64 KiB for client registration, 4 MiB for a JSON-RPC message

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `HttpServletStatelessServerTransportTest` (`readBody_readsABodyAtTheLimitAndStopsOneBytePastIt`, `doPost_oversizedMessage_answers413WithoutReachingTheHandler`) and `OAuthHttpStatelessServerTransportProviderTest` (`doPost_oversizedRegistration_answers413WithoutRegistering`), `RegistrationHandlerTest` (`testRedirectUriTooLong_throwsRegistrationException`), `McpOAuthIT` (`registrationOverTheBodyLimitIsRefused`)
- **Related:** ADR:2026-10-31-column-csv-import-bounds

## Context

`POST /mcp/register` needs no credentials and handed the request stream straight to Jackson;
`POST /mcp` joined the whole body into a string. `RegistrationHandler`'s field limits only see the
parsed object, so they run after Jackson has built the full document. The server inflates gzip
request bodies, so a small body on the wire can expand to hundreds of MB of heap, and a client that
stops sending mid-body keeps that memory reachable.

## Decision

- Both entry points read the body through `HttpServletStatelessServerTransport.readBody`, which
  reads at most the limit plus one byte of the inflated stream and refuses anything longer with
  413 before parsing.
- `/mcp/register`: 64 KiB (`MAX_REGISTRATION_BODY_BYTES`), answered `invalid_client_metadata`.
  Metadata that passes `RegistrationHandler` is at most about 31 KB (10 redirect URIs of 2048
  characters are 20 KiB, plus four other URI fields, names and 5 contacts); the rest leaves room
  for an inline `jwks`. A cap below that refuses valid registrations.
- `/mcp`: 4 MiB (`MAX_MESSAGE_BODY_BYTES`), answered with a JSON-RPC `INVALID_REQUEST`. 1 MiB
  would refuse a legitimate `tools/call` carrying a large argument, such as a long description.
- `redirect_uris` entries get the same 2048-character limit as the other URI fields.

## Consequences

A tool call over 4 MiB now fails with 413; raising the limit is a one-constant change but buys
back heap per stalled request. Registrations already stored are not re-checked.
