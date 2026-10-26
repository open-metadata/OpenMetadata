# Every request on the application context starts and ends with clean per-request thread state

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `PerRequestContextCleanupFilterTest` (the filter); `reviewer` (its registration and
  order in `OpenMetadataApplication.run`)
- **Related:** `PerRequestContextCleaner`, `ImpersonationCleanupFilter`

## Context

The request entity cache, impersonation, persona and domain contexts live in thread-locals.
`ImpersonationCleanupFilter` clears them at the end of every Jersey response, and background pools
call `PerRequestContextCleaner` themselves. Servlets and filters outside Jersey (the MCP transport,
the WebSocket handshake, `/callback`, the SAML ACS) run on the same Jetty threads and cleared
nothing. An entity one of them cached, such as a bot user read for a token check, stayed on the
thread and could answer a later request's lookup, including a token check that reads with
`fromCache=false`, since that flag only changes the request cache key.

## Decision

- `PerRequestContextCleanupFilter`, a servlet filter on `/*` for `REQUEST` dispatches, calls
  `PerRequestContextCleaner.clear()` before and after the chain.
- It is registered with `isMatchAfter=false` in `OpenMetadataApplication.run`, so it runs before
  the filters registered earlier on the application context and still clears when one of them
  answers without calling the chain. Two filters are prepended after it and run first: Jetty's
  WebSocket upgrade filter and the MCP OAuth discovery filter. Neither reads or sets per-request
  state, and whatever a request they answer leaves behind is cleared when the next request enters
  this filter.
- `ImpersonationCleanupFilter` stays: it clears before Jersey writes the response, and the extra
  clear is a no-op.
- The bot and personal access token loaders also read the user inside `FreshReadScope`, so a token
  reload on a thread this filter does not wrap (startup, the admin port) cannot pick up a stale
  user either.

## Consequences

- Code that runs inside this filter starts with empty per-request state, whatever the thread
  served before.
- A filter prepended later runs before this one; it must not read or set per-request state.
