# Persona AI context status reads the cache and pages like the persona list

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** @Rohit0301
- **Guard:** `PersonaAIContextIT.aiContextStatusPagesWithTheSameCursorAsThePersonaList`, `PersonaAIContextIT.aiContextStatusListsCachedStateForEveryPersonaAndIsAdminOnly`
- **Related:** PR #35432

## Context
The Context Center AI Context table shows, per persona, how many entities its compiled context
document includes, how much of the budget it uses and how fresh it is. None of that is on the
persona entity — it lives in `PersonaContextCache`. The only existing ways to read it were per
persona: `GET /personas/{id}/aiContext` (one request per row) and `GET /personas/{id}/aiContext/document`,
which compiles the document on a cache miss, so rendering the table would compile every persona.

## Decision
`GET /v1/personas/aiContext/status` returns `ResultList<PersonaContextStatus>`
(`type/personaContextStatus.json`):

- It **pages with the same `listInternal` call, filter and cursor as `GET /v1/personas`**, so a
  client fetches one page of personas and their statuses in parallel with one cursor and joins by
  `personaId`.
- It **only reads the cache** (`PersonaContextCache.snapshot`, local then Redis) and never compiles.
  A persona with nothing cached reports `STALE` with no `lastGeneratedAt` and zero counts.
- `tokensEst` is `ceil(characters / 4)`, the same estimate the document endpoint returns.
- It is **admin-only**, like the document endpoint: cache diagnostics describe a materialization
  non-admins may not trigger or read.

## Consequences
The table costs two requests per page and never triggers compilation. Without Redis, a server
restart empties the cache, so every persona reads as never generated until its document is compiled
again. The persona list and the status list must keep the same ordering and filter; changing either
one's `ListFilter` or `listInternal` call breaks the cursor contract. A token count that is not an
estimate would need the compiled document to record a real tokenizer count.
