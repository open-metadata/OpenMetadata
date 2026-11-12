# Rotating the Fernet key re-encrypts every stored token in place, and a key leaves only after a full read finds nothing that needs it

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OpsFernetKeyRotationIT` (on MySQL and PostgreSQL, with Redis when the lane has it: a report run changes no byte; `--apply` exits 0 while a server keeps writing and a user keeps a session; an independent scan finds every token opening under the new key alone, with the original plaintexts; a second run writes nothing; a run with `--every-table` then exits 0 and names the key that can go; the suite server, which never held the old key, then authenticates the bot, sends the alert with its header, decrypts settings and refreshes the session; the old key alone never exits 0; a value no configured key opens exits 4 and is never written; a table without a primary key exits 3; every name on the large-table list is a table that holds no token), `FernetRotationStoresIT` (the columns discovery keeps and leaves out, compare-and-set on both engines and in Redis, a table without a primary key never written, a schema without OpenMetadata tables refused), `FernetTokensTest`, `WebhookSecretAnchorsTest`, `CurrentKeySessionStoreTest`, `KeyRingTest`
- **Related:** #36477, #35788, docs/fernet-key-rotation.md, ADR:2026-11-03-a-webhook-secret-opens-only-where-it-was-written, ADR:2026-11-06-rotating-the-jwt-signing-key-is-a-hard-cut

## Context

The Fernet key list encrypts with its first key and decrypts with any of them, but nothing
re-encrypted a stored value, so an old key could never be removed safely. Fernet tokens sit in
entity rows and every version of them, settings rows and their deployment snapshot, sessions in a
table or in Redis, MCP OAuth tokens, SSO test-login state, the Redis entity cache and the BPMN
bytes the workflow engine deployed. Bound tokens (`fernet:bound:`) open only for the owner and
field they were written for. Servers keep running during a rotation and write some of these values
back from copies they hold in memory.

## Decision

- `openmetadata-ops.sh rotate-fernet-key` reports by default. With `--apply`, it re-encrypts and
  then reads the same places again. The exit code comes from that second read: 0 when every token
  found opens with the primary key and every place in scope was read; 3 when a token needs an older
  key or a value cannot be vouched for (unbound, not rewritable, contended, unreadable store); 4
  when the only finding is tokens no configured key opens; 2 when it refused before reading or
  writing.
- The command finds tokens by reading, not by a list of places. On every run it takes from
  `information_schema` each non-generated JSON, text, character or binary column of the current
  schema that is at least 100 characters wide, and it reads every Redis key under the prefixes the
  servers build from the configured keyspace. The only list of names is the large tables that
  cannot hold a secret. A run leaves them out, and reads entity versions only for the entities of
  the tables it reads, unless `--every-table` is given. The report names every table it left out,
  and only a run that left nothing out says that an older key can be removed.
- A token is replaced in the stored text by a token of the same length for the same plaintext under
  the primary key. Every other byte stays, and no version, change event or audit entry is written.
  Each write is a compare-and-set on the value read; a value that keeps changing is reported
  `CONTENDED` after three attempts.
- A bound token keeps its binding. Anchor rules (`BoundSecretAnchors`, loaded with `ServiceLoader`)
  tie it to its owner and field by calling the owner kind's own functions, such as
  `DestinationSecrets.ownerOf` and `WebhookSecrets.fieldsIn`. A bound token that no rule ties to an
  owner, or that none of its candidate owners opens, is `UNBOUND` and blocks exit 0: a wrong key and
  a wrong owner look the same. A new owner kind of bound tokens ships its anchor rule.
- Every Fernet token the server stores stays findable as text, as `fernet:` in a text, JSON or
  binary column or a Redis value. A storage format that compresses, encodes or encrypts a token
  again needs this record amended first.
- While more than one key is configured, every session write re-encrypts the session's refresh
  tokens with the primary key (`CurrentKeySessionStore`). A rotation never changes a session's
  version.
- An old key leaves the servers only after a run with `--every-table` exits 0. The procedure
  restarts the servers twice (old key first, then new key first) before `--apply`, and its last
  check runs from an ops host that still holds the old key after the servers dropped it. `--apply`
  refuses a single key and the default key from `openmetadata.yaml` as primary.

## Consequences

An admin can rotate the key with no downtime and no secret entered again, and can check at any time
whether a stored value still needs an older key. A default run reads every text-bearing column
outside the large tables; the one run with `--every-table` that clears an old key costs a full scan
on a large catalog. A rewritten settings row makes every server reload that setting once. A server
may still write an older-key token back from a copy taken before the rewrite; the confirming run
and the last run from the ops host find and repair it instead of changing hot write paths. Revisit
if one full read per rotation is too slow, if a large table starts holding secrets, or if the
server starts storing tokens outside the database and Redis.
