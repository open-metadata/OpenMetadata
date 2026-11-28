# Rotating the Fernet key re-encrypts every stored token in place, and a key leaves only after a full read finds nothing that needs it

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial); v2 2026-11-25 (rewrite tables without a primary key via whole-cell compare-and-set, read `apps_extension_time_series` by default, escape Redis glob metacharacters, and report when Redis was not read)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OpsFernetKeyRotationIT` (on MySQL and PostgreSQL, with Redis when the lane has it: a report run changes no byte; `--apply` exits 0 while a server keeps writing and a user keeps a session; an independent scan finds every token opening under the new key alone, with the original plaintexts, including `apps_extension_time_series`; a second run writes nothing; a run with `--every-table` then exits 0 and names the key that can go; the suite server, which never held the old key, then authenticates the bot, sends the alert with its header, decrypts settings and refreshes the session; the old key alone never exits 0; a value no configured key opens exits 4 and is never written; every name on the large-table list is a table that holds no token), `FernetRotationStoresIT` (the columns discovery keeps and leaves out, compare-and-set on both engines and in Redis, tables without a primary key and `apps_extension_time_series` rewritten via whole-cell compare-and-set, Redis keyspaces with glob metacharacters matched literally, a schema without OpenMetadata tables refused), `FernetTokensTest`, `CurrentKeySessionStoreTest`, `KeyRingTest`
- **Related:** #36477, #35788, docs/fernet-key-rotation.md, ADR:2026-11-14-webhook-secrets-are-encrypted-with-the-server-fernet-key, ADR:2026-11-06-rotating-the-jwt-signing-key-is-a-hard-cut

## Context

The Fernet key list encrypts with its first key and decrypts with any of them, but nothing
re-encrypted a stored value, so an old key could never be removed safely. Fernet tokens sit in
entity rows and every version of them, settings rows and their deployment snapshot, sessions in a
table or in Redis, MCP OAuth tokens, SSO test-login state, the Redis entity cache and the BPMN
bytes the workflow engine deployed. Servers keep running during a rotation and write some of these
values back from copies they hold in memory.

## Decision

- `openmetadata-ops.sh rotate-fernet-key` reports by default. With `--apply`, it re-encrypts and
  then reads the same places again. The exit code comes from that second read: 0 when every token
  found opens with the primary key and every place in scope was read; 3 when a token needs an older
  key or a value cannot be vouched for (not rewritable, contended, unreadable store); 4 when the
  only finding is tokens no configured key opens; 2 when it refused before reading or writing.
- The command finds tokens by reading, not by a list of places. On every run it takes from
  `information_schema` each non-generated JSON, text, character or binary column of the current
  schema that is at least 100 characters wide, since the shortest token the server writes is 107
  characters. It reads every Redis key under the prefixes the servers build from the configured
  keyspace. The only list of names is the large tables that cannot hold a secret. A run leaves them
  out, and reads entity versions only for the entities of the tables it reads, unless
  `--every-table` is given. `apps_extension_time_series` is not skipped because app run records
  can carry encrypted app configuration. The report names every table it left out, says explicitly
  when Redis was not read (`cache.provider` is not `redis` on the ops host), and only a run that
  left nothing out says that an older key can be removed.
- A table with a primary key is paged by that key 1000 rows at a time. A page returns only the key
  and whether each column holds `fernet:`, so one statement reads at most 1000 rows however rare
  the tokens are. The flagged cells are then fetched 100 rows at a time, because one cell can hold
  a whole entity document. A table without a primary key is read in one statement and written with
  a compare-and-set matching its indexed scalar columns (when present, so updates on tables such as
  `apps_extension_time_series` use their indexes) and the whole column value read
  (`WHERE indexed_cols = read AND column = read`), rewriting every identical row to the same new
  value. On PostgreSQL, attached child partitions (`pg_class.relispartition`) are excluded from
  separate catalog discovery so partitioned tables such as `activity_stream` are read once through
  their parent (or skipped with it in the default scope), while detached partitions are still read.
  Entity versions
  are read for 500 entity ids per statement, a copy of the 2.1 migration's batch for the same read.
  Redis keys, and the fields and members of hashes, sets and sorted sets, are scanned with
  `COUNT 1000`, which Redis takes as a hint, escaping Redis glob metacharacters in each literal
  keyspace prefix before appending `:*`; a list is read whole. The report keeps at most 100
  problems and 100 places that still need an older key, since a run before `--apply` can find such
  a place in nearly every row, and prints at most 100 of them, problems first. The log lists every
  problem, and at debug level every place that still needs an older key. None of these sizes
  changes the exit code.
- A token is replaced in the stored text by a token of the same length for the same plaintext under
  the primary key. Every other byte stays, and no version, change event or audit entry is written.
  Each write is a compare-and-set on the value read; a value that keeps changing is reported
  `CONTENDED` after three attempts.
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
