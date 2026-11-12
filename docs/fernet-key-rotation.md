# Rotating the Fernet key

OpenMetadata encrypts the secrets it stores with the Fernet key in `fernetConfiguration.fernetKey`
(`FERNET_KEY`). These include service connection passwords, bot tokens, ingestion pipeline secrets,
alert and profile webhook secrets, settings such as the SMTP password, session refresh tokens and
MCP OAuth tokens. The value can list several keys separated by commas. The first key encrypts, and
every key in the list decrypts.

This procedure replaces the key while the servers keep running. Nobody enters a secret again.
The servers first learn the new key. Then `rotate-fernet-key` re-encrypts every stored value with
it. You remove the old key only after the command confirms that no stored value still needs it.

The procedure does not rotate the secrets themselves. With an external secrets manager (AWS,
Azure, GCP, Kubernetes), OpenMetadata stores encrypted `secret:` references, and this procedure
re-encrypts those references. Rotate the secrets inside the manager with the manager's own tools.
To rotate the JWT signing key, see [jwt-signing-key-rotation.md](jwt-signing-key-rotation.md).

## Before you start

- Every server, and the host that runs `openmetadata-ops.sh`, runs a release that has the
  `rotate-fernet-key` command.
- The ops host's configuration points at the servers' database, with the same database user. When
  `cacheConfig.provider` is `redis`, it also points at the same Redis, with the same keyspace.
- The ops host's clock is within a minute of the servers' clocks. A token stamped more than a
  minute ahead of the ops host's clock does not open there, and the report counts it as No key.
- Back up the database.

Below, OLD is the current key and NEW is the new one. Create NEW with:

```bash
openssl rand -base64 32
```

OpenMetadata accepts a key in base64 or base64url.

### Key fingerprints

Keys are never printed. Servers and the command print a fingerprint for each key, which is the
first 12 hex digits of the SHA-256 of the key's 32 bytes. Each server logs its keys at startup:

```
Fernet keys: 9f3a1c2e7b40 (primary), 51d0e8aa02c7
```

To compute the fingerprint of a key, in either spelling:

```bash
python3 -c "import base64,hashlib,sys; k=sys.argv[1].replace('-','+').replace('_','/'); k+='='*(-len(k)%4); print(hashlib.sha256(base64.b64decode(k)).hexdigest()[:12])" "$KEY"
```

## 1. Give the servers the new key

Set `FERNET_KEY=OLD,NEW` on every server, then restart the servers one at a time. OLD stays the
primary key, so a server that has not restarted yet can still read everything the others write.
With a single server, skip to step 2.

## 2. Make the new key primary

Set `FERNET_KEY=NEW,OLD` on every server, then restart the servers one at a time. Check that the
startup line of each server shows NEW's fingerprint as `(primary)`.

From the last restart on, no server encrypts with OLD. While a server lists more than one key, it
also re-encrypts a session's refresh tokens with the primary key each time it saves the session.

## 3. Re-encrypt the stored values

On the ops host, with `FERNET_KEY=NEW,OLD`, run the command once to see the counts. Then run it
with `--apply`:

```bash
./bootstrap/openmetadata-ops.sh -c <config.yaml> rotate-fernet-key
./bootstrap/openmetadata-ops.sh -c <config.yaml> rotate-fernet-key --apply
```

By default the command leaves out the large tables that cannot hold a secret, such as data assets
and change events. Step 4 reads them once with `--every-table`.

Before `--apply`, check that the first line of the report names NEW's fingerprint as `(primary)`,
as the servers' startup lines do. The command cannot tell which key is new. With the keys in the
wrong order, it re-encrypts everything under OLD.

`--apply` asks for confirmation, and the prompt names the primary key's fingerprint. Add `--yes`
to skip the prompt. Without a terminal, for example in a script, `--apply` runs only with `--yes`.
The command then:

1. Replaces each stored token that an older key opens with a token of the same secret under the
   primary key. It changes nothing else in the stored value. No entity gets a new version, and no
   change event or audit entry is written, because no secret changed.
2. Replaces a value only if it is unchanged since the command read it. A value that a server
   changed in the meantime is read again and re-encrypted. After three failed attempts, the value is
   reported as `CONTENDED`.
3. Reads the same tables again and prints the result. The exit code comes from this second read.

The servers keep running. Users stay signed in, bots keep their tokens, and ingestion pipelines
need no redeploy. Interrupting the command is safe. Every value is replaced in one write, and the
servers hold both keys, so they read old and new values alike. Run the command again to finish.

The report lists each table, and Redis, with its counts:

| Column | Meaning |
|---|---|
| Values | Stored values that hold at least one token |
| Primary | Tokens the primary key opens |
| Older key | Tokens only an older configured key opens |
| No key | Tokens that no configured key opens |
| Unbound | Webhook secrets that the command cannot open for the alert, user or team that holds them, because it cannot tell which one holds them or no configured key opens them for it |
| Not rewritable | Tokens the command will not replace, for example in a table without a primary key or where the database refused the write |
| Re-encrypted, Contended | With `--apply`: tokens replaced, and values that kept changing |

Up to 100 lines follow the table: problems first, then places that still need an older key. The
log lists every problem, and at debug level every place that still needs an older key. A line
names where a value is stored, never the value. When a write fails, the line gives the error's
class and SQL state but not its message, because a database error can quote the row. Rows of entity
tables, entity versions and settings are named by their key. Other rows and Redis keys are named by
a short digest of their key, because some keys, such as session ids, are credentials.

| Exit code | Meaning |
|---|---|
| 0 | Every token the command read opens with the primary key. After a run with `--every-table`, older keys can be removed from the servers |
| 1 | The command failed, for example because the database was unreachable. Values it already re-encrypted stay readable under the configured keys |
| 2 | The command refused to start and changed nothing. Possible causes: no key is configured; `--apply` with a single key; `--apply` with the default key from `openmetadata.yaml` as primary; the prompt was not confirmed; `--apply` without a terminal and without `--yes`; Redis is configured but unreachable; the database has no OpenMetadata tables, for example because the ops host points at another database or schema |
| 3 | Not safe to remove an older key. A token still needs one, or a value cannot be vouched for (unbound, not rewritable, contended, or a table that could not be read). Run `--apply` again, with `--every-table` if the run had it, or fix the places listed |
| 4 | No token needs an older configured key, but some tokens open with no configured key. Those values were already unreadable before the rotation. Removing a key does not change that |

On exit 4, check the listed places. Expired sessions and OAuth tokens written under a key that was
removed earlier are the usual cause. If a server lists a key that the ops host does not, add that
key to the ops host and run again. The same check applies on exit 3 when the listed places are
webhook secrets that no candidate owner opens, because a missing key and a wrong owner look the
same to the command.

## 4. Confirm

Wait at least 5 minutes, so that the servers drop the copies they keep in memory. When the servers
set `cacheMemory.entityCacheTTLSeconds` (`ENTITY_CACHE_TTL_SECONDS`) above 300, wait that long
instead. Then, still with `FERNET_KEY=NEW,OLD`, run the command with `--every-table` and without
`--apply`:

```bash
./bootstrap/openmetadata-ops.sh -c <config.yaml> rotate-fernet-key --every-table
```

This is the one run of the procedure that reads every table, the large ones included, so it takes
longer on a large catalog. Continue when it exits 0, or 4 for values you have checked. On exit 3,
run `rotate-fernet-key --apply --every-table`, then run this step again.

## 5. Remove the old key from the servers

When the run of step 4 exits 0, its last line names the key that every stored value opens with and
the key that can be removed from the servers. Check that they are NEW's and OLD's fingerprints.
Then set `FERNET_KEY=NEW` on every server, and restart the servers one at a time.

## 6. Check from the ops host

The ops host still has `FERNET_KEY=NEW,OLD`. Run `rotate-fernet-key` there once more, without
`--every-table`. A server writes back only values that hold a secret, and the default read covers
every table that can hold one. Exit 0 completes the rotation, because step 4 already read every
table. On exit 3, a server wrote back a value from a copy older than step 3.
`rotate-fernet-key --apply` repairs it, and the servers never need OLD again.

## 7. Retire the old key

Remove OLD from the ops host. Keep it in your vault while you keep backups taken before step 3.
To restore such a backup, run `rotate-fernet-key --apply --every-table` with `FERNET_KEY=NEW,OLD`
on the ops host before you start the servers.

## Rolling back

Before step 3, set `FERNET_KEY=OLD,NEW` and restart the servers. Keep NEW in the list, because
values written while NEW was primary need it. To remove NEW later, run this procedure with OLD as
the new key.

After step 3, roll back by keeping both keys, in either order. Never configure OLD alone. Values
re-encrypted in step 3 open only with NEW.

## After a suspected leak

Run every step without waiting between them. A leaked key exposes the secrets in every copy of the
database encrypted with it. The rotation protects the database from then on. It does not protect
backups, replicas or exports taken before step 3. If such a copy may be in the wrong hands, change
the secrets themselves at their source, for example the database passwords that service
connections use.

## What the command reads

- Every table of the OpenMetadata database schema that has a column able to hold a token: JSON,
  text, character, binary or blob columns that are not generated and are at least 100 characters
  wide. Columns are chosen by type, not by name, so tables that a later release, a distribution or
  the workflow engine adds are read without changes to the command. Generated columns are left
  out because the database recomputes them from the column the command rewrites.
- Every key under the configured `cacheConfig.redis.keyspace`, when `cacheConfig.provider` is
  `redis`. With a blank keyspace, the servers write the entity cache under `:` and sessions under
  `om:`, and the command reads both. A rewritten key keeps its time to live.

By default, the command leaves out the large tables that cannot hold a secret, such as data assets,
change events, relationships and time series. It then reads entity versions only for the entities
of the tables it does read. The report names every table it left out. `--every-table` reads those
tables and every entity version as well. Only a run that left nothing out says that an older key
can be removed, so the procedure runs `--every-table` once, in step 4.

The command does not read the contents of an external secrets manager, the search indexes (they
hold no secrets) or anything outside the database and Redis, such as Airflow.
