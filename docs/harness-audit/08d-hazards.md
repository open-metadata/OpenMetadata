# Agent-Safety Hazard Audit — What an Autonomous Agent Could Break

**Scope:** things an autonomous coding agent could plausibly destroy or corrupt in this repo,
framed as agent-safety concerns for maintainers. **This was a read-only audit — nothing in this
pass was executed** (no scripts, no `make`, no build, no migration, not even a dry-run flag).

**Prior art reviewed first:** `THREAT_MODEL.md` (metadata-only platform posture),
`SECURITY.md` (GitHub Security Advisory disclosure process), `INCIDENT_RESPONSE.md`, `.snyk`
(+ `ingestion/.snyk`), `bootstrap/MIGRATION_SYSTEM.md`. Those cover *deployment/product* security;
this pass covers *repo-and-tooling* hazards an agent touches while doing dev work, which they do
not address.

> **Item 5 (the CI agent surface / prompt-injection boundary) is deliberately NOT in this file.**
> It was delivered in chat per the task's disclosure instruction.

---

## 1. Destructive operations reachable from the repo

### 1a. `bootstrap/openmetadata-ops.sh` — thin launcher, zero guardrails of its own

`openmetadata-ops.sh` (36–56) resolves a classpath and does
`java … OpenMetadataOperations -c conf/openmetadata.yaml "$@"` — it passes **all arguments
straight through with no allow-list and no confirmation**. Every safety check lives in the Java
`OpenMetadataOperations` subcommands
(`openmetadata-service/src/main/java/org/openmetadata/service/util/OpenMetadataOperations.java`).
Note also line 53: if `libs/` is absent it silently shells out to
`mvn -pl openmetadata-service … exec:exec` to compute the classpath — i.e. running the script can
trigger a Maven build.

The subcommand list (from the usage string, OMOps:194–200): `info, validate, repair,
check-connection, drop-create, changelog, migrate, migrate-secrets, reindex, reembed, reindex-rdf,
reindexdi, deploy-pipelines, dbServiceCleanup, relationshipCleanup, tagUsageCleanup, drop-indexes,
remove-security-config, create-indexes, …`. The destructive ones:

| Subcommand | What it destroys | Confirmation? | Agent-misfire risk |
|---|---|---|---|
| **`drop-create`** (OMOps:1097 → `dropAllTables` 3269) | **Every table in the OM database.** MySQL: `SET FOREIGN_KEY_CHECKS=0` then `DROP TABLE IF EXISTS` per table; Postgres: `DROP TABLE … CASCADE` per table. Then recreates schema + search indexes → **total metadata wipe.** | **Yes but bypassable** — `promptUserForDelete()` (3305) reads stdin with a `Scanner` and loops until you type `DELETE` (`QUIT` → `System.exit(1)`). With no TTY the `Scanner` throws → caught by the outer try → returns 1 (safe abort). But it is trivially satisfied by piping `DELETE` on stdin. | **HIGH.** An agent wanting to "reset the local DB for a clean test" would reasonably pipe `echo DELETE`. The typed-`DELETE` prompt is the *only* guard and it is defeatable non-interactively. |
| **`dbServiceCleanup`** (OMOps:1261) | Immediately deletes DB-service entities the DAO deems "broken": `removeBrokenTables()`, `removeBrokenDatabaseSchemas()`, `removeDatabase()`. | **None. No dry-run, no prompt.** | **MED.** No guard at all; scoped to "broken" rows, but an agent running it "to tidy up" deletes metadata on the spot. |
| **`drop-indexes`** (OMOps:2441) | Deletes **all** Elasticsearch/OpenSearch indexes for every entity type + DataInsights data streams. | **None.** | **MED.** Source DB intact and rebuildable via `reindex`/`create-indexes`, but search is down until a full reindex. No guard. |
| **`migrate --force`** (OMOps:1183) | Re-runs already-applied migrations. Documented to have **lost data** (roles, policies, bot relationships) — the sibling `recover` command (OMOps:1210–1214) exists specifically to undo "you ran migrations with `--force` after upgrading and lost data." | `--force` has no prompt (that is the footgun). | **MED.** `--force` reads as benign ("just re-run migrations") but is a known data-loss trigger. |
| **`remove-security-config`** (OMOps:2592) | Removes stored security/auth configuration from the DB. | Prompts `Enter 'DELETE' to confirm` (2612) unless `--force` (2598). | LOW–MED (guarded by default). |
| **`update-security-config`** (OMOps:704) | Overwrites stored security config from a YAML file. | Prompts unless `--force` (716; check at 770). | LOW–MED (guarded by default). |
| `relationshipCleanup` (OMOps:1323) | Orphaned relationships + broken hierarchy entities. | **Dry-run by default; requires `--delete`.** | LOW — safe-by-default design. |
| `tagUsageCleanup` (OMOps:1394) | Orphaned tag usages. | **Dry-run by default; requires `--delete`.** | LOW — safe-by-default design. |

**Inconsistency worth noting:** `relationshipCleanup`/`tagUsageCleanup` default to dry-run (good),
but `dbServiceCleanup` and `drop-indexes` delete immediately with no dry-run and no prompt — the
safety model is applied unevenly across sibling cleanup commands.

### 1b. `docker/run_local_docker.sh` — the documented "test locally" command wipes local DB by default

`run_local_docker.sh` (17) → `run_local_docker_common.sh:run_local_docker_main`. Hazards:

- **`cleanDbVolumes` defaults to `true`** (`run_local_docker_common.sh:351`, `${cleanDbVolumes:=true}`;
  help text line 26 confirms "Default [true]"). When true (lines 389–397) it runs
  **`rm -rf "$PWD/docker/development/docker-volume"`** — deleting the entire local database volume —
  and, if that fails and passwordless sudo is available, escalates to
  **`sudo rm -rf`** (392–393). **No confirmation prompt.**
- Unconditionally runs `docker compose … down --remove-orphans` on both compose files (359–360),
  stopping/removing any running local stack.

**Why this matters:** `CLAUDE.md` documents `./docker/run_local_docker.sh -m ui -d mysql` as the
"complete local setup" command, and the `test-locally` skill drives the same script. An agent
running it to "spin up a local instance and test" **silently destroys any existing local metadata
DB** by default (you must pass `-r false` to keep it), and can invoke `sudo rm -rf`. `$PWD` is
pinned to the repo root (356), so the delete is scoped to `<repo>/docker/development/docker-volume`
— but that is exactly the developer's local database.

Other `docker/` scripts (`openmetadata-start.sh`, `start/stop-rdf-services.sh`,
`rdf-store/entrypoint.sh`, `run_local_docker_rdf.sh`) are start/stop wrappers; the destructive
default is the `docker-volume` deletion above.

---

## 2. Migration hazards (`bootstrap/sql/migrations/{flyway,native}`)

**Convention:** append-only — an applied migration file must never be edited. Reality:

### What enforces append-only today: **nothing automated.**
- **No CI workflow references migrations at all** — grepping all 59 `.github/workflows/*.yml` for
  `migration` / `schemaChanges` / `bootstrap/sql` returns nothing. No PR check guards these files.
- **No pre-commit guard** — a root `.pre-commit-config.yaml` exists but does not mention migrations.
- **No runtime checksum-abort.** Unlike stock Flyway (which fails startup if an applied migration's
  checksum changed), the OM runner does **not** validate stored checksums to reject a tampered file.

### What actually happens if an applied migration is edited (traced in `MigrationWorkflow` + `MigrationFile`):
The runner filters by *version* recorded in `SERVER_CHANGE_LOG`
(`MigrationWorkflow.resolveApplyMigrations` 284 → `getMigrationsToApply` 308 →
`processNativeMigrations` 317):
- **Edited migration in an already-applied version *outside* the current release-train reprocessing
  window** → the version is in `executedMigrations` and not selected → **skipped entirely**. The edit
  **never runs on existing databases**; it only runs on a *fresh* install → **silent schema drift**
  between upgraded and fresh deployments, with no error.
- **Edited migration *inside* the current release train** → it is "reprocessed":
  `filterAndGetMigrationsToRun` (165–184) calls `MigrationFile.parseSQLFiles()` then skips only if
  `isReprocessing() && !hasNewStatements()`. `hasNewStatements()` (`MigrationFile.java:206–213`) hashes
  **each statement** (`EntityUtil.hash(query)`) and checks `migrationDAO.checkIfQueryPreviouslyRan()`.
  So a *changed* statement gets a new hash → runs as if new, **but the original statement already ran
  and is not rolled back**; a *deleted* statement simply never re-runs (its past effect persists).
  Net: partial, order-dependent application with **no error raised**.

Either path fails silently. An agent "fixing a typo in a migration", reformatting SQL, or
"correcting" an old `schemaChanges.sql` would produce drift or partial application that neither CI
nor the server startup would flag.

### Doc vs. reality
`MIGRATION_SYSTEM.md:41` describes `SERVER_CHANGE_LOG.checksum` as "Hash of migration content for
**integrity validation**", and 48–49 the per-statement `SERVER_MIGRATION_SQL_LOGS.checksum`. In
code the checksum is used for **statement-level idempotency / reprocessing**
(`MigrationFile:206–213`), **not** to detect or reject tampering — there is no integrity gate that
aborts. The doc oversells "integrity validation." `MIGRATION_SYSTEM.md:148` ("Use `--force` … only
if absolutely necessary") hints at the `migrate --force` data-loss risk (§1) but does not state that
`--force` can delete data. (Counts today: 82 native version dirs, 16 flyway MySQL scripts — all
committed and, by convention, frozen.)

---

## 3. Generated-output hazards — authoritative list from codegen config

Verified from the generator **configuration** (not directory names). Source for every generator is
the single canonical tree `openmetadata-spec/src/main/resources/json/schema/**` (ANTLR uses
`openmetadata-spec/src/main/antlr4/org/openmetadata/schema/*.g4`). **The shape differs per language
— Java generated output is build-time under `target/`, never committed; the TypeScript tree is the
one committed generated tree.**

| Generator | Output path (glob) | Committed? | Gitignore |
|---|---|---|---|
| datamodel-code-generator (Pydantic) | `ingestion/src/metadata/generated/**` (incl. `…/generated/schema/**`) | No — build-time | `.gitignore:108` |
| jsonschema2pojo (Java POJOs) | `openmetadata-spec/target/generated-sources/jsonschema2pojo/**` (plugin default; `openmetadata-spec/pom.xml:171–197` sets no `<outputDirectory>`) | No — build-time under `target/` | `.gitignore:17` (`target/`) |
| **quicktype (TypeScript)** | `openmetadata-ui/src/main/resources/ui/src/generated/**` **except** `…/src/generated/antlr/**` | **YES — committed (887 tracked files)** | not ignored (intentional) |
| ANTLR — Python (`make py_antlr`) | `ingestion/src/metadata/generated/antlr/**` | No — build-time | `.gitignore:108` |
| ANTLR — JavaScript (`make js_antlr`) | `openmetadata-ui/src/main/resources/ui/src/generated/antlr/**` | No — build-time | `.gitignore:120` |
| parseSchemas.js (`yarn parse-schema`) | `openmetadata-ui/src/main/resources/ui/src/jsons/{connectionSchemas/connections,ingestionSchemas,governanceSchemas,applicationSchemas,configuration}/**` | No — build-time | `.gitignore:97` |

Also ignored: `ingestion-core/src/metadata/generated/**` (`.gitignore:107`, sibling module, not part
of `make generate`).

### Guidance for the blocking hook (prompt 9) — precision matters across 309 open PRs
- **Two distinct edit outcomes.** For the build-time trees, an agent edit is *futile* (regenerated /
  `rm -rf`'d on next build; can't even be committed — gitignored). For the **committed quicktype TS
  tree**, an edit is a *real, committable diff* that a hand-edit corrupts and the next
  `json2ts-generate-all.sh` overwrites. The hook should cover both, but they are different failure
  modes.
- **`make generate`'s destructive step:** `Makefile:56` does `rm -rf ingestion/src/metadata/generated`
  before regenerating — anything an agent hand-wrote there is deleted without warning.
- **Two false-positive traps — do NOT block these as "generated":**
  1. `openmetadata-ui/src/main/resources/ui/src/generated/antlr/**` is ignored, but the **rest** of
     `src/generated/**` is committed — a matcher must not assume all of `src/generated` is build-time
     (or, conversely, treat the committed TS as freely editable).
  2. `openmetadata-ui/src/main/resources/ui/src/jsons/` contains **two hand-maintained committed
     files** — `src/jsons/profilerSettings.json` and `src/jsons/ssoSchemas/ssoConfigurationUISchema.json`
     — that parseSchemas.js never writes. A blanket `src/jsons/**` guard would wrongly block
     legitimate edits to these.
- **Over-broad matcher risk:** a `**/generated/**` glob would also catch unrelated dirs; prefer the
  exact roots above. The Java POJOs live under `target/` and never appear in a PR, so a hook keyed on
  `target/**` is redundant with `.gitignore` and only adds noise.

---

## 4. Secrets — where credentials enter, and what an agent could commit by accident

*(Location + type only; no credential values are reproduced. Line numbers are in the named files.)*

### Where secrets enter
1. **`conf/openmetadata.yaml` (committed / tracked).** Env-interpolated `${VAR:-default}`. Most
   sensitive keys default to **empty** — `oidcConfiguration.secret` (470, with an in-file "NEVER
   commit this!" comment), SAML keystore password (513), LDAP passwords (518/538), Elasticsearch
   creds (564/567), AWS creds (586–588 and 690–693), LLM `apiKey`s (605/621/625),
   `secretsManagerConfiguration` (752–756), redis (879). But several have **functional hardcoded
   fallbacks**: `database.password` (332), asset-uploader S3 `secretKey` (402),
   `pipelineServiceClient.password` (Airflow, 704), RDF remote password (851), and — most notably —
   `fernetConfiguration.fernetKey` (741–742), which encrypts stored connection credentials and
   defaults to the **well-known OSS Fernet key**. `jwtTokenConfiguration` (551–554) references the
   committed `conf/private_key.der` / `conf/public_key.der` with a hardcoded `keyId`.
   `conf/openmetadata-h2-test.yaml` mirrors these. **No SMTP/email block exists** in the file.
2. **docker-compose + docker scripts (committed; intentional local-dev defaults).** DB / Airflow /
   MySQL-root passwords and the same default Fernet key across `docker/development/*`,
   `docker/docker-compose-*`, `docker/mysql/mysql-script.sql`, `docker/postgresql/postgres-script.sql`;
   a Keycloak admin default and a SAML test-user password under `docker/local-sso/**`; and a
   committed RS256-signed **default admin JWT** at `docker/run_local_docker_common.sh:15` (pairs with
   the committed private key). The default Fernet key literal is duplicated across **13+ files**.
3. **Committed key material (sample/test keypairs — intentional, but real private keys).**
   `conf/private_key.der` + `public_key.der`; `*.der` / `*_pkcs8.pem` (BEGIN PRIVATE KEY) / `*.p12`
   keystore / `saml/mock-idp-pkcs8.key` under `openmetadata-service/src/test/resources/**`; matching
   keypairs under `openmetadata-integration-tests`, `openmetadata-mcp`, and `openmetadata-sdk` test
   resources; inline PEM private keys embedded in many `ingestion/tests/**` files and in
   `SamlValidatorTest.java`.
4. **Example workflow configs.** `ingestion/src/metadata/examples/workflows/*.yaml` — 61 files carry
   a `password:` field (sampled values are dev placeholders); `kinesisfirehose.yaml` uses AWS's
   documented EXAMPLE key pair. A stale copy exists under `ingestion/build/lib/…`.
   *Confirmed placeholders* (not real, noted so the pattern is clear): AWS `AKIA…EXAMPLE` pairs across
   several Java tests; UI `Service.mock.ts` masks secrets as `*****`.

### What's already gitignored / scanned — and the gaps
- Committed, **not** ignored: `conf/openmetadata.yaml`, `conf/*.der`, the docker-compose files,
  `docker/local-sso/**`.
- `.gitignore` covers `.env`, `.env.local`, playwright `.auth`, `docker-volumes/`, `security-report`,
  `scan-requirements.txt` — but has **NO rule for `*.pem` / `*.der` / `*.key` / `*.p12` / `*.jks` /
  `keystore`**. Nothing stops a new key/cert from being committed.
- **No dedicated secret scanner in CI** — grep of `.github/workflows/**` for gitleaks / trufflehog /
  detect-secrets / git-secrets / ggshield → none. What runs is Snyk Open Source + Snyk Code (SAST) +
  Retire.js (`security-scan.yml`) and CodeQL (`codeql.yml`); none of these detect committed secrets.
- Snyk Code **excludes the fixture dirs** (`.snyk` + `ingestion/.snyk`): `ingestion/{examples,tests}/**`,
  `ingestion/src/_openmetadata_testutils/**`, `ingestion/src/metadata/sdk/examples/**`, the UI mocks,
  and **`openmetadata-service/src/test/**`** — so every committed-key location in (3) is unscanned even
  by SAST.

### What an agent could commit by accident (the hazard)
1. **Filling an empty `${VAR:-""}` in a tracked config with a real value** — replacing the empty OIDC
   secret (470), AWS keys (586–588 / 690–693), LLM `apiKey`s (605/621/625), or `FERNET_KEY` (742) with
   a live secret to "make it work" lands it in a committed file with no scanner to catch it.
2. **Dropping a real credential into an excluded fixture path** — the repo already normalizes
   committing `*.der`/PEM/`p12` test keys under exactly the dirs Snyk excludes, giving an agent a
   strong "this is the pattern" precedent to imitate with a *real* key, invisible to every current scan.
3. **Committing a new key/cert file** — no key-extension gitignore rule, and committed sample keys
   already sit in `conf/` and test dirs, so a generated real private key written beside them is tracked
   by default.
4. **Rotating a shared default to a real one** — the default Fernet key / admin JWT are duplicated
   across 13+ files; "rotating" one could paste a production secret into a tracked dev file.

**Context (not an incident):** the committed keypairs, default admin JWT, and default Fernet key are
the project's **intentional public local-dev/test defaults** — shipped in every checkout, documented
to be replaced in production — not leaked live credentials. I found **no evidence of a real/live
production secret committed.** The agent-safety risk is the *precedent plus the absence of any
detection*, which is what would let a genuinely sensitive value slip through unnoticed.

---

## 6. Vendored / shaded code (`openmetadata-shaded-deps`)

**What it is:** a Maven module (`packaging: pom`, `openmetadata-shaded-deps/pom.xml`) with two
children, `elasticsearch-dep` and `opensearch-dep`. It is **not vendored source** — there is no
copied third-party code. Each child pulls an upstream client jar and **relocates its packages** with
`maven-shade-plugin`. For `elasticsearch-dep/pom.xml` (128–154): `org.elasticsearch` →
`es.org.elasticsearch`, `co.elastic.clients` → `es.co.elastic.clients`, `org.apache.lucene` →
`es.org.apache.lucene`. `opensearch-dep` does the analogous relocation under an `os.*` prefix.

**Why it exists:** OpenMetadata supports **both** Elasticsearch and OpenSearch, whose client jars
share package names and would collide on one classpath. Relocating each behind `es.*` / `os.*` lets
`openmetadata-service` depend on both simultaneously. The relocated `es.*`/`os.*` packages are what
the service imports (e.g. `es.co.elastic.clients.*`).

**The only files are `pom.xml` per module** (committed) plus `dependency-reduced-pom.xml`, which is a
shade-plugin build artifact and is **not tracked** (`git ls-files` returns nothing for it) — it sits
on disk from a prior build and looks like a real pom.

**Would an agent know not to edit it? No.**
- It is **not mentioned in `CLAUDE.md`, `AGENTS.md`, or `DEVELOPER.md`** (grep: no match for
  `shaded`), and it is **not in any off-limits list**. There is **no README** in the module.
- The only editable-looking files are poms; nothing signals that the `es.*`/`os.*` relocations are
  load-bearing.
- **Failure mode:** an agent "upgrading the elasticsearch-java version," "removing the odd `es.`
  prefixes," or editing the relocation block would break the ES/OS classpath separation, producing
  cascading `es.co.elastic.clients does not exist`-style compile failures across
  `openmetadata-service` (a known fragility whose fix is rebuilding `openmetadata-shaded-deps`, not
  editing the imports). An agent could also waste effort editing the untracked
  `dependency-reduced-pom.xml` believing it is the real pom.
