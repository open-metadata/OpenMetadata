---
description: Schema-first — edit JSON Schemas, regenerate models, never hand-edit generated output
paths: "openmetadata-spec/src/main/resources/json/schema/**,openmetadata-ui/src/main/resources/ui/src/generated/**,ingestion/src/metadata/generated/**"
---

# Schema-first: edit schemas, never generated output

OpenMetadata uses a schema-first approach: JSON Schemas in `openmetadata-spec/` are the single source
of truth and drive code generation across languages. Compliant reference schema:
`openmetadata-spec/src/main/resources/json/schema/entity/data/table.json`.

- **Edit the schema, then regenerate. Never hand-edit generated output** — it is overwritten on the
  next build and, for the committed TS tree, a CI job regenerates/reverts it.
- Generated output by language (authoritative):
  - **Pydantic (Python)** → `ingestion/src/metadata/generated/**` — **gitignored**, `rm -rf`'d and
    rebuilt by `make generate`. Editing it is futile.
  - **Java POJOs** → `openmetadata-spec/target/generated-sources/jsonschema2pojo/**` — build-time under
    `target/`, never committed.
  - **TypeScript** → `openmetadata-ui/src/main/resources/ui/src/generated/**` (except `.../generated/antlr/`)
    — **committed**; the `typescript-type-generation` workflow regenerates it and fails fork PRs whose
    generated types are stale.
- **Enforced:** a `PreToolUse` hook (`.claude/settings.json`) **blocks `Edit`/`Write` to generated
  output** — `openmetadata-ui/src/main/resources/ui/src/generated/**`,
  `ingestion(-core)/src/metadata/generated/**`, and `**/target/generated-sources/**`. It does **not**
  block `make generate` (that's a Bash command, not a file edit), so regeneration is unaffected.
  (The gitignored `parseSchemas.js` outputs under `src/jsons/` are intentionally **not** blocked, to
  avoid false-positiving the two hand-maintained files there — `profilerSettings.json` and
  `ssoSchemas/`.)
- When you modify a schema:
  ```bash
  make generate                              # root-only target — Pydantic models (+ ANTLR)
  mvn clean install -pl openmetadata-spec    # Java POJOs
  yarn parse-schema                          # UI connection/ingestion schemas (build artifact)
  ```
  > **Correction:** `make generate` is a **root-only** Make target — running it after `cd ingestion`
  > fails (`No rule to make target 'generate'`). Run it from the repo root.
- **Schema conventions**: `$id` matches the file path; `title` is camelCase of the filename; `javaType`
  follows `org.openmetadata.schema.{category}.{ClassName}`; use `$ref` for shared types; set
  `additionalProperties: false` on connection schemas. Import generated types **only as types**
  (they are the data-exchange schema; do not add runtime logic to generated modules).
