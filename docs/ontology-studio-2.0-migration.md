# Ontology Studio 2.0 migration

Ontology Studio adds relational persistence and backfills that are required for 2.0. The changes are present in both clean-install schemas and both native 2.0 upgrade dialects; deploying only application code is not supported.

## Before upgrading

1. Back up the OpenMetadata database and verify restoration in a nonproduction environment.
2. Record the current `RdfIndexApp` and search-index application schedules and custom entity filters.
3. Stop ontology/glossary writes for the migration window. Existing reads may continue until the application is stopped.
4. If RDF is enabled, record Fuseki dataset size and health. The RDF store does not need a backup for correctness because it can be rebuilt, but a snapshot can shorten rollback.
5. Run the upgrade against a copy of production data with the same MySQL or PostgreSQL major version.

## Schema changes

The native `2.0.0` migration creates:

- `relationship_type_entity`;
- `ontology_axiom_entity`;
- `ontology_change_set_entity`;
- `ontology_annex`;
- `ontology_edit_lock`;
- `rdf_inference_rule`.

It also adds nullable `relationshipId` and `relationshipTypeId` columns to `entity_relationship`, a unique stable-ID index, and a relationship-type lookup index. The migration is idempotent at the DDL boundary so a migration retry does not duplicate tables, columns, or indexes.

The clean schemas and upgrade scripts are checked together by `OntologySqlMigrationParityTest` for MySQL and PostgreSQL.

## Data conversion

The 2.0 Java migration converts configured legacy relation types into deterministic first-class `RelationshipType` entities and seeds the system relationship pairs. Existing glossary-term relationship rows receive:

- a deterministic UUID-shaped relationship ID derived from canonical endpoints and relation kind;
- the matching relationship-type ID when a migrated type exists;
- typed JSON metadata for stable ID, source term, relationship type, provenance, status, creator, and creation time.

Legacy attribution that cannot be recovered is represented as migration/system provenance; the conversion does not invent a human author. Existing glossary records need no rewrite to acquire ontology defaults: absent configuration reads as L3 with a generated base IRI and empty imports/prefixes.

The post-data migration also marks `RdfIndexApp` for a full recreate, restores its entity scope to `all`, and applies the weekly Saturday schedule. It removes pre-2.0 RDF and search application run records, so RDF status remains `REBUILDING` until the first successful post-upgrade run. `SearchIndexingApplication` is reset to the `all` entity scope; its staged run creates the new `relationshipType` index and applies the explicit concept-attribute mapping. Run both applications immediately after upgrade rather than waiting for a schedule.

## Upgrade sequence

1. Deploy the 2.0 migration image and run the normal OpenMetadata migration command.
2. Confirm the migration framework completed both schema and post-data phases.
3. Start one OpenMetadata server and verify relational health before scaling out other nodes.
4. Confirm all system relationship types and legacy custom types are listable from `/api/v1/relationshipTypes`.
5. Verify existing term relationships have stable IDs and can be read through the compatibility and stable-ID endpoints.
6. Rebuild search indexes so relationship types and concept attributes are discoverable.
7. If RDF is enabled, run a full `RdfIndexApp` recreate before treating Query/inference results as current.
8. Run `RdfInferenceApp` after the asserted rebuild if materialized inference is enabled.
9. Open Ontology Studio and verify View, permission-gated Edit, scoped Query, Library, and AI flag behavior.

Do not wait for the weekly RDF schedule after an upgrade. The Studio status may correctly show a rebuilding/degraded projection while relational authoring remains available.

## Verification queries

Use the database catalogue rather than relying only on application startup.

MySQL:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'relationship_type_entity',
    'ontology_axiom_entity',
    'ontology_change_set_entity',
    'ontology_annex',
    'ontology_edit_lock',
    'rdf_inference_rule'
  );

SELECT column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'entity_relationship'
  AND column_name IN ('relationshipId', 'relationshipTypeId');
```

PostgreSQL:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'relationship_type_entity',
    'ontology_axiom_entity',
    'ontology_change_set_entity',
    'ontology_annex',
    'ontology_edit_lock',
    'rdf_inference_rule'
  );

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'entity_relationship'
  AND column_name IN ('relationshipid', 'relationshiptypeid');
```

On either dialect, the following counts must be zero after conversion finishes:

```sql
SELECT COUNT(*)
FROM entity_relationship
WHERE fromEntity = 'glossaryTerm'
  AND toEntity = 'glossaryTerm'
  AND relation = 15
  AND relationshipId IS NULL;
```

PostgreSQL folds unquoted column names to lowercase; use `fromentity`, `toentity`, and `relationshipid` when issuing that query directly there.

Application verification:

```bash
curl -H 'Authorization: Bearer <admin-token>' \
  http://localhost:8585/api/v1/relationshipTypes?limit=100

curl -H 'Authorization: Bearer <token>' \
  http://localhost:8585/api/v1/rdf/status
```

## Clean-install and upgrade test matrix

Before release, run both paths against MySQL and PostgreSQL:

- create a clean 2.0 database and exercise relationship, axiom, change-set, annex, lease, and inference-rule persistence;
- restore a pre-ontology 2.0 fixture, run the native upgrade, and verify deterministic backfills and legacy settings conversion;
- rerun the migration to prove DDL idempotency;
- start with RDF disabled and verify authoring/import/export remain available;
- start the PostgreSQL + Fuseki profile, run the full rebuild, and execute the `Ontology RDF` Playwright project.

The focused structural gate is:

```bash
mvn -nsu -pl openmetadata-service \
  -Dtest=OntologySqlMigrationParityTest,OntologyMigrationTest,RdfScheduleMigrationTest test
```

## Rollback

The database migration is forward-only. Do not attempt to drop individual ontology tables or columns while 2.0 code is running.

For rollback:

1. Stop all 2.0 OpenMetadata servers and writers.
2. Restore the pre-upgrade database backup.
3. Deploy the previous application version.
4. Restore the previous search indexes or run that version's full search reindex.
5. Either restore the Fuseki snapshot or clear the dataset and rebuild it from the restored relational database.
6. Restore custom application schedules recorded before the upgrade.

The RDF projection is disposable; the relational backup is not. Never use Fuseki as the source for restoring lost glossary, relationship, axiom, pack, or change-set records.

## Failure handling

- A failed DDL or Java migration blocks server rollout; correct the error and retry through the migration framework.
- A failed search or RDF rebuild does not justify manual data edits. Keep Studio relational authoring available only if the projection state is explicitly degraded and retry the application job.
- A relationship-type conversion mismatch requires restoring the database or correcting the deterministic migration code and rerunning from a backup copy; do not hand-assign IDs in production.
- Annex checksums are immutable fidelity evidence. A duplicate checksum is idempotent; a changed checksum for the same source revision requires investigation.
