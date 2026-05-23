# Prompt 4: Lineage Accuracy

Review lineage extraction for SQL dialect, FQN resolution, column-level lineage, and cross-service resolution.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

Audit this connector for lineage accuracy.

Load the connector standards with /connector-standards, then analyze against the Lineage Accuracy standard (Standard 2).

## Where to look

Lineage in OpenMetadata is split across MULTIPLE layers. You MUST check ALL of these:

**1. Connector-specific lineage:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/lineage.py` — connector-specific lineage extraction (if exists)
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/queries.py` — SQL queries for extracting query logs (if exists)
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/models.py` — lineage-related models

**2. Service-type base class lineage methods:**
- **Database:** `lineage_source.py` (LineageSource) — yield_table_lineage, yield_procedure_lineage
- **Database:** `query_parser_source.py` (QueryParserSource) — query log processing
- **Dashboard:** `dashboard_service.py` — yield_dashboard_lineage_details (dashboard → table)
- **Pipeline:** `pipeline_service.py` — yield_pipeline_lineage (pipeline → table)

**3. Shared lineage framework (CRITICAL — column-level lineage lives here):**
- `ingestion/src/metadata/ingestion/lineage/parser.py` — LineageParser, column-level extraction
- `ingestion/src/metadata/ingestion/lineage/sql_lineage.py` — FQN resolution, get_lineage_by_query, multi-service search
- `ingestion/src/metadata/ingestion/lineage/lineage_processors.py` — cross-database lineage, service_names expansion

**4. Pipeline configuration:**
- `openmetadata-spec/.../metadataIngestion/databaseServiceQueryLineagePipeline.json` — processCrossDatabaseLineage toggle, service names config

**5. Service spec:**
- `[CONNECTOR_NAME]/service_spec.py` — which classes are registered for the lineage pipeline type

## What to assess

### SQL Dialect Configuration

1. Is the correct SQL dialect set for this connector's SQL parsing?
2. Where is the dialect configured? (connector-specific or inherited?)
3. Does the dialect handle connector-specific syntax? (e.g., Snowflake's FLATTEN, BigQuery's UNNEST, Redshift's COPY)

### Query Source

1. Where do query logs come from? (system tables, API, audit logs)
2. Is there a time window filter? Does it use `get_start_and_end()` properly?
3. Is there a result limit? What happens when there are more queries than the limit?
4. Are DDL statements (CREATE VIEW AS, CREATE TABLE AS SELECT) captured in addition to DML?

### Table-Level Lineage

For EACH lineage path the connector supports, verify:
1. **FQN resolution**: Are table references resolved to full database.schema.table format?
2. **Case normalization**: Does the connector handle case-sensitivity correctly for this source system?
3. **Cross-database references**: Are references to tables in other databases/schemas resolved?
4. **Temporary/intermediate tables**: Are temp tables filtered out or resolved correctly?
5. **View lineage**: Are views resolved to their underlying tables?

### Column-Level Lineage

Column-level lineage is often inherited from the shared framework — verify it actually works for this connector:
1. **SELECT \***: Does column lineage resolve when queries use SELECT \*?
2. **Aliases**: Are column aliases tracked correctly? (SELECT a AS b)
3. **Expressions**: Are computed columns (SELECT a + b AS c) tracked to their source columns?
4. **Subqueries**: Does column lineage work through subqueries and CTEs?
5. **UNIONs**: Are column mappings preserved across UNION branches?
6. **Functions**: Are columns inside functions (COALESCE, CASE, CAST) tracked?

### Cross-Service Lineage

**For database connectors:**
- Is `processCrossDatabaseLineage` supported? Check pipeline config JSON.
- Does the connector override `yield_cross_database_lineage()`?
- How are `service_names` expanded in lineage_processors.py?

**For dashboard connectors:**
- Does `yield_dashboard_lineage_details()` resolve to the correct database tables?
- Are data source connections mapped to the right database service?
- Does it handle dashboards that query multiple databases?

**For pipeline connectors:**
- Does `yield_pipeline_lineage()` resolve input/output datasets to table FQNs?
- Are task-level lineage edges created (task → input table, task → output table)?

### Edge Cases

Check how the connector handles:
1. **CTEs (WITH clauses)**: Are intermediate CTE references resolved or do they create phantom entities?
2. **Temp tables**: Are they filtered, resolved, or do they pollute lineage?
3. **Dynamic SQL**: Is it detected? Skipped? Does it create incorrect lineage?
4. **View chains**: A → view_1 → view_2 → table — is the full chain resolved?
5. **Stored procedures**: Is the stored procedure lineage mixin registered for this connector? Does it work?
6. **Schema changes**: If a table moves schemas, does lineage break?

## Rating Calibration

**Lineage Accuracy:**
- ✅ Compliant = Correct SQL dialect configured, FQNs resolve correctly across databases/schemas, column-level lineage works for standard queries, cross-service lineage resolves to correct entities, edge cases handled or gracefully skipped with logging
- ⚠️ Partial = Table-level lineage works for common queries, but column-level has gaps (SELECT \*, complex expressions), cross-service partially resolves, some edge cases create incorrect lineage
- ❌ Gaps = Wrong or missing dialect, FQNs don't resolve (wrong database/schema), column-level lineage broken or absent, cross-service lineage not implemented
- N/A = The source system fundamentally cannot provide the data for this lineage type (e.g., no execution history table, no audit log). Rate N/A regardless of whether connector code exists. Do NOT rate as ❌. Note: static analysis of definitions (e.g., parsing procedure body SQL) IS implementable and can be rated ⚠️ if missing, but runtime lineage without a source system data source is N/A.

**Optimism traps:**
- "Lineage exists" — Table-level only? Column-level may be completely broken even when table-level works fine.
- "FQNs resolve" — Within the same database only? Cross-schema and cross-database resolution is a different code path.
- "The shared parser handles it" — Which SQL dialect is configured? A generic parser may mangle connector-specific syntax (LATERAL FLATTEN, PIVOT, QUALIFY).
- "Column lineage is inherited" — Does the inherited code actually work for this connector's query patterns? Test with SELECT \*, aliases, and expressions.
- "Stored procedure lineage works" — Is the StoredProcedureLineageMixin registered in service_spec.py? Many connectors inherit it but never register the pipeline.

Present findings as:
1. Lineage path inventory (which lineage types are supported, where implemented)
2. Per-path assessment (table-level, column-level, cross-service)
3. Rating with evidence (file:line references)
4. Specific issues found, ordered by severity
5. What the source system provides that we don't extract
6. **Source system constraints**: List lineage types rated N/A because the source system fundamentally cannot provide the data — so the reader knows what's a connector gap vs an impossible ask

## Present & Validate

Before saving, present a summary to the user for review:
1. **Rating** — Lineage Accuracy standard rating
2. **Lineage path inventory** — which lineage types work, which are broken, which are N/A
3. **Top findings** — the 3-5 most important issues, each with severity and a one-sentence description
4. **Source system constraints** — lineage types rated N/A
5. **Anything you're uncertain about** — flag findings where you're not confident

Then ask: *"Ready to save to `.claude/audit-results/04-lineage.md`? Any findings to adjust?"*

If the user requests changes, revise and re-present. Once the user confirms, **save the full report** to `.claude/audit-results/04-lineage.md` (create the directory if needed) — Prompt 6 reads this file.
