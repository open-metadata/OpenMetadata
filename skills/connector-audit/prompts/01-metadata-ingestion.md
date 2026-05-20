# Prompt 1: Metadata & Ingestion Completeness

Assess metadata coverage by tier and verify ingestion completeness for the connector.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

Audit this connector for metadata coverage and ingestion completeness.

Load the connector standards with /connector-standards, then analyze against Metadata Tiers 1-3 and the Ingestion Completeness standard.

## Where to look

The connector's metadata extraction is split across MULTIPLE locations. You MUST check ALL of these:

**1. Connector-specific code:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/` — metadata.py, models.py, queries.py
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/service_spec.py` — registered classes for each pipeline type

**2. Connection schema:**
- `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/[SERVICE_TYPE]/[connector]Connection.json`
- Follow `$ref` links to understand available configuration options and metadata types

**3. Service-type base class (CRITICAL — many metadata features live here):**
Each service type has a shared base class that provides core extraction patterns. Check the one matching your connector:
- **Database:** `common_db_source.py` (CommonDbSourceService) — table/view extraction, column metadata, descriptions, ownership, tags, yield patterns
- **Dashboard:** `dashboard_service.py` (DashboardServiceSource) — yield_dashboard, yield_dashboard_chart, data model columns
- **Pipeline:** `pipeline_service.py` (PipelineServiceSource) — yield_pipeline, yield_pipeline_status, task extraction
- **Storage:** `storage_service.py` (StorageServiceSource) — yield_create_container_requests
- **Messaging:** `messaging_service.py` (MessagingServiceSource) — yield_topic, yield_topic_sample_data
- **Search:** `search_service.py` (SearchServiceSource) — yield_search_index
- **ML Model:** `mlmodel_service.py` (MlModelServiceSource) — yield_mlmodel
- **API:** `api_service.py` (ApiServiceSource) — yield_api_collection, yield_api_endpoint

**4. Profiler / Sampler (Tier 3 metadata lives here, NOT in metadata ingestion):**
- `ingestion/src/metadata/sampler/sqlalchemy/[CONNECTOR_NAME]/` — connector-specific sampler
- `ingestion/src/metadata/profiler/` — profiler framework

**5. Shared utilities:**
- `ingestion/src/metadata/utils/filters.py` — schema/table/topic filtering
- `ingestion/src/metadata/ingestion/models/topology.py` — TopologyRunnerMixin entity iteration

## What to assess

### Part 1: Metadata Coverage by Tier

For EACH metadata type below, determine:
1. Is it extracted? (yes/no)
2. Where is it extracted? (file:line)
3. Source: (a) connector-specific code, (b) inherited from base class, (c) separate pipeline, (d) not supported
4. Completeness: Does extraction capture ALL available metadata from the source system?
5. Limitations or gaps

**Tier 1 — Core** (non-negotiable):
- Entity hierarchy (databases → schemas → tables, dashboards → charts, pipelines → tasks, etc.)
- Entity types (table, view, materialized view, external table, etc.) — does the connector distinguish all types the source system supports?
- Column / field metadata (names, data types, constraints, default values)
- Data Model columns (for dashboard connectors — does it extract column metadata for data models?)
- Descriptions (entity-level + column-level) — from the source system, not user-added
- Run status (for pipeline connectors — task success/failure/duration)
- Table-level lineage — query-log based for databases, cross-service for dashboard/pipeline connectors
- Column-level lineage — check both connector-specific AND the shared lineage framework

> **Critical:** The connector must ingest **all entity types available from the source system**. If the source distinguishes tables, views, materialized views, external tables, stored procedures, etc., the connector must extract and correctly classify each. Missing entity types means users get an incomplete picture of their data estate. Research the source system's API docs to identify the full set of entity types — don't assume the existing code covers everything.

**Tier 2 — Expected** (customers assume this works):
- Ownership — does the connector extract owner information from the source system?
- Tags / Classifications — does the source system have tags/labels? Do we extract them?

**Tier 3 — Differentiator:**
- Usage statistics — query counts, users, access patterns
- Profiling — column statistics (min, max, mean, null count, distinct count)
- Data quality — test results, assertions
- Sample data — does the sampler pipeline support this connector?

### Part 2: Ingestion Completeness (Standard 1)

For EACH entity type the connector extracts, verify:

1. **Pagination**: Are ALL list operations paginated? Look for:
   - API calls that fetch lists without pagination tokens
   - SQL queries with LIMIT but no offset loop
   - Hard limits (e.g., SHOW TABLES LIMIT 10000) without overflow detection

2. **Silent drops**: Does the connector silently skip entities? Look for:
   - `continue` without logging
   - `except: pass` or `except: continue`
   - Conditions that filter entities without warning logs

3. **Generators**: Are yield patterns used? Look for:
   - Lists that collect all entities in memory before returning
   - Missing `yield` in entity iteration methods

4. **Filters**: Are user-configured filters properly applied?
   - Schema/table/topic filter patterns
   - Include/exclude logic correctness

5. **Incremental extraction**: Does the connector support incremental ingestion?
   - Does it check `markDeletedEntities` configuration?
   - Does it handle soft deletes properly?

## Rating Calibration

**Metadata Coverage** — rate per tier:
- ✅ Compliant = All metadata types in this tier are extracted completely, with proper source attribution
- ⚠️ Partial = Most metadata types extracted but some have gaps (e.g., descriptions only at entity level, not column level)
- ❌ Gaps = Major metadata types in this tier are missing (e.g., no column types, no entity hierarchy)
- N/A = The source system does not natively provide this metadata type (e.g., MySQL has no native tags/classifications). Do NOT rate as a gap — rate N/A with a brief explanation.

**Ingestion Completeness:**
- ✅ Compliant = ALL list operations paginated, generators used throughout, no silent drops, filters work correctly. Would handle 10,000+ entities without missing any.
- ⚠️ Partial = Primary entities paginated but secondary operations have limits (e.g., tags, descriptions fetched without pagination). Some silent drops in edge cases.
- ❌ Gaps = Major entity types can be silently truncated or dropped. No pagination on primary list operations. Lists collected in memory.

**Optimism traps:**
- "Pagination exists" — Does it cover ALL operations? Tags, descriptions, ownership, stored procedures, views — not just tables.
- "The base class handles it" — Check if the connector overrides base class methods and loses pagination or entity extraction.
- "There's a LIMIT" — A LIMIT without an offset loop means entities beyond the limit are silently lost. Classify as "Not paginated — hard cap" not as "paginated."

**Rating rules:**
- If any list operation uses a hard cap (LIMIT without pagination/offset loop) where the default value could plausibly be exceeded in production, the Ingestion Completeness rating cannot be ✅. Rate ⚠️ minimum.
- Before rating ✅ for a metadata type, verify the feature works correctly — not just that code exists. "Code exists that extracts X" is not the same as "X is extracted completely and correctly." If correctness needs deeper testing, rate ⚠️ with a note that the specialized prompt should verify.

**Worked example:** `LIMIT 1000` on a query log table that receives 50K entries/day means 98% of queries are silently dropped at default settings. This is NOT "paginated" and NOT "fine because it's configurable" — most users never change defaults. Rate ⚠️ minimum for Ingestion Completeness and flag in findings.

Present findings as a structured report with:
1. Metadata coverage table (tier × metadata type × status × source location)
2. Ingestion Completeness rating with evidence
3. Specific issues found with file:line references
4. What's missing compared to what the source system actually provides
5. **Source system constraints**: List any metadata types rated N/A because the source system does not provide them — so the reader knows what's a connector gap vs a source limitation

## Present & Validate

Before saving, present a summary to the user for review:
1. **Ratings** — one line per tier/standard with the rating emoji
2. **Top findings** — the 3-5 most important issues, each with severity and a one-sentence description
3. **Source system constraints** — anything rated N/A
4. **Anything you're uncertain about** — flag findings where you're not confident in the severity or root cause

Then ask: *"Ready to save to `.claude/audit-results/01-metadata-ingestion.md`? Any findings to adjust?"*

If the user requests changes, revise and re-present. Once the user confirms, **save the full report** to `.claude/audit-results/01-metadata-ingestion.md` (create the directory if needed) — Prompt 6 reads this file.
