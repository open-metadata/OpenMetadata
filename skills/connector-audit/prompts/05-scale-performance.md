# Prompt 5: Scale & Performance

Audit memory patterns, pagination, generator usage, lookup complexity, and connection management.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

Audit this connector for scale and performance.

Load the connector standards with /connector-standards, then analyze against the Scale standard (Standard 6).

## Where to look

**1. Connector-specific code:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/` — ALL .py files
- Focus on: metadata.py (entity iteration), queries.py (SQL queries), lineage.py (query log processing), models.py (data structures)

**2. Service-type base class and topology runner:**
- **Database:** `common_db_source.py` (CommonDbSourceService) — entity iteration, inspector management, per-schema processing
- **Dashboard:** `dashboard_service.py` — dashboard/chart iteration patterns
- **Pipeline:** `pipeline_service.py` — pipeline/task iteration patterns
- `ingestion/src/metadata/ingestion/models/topology.py` — TopologyRunnerMixin, how entities are yielded and processed
- Check if the connector overrides base class methods and introduces performance issues

**3. Connection management:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/connection.py` — engine creation, connection pooling
- `ingestion/src/metadata/ingestion/connections/builders.py` — shared engine creation patterns (QueuePool, max_overflow)

**4. Lineage processing (often the most memory-intensive):**
- `ingestion/src/metadata/ingestion/lineage/parser.py` — query parsing memory usage
- `ingestion/src/metadata/ingestion/lineage/sql_lineage.py` — lineage graph construction
- Check if query logs are streamed or loaded entirely into memory

## What to assess

### Memory Patterns

**Classify EVERY data collection** in the connector-specific code as:
- ✅ Bounded: Fixed-size or capped (e.g., configuration dicts, enum lookups)
- ⚠️ Linear: Grows with data volume but proportionally (e.g., one entry per table — manageable at 10K)
- ❌ Unbounded: Grows without limit or accumulates across iterations (e.g., collecting all query logs in a list, caching all column metadata in a dict that's never cleared)

Present as a table: | File:Line | Data Structure | Growth Pattern | Classification | Risk at Scale |

**Check specifically for:**
1. Lists that collect all results before processing (should use generators)
2. Dicts/caches that grow per-entity and are never cleared between schemas/databases
3. File reads without size checks (reading entire query log files into memory)
4. String concatenation in loops (building large SQL strings)

### Pagination Completeness

For EVERY API call or SQL query that fetches a list of entities:
1. Is it paginated? (page token, offset/limit, cursor)
2. What's the page size? Is it configurable?
3. What happens when there are more results than the page/limit?
4. Are there hard limits (e.g., LIMIT 10000) without overflow detection?

Present as a table: | File:Line | Operation | Paginated? | Page Size | Overflow Handling |

### Generator Usage

1. Are `yield` patterns used for ALL entity iteration methods?
2. Are there methods that collect entities in a list then return the list?
3. Does the topology runner process entities as they're yielded, or does it collect them first?
4. Are secondary operations (tags, descriptions, ownership) also streamed?

### Lookup Complexity

1. Are there O(n×m) patterns? (nested loops where both n and m grow with data volume)
2. Could any nested lookups be replaced with pre-built dicts?
3. Are there repeated API calls inside loops that could be batched?

**Common patterns to check:**
- Looking up column metadata by iterating all columns for each table (should index by table name)
- Searching for lineage matches by scanning all entities (should use FQN dict)
- Fetching tags/descriptions per-entity when batch APIs exist

### Connection Management

1. **Pooling**: Is a connection pool used? What are the pool settings? (pool_size, max_overflow)
2. **Engine creation**: Is a new engine created per-schema or per-database? (Should be shared or disposed properly)
3. **Cursor management**: Are cursors closed after use? Are there server-side cursors for large result sets?
4. **Connection leaks**: Any code paths where connections are acquired but not released on error?

### Scale Scenarios

Think about what happens when this connector runs against:
- **10,000 tables** with 100 columns each → 1M column metadata objects
- **500 dashboards** with 50 charts each → 25K chart objects
- **1,000,000 query log entries** → lineage parsing memory and time
- **200ms network latency** per API call → multiply by number of sequential API calls
- **100 schemas** in one database → per-schema operations multiply

For each scenario, identify:
1. Which code paths become bottlenecks?
2. Where does memory grow proportionally?
3. Where do sequential API calls become time bottlenecks?
4. Are there any operations that are O(n²) or worse?

## Rating Calibration

**Scale:**
- ✅ Compliant = All list operations use generators, pagination on every API/SQL list call, bounded caches, no O(n×m) lookups, connection pool properly managed, would handle 10K+ entities without memory issues or excessive time
- ⚠️ Partial = Primary entity iteration uses generators, but secondary operations (tags, descriptions, lineage) collect in memory. Pagination on main operations but not all. Some O(n×m) patterns in non-critical paths.
- ❌ Gaps = Primary entity lists collected in memory, no pagination on key operations, unbounded caches, O(n×m) lookups in hot paths, connection leaks or per-schema engine creation without cleanup

**Optimism traps:**
- "It uses generators" — For primary entity iteration only? Secondary operations (fetching tags, descriptions, column metadata, lineage per table) may still collect everything in memory.
- "Connection pool handles it" — Does the connector create new engines per schema or per database? A pool per schema × 100 schemas = 100 pools.
- "Results are paginated" — But are paginated results collected into a list before processing? Pagination that loads all pages into memory before yielding defeats the purpose.
- "There's a LIMIT" — A LIMIT/TOP without an offset loop or cursor continuation is NOT pagination. It is a hard cap that silently drops data. Classify as "Not paginated — hard cap" in the pagination table. If the default value could plausibly be exceeded in production (e.g., 1000 queries on a system doing 50K/day), this directly degrades the Scale rating — rate ⚠️ minimum.
- "It's fine for test data" — Test environments have 10 tables. Production has 10,000. What's O(n) at 10 is still O(n) at 10,000 — but the constant matters when n is large.
- "The base class is efficient" — Does the connector override base class methods? Overrides may lose generator patterns, add unbounded caches, or introduce O(n×m) lookups.

Present findings as:
1. Memory pattern classification table (EVERY collection in connector code)
2. Pagination completeness table (EVERY list operation)
3. Rating with evidence (file:line references)
4. Specific issues found, ordered by severity
5. Scale scenario analysis (what breaks first at 10x, 100x, 1000x)

## Present & Validate

Before saving, present a summary to the user for review:
1. **Rating** — Scale standard rating
2. **Top findings** — the 3-5 most important issues, each with severity and a one-sentence description
3. **What breaks first** — the single biggest bottleneck at scale
4. **Anything you're uncertain about** — flag findings where you're not confident

Then ask: *"Ready to save to `.claude/audit-results/05-scale-performance.md`? Any findings to adjust?"*

If the user requests changes, revise and re-present. Once the user confirms, **save the full report** to `.claude/audit-results/05-scale-performance.md` (create the directory if needed) — Prompt 6 reads this file.
