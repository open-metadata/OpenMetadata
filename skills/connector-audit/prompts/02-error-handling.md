# Prompt 2: Error Handling & Resilience

Audit error handling (Error Clarity), fault tolerance, and observability across the connector.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

Audit this connector for error handling, fault tolerance, and observability.

Load the connector standards with /connector-standards, then analyze against these 3 reliability standards:
- **Error Clarity** (Standard 4)
- **Fault Tolerance** (Standard 5)
- **Observability** (Standard 7)

## Where to look

**1. Connector-specific code:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/` — ALL .py files
- Focus especially on: metadata.py (entity extraction), connection.py (connection handling), lineage.py (lineage extraction)

**2. Service-type base class:**
- **Database:** `common_db_source.py` — error handling in yield_table, yield_view, set_inspector
- **Dashboard:** `dashboard_service.py` — error handling in yield_dashboard, yield_dashboard_chart
- **Pipeline:** `pipeline_service.py` — error handling in yield_pipeline, yield_pipeline_status
- Check ALL methods the connector inherits or overrides

**3. Connection handling:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/connection.py`
- `ingestion/src/metadata/ingestion/connections/builders.py` — shared connection building
- **Token lifecycle (CRITICAL for IAM/OAuth/temporary credentials):** Trace end-to-end — where is the token generated? Where stored? Is there a refresh mechanism? Check BOTH `connection.py` AND `builders.py` (IAM tokens are often generated in shared code). Check ALL auth types, not just the first one you find.

**4. Shared utilities:**
- `ingestion/src/metadata/utils/helpers.py` — retry utilities
- `ingestion/src/metadata/ingestion/api/models.py` — Either pattern definition

## What to assess

### Standard 4: Error Clarity

**Classify EVERY try/except block** in the connector-specific code as:
- ✅ Good: Uses Either pattern with entity name + operation + stack trace
- ⚠️ Acceptable: Logs at WARNING/ERROR with enough context to debug
- ❌ Bad: bare except, except:pass, except:continue, swallowed exceptions, debug-level for operational failures

Present as a table: | File:Line | Exception handling | Classification | Issue |

**Check specifically for:**
1. **Either pattern usage**: Are per-entity errors wrapped in `Either(left=StackTraceError(...))`?
2. **Error context**: Does every error message include the entity name and operation that failed?
3. **Exception specificity**: Are exceptions caught by type (OperationalError, TimeoutError) or with bare `except Exception`?
4. **Silent drops**: Any `except: continue` or `except: pass` that drops entities without logging?
5. **Error propagation**: Are connection-level errors properly distinguished from entity-level errors?

**After classifying existing try/except blocks**, scan for code paths that SHOULD have error handling but don't:
- Any raw SQL execution (via `conn.execute()`, `text()`) NOT inside a try/except
- Any external API call NOT inside a try/except
- Any file I/O NOT inside a try/except
These missing handlers are often higher severity than poorly-written existing ones.

### Standard 5: Fault Tolerance

**Check for:**
1. **Retry logic**: Are API calls and queries retried on transient failures (HTTP 429, 503, connection reset)?
   - Connection pool retry (reconnecting dropped connections) does NOT count as query retry
   - Look for `@retry`, `tenacity`, `backoff`, or manual retry loops
   - What's the retry strategy? (exponential backoff, fixed delay, no backoff)

2. **Timeouts**: Are there per-operation timeouts?
   - Check SQLAlchemy engine creation for `connect_args` timeout settings
   - Check HTTP client configurations for request timeouts
   - A framework default of 300s per query × many queries = hours is NOT meaningful

3. **Token refresh**: For connectors with OAuth or temporary credentials:
   - Are tokens refreshed during long-running ingestion?
   - What happens when a token expires mid-ingestion?

4. **Resource cleanup**: Are connections, cursors, file handles cleaned up on failure?
   - Look for try/finally patterns or context managers
   - Check for connection/engine leaks (creating new engines without closing old ones)

5. **Graceful degradation**: When a non-critical operation fails (e.g., fetching tags), does the connector continue with core extraction?

### Standard 7: Observability

**Check for:**
1. **Log levels**: Are operational failures logged at WARNING or ERROR? (not DEBUG). Is routine progress logged at INFO? Are verbose details at DEBUG?

2. **Silent fallbacks**: Any pattern where the code catches an exception and returns a default value WITHOUT logging?

3. **Progress logging**: Can an operator tell from the logs which entity is being processed, how many were processed/skipped/failed, and why an entity was skipped?

4. **Failure attribution**: When ingestion partially fails, can you tell from the logs WHICH entities failed and WHY?

5. **Sensitive data**: Are credentials, tokens, or connection strings accidentally logged?

## Rating Calibration

**Error Clarity:**
- ✅ Compliant = Every entity extraction wrapped in Either pattern, all exceptions caught with specific types, error messages include entity name + operation, no silent drops
- ⚠️ Partial = Either pattern used for primary entities but not everywhere, some generic exception handling, most errors have context
- ❌ Gaps = Widespread bare except/pass/continue, missing Either pattern on primary entity extraction, errors lack context

**Fault Tolerance:**
- ✅ Compliant = Transient errors retried with backoff, per-operation timeouts, token refresh handled, proper cleanup in finally blocks
- ⚠️ Partial = Per-entity isolation exists (one entity failing doesn't stop others), but no query-level retry, no explicit timeouts
- ❌ Gaps = No retry at any level, no timeouts, token expiry crashes ingestion, resource leaks on failure

**Fault Tolerance optimism traps:**
- "The connection pool retries" — Connection pool reconnection is NOT the same as retrying a failed query or API call
- "Per-entity isolation" — Good, but not sufficient alone. What about transient API failures that affect ALL entities?
- "There's a timeout in the engine config" — Is it per-query or per-connection? What's the actual value?

**Observability:**
- ✅ Compliant = All failures logged at WARNING+, progress visible at INFO, no silent fallbacks, failure attribution clear
- ⚠️ Partial = Most failures logged but some at wrong level, some silent fallbacks exist, partial progress logging
- ❌ Gaps = Operational failures at DEBUG, widespread silent fallbacks, no way to tell from logs what went wrong

Present findings in TWO sections:

**Section A — Connector-specific issues** (files under the connector directory):
1. Try/except classification table (EVERY block in connector-specific code)
2. Per-standard rating with evidence (file:line references)
3. Specific issues found, ordered by severity
4. Recommended fixes

**Section B — Inherited base class issues** (shared code that affects this connector):
1. Base class issues that affect this connector, labeled with which other connectors share the same issue
2. Clearly mark whether a fix would be connector-specific or shared

**Source system constraints**: Note any limitations that are inherent to the source system (e.g., no native retry mechanism) vs connector implementation gaps.

## Present & Validate

Before saving, present a summary to the user for review:
1. **Ratings** — one line per standard (Error Clarity, Fault Tolerance, Observability) with the rating
2. **Top findings** — the 3-5 most important issues, each with severity and a one-sentence description
3. **Section A vs B split** — how many issues are connector-specific vs inherited
4. **Anything you're uncertain about** — flag findings where you're not confident

Then ask: *"Ready to save to `.claude/audit-results/02-error-handling.md`? Any findings to adjust?"*

If the user requests changes, revise and re-present. Once the user confirms, **save the full report** to `.claude/audit-results/02-error-handling.md` (create the directory if needed) — Prompt 6 reads this file.
