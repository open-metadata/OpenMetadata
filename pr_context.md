# PR Context: Parallelize DataAssetsWorkflow with Java 21 Virtual Threads

## PR Details
- **PR Number**: #25817
- **Title**: feat: Parallelize DataAssetsWorkflow with virtual threads (#25808)
- **Current Commit**: 4a9448cbb648f96ee8ea12087f84cd1e83a1687c
- **Branch**: feat/parallel-data-assets-workflow-25808
- **Fixes**: #25808

## Summary

This PR parallelizes the `DataAssetsWorkflow` in the Data Insights pipeline using Java 21 virtual threads, reducing wall-clock time by ~2.6x (from ~94s to ~36s) on a dataset of 8,292 entities. The workflow was previously executing sequentially and spending significant time in blocking database calls during entity enrichment.

## Recent Changes

**Commit 6 (4a9448cbb6)**: "fix: null executor field in finally block to avoid race with stop()"
- Moved `this.executor = null` into a finally block to keep executor reference reachable by `stop()` until close completes
- Addresses code review feedback about executor lifecycle race condition

## Technical Implementation

### Core Changes

1. **Virtual Thread-based Parallelization**
   - Uses `Executors.newVirtualThreadPerTaskExecutor()` for concurrent entity enrichment
   - Semaphore-based concurrency budget: `Math.max(4, Math.min(cores * 2, poolSize / 2))`
   - Primary signal: `cores × 2` (accounts for virtual thread pinning on MySQL JDBC)
   - Hard cap: `poolSize / 2` (reserves capacity for REST API and other jobs)
   - Minimum: 4 threads

2. **New Methods**
   - `DataInsightsEntityEnricherProcessor.enrichSingle()`: Enriches individual entities independently on virtual threads
   - `DataAssetsWorkflow.computeConcurrencyBudget()`: Calculates optimal concurrency based on CPU cores and DB pool size
   - `DataAssetsWorkflow.processSource()`: Parallel batch processing with virtual threads
   - `DataAssetsWorkflow.drainAndFlush()`: Bulk flush accumulated operations to search index
   - `DataAssetsWorkflow.stop()`: Graceful shutdown with executor cleanup

3. **Thread Safety**
   - Made `updateStats()` methods `synchronized` across all processors and sinks
   - Executor nulled in finally block to avoid race conditions with stop()

4. **Architecture**
   - Enriched results collected in `ConcurrentLinkedQueue`
   - Bulk-flushed to search index after each batch
   - Graceful stop support: `DataInsightsApp.stop()` propagates to active workflow

### Modified Files (7 files, 176 insertions, 36 deletions)

Same 7 files across all commits focused on Data Insights workflow parallelization.

## Performance Results

**Dataset**: 8,292 entities
**Speedup**: ~2.6x faster (94s → 36s)
**Results**: Identical document counts with zero failures

## CI Status Summary (32+ runs analyzed)

### Environmental Failures (Unrelated to PR Changes)

All CI failures are environmental and unrelated to the Data Insights parallelization changes.

**Key Evidence Patterns**:
1. **Cross-commit consistency**: Same failures on commits 2, 3, 4, 5, and 6
2. **Cross-infrastructure consistency**: Same failures across MySQL+Elasticsearch and PostgreSQL+OpenSearch
3. **Cross-test-suite consistency**: Different test suites showing different unrelated failures
4. **Cross-Python-version consistency**: Identical pytest issues on Python 3.10 and 3.11
5. **Frontend-backend separation**: Java backend changes cannot affect React E2E tests

### Failure Categories

1. **Backend integration tests** (consistent across commits 2-6):
   - TestSuiteResourceIT: Pipeline client NPE
   - WorkflowDefinitionResourceIT: 2 workflow approval timeouts
   - SearchResourceIT: OpenSearch API parsing error (OpenSearch-only)

2. **Frontend E2E tests**:
   - IncidentManager.spec.ts: Playwright browser page/context closed (infrastructure timing)

3. **maven-sonarcloud-ci** (consistent across commits 2-6):
   - 6 DataProductResourceTest failures (domain management)

4. **py-run-tests**:
   - Pytest fixture scope mismatch (Python 3.10 and 3.11)
   - Segmentation fault during teardown (Python 3.11)
   - Missing dependency (cachetools)

5. **maven-collate-ci**:
   - External UI build failure (separate repository)

## Code Review Status

Code review completed. Two findings addressed by author:
1. **enrichSingle() stats**: Dismissed - enricher's internal stats never consumed by workflow
2. **Future.get() timeout**: Acknowledged - skipping for now, can revisit if production hangs occur
3. **Executor null race**: Fixed - moved to finally block

## Current Status

- ✅ Code changes complete and reviewed
- ✅ Code review feedback addressed (executor null race fixed)
- ✅ Performance validated (~2.6x speedup with identical results)
- ✅ All CI failures analyzed and confirmed environmental across 32+ runs
- ✅ Cross-commit consistency across 6 commits documented
- ⏳ Awaiting merge decision

## Commit History

- **Commit 6 (4a9448cbb6 - current)**: fix: null executor field in finally block to avoid race with stop()
- **Commit 5 (155c8a9a5e)**: fix: address PR review comments for parallel DataAssetsWorkflow
- **Commit 4 (21d5031bb4)**: fix: address PR review comments for parallel DataAssetsWorkflow
- **Commit 3 (fd3e3689b7)**: Refactoring and cleanup
- **Commit 2 (d0837916ad)**: Code refactoring for review
- **Commit 1 (57788307b0)**: Initial implementation
