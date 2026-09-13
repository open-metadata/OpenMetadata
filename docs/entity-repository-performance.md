# Entity repository performance evidence

Partial performance evidence for the completed composition implementation; its latency gate remains open.

## Final-package SQL verification

The final `7c3bd8bb…` package and original `306263df…` package each passed all
78 workload protocols at widths 3, 100 and 1,000 with Redis enabled. Each workload
used one warmup and two measured requests, with SQL collection enabled and at
most one request in flight. All 312 measured responses passed validation.
SQL totals were lower in 75 workloads and equal in three; none were higher.
The equal cases were cached column reads, which issued zero SQL at every width.

The following are statement totals for **two measured requests** on 100-column
fixtures, including the work observed by the diagnostic collector:

| Workload | Original statements | Final statements |
| --- | ---: | ---: |
| Metrics | 202 | 4 |
| Extensions | 202 | 4 |
| Relationships | 8 | 6 |
| History | 226 | 26 |
| Unchanged PUT | 246 | 44 |
| Changed PUT | 252 | 50 |
| Hard delete | 470 | 72 |

Changed and unchanged single PUTs and hard deletes each recorded two owning
commits for two requests on each artifact. Final unchanged bulk requests recorded
one owning mutation commit per request; changed bulk requests recorded one
mutation commit plus the established post-commit feed transaction. Asynchronous
polling totals vary with observed completion and do not establish a SQL budget
for background work.

The two servers used Java 21, fixed 1 GB G1 heaps, durable PostgreSQL/OpenSearch
and Redis. These diagnostics overlapped other regression work, so their elapsed
times are not latency evidence. Raw results are retained as
`policy-surface-final-{baseline,candidate}-sql.csv` and per-workload SQL files;
`policy-surface-final-sql-comparison.csv` contains the complete comparison under
`.context/entity-repository/`.

## ID/FQN and regular-user read protocols

The benchmark now adds 24 read variants: ID/FQN lookup, default/expanded field
selection, and admin/regular DataConsumer principals at widths 3, 100 and 1,000.
Default selection retains API default fields, including table columns. The
original six read workload names remain unchanged. The generated manifest now
contains 102 workloads.

Per-request credentials replace the default Authorization header. A new HTTP
protocol test reproduced the previous duplicate-header behavior; all 23 benchmark
protocol tests pass after the correction. Tokens remain in private fixture
manifests. Native Java 21 integration compilation and Spotless pass.

All 42 read workloads passed a real-API smoke check on both artifacts, including
the new variants: 168 measured HTTP 200 responses with no errors. Separate SQL
diagnostics covered the 24 added workloads with two measured requests each.
Eighteen statement totals decreased, six stayed equal, and none increased.
For 100-column expanded reads, admin queries decreased from 207 to 8 per request;
regular-user queries decreased from 208 to 9. Default admin reads remained at two
queries per request, while regular-user default reads decreased from five to four.
ID and FQN paths had the same budgets.

These checks overlapped regression suites and do not establish latency for the
new variants. Evidence is retained as `policy-surface-v17-read-smoke-*`,
`policy-surface-v17-lookup-sql-*` and `policy-surface-v17-benchmark-unit.*` under
`.context/entity-repository/`. The frozen v8 client includes the credential fix;
its manifest SHA-256 is
`20c8e80108ea9f102262aad3a88cf76f10960934183e37f0b417930b9b6d3e0d`.

## Final policy PUT latency

The original artifact and final `policy-surface-v2-service.jar` (SHA-256
`7c3bd8bbb349252fa5a7dee232a9dc7034c17e460f2634fe5bb292955ce8b866`)
completed five alternating pairs of changed and unchanged PUT requests on
100-column fixtures. Each workload used 200 warmups and 1,000 measured requests
per round at 20 offered requests per second, with at most 32 requests in flight.
Both servers used fixed 1 GB G1 heaps, Java 21, durable PostgreSQL/OpenSearch
storage and Redis. No builds, regression suites or profilers ran during timing.
All 20,000 measured responses returned the expected HTTP 200 status.

Milliseconds are medians of run percentiles; ratios are medians of the five
paired candidate/original ratios.

| PUT workload | Percentile | Original ms | Composed ms | Paired ratio | Slower pairs |
| --- | --- | ---: | ---: | ---: | ---: |
| Unchanged | p50 | 57.731 | 33.111 | 0.551 | 0/5 |
| Unchanged | p95 | 657.801 | 199.403 | 0.328 | 0/5 |
| Unchanged | p99 | 946.224 | 784.544 | 0.830 | 0/5 |
| Changed | p50 | 94.961 | 50.069 | 0.519 | 0/5 |
| Changed | p95 | 1,062.506 | 856.594 | 0.856 | 0/5 |
| Changed | p99 | 1,353.557 | 1,358.528 | 0.988 | 2/5 |

Unchanged PUT improved at all three percentiles in every pair. Changed PUT had
lower p50 and p95 in every pair; its paired p99 ratio ranged from 0.921 to 1.053,
remaining close to baseline. These results cover two workloads in one cache/load
configuration. The other APIs, widths, cache modes and overload/recovery checks
remain outside this comparison.

The frozen v6 client also recorded ordered request latency, submission delay,
status and success. All 20,000 traces match the ranked sample files. Median run
p99 submission delay was approximately 5 ms on both revisions; 11 original and
12 candidate changed-PUT requests had submission delays above 50 ms. These traces
retain client queueing in the end-to-end measurements.
Reports, traces, actual exits and configuration hashes are retained under
`.context/entity-repository/policy-surface-fixed-put-20/`.

## Final policy read latency

The final `7c3bd8bb…` artifact and original `306263df…` artifact completed five
alternating pairs of six read workloads on 100-column fixtures. Each workload
used 200 warmups and 1,000 measured requests per round at 50 offered requests
per second, with at most 32 requests in flight. Both servers used fixed 1 GB
G1 heaps, Java 21, durable PostgreSQL/OpenSearch storage and Redis. No builds,
regression suites or profilers ran during timing. All 60,000 measured responses
returned HTTP 200 and passed validation; ordered traces match the ranked samples.

The ratios below are medians of the five paired candidate/original ratios.
The last column counts pairs with a higher candidate p99.

| Read workload | p50 ratio | p95 ratio | p99 ratio | Slower p99 pairs |
| --- | ---: | ---: | ---: | ---: |
| Columns | 1.003 | 1.141 | 2.278 | 3/5 |
| Metrics | 0.262 | 0.034 | 0.047 | 0/5 |
| Extensions | 0.312 | 0.083 | 0.804 | 0/5 |
| Relationships | 0.980 | 1.034 | 1.111 | 3/5 |
| List metrics | 0.285 | 0.040 | 0.057 | 0/5 |
| History | 0.321 | 0.419 | 0.858 | 2/5 |

Metrics, extensions and metric listings improved at every percentile in every
pair. History p50 and p95 improved in every pair, while its p99 ratios ranged
from 0.523 to 1.094. Columns and relationships still have unstable tails:
their p99 ratios ranged from 0.250 to 9.606 and 0.156 to 11.871, respectively.
Median run p99 was 40.795/80.487 ms for original/candidate columns and
417.306/482.308 ms for relationships. These results do not resolve the earlier
tail concern or establish latency parity.

Client submission delay remains included in the measurements. Original metrics,
extensions, history and metric listings had median run p99 submission delays
of 56–145 ms; the candidate values were 12–30 ms. Columns and relationships
were approximately 9–12 ms on both revisions. Equal offered load therefore
does not imply an absence of queueing. The full cache/load/width and overload
matrix remains open. Reports, raw traces and configuration hashes are retained
under `.context/entity-repository/policy-surface-final-reads-100-50/`.

A separate diagnostic captured 4,000 column and 4,000 relationship reads per
revision with JFR, pool metrics and bounded thread dumps. All 16,000 responses
passed, but instrumentation excludes these timings from acceptance. Both pools
had the same configured minimum/maximum of 10/100 connections. The baseline
already had 31–35 connections during sampling, while the candidate had 13–19
and reached 19 pending borrowers. The candidate recorded 19 virtual-thread
pinning events while JDBI acquired database connections; the longest was about
152 ms. The full stacks identify Hikari borrowing inside JDBI's lazy handle
initialization. These waits did not overlap the recorded thread-dump windows.

Sampled stacks also show requests waiting for Redis bundle reads and expiry
refreshes. Recorded GC pauses reached 25.250 ms on the original and 31.045 ms
on the candidate. Elastic pool growth is a concrete lead for further investigation;
these observations do not establish the full cause of the uninstrumented tails
or a verified fix. Raw recordings and full-depth stack exports remain under
`.context/entity-repository/policy-surface-final-tail-diagnostic/`.

## Paired warm read latency

The frozen original and composed artifacts completed five alternating pairs on
the same host, with separate durable PostgreSQL/OpenSearch/Redis stacks and
matching fixtures. No builds, regression suites or profilers ran during timing.
Each workload used 50 warmups and 200 measured requests per round at ten offered
requests per second, with at most 32 requests in flight. All 12,000 measured
responses passed their checks.

Values are median run percentiles in milliseconds. The ratio column is the
median of the five paired candidate/baseline p50 ratios.

| 100-column workload | Original p50 | Composed p50 | Paired p50 ratio | Original p95 | Composed p95 | Original p99 | Composed p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Columns | 11.880 | 12.332 | 1.045 | 20.231 | 19.150 | 23.592 | 26.976 |
| Metrics | 55.315 | 14.962 | 0.261 | 79.988 | 23.261 | 688.196 | 30.802 |
| Extensions | 48.265 | 18.002 | 0.388 | 62.047 | 26.565 | 589.101 | 29.593 |
| Relationships | 15.517 | 16.090 | 1.014 | 25.584 | 25.576 | 30.846 | 30.362 |
| List metrics | 56.369 | 17.676 | 0.308 | 83.648 | 28.696 | 614.650 | 31.563 |
| History | 55.891 | 29.416 | 0.534 | 73.560 | 44.669 | 515.686 | 52.320 |

Metrics, extensions, list metrics and history had lower p50 and p95 in all five
pairs. Columns had higher p50 in four pairs and higher p99 in three; relationships
had higher p50 and p99 in three pairs. Their small median differences and variable
tails remain under investigation. These measurements cover six workloads in one
cache/load configuration, and do not establish the full latency acceptance gate.
Raw samples, paired ratios, artifact hashes and actual exit statuses are retained
under `.context/entity-repository/mutation-policy-warm-reads-100/`.

The larger columns/relationships repeat used five alternating pairs with 200
warmups and 1,000 measured requests per workload per round at 50 offered requests
per second. All 20,000 measured responses passed. Median paired p50 ratios were
0.961 for columns and 0.998 for relationships. Relationship p99 was higher in all
five pairs, with a median paired ratio of 1.230. Median run p99 was 518.270 ms on
the original and 631.388 ms on the composed artifact. These results remain a
performance regression pending a verified fix; raw evidence is retained under
`.context/entity-repository/mutation-policy-warm-simple-reads-50/`.

Server access logs corroborated the tails. Separate diagnostic recordings and
thread dumps found requests waiting for database connections during parent
inheritance; virtual threads were pinned while JDBI initialized lazy handles.
Garbage-collection safepoints stayed below 66 ms in that diagnostic, insufficient
to explain the entire delay. These observations identify contention but do not
establish its full cause.

## Empty inheritance ancestors

The incoming relationship projection already includes every `CONTAINS` row,
including deleted relationships. When that projection has no parent, inheritance
now stops without repeating the parent lookup. Malformed first-parent records
retain the existing fallback, and duplicate-parent selection still uses the first
row. No cache keys, cache bounds or transaction boundaries change.

The new real-database regression failed against `mutation-policy-service.jar`
with four relationship queries for a schema/database/service hierarchy, where
three are sufficient. All nine focused inheritance tests pass with the fix.
The packaged `inheritance-empty-service.jar` has SHA-256
`7c61b161aa3a070146c2c6896ab80b2b6dacba88d30f73668e255987dee4c3ec`;
its selected service run passed 2,328 tests with one skip. MySQL/Elasticsearch and
PostgreSQL/OpenSearch each passed 773 API tests, with 21 assumption aborts, two
skips and no failures. The new hierarchy query-budget assertion passes on both.
A separate API diagnostic measured three SQL statements per relationship read at
widths 3, 100 and 1,000, down from four. Four measured requests per width returned
12 statements, no commits and no errors.

The subsequent five-pair repeat used the same client and 50-request-per-second
settings as the preceding comparison. All 20,000 responses passed. Relationship
p99 remained slower in four pairs, with a median paired ratio of 1.353; median
run p99 was 534.372 ms on the original and 757.093 ms on the candidate. The query
optimization does not resolve the observed tail regression. Evidence is retained
under `.context/entity-repository/inheritance-empty-warm-simple-reads-50/`.

The two JVMs shared a 4 GB maximum but chose different committed heap sizes:
approximately 1.1 GB on the original and 570 MB on the candidate. The candidate
performed 14–16 collections per round; the original usually performed five.
Two original rounds also overlapped the scheduled Data Insights workload and
allocated substantially more memory. The earlier failures remain recorded;
latency acceptance is still open.

A fresh-process comparison used the repository Docker defaults,
`-Xms1G -Xmx1G`, matching fixtures, the same frozen client and five alternating
pairs of 1,000 measured requests after 200 warmups at 50 offered requests per
second. All 20,000 responses passed. Columns had median paired p50/p95/p99 ratios
of 0.979/0.959/0.611. Relationships had ratios of 0.984/1.180/19.142; their p95
and p99 were slower in all five pairs. Median run relationship p99 was 33.830 ms
on the original and 690.793 ms on the candidate. Both JVMs performed five
collections per round, except the original's first round with six. Candidate
allocation was lower, approximately 1.74–1.79 GB versus 2.02–2.07 GB per round.
Equal heap sizing and reduced allocation therefore do not establish a tail fix.
Evidence is retained under
`.context/entity-repository/inheritance-empty-fixed-simple-reads-50/`.

A subsequent diagnostic isolated relationship reads for 4,000 measured requests
per revision after 400 warmups. JFR, live pool metrics and GC-triggered thread
dumps were enabled, so its timings are excluded from acceptance. Both revisions
had long tails: p99 was 656.514 ms on the original and 611.621 ms on the candidate.
Several captures showed most active requests waiting for Redis replies on
unmounted virtual threads. Database connection waits were also present; neither
observation establishes the primary cause. The shorter paired comparison always
ran columns before relationships.

A longer uninstrumented relationship-only comparison subsequently completed
five alternating pairs of 4,000 measured requests after 400 warmups at 50 offered
requests per second. All 40,000 responses passed. Median paired p50/p95/p99 ratios
were 0.958/0.928/0.840. Candidate p50 and p95 were lower in every pair; p99 was
lower in four pairs. The paired p99 ratios ranged from 0.132 to 1.292, so tail
repeatability remains insufficient for sign-off. This run does not reproduce a
consistent relationship slowdown, and shows that the shorter workload sequence
is insufficient to characterize its tails. Evidence is retained under
`.context/entity-repository/inheritance-empty-fixed-relationships-long/`.
The full cache/load matrix remains open.

## Composed-module SQL comparison

The original task snapshot and frozen `mutation-policy-service.jar` each
passed all 78 instrumented workload checks on PostgreSQL with Redis. The following
counts cover two measured requests against 100-column fixtures:

| API workload | Original SQL statements | Composed policy SQL statements |
| --- | ---: | ---: |
| Column read | 0 | 0 |
| Column metrics read | 202 | 4 |
| Column extensions read | 202 | 4 |
| History read | 226 | 28 |
| Unchanged PUT | 246 | 48 |
| Changed PUT | 252 | 54 |
| Unchanged bulk update | 56 | 49 |
| Changed bulk update | 90 | 78 |
| Hard delete | 470 | 74 |

These diagnostics establish database-work reductions for these fixtures. They
were collected alongside regression suites, so their elapsed timings are excluded
from latency acceptance. Sixty workload totals decreased, sixteen stayed equal,
and two asynchronous totals increased. The asynchronous diagnostic window includes
the client's completion GETs; the number of polls varies with completion time.
The probe only records threads with a request context, so these asynchronous totals
do not establish a budget for all background mutation SQL.

A repeated four-request unchanged-bulk check used 96 statements at widths 100 and
1,000, and 97 at width three, versus 112 at each width on the original artifact.
Each candidate request committed one nonempty transaction.
The single extra statement moved between widths across runs; its origin remains
unattributed, so a strict 24-statements-per-request ceiling is not claimed.

The commit probe counts explicit JDBI commits, not autocommit completions. A
four-request follow-up found unchanged bulk updates made zero explicit commits in
the original and four in the composed implementation; none of its transactions were empty. Metadata cleanup
previously performed outside the owning transaction now participates in it. Null
certification inputs still clear stored tags even when the input projection omits
them; skipping that delete would break the existing cleanup contract. Changed bulk
updates retain one mutation commit and the existing separate post-commit feed
transaction per request.

The first warm latency screen was invalidated when the original baseline timed out
on 10 of 20 changed 1,000-column CSV imports at ten offered requests per second.
The paired comparison did not complete. Heavy CSV workloads require a separate,
lower offered rate, held equal across both revisions, before their latency can be
assessed.

## Cold-cache and Redis-outage checks

Both frozen artifacts passed 26 workloads at widths three and 1,000 with a fully
cold cache, then with L1 cleared while Redis remained available. Each workload
used one warmup and two measured requests. Representative 1,000-column totals:

| API workload | Original cold SQL | Composed cold SQL | Original L1-cold SQL | Composed L1-cold SQL |
| --- | ---: | ---: | ---: | ---: |
| Column metrics | 2,008 | 10 | 2,002 | 4 |
| Changed PUT | 2,064 | 66 | 2,054 | 56 |
| Changed bulk update | 100 | 88 | 92 | 80 |
| Hard delete | 4,080 | 84 | 4,070 | 74 |

Both artifacts also passed the same 26 workloads while their isolated Redis
container was paused and L1 was cleared before requests. Both Redis containers
were resumed, followed by acknowledged cache recovery. The candidate's critical
PostgreSQL transaction/cache suite with Redis disabled passed 47 tests with one
cache-mode assumption abort. Redis fallback and the owning transaction therefore
have functional evidence in these configurations.

All these diagnostics used SQL instrumentation while API regression suites were
running. Their elapsed timings are excluded from latency acceptance. The full
five-pair, cache-mode and offered-load latency matrix is still required.

## Generic deletion reads

Generic entity deletion previously loaded the entity before dispatching to the
owning deletion command, which loaded it again. Removing the unused first result
reduces the measured row SELECT count from three to two for both soft and hard
deletion. The operation still owns one SQL commit. The corrected integration
fixture forces fresh reads while retaining Redis publication and verifies both
ID and FQN aliases after deletion. A missing entity remains idempotent with one
row read and no commit.

The three-read baseline passed against the frozen subtree artifact. The two-read
candidate passed on MySQL and PostgreSQL with Redis in the import artifact's
36-selector runs, each with 1,343 passes and zero failures. This is a deterministic
query budget, not an elapsed latency comparison for the final composed module.

## Column-read allocation diagnostic

A separate final-artifact JFR recording exercised column and relationship reads
at width 100, with 100 warmups and 1,000 measured requests per workload per
revision. All 4,000 measured requests passed. Sampled allocation weight attributed
to detail-read application stacks was approximately 1.41 GB on the original and
0.95 GB on the composed artifact. JSON serialization, deserialization, inheritance
and relationship processing dominate those samples. Stack attribution was used
because virtual request threads do not have the platform request-thread names.
These are sampled weights, including warmup, not exact allocation totals or
latency evidence; JFR overhead excludes these timings from acceptance. Recordings
and summaries are retained under
`.context/entity-repository/mutation-policy-simple-read-profile-v2/`.

A JFR allocation recording of 600 successful reads on the reference-validation
artifact (`518153b16ed937d56f54aab9962cd3bea7111bf518ec6b78753a9c72b757cafd`)
covered 100- and 1,000-column tables with Redis enabled. Request-cache snapshot
serialization accounted for about 48% of the sampled allocation weight attributed
to detail reads; deserializing the canonical cached entity accounted for another
43%. These are sampled weights from an instrumented run alongside regression
suites, not precise allocated-byte totals or latency measurements.

A private UTF-8 snapshot prototype passed 31 compatibility tests, including
unpaired surrogates, extension values, mutable copies, aliases, eviction and
serialization failures. A warmed-thread allocation probe gave mixed results:

| Columns | Snapshot only, String → UTF-8 bytes/op | Snapshot and two hits, String → UTF-8 bytes/op |
| --- | ---: | ---: |
| 3 | 1,933 → 1,925 | 7,547 → 7,795 |
| 100 | 18,768 → 33,274 | 105,929 → 120,544 |
| 1,000 | 617,192 → 323,437 | 1,494,856 → 1,201,176 |

The probe used five rounds of 500 operations after 1,000 warmups per shape,
Java 21/G1 and a 2 GB heap. It measures the current thread's allocated bytes,
not API latency or production virtual-thread allocation. The prototype was not
adopted because it increased allocation for smaller fixtures. Production retains
the existing String snapshots, one serialization for both aliases, independent
returned POJOs and the 50-entry request-cache bound. Ten new characterization
tests preserve these contracts for further work. Redis formats and behavior are
unchanged by this diagnostic.

## Attribution metadata writes

Attribution updates now lock and read only FQN, version and change-description
metadata, then update the change-description JSON field. They no longer transfer
or deserialize the column graph, serialize the full entity, or rewrite the FQN hash.
The existing unit of work owns the transaction and deadlock replay; cache
invalidation remains deferred until its owning commit.

Database probes on MySQL and PostgreSQL pass the single-write, concurrent-write,
rollback and retry cases. Across 3, 100 and 1,000 columns, the deterministic path
uses one locked SELECT and one UPDATE, with less than 2 KB of projected metadata
for these fixtures. Column counts and unrelated stored values remain intact.
These are work and payload budgets, not elapsed latency measurements. Native
packaged-artifact verification and paired latency comparisons remain required.

The frozen Maven artifact is `summary-projection-native-service.jar`, SHA-256
`eac553d97d072278715ea2ed32127216fb767e1e6cf529375e553fb7a5eca651`.
Its selected service run passed 2,039 tests with one skip. Diagnostic SQL overlays
preceded this package and are not substitutes for its final API or coverage runs.

## Bulk preparation and field selections

Bulk resources now reuse the canonical name produced by `prepareInternal`.
The preceding artifact calculated each name twice: two calls for a single input
and six for three inputs. The regression checks now observe one and three calls,
respectively, and verify the stored names and service relationships through the API.
The preparation and field-policy artifacts each passed 3,246 API tests per database
with Redis enabled. This removes repeated name preparation; it does not establish
a database query reduction or an elapsed latency gain for every entity type.

Wildcard field selections copy the allowed field set directly, avoiding a string
join and parse. Selections remain independently mutable and retain constructor
changes to supported fields. The field-policy behavior tests cover strict errors,
supported-only selections and common write-field defaults.

## Mutation benchmark coverage

The driver supports `-DentityBenchmark.scheduling=single-client` for sequential
measurements without an arrival-rate delay. It starts the next sample only after
the previous request and required completion checks finish. This mode reports
zero offered requests per second, a maximum of one request in flight, and the
explicit scheduling mode in its CSV. The default `open-loop` mode retains
scheduled arrivals and includes submission delays in measured latency. Cache
reset measurements remain explicitly identified as acknowledged, serial runs.
The driver also exports an ordered request trace alongside the ranked latency
samples. It records latency, delay between scheduled arrival and the start of
request work, HTTP status and success after response validation. A rejected HTTP
503 and a failed bulk result returned with HTTP 200 therefore remain distinct.
Trace files are written after measurement; the existing 100,000-sample limit
bounds their retained data. Twenty driver tests pass, including serial scheduling,
queued rejection and failed-row cases. SQL probe tests declare their H2 dependency
with test scope.

The standalone harness now defines 78 workloads across 3, 100 and 1,000 columns.
In addition to the earlier reads and individual writes, it includes three-row bulk
create, duplicate, unchanged, changed and mixed requests, soft/hard delete, restore
and stale PATCH conflicts. CSV covers export, unchanged/changed imports and dry runs.
Warmup and measured mutations use separate entities. Restore requests capture the ID
from their own setup response.

Asynchronous bulk workloads report HTTP acknowledgement and observed completion
separately. Both drain every accepted row and require the expected new values on
existing rows, so HTTP 202 or an older HTTP 200 representation cannot hide failed
work. Completion polls every 20 ms, stops reading completed rows, and limits every
HTTP timeout to the remaining deadline. This measures observed completion, including
polling delay, rather than the exact server commit time.

Bulk requests must return the expected successful row counts and no failures;
HTTP 200 alone is insufficient. HTTP completion is recorded before parsing and
validating the result. Protocol tests demonstrate rejection of a partial bulk
success and independent restore IDs across warmup and measurement. All 57 workloads
passed functional smoke checks against both the original and detail-reader servers
with PostgreSQL and Redis (one warmup and two measured requests per workload).
The paging artifact also passed all 75 workloads before the duplicate cases were
added, including CSV and asynchronous checks at every width. Twelve HTTP/protocol
tests cover partial results, old async values, bounded completion, quoted CSV and
per-sample setup IDs. Both the original artifact and the metadata-read-assembly
candidate (`2c5d047905813162481310274166cd16c8281551b987c845e36946933aedc66a`)
subsequently passed all 78 workloads, including duplicate bulk inputs. Other tests
were running concurrently, so these smoke timings are
not latency evidence. Paired latency runs and the full cache/concurrency matrix
remain open.

## Ownership persistence differences

Focused tests on the preceding ownership-writer artifact measured 4,000 ID getter
calls for two unchanged 1,000-item owner/domain lists, and 4,001 for an owner change
that removes one ID and adds another. Reusing the two ID sets reduces these budgets
to 2,000 and 3,001 respectively. The added-reference list was used only to determine
whether anything changed; it is no longer allocated. Removed owners group directly
into ID lists, avoiding an intermediate reference list per owner type.

All 12 focused ownership behavior and work-count tests passed after this change;
the new budgets failed against the preceding artifact. Full requested-set writes,
duplicate and ID-only matching semantics, domain lineage identity and repository
store hooks remain. The 856-test selected service build passed; the subsequent
seed/pipeline artifact passed 1,471 API tests per database with Redis enabled
(82 assumption aborts and eight skips each). These CPU-work
reductions do not establish elapsed API latency gains.

## Nested field-tag projections

The preceding implementation keyed flattened field lists by the mutable entity
POJO. A 1,000-column fixture measured two complete entity `hashCode()` traversals;
two distinct but equal table objects could also cause one field projection to be
skipped. Both regressions reproduced on the preceding frozen service artifact.

`EntityFieldTagReader` retains field lists by input occurrence. Both characterization
tests pass with zero entity hashes, alongside seven component tests. Query chunks
remain 5,000 exact FQNs; repeated FQNs share their usage read, and derived labels
are fetched once for the batch. The service build passed 879 selected tests. Both
flat/nested-column database cases reproduced missing tags on the preceding artifact
and passed on the fixed PostgreSQL artifact, within an 11-pass selection (one skip).
The expanded MySQL verification also passed these cases. The removed hash traversals are a CPU-work
measurement; elapsed API latency has not yet been compared for this artifact.

## Asynchronous bulk retention

`EntityBulkJobs` keeps the existing bounded executor and 100 active permits. Its
completed history is capped at 1,000 entries with five-minute expiry, replacing
an unbounded result map and one delayed cleanup task per completion. Active jobs
never expire or get evicted, and returned futures retain results after history
eviction. Cancellation holds admission capacity until the accepted mutation has
finished. Older completed entries may be evicted before five minutes under load;
the REST acknowledgement does not expose these internal job IDs.

Eleven focused tests passed, including concurrent admission, cancellation,
expiry, scheduling failures and authorization-result merging. The 853-test selected
service build passed. MySQL and PostgreSQL with Redis each passed 399 API tests,
with ten assumption aborts and two skips. Asynchronous acknowledgement and
completion latency comparisons remain open.

## Team-owner validation

The reference-validator artifact
(`6efe52a37d2c616821c08e1b70fdae7b83c7d7eeb9b97987f77eaf1e57625de0`)
uses the reference from the team already loaded to validate its group type. Real
database tests inside `FreshReadScope` measured these team reads:

| Owner input | Before | After |
| --- | ---: | ---: |
| One group team | 2 | 1 |
| Two occurrences of the same group team | 3 | 1 |

The preceding implementation already reused its empty-field team projection through
`RequestEntityCache`; it still repeated the canonical reference lookup. The new path
preserves the complete reference JSON, input order, independent returned references,
and rejection of non-group teams. The MySQL and PostgreSQL selections each passed
335 tests with Redis. Normal reads retain their existing Redis and L1 layers; these
fresh-read SQL counts do not imply the same SQL reduction on warm cache hits or
establish an elapsed API latency improvement.

## Reference differences

The relationship-write artifact
(`74e4783e83391e421d842f47b543edec5f982c30588d4c25015c568127eb47ad`)
indexes reference lists by ID and entity type for the canonical matching predicate.
Two unchanged 1,000-reference lists required 2,010,000 identity-field reads on the
preceding artifact; the new regression budget is fewer than 20,000. One hundred
seeded comparisons against the linear matcher preserve added/deleted payloads,
duplicate order and type-sensitive identity. Custom predicates and malformed
references retain the previous matching/error path. The maps live only for that
diff and do not add a persistent cache or database read.

Relationship deletion also groups directly into ID lists, removing an intermediate
reference list per type. Stable insertion and response-order comparators are retained
once per component. The 676-test selected service run passed, as did 1,900 API consumer
tests on each database with Redis. These work-count results do not establish an elapsed
API latency gain.

## Owner/domain hydration and column validation

The access-metadata artifact passed 312 integration tests on each database with
Redis enabled (ten assumption aborts and one skip each). Baseline SQL tests failed
at two relationship queries; the candidate passes at one when both fields are
requested. Authorization and inheritance preserve their different missing-value
rules. The combined statement keeps the original predicates and uses `UNION ALL`;
it reduces round trips while retaining both selections.

| Operation | Before | After |
| --- | ---: | ---: |
| Authorization owner/domain relationship queries per batch | 2 | 1 |
| Inheritance owner/domain relationship queries per batch | 2 | 1 |
| Name accesses while validating 1,000 column names | 2,000 | 1,000 |

Large-input tests cover more than 30,000 IDs, duplicate IDs across chunk boundaries,
and deleted relationship rows on both databases. Owner references still use
`NON_DELETED`; domains still use `ALL`, through the existing reference/cache path.
Column-name membership checks now use a set, preserving case sensitivity, null
handling and the first-duplicate error. Empty column and tag updates skip unused
diff/index allocations while retaining the existing hooks.

Verified access-metadata service SHA-256:
`56d383193ebe091f5c039f93e5cc6942f67c96c15b4346096cc68b4792e556fe`.
These are deterministic work reductions, not elapsed API latency measurements.

## Column matching and Redis alias eviction

The column stage passed 123 applicable integration tests on both MySQL and
PostgreSQL with Redis enabled. These deterministic tests establish reduced work;
they do not measure elapsed API latency.

| Operation | Before | After |
| --- | ---: | ---: |
| List difference for 1,000 unchanged columns: column-name reads | 2,004,000 | Fewer than 20,000 |
| Adjacent FQN entity/reference alias deletions | Two Redis DEL commands | One multi-key DEL command |

Column matching uses case-insensitive ordered name buckets and retains the first
matching data/array type. It preserves Java's Unicode case matching, duplicate
semantics and the linear fallback for custom predicates. Column orchestration
reuses that index for its existing-column walk. Redis eviction retains both keys,
bypass behavior and the surrounding invalidation/publication order.

Verified column-orchestration service SHA-256:
`f0262c4b418e3994346690dfb309a0962a12eb69ed92829c6a228aa8d6b39957`.
Subsequent work reductions are reported above. The final latency matrix remains open.

## History/cache stage: paired read measurements

Five alternating paired runs, 200 measured requests and 50 warmups per workload per run,
10 offered requests/second, HTTP client in a separate process. Each version has 1,000
measured requests per workload. Java 21/G1, 4 GiB maximum heap; durable PostgreSQL 16,
OpenSearch 3.4.0, and Redis disabled. Both servers used the same test harness and fixture shape
(100 columns, custom metrics, column extensions, owner/follower and five history versions).
Measured on a shared local development machine. No builds or tests ran during measurement.

The candidate is the frozen history/cache stage; it predates pagination, custom-property
validation/storage, row hydration, session-policy and tag/certification extractions.

Baseline artifact SHA-256: `306263df42c131d28daa4a5c189591e2f5563937501dddd105c8221ee1cdfdf5`.
Candidate artifact SHA-256: `01ce602757791b4e2c654fa2803b46837c9f727c559f18f33136183a50217ec7`.

## p50

Values are medians of the five run percentiles, in milliseconds. Ratios compare paired runs.

| Workload | Baseline | Candidate | Median paired ratio | Ratio range | Candidate slower runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| get.columns.100 | 15.22 | 15.50 | 1.001 | 0.982–1.106 | 3/5 |
| get.metrics.100 | 133.88 | 17.45 | 0.132 | 0.115–0.140 | 0/5 |
| get.extensions.100 | 116.06 | 17.96 | 0.156 | 0.149–0.190 | 0/5 |
| get.relationships.100 | 24.57 | 23.71 | 0.941 | 0.898–0.992 | 0/5 |
| list.metrics.100 | 141.95 | 19.05 | 0.137 | 0.124–0.209 | 0/5 |
| get.history.100 | 142.73 | 40.55 | 0.295 | 0.132–0.391 | 0/5 |

## p95

Values are medians of the five run percentiles, in milliseconds. Ratios compare paired runs.

| Workload | Baseline | Candidate | Median paired ratio | Ratio range | Candidate slower runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| get.columns.100 | 22.31 | 23.36 | 1.052 | 0.347–1.072 | 4/5 |
| get.metrics.100 | 1293.82 | 27.44 | 0.021 | 0.018–0.490 | 0/5 |
| get.extensions.100 | 1089.37 | 27.07 | 0.027 | 0.019–1.149 | 1/5 |
| get.relationships.100 | 649.00 | 582.72 | 1.870 | 0.048–17.460 | 3/5 |
| list.metrics.100 | 1380.64 | 29.72 | 0.022 | 0.012–0.024 | 0/5 |
| get.history.100 | 1397.14 | 1046.87 | 0.749 | 0.190–1.646 | 2/5 |

## p99

Values are medians of the five run percentiles, in milliseconds. Ratios compare paired runs.

| Workload | Baseline | Candidate | Median paired ratio | Ratio range | Candidate slower runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| get.columns.100 | 36.26 | 36.92 | 1.018 | 0.052–1.778 | 3/5 |
| get.metrics.100 | 1582.86 | 1023.60 | 0.716 | 0.022–1.265 | 1/5 |
| get.extensions.100 | 1484.27 | 33.89 | 0.023 | 0.016–1.367 | 1/5 |
| get.relationships.100 | 1349.59 | 1299.52 | 1.492 | 0.025–36.828 | 3/5 |
| list.metrics.100 | 1808.22 | 39.39 | 0.023 | 0.011–0.032 | 0/5 |
| get.history.100 | 1795.86 | 1474.13 | 0.821 | 0.450–1.786 | 2/5 |

All 12,000 measured responses had the expected status. Individual run CSVs and ranked raw
latencies are retained in the workspace at `.context/entity-repository/paired-reads-v2/`. These runs do not cover writes, other table widths,
Redis configurations or the latest code. Tail spikes require investigation before latency sign-off.

## Tag/certification stage: SQL query counts

`TagMetadataReadIT` measured the before tag-usage query counts with a real MySQL
database, OpenSearch and Redis on the preceding frozen metadata-policy artifact.
The after counts passed on both MySQL and PostgreSQL, each using OpenSearch and
Redis, with the final tag/certification artifact below.

| Bulk projection, three tables | Before | After |
| --- | ---: | ---: |
| Tags and certification | 2 | 1 |
| Tags including glossary-derived tags | 4 | 2 |
| Certification only | 1 | 1 |
| Neither tags nor certification | 0 | 0 |

`BulkTagReadIT` also verifies two tag-usage queries across three entities for topics,
pipelines, containers, search indexes, dashboard data models and API endpoints.
The tests assert returned labels, certification dates and independent tag lists
for duplicate FQNs. Single and batch certification replacement tests verify
rollback with accompanying tag writes.

Final tag-stage artifact SHA-256: `fdb61abe9308fdbab55aa00f19c2c78dcc031136d52e385ad8341956565f7fd6`.
These query budgets do not measure API latency. The paired latency tables above
predate this stage; final p50/p95/p99 and cache-matrix comparisons remain open.

## Update/inheritance stage: duplicate field reads

`BulkFieldReadIT` measured these reductions against the preceding tag-stage artifact
on MySQL/OpenSearch/Redis. The updated query budgets and returned values passed on
the update/inheritance artifact with both MySQL and PostgreSQL, OpenSearch and
Redis. Topic's unsupported usage projection remains rejected, and its legacy
follower resolver remains in place because its missing-reference semantics differ.

| Bulk projection | Before | After |
| --- | ---: | ---: |
| Pipeline usage | 2 | 1 |
| Pipeline status, three pipelines | 6 | 3 |
| Topic service | 3 | 1 |

The update engine also avoids serializing unchanged JSON values and unversioned
changes whose values are not recorded. Getter-counting regression tests measured
two serializations before and zero after for each path; changed values still
serialize once each.

Update/inheritance artifact SHA-256:
`2839d1afecfcf351d6d91d7849c33a0191c900f998b62f1eb215ddb08a836065`.
These deterministic reductions do not replace the final API latency comparisons.

## Custom-property mutations

`EntityExtensionMutationIT` confirmed one delete and one upsert for an unchanged
property on the update/inheritance artifact (the MySQL upsert uses `REPLACE INTO`).
The extracted custom-property updater performs zero deletes and zero upserts for
that same no-op. Hard deletion also issued two extension deletes where the first
all-extensions delete was sufficient; the cleanup path now issues one. Both query
budgets, session replay and transaction rollback passed with MySQL and PostgreSQL,
each using OpenSearch and Redis. These SQL assertions do not measure elapsed time.

Verified deletion-cleanup artifact SHA-256:
`b99029b3ac3dcecf3555a9516e14c7386030ec551ffced0723a2622bb783f3c1`.

## Bulk restore and soft-delete transaction baseline

`EntitySubtreeAtomicityIT` measured two commits for each operation on the
deletion-cleanup artifact with MySQL/OpenSearch/Redis. An injected exception after
the bulk row write left that row changed in both cases.

The frozen subtree-update artifact passed 118 tests on each of MySQL and PostgreSQL
with Redis enabled, with one cache-disabled-only assumption abort each. The eight
new atomicity cases verify that both operations now commit once, roll back rows and
history together, replay an injected deadlock with one rollback and one commit,
and join an enclosing rollback with zero commits. Canonical rows and version deltas
are asserted after each operation. This removes one commit per changed level;
elapsed API latencies for this artifact remain unmeasured.

Verified service SHA-256:
`e4f8a8a8373fc4903dbe85d11c425918d29f934bee35e5f9e73d3fea85a4956f`.

## Hard-delete publication

The deletion/workflow artifact passed 126 integration tests on each database with
Redis enabled, with one cache-disabled-only assumption abort each. Single and bulk
hard deletions retain their one-commit budget. Redis not-found markers and Flowable
cancellation now wait for an enclosing commit; rollback preserves the entity,
metadata, ID/FQN API reads and its paused workflow. On the preceding artifact,
both operations left not-found markers after rollback and cancelled workflows
before the enclosing transaction committed. These are correctness and transaction
boundary measurements, not elapsed API latency results.

Verified service SHA-256:
`a57b3458b8c1b79311295ba6c8e0860128a0a83b6015e1b2396bc1c96625a7d0`.

## Bulk mutation and CSV summary budgets

The bulk publication artifact passed 199 applicable integration tests on each
database with Redis enabled. The mixed coordinator extraction subsequently passed
203 on each database, with the same ten assumption aborts per run.

| Operation | Previous behavior | Verified behavior |
| --- | --- | --- |
| Changed bulk update | Three explicit commits plus metadata autocommits | One mutation commit and one existing post-commit feed batch |
| Unchanged source hash | Fast path | Zero SELECTs and zero commits retained |
| New duplicate FQN in a mixed batch | One reload | One reload retained |
| CSV summary history/current row/feed | Independent writes could survive later failure | One retained transaction; all roll back together |
| Bulk metric accounting | Per-entry latency list and unused average/maximum scans | Fixed lazy meter references; no latency list or aggregate scans |

Failure injection also verifies complete owning-transaction replay after a nested
deadlock, fresh snapshots for bulk fallback, and event publication after commit
despite a failing post-update hook. Permission checks share one explicit-denial
snapshot per mutation. These are SQL, transaction and allocation changes; no new
elapsed API latency result is claimed here.

Verified mixed coordinator service SHA-256:
`1fe9d09409e66a6c946c61ab33d6ee80c67fec47015fc900aae2d4e192d49f66`.
