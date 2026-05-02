# Search Indexing Application

This schema defines configuration for Search Reindexing Application.

$$section
### Batch Size $(id="batchSize")

Maximum number of events entities in a batch (Default 100).

$$

$$section
### Payload Size $(id="payLoadSize")

Maximum number of events entities in a batch (Default 100).

$$

$$section
### Number of Producer Threads $(id="producerThreads")

Number of threads to use for reindexing

$$

$$section
### Number of Consumer Threads $(id="consumerThreads")

Number of threads to use for reindexing

$$

$$section
### Queue Size to use. $(id="queueSize")

Queue Size to use internally for reindexing.

$$

$$section
### Max Concurrent Requests $(id="maxConcurrentRequests")

Maximum number of concurrent requests to the search index

$$

$$section
### Max Retries $(id="maxRetries")

Maximum number of retries for a failed request

$$

$$section
### Initial Backoff Millis $(id="initialBackoff")

Initial backoff time in milliseconds

$$

$$section
### Max Backoff Millis $(id="maxBackoff")

Maximum backoff time in milliseconds

$$

$$section
### entities $(id="entities")

$$

$$section
### Recreate Indexes $(id="recreateIndex")

$$

$$section
### Search Index Language $(id="searchIndexMappingLanguage")

Recreate Indexes with updated Language

$$

$$section
### Auto Tune $(id="autoTune")

Enable automatic performance tuning based on cluster capabilities and database entity count

$$

$$section
### Use Distributed Indexing $(id="useDistributedIndexing")

Enable distributed indexing to scale reindexing across multiple servers with fault tolerance and parallel processing

$$

$$section
### Partition Size $(id="partitionSize")

Number of entities per partition for distributed indexing. Smaller values create more partitions for better distribution across servers. Range: 1000-50000.

$$

$$section
### Time Series Max Days $(id="timeSeriesMaxDays")

Maximum age in days for time series data during reindexing. Default 0 (index all data). Set to a positive value like 15 to limit to recent data only.

$$

$$section
### Live Index Settings $(id="liveIndexSettings")

Settings applied to staged indexes **before alias swap** (live serving values). These control how the index behaves once it starts serving real read traffic.

The defaults match OpenSearch/Elasticsearch out-of-the-box behavior so live UX is preserved:

- **Number of Shards: 1** — for OpenMetadata indexes (typically 1–5 GB), a single shard outperforms multi-shard. Aim for 10–50 GB per shard if you scale up.
- **Number of Replicas: 1** — required for HA on multi-node clusters; set to `0` for single-node dev.
- **Refresh Interval: 1s** — near-real-time. Required if users or agents read-after-write. Increase to `30s` only if you can tolerate that delay and want lower CPU.
- **Translog Durability: request** — every write is fsynced (durable). `async` is faster but can lose `<syncInterval` seconds on crash.

$$

$$section
### Number of Shards $(id="liveIndexSettings.numberOfShards")

Primary shard count for the live index. **Cannot be changed after index creation** — it's fixed at the staged-index build time. Aim for 10–50 GB per shard. For OpenMetadata catalogs, `1` is correct in most cases (each entity index is typically 1–5 GB total).

$$

$$section
### Number of Replicas (Live) $(id="liveIndexSettings.numberOfReplicas")

Replica shard count for the live index. `1` for production multi-node clusters (HA + read distribution). `0` only for single-node dev clusters where replicas can't be allocated.

$$

$$section
### Refresh Interval (Live) $(id="liveIndexSettings.refreshInterval")

How often new writes become searchable on the live index. Keep at `1s` (default) for near-real-time read-after-write — required if users or agents create an entity and immediately search for it.

Increasing to `30s` reduces segment churn / CPU but delays search visibility. Format: `1s`, `30s`, `1m`.

$$

$$section
### Translog Durability (Live) $(id="liveIndexSettings.translogDurability")

How the translog (write-ahead log) is fsynced on the live index.

- **`request`** (recommended): fsync per write. Durable — acknowledged writes are not lost on crash.
- **`async`**: fsync on `translogSyncInterval`. Faster but a crash can lose up to `syncInterval` seconds of writes.

$$

$$section
### Translog Sync Interval (Live) $(id="liveIndexSettings.translogSyncInterval")

How often the translog is fsynced when `translogDurability=async`. Ignored when durability=`request`. Format: `5s`, `30s`, `1m`. Higher = more throughput but more potential data loss on crash.

$$

$$section
### Bulk Index Settings (During Reindex) $(id="bulkIndexSettings")

Overrides applied to staged indexes **during** the bulk reindex for write throughput. Reverted to **Live Index Settings** before the alias swap, so live read traffic is never affected by these aggressive values.

Recommended defaults (pre-filled):

- **Number of Replicas: 0** — no replica indexing during build; populated after promotion.
- **Refresh Interval: -1** — refresh disabled. Staged index isn't searchable, so this is safe.
- **Translog Durability: async** — fsync batched, not per-write.
- **Translog Sync Interval: 30s** — relaxed fsync cadence.
- **Force-merge before alias swap: off** — enable for one-shot massive reindexes.

Together these typically give **5–10× faster bulk writes** with zero impact on live UX.

$$

$$section
### Number of Replicas (Bulk) $(id="bulkIndexSettings.numberOfReplicas")

Replica count during bulk write. `0` disables replica indexing for max throughput; replicas are populated after promotion from the new primary. Reverted to **Live → Number of Replicas** before alias swap.

$$

$$section
### Refresh Interval (Bulk) $(id="bulkIndexSettings.refreshInterval")

`-1` disables refresh entirely during bulk write — no segment churn, dramatically faster. Staged index isn't searchable, so this is safe. Reverted to **Live → Refresh Interval** before alias swap.

$$

$$section
### Translog Durability (Bulk) $(id="bulkIndexSettings.translogDurability")

`async` for bulk: fsync is batched, not per-write. Acceptable because a crashed reindex is rerunnable and the source of truth is in PostgreSQL/MySQL.

$$

$$section
### Translog Sync Interval (Bulk) $(id="bulkIndexSettings.translogSyncInterval")

Translog fsync cadence during bulk reindex. Ignored when durability=`request`. `30s` is a good balance — most data is flushed regularly without per-write overhead.

$$

$$section
### Force-merge before alias swap $(id="bulkIndexSettings.forceMergeOnPromote")

Run `_forcemerge?max_num_segments=1` on the staged index before swapping the alias. Compacts the many small segments accumulated during bulk write into one large segment, improving post-reindex query latency.

**Cost:** adds time to the reindex (proportional to index size). For a 1 GB index, expect 30–60 seconds; for 50 GB, several minutes.

**When to enable:** large indexes that serve heavy read traffic post-reindex. Skip for small indexes or when build time matters more than steady-state query speed.

$$

