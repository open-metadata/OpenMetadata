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
### Search Index Language $(id="searchIndexMappingLanguage")

Search index mapping language.

$$

$$section
### Auto Tune $(id="autoTune")

Enable automatic performance tuning based on cluster capabilities and database entity count

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

Settings applied to staged indexes before alias swap (live serving values). Tune for read freshness and HA. Defaults preserve current near-real-time read-after-write behavior. number_of_shards is omitted — it can only be set at index creation time, not via PUT _settings, and the staged-index reindex flow uses the static mapping JSON for creation.

$$

$$section
### Number of Replicas $(id="liveIndexSettings.numberOfReplicas")

Replica shard count. 1 for HA on multi-node clusters; 0 for single-node.

$$

$$section
### Refresh Interval $(id="liveIndexSettings.refreshInterval")

How often new writes become searchable. '1s' = near-real-time (required if users/agents read-after-write). Higher values reduce CPU/segment churn but delay search visibility.

$$

$$section
### Translog Durability $(id="liveIndexSettings.translogDurability")

'request' = fsync per write (durable). 'async' = fsync on interval (faster, can lose <syncInterval seconds on crash).

$$

$$section
### Translog Sync Interval $(id="liveIndexSettings.translogSyncInterval")

Translog fsync cadence when durability=async. Ignored when durability=request.

$$

$$section
### Bulk Index Settings (during reindex) $(id="bulkIndexSettings")

Overrides applied to staged indexes during bulk reindex for write throughput. Reverted to liveIndexSettings before alias swap. Nothing reads from staged indexes, so refresh=-1 and replicas=0 are safe.

$$

$$section
### Number of Replicas $(id="bulkIndexSettings.numberOfReplicas")

Replica count during bulk write. 0 disables replica indexing for max throughput; replicas are populated after promotion from the new primary.

$$

$$section
### Refresh Interval $(id="bulkIndexSettings.refreshInterval")

'-1' disables refresh during bulk write — no segment churn, dramatically faster. Staged index isn't searchable, so this is safe. Reverted to live value before swap.

$$

$$section
### Translog Durability $(id="bulkIndexSettings.translogDurability")

'async' for bulk: fsync is batched, not per-write. Acceptable because a crashed reindex is rerunnable.

$$

$$section
### Translog Sync Interval $(id="bulkIndexSettings.translogSyncInterval")

Relaxed translog fsync cadence during bulk. Ignored when durability=request.

$$

$$section
### Force-merge before alias swap $(id="bulkIndexSettings.forceMergeOnPromote")

Run _forcemerge to 1 segment before swapping the alias. Improves post-reindex query performance at the cost of build time. Enable for large indexes serving heavy read traffic.

$$