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