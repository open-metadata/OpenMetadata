# RDF Knowledge Graph Indexing

Configuration for RDF knowledge graph indexing.

$$section
### Entities $(id="entities")

List of entities that you need to reindex. Leave empty to index all supported entities.

$$

$$section
### Recreate RDF Store $(id="recreateIndex")

Clear the RDF store before indexing.

$$

$$section
### Batch Size $(id="batchSize")

Maximum number of entities processed in a batch.

$$

$$section
### Producer Threads $(id="producerThreads")

Number of producer threads to use for non-distributed RDF indexing.

$$

$$section
### Consumer Threads $(id="consumerThreads")

Number of consumer threads to use for non-distributed RDF indexing.

$$

$$section
### Queue Size $(id="queueSize")

Internal queue size for non-distributed RDF indexing.

$$

$$section
### Use Distributed Indexing $(id="useDistributedIndexing")

Enable distributed RDF indexing with partition coordination and recovery.

$$

$$section
### Partition Size $(id="partitionSize")

Number of entities per partition for distributed RDF indexing.

$$

$$section
### Blue/Green Rebuild $(id="blueGreenRebuild")

Build the rebuild into an idle dataset and switch to it only after the run succeeds, so queries keep seeing the previous graph instead of a partially-rebuilt one. Requires roughly twice the dataset size on disk. Only applies when Recreate RDF Store is enabled.

$$

$$section
### Minimum Success Ratio $(id="minSuccessRatio")

Fraction of records that must index successfully before a blue/green rebuild is allowed to become the served dataset. Below this the previous dataset keeps serving and the run is marked failed.

$$

$$section
### Max Retries $(id="maxRetries")

Maximum number of failed write attempts tolerated per relationship source before that source is abandoned for the run.

$$