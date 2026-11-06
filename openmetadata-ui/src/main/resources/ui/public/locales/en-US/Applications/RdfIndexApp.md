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
### Number of Reader Threads $(id="producerThreads")

Number of threads loading entities to index. Writes always go through one writer, because Fuseki accepts one write transaction at a time.

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
### Relationship Isolation Failure Limit $(id="relationshipIsolationMaxFailures")

Maximum failed per-source writes during isolation of a failed RDF relationship batch. Once this limit is reached, remaining sources are recorded as failures. Successful writes do not consume the budget; zero disables per-source isolation. This is separate from HTTP request retries.

$$