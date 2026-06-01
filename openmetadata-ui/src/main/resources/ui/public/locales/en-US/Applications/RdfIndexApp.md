# RDF Knowledge Graph Indexing

Configuration for RDF knowledge graph indexing.

$$section
### entities $(id="entities")

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