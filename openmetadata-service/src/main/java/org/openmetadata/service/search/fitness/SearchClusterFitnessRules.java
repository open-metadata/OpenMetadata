/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under the License.
 */
package org.openmetadata.service.search.fitness;

/**
 * Threshold constants for the cluster fitness diagnostic.
 *
 * <p>Each constant carries the rationale for the chosen value so devops reading the report can
 * understand why an observation was flagged. Numbers reflect Elastic / AWS OpenSearch sizing
 * guidance and operational experience with OpenMetadata workloads. Tune by editing this class and
 * rebuilding — there is intentionally no runtime configuration knob.
 */
public final class SearchClusterFitnessRules {

  private SearchClusterFitnessRules() {}

  /**
   * Average bytes per document above which an index is considered "heavy" (likely contains large
   * descriptions, sampleData, or deeply nested arrays). Elastic recommends keeping documents under
   * ~100KB for healthy indexing and search latency; we warn earlier to give a buffer.
   */
  public static final long AVG_DOC_BYTES_WARN = 50L * 1024;

  /**
   * Average bytes per document above which an index is considered critically heavy. A typical
   * "entity-as-blob" anti-pattern — heap pressure, slow merges, and source-field bloat all scale
   * with document size.
   */
  public static final long AVG_DOC_BYTES_FAIL = 500L * 1024;

  /**
   * Primary shard size above which Elastic recommends splitting into more shards. Source:
   * Elasticsearch sizing guide — "aim to keep the shard size between a few GB and a few tens of
   * GB" with 50GB as a commonly cited upper bound.
   */
  public static final long SHARD_SIZE_FAIL_BYTES = 50L * 1024 * 1024 * 1024;

  /** Primary shard size threshold above which we suggest splitting (warning, not failure). */
  public static final long SHARD_SIZE_WARN_BYTES = 30L * 1024 * 1024 * 1024;

  /**
   * Indices smaller than this with more than one primary shard are over-sharded — wastes file
   * handles, slows search fan-out, and provides no scaling benefit.
   */
  public static final long INDEX_OVERSHARDED_SIZE_BYTES = 1L * 1024 * 1024 * 1024;

  /** Node disk usage percent at which we WARN (well below ES default low watermark of 85%). */
  public static final double DISK_USAGE_WARN_PERCENT = 75.0;

  /**
   * Node disk usage percent at which we FAIL. The default ES/OS low watermark is 85% — once
   * crossed, no new shards are allocated to the node. The high watermark (90%) triggers shard
   * relocation; flood-stage (95%) flips indices read-only.
   */
  public static final double DISK_USAGE_FAIL_PERCENT = 85.0;

  /** JVM heap usage percent above which we WARN (sustained pressure, indexing slows). */
  public static final double HEAP_USAGE_WARN_PERCENT = 75.0;

  /**
   * JVM heap usage percent above which we FAIL. Above 85% Old-Gen GC dominates and the node is
   * effectively single-threaded for collection work.
   */
  public static final double HEAP_USAGE_FAIL_PERCENT = 85.0;

  /** Sustained CPU percent that suggests the node is too small for current load. */
  public static final double CPU_USAGE_WARN_PERCENT = 75.0;

  public static final double CPU_USAGE_FAIL_PERCENT = 90.0;

  /**
   * Cap recommended heap per data node. The 32GB compressed-OOPs threshold is the universal upper
   * bound for ES/OS JVMs.
   */
  public static final long MAX_RECOMMENDED_HEAP_BYTES = 31L * 1024 * 1024 * 1024;

  /**
   * Recommended ratio of total data size that fits in JVM heap. AWS OpenSearch sizing guide
   * recommends 1:25 for general search workloads. OpenMetadata's heavier nested entity documents
   * push the working set per doc higher, so we use a more conservative 1:20 to leave heap
   * headroom for fielddata cache and indexing buffers.
   *
   * @see <a
   *     href="https://docs.aws.amazon.com/opensearch-service/latest/developerguide/sizing-domains.html">AWS
   *     OpenSearch sizing guide</a>
   */
  public static final long DATA_TO_HEAP_RATIO = 20L;

  /**
   * Target primary-shard data per node for capacity planning. AWS recommends keeping per-node
   * data under ~200 GB for general search workloads (at the 1:25 heap-to-data ratio with a
   * typical 8 GB heap data node, this is the natural ceiling).
   */
  public static final long TARGET_NODE_DATA_SIZE_BYTES = 200L * 1024 * 1024 * 1024;

  /**
   * Disk headroom multiplier — each data node should provision this much disk beyond the data it
   * holds. Covers replicas, merge scratch space, snapshots, and watermark headroom. Derived from
   * AWS storage formula (source × (1 + replicas) × 1.45) doubled to operate well below the high
   * watermark.
   *
   * @see <a
   *     href="https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp-storage.html">AWS
   *     storage best practices</a>
   */
  public static final double DISK_HEADROOM_MULTIPLIER = 2.5;

  /**
   * AWS storage overhead multiplier. Minimum storage = source_data × (1 + replicas) × this. The
   * 1.45 captures ~10% indexing overhead plus OS-reserved 5% (or 20 GB, whichever is smaller)
   * plus workload headroom.
   */
  public static final double AWS_STORAGE_OVERHEAD_MULTIPLIER = 1.45;

  /** Buffer data nodes beyond the minimum required. AWS recommends ≥1 for production. */
  public static final int DATA_NODE_BUFFER = 1;

  /**
   * Maximum shards per GB of JVM heap. AWS recommendation; once exceeded, shards should be
   * consolidated or heap increased.
   *
   * @see <a
   *     href="https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp-sharding.html">AWS
   *     sharding best practices</a>
   */
  public static final int MAX_SHARDS_PER_GB_HEAP = 25;

  /**
   * Data-node count above which AWS recommends switching from data-eligible masters to dedicated
   * master nodes.
   *
   * @see <a
   *     href="https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp-instances.html">AWS
   *     instance best practices</a>
   */
  public static final int DEDICATED_MASTER_DATA_NODE_THRESHOLD = 10;

  /**
   * Target primary shard size for AWS search workloads (10–30 GB). We use 30 GB as the planning
   * target — large enough to keep shard count down, small enough to recover quickly.
   */
  public static final long TARGET_PRIMARY_SHARD_SIZE_BYTES = 30L * 1024 * 1024 * 1024;

  /** Total cluster shard count vs. (nodes × max-shards-per-node). Warn beyond this fraction. */
  public static final double SHARD_BUDGET_WARN_FRACTION = 0.7;

  public static final double SHARD_BUDGET_FAIL_FRACTION = 0.9;

  /** Default ES/OS max shards per node when the cluster setting is unavailable. */
  public static final int DEFAULT_MAX_SHARDS_PER_NODE = 1000;

  /** Pending tasks queue depth above which the master is struggling to keep up. */
  public static final int PENDING_TASKS_WARN = 10;

  public static final int PENDING_TASKS_FAIL = 50;

  /** Headroom we leave before the low watermark — warn when within this fraction of crossing. */
  public static final double WATERMARK_PROXIMITY_FRACTION = 0.1;
}
