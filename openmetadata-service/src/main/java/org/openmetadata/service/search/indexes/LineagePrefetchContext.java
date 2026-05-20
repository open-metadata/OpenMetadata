package org.openmetadata.service.search.indexes;

import java.util.List;
import org.openmetadata.schema.api.lineage.EsLineageData;

/**
 * Thread-bound holder for upstream lineage that the reindex bulk sinks batch-prefetch before
 * submitting per-entity doc-build tasks. Bound by {@code OpenSearchBulkSink} /
 * {@code ElasticSearchBulkSink} for the duration of a single {@code addEntity()} call so the
 * doc-build virtual thread does not need to acquire a JDBI handle / Hikari connection while
 * building the document.
 *
 * <p>Semantics:
 *
 * <ul>
 *   <li>{@code null} (unset) — no prefetch was attempted; callers should fall back to the
 *       per-entity DB query via {@link SearchIndex#getLineageData(org.openmetadata.schema.type.EntityReference)}.
 *   <li>empty list — prefetch ran and this entity has no upstream lineage.
 *   <li>non-empty list — prefetched edges to apply directly.
 * </ul>
 *
 * Callers MUST pair {@link #setUpstream(List)} with {@link #clear()} in a {@code finally} block to
 * avoid leaking state across tasks that share a virtual-thread worker.
 */
public final class LineagePrefetchContext {
  private static final ThreadLocal<List<EsLineageData>> PREFETCHED_UPSTREAM = new ThreadLocal<>();

  private LineagePrefetchContext() {}

  public static void setUpstream(List<EsLineageData> data) {
    PREFETCHED_UPSTREAM.set(data);
  }

  public static List<EsLineageData> getUpstream() {
    return PREFETCHED_UPSTREAM.get();
  }

  public static void clear() {
    PREFETCHED_UPSTREAM.remove();
  }
}
