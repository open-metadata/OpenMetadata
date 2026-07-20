package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.type.Style;

/**
 * Optional pre-fetched data threaded into {@link SearchIndex#buildSearchIndexDoc(DocBuildContext)}
 * so doc-build mixins (e.g., {@link LineageIndex#applyLineageFields(java.util.Map,
 * DocBuildContext)}) can skip per-entity DB lookups during reindex.
 *
 * <p>{@code prefetchedUpstreamLineage} semantics:
 *
 * <ul>
 *   <li>{@code null} — no prefetch was attempted; callers should fall back to per-entity DB
 *       lookups via {@link SearchIndex#getLineageData(
 *       org.openmetadata.schema.type.EntityReference)}.
 *   <li>empty list — prefetch ran and this entity has no upstream lineage.
 *   <li>non-empty list — prefetched edges to apply directly.
 * </ul>
 *
 * <p>{@code serviceStylePrefetch} semantics:
 *
 * <ul>
 *   <li>{@link ServiceStylePrefetch#notPrefetched()} — no style prefetch was attempted for this
 *       entity; callers should fall back to per-entity lookups.
 *   <li>{@link ServiceStylePrefetch#prefetched(Optional)} with {@link Optional#empty()} — prefetch
 *       ran and this service has no style.
 *   <li>{@link ServiceStylePrefetch#prefetched(Optional)} with a value — prefetched style to apply.
 * </ul>
 *
 * The context is passed by value down the doc-build call chain; nothing is stored in thread-local
 * state, so callers and mixins see the dependency in their method signatures.
 */
public record DocBuildContext(
    List<EsLineageData> prefetchedUpstreamLineage, ServiceStylePrefetch serviceStylePrefetch) {

  private static final DocBuildContext EMPTY =
      new DocBuildContext(null, ServiceStylePrefetch.notPrefetched());

  public DocBuildContext {
    serviceStylePrefetch =
        serviceStylePrefetch == null ? ServiceStylePrefetch.notPrefetched() : serviceStylePrefetch;
  }

  public static DocBuildContext empty() {
    return EMPTY;
  }

  public static DocBuildContext withUpstreamLineage(List<EsLineageData> upstreamLineage) {
    return new DocBuildContext(upstreamLineage, ServiceStylePrefetch.notPrefetched());
  }

  public static DocBuildContext of(
      List<EsLineageData> upstreamLineage, ServiceStylePrefetch serviceStylePrefetch) {
    return new DocBuildContext(upstreamLineage, serviceStylePrefetch);
  }

  public record ServiceStylePrefetch(boolean prefetched, Optional<Style> style) {
    private static final ServiceStylePrefetch NOT_PREFETCHED =
        new ServiceStylePrefetch(false, Optional.empty());

    public ServiceStylePrefetch {
      style = style == null ? Optional.empty() : style;
    }

    public static ServiceStylePrefetch notPrefetched() {
      return NOT_PREFETCHED;
    }

    public static ServiceStylePrefetch prefetched(Optional<Style> style) {
      return new ServiceStylePrefetch(true, style);
    }
  }
}
