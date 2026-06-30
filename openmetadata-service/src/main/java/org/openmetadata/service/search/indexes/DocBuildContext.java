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
 * The context is passed by value down the doc-build call chain; nothing is stored in thread-local
 * state, so callers and mixins see the dependency in their method signatures.
 */
public record DocBuildContext(
    List<EsLineageData> prefetchedUpstreamLineage, Optional<Style> prefetchedServiceStyle) {

  private static final DocBuildContext EMPTY = new DocBuildContext(null, null);

  public static DocBuildContext empty() {
    return EMPTY;
  }

  public static DocBuildContext withUpstreamLineage(List<EsLineageData> upstreamLineage) {
    return new DocBuildContext(upstreamLineage, null);
  }

  public static DocBuildContext of(
      List<EsLineageData> upstreamLineage, Optional<Style> serviceStyle) {
    return new DocBuildContext(upstreamLineage, serviceStyle);
  }
}
