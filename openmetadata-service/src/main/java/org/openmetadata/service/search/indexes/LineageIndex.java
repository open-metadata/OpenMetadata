package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchIndexUtils;

/**
 * Mixin interface for search indexes of entities that have upstream lineage. Centralizes the
 * lineage field population that was previously duplicated across 25+ index classes.
 */
public interface LineageIndex extends SearchIndex {

  /**
   * Convenience overload used by callers that do not have pre-fetched lineage (live CRUD,
   * single-entity update). Delegates to {@link #applyLineageFields(Map, DocBuildContext)} with an
   * empty context, which falls back to the per-entity DB lookup.
   */
  default void applyLineageFields(Map<String, Object> doc) {
    applyLineageFields(doc, DocBuildContext.empty());
  }

  /**
   * Applies upstream lineage to {@code doc}. When {@link DocBuildContext#prefetchedUpstreamLineage()}
   * is non-null the prefetched edges are used directly; otherwise the legacy per-entity DB lookup
   * via {@link SearchIndex#getLineageData(org.openmetadata.schema.type.EntityReference)} runs.
   *
   * <p>Edge SQL is deduplicated into {@code lineageSqlQueries} exactly as the live
   * {@code ADD_UPDATE_LINEAGE} script does. Without this the two paths disagreed on every
   * lineage-bearing document: live stored each distinct query once and pointed edges at it via
   * {@code sqlQueryKey}, while a rebuild inlined the full text on every edge — so each reindex
   * silently reverted the deduplication and could push a document past the payload cap, at which
   * point {@code SearchIndexUtils.stripLineageForSize} drops {@code upstreamLineage} entirely.
   */
  default void applyLineageFields(Map<String, Object> doc, DocBuildContext ctx) {
    Object entity = getEntity();
    if (entity instanceof EntityInterface ei) {
      List<EsLineageData> prefetched = ctx.prefetchedUpstreamLineage();
      // deduplicateSqlAcrossEdges rewrites each edge in place. The prefetched list belongs to the
      // batch context, so it is copied first — mutating it would leave a second build of the same
      // entity with sqlQueryKey set but no map to resolve it against. The fallback lookup already
      // returns a fresh list, and copying it on every entity of a bulk reindex would be pure cost.
      List<EsLineageData> edges =
          prefetched != null
              ? JsonUtils.deepCopyList(prefetched, EsLineageData.class)
              : SearchIndex.getLineageData(ei.getEntityReference());
      Map<String, String> sqlQueries = SearchIndexUtils.deduplicateSqlAcrossEdges(edges);
      doc.put("upstreamLineage", edges);
      if (!sqlQueries.isEmpty()) {
        doc.put("lineageSqlQueries", sqlQueries);
      }
    }
  }
}
