package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;

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
   */
  default void applyLineageFields(Map<String, Object> doc, DocBuildContext ctx) {
    Object entity = getEntity();
    if (entity instanceof EntityInterface ei) {
      List<EsLineageData> prefetched = ctx.prefetchedUpstreamLineage();
      if (prefetched != null) {
        doc.put("upstreamLineage", prefetched);
      } else {
        doc.put("upstreamLineage", SearchIndex.getLineageData(ei.getEntityReference()));
      }
    }
  }
}
