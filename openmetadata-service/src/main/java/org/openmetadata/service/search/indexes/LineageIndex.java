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

  /** Applies lineage-related fields to the search index document. Sets: upstreamLineage. */
  default void applyLineageFields(Map<String, Object> doc) {
    Object entity = getEntity();
    if (entity instanceof EntityInterface ei) {
      List<EsLineageData> prefetched = LineagePrefetchContext.getUpstream();
      if (prefetched != null) {
        doc.put("upstreamLineage", prefetched);
      } else {
        doc.put("upstreamLineage", SearchIndex.getLineageData(ei.getEntityReference()));
      }
    }
  }
}
