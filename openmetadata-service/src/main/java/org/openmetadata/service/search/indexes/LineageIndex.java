package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.EntityInterface;

/**
 * Mixin interface for search indexes of entities that have upstream lineage. Centralizes the
 * lineage field population that was previously duplicated across 25+ index classes.
 */
public interface LineageIndex extends SearchIndex {

  /** Applies lineage-related fields to the search index document. Sets: upstreamLineage. */
  default void applyLineageFields(Map<String, Object> doc) {
    Object entity = getEntity();
    if (entity instanceof EntityInterface ei) {
      doc.put("upstreamLineage", SearchIndex.getLineageData(ei.getEntityReference()));
    }
  }
}
