package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public record StoredProcedureIndex(StoredProcedure storedProcedure) implements SearchIndex {

  @Override
  public Object getEntity() {
    return storedProcedure;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(storedProcedure, Entity.STORED_PROCEDURE);
    doc.putAll(commonAttributes);
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.STORED_PROCEDURE, storedProcedure));
    doc.put("tags", parseTags.getTags());
    doc.put("upstreamLineage", SearchIndex.getLineageData(storedProcedure.getEntityReference()));
    doc.put("tier", parseTags.getTierTag());
    doc.put("service", getEntityWithDisplayName(storedProcedure.getService()));
    doc.put("processedLineage", storedProcedure.getProcessedLineage());
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
