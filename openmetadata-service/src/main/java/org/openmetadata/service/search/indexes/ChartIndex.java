package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;

public record ChartIndex(Chart chart) implements TaggableIndex, LineageIndex {
  @Override
  public Object getEntity() {
    return chart;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.CHART;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    return esDoc;
  }
}
