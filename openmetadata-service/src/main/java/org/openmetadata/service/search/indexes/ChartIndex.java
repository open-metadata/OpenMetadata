package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;

public record ChartIndex(Chart chart) implements SearchIndex {
  @Override
  public Object getEntity() {
    return chart;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(chart, Entity.CHART);
    esDoc.putAll(commonAttributes);
    return esDoc;
  }
}
