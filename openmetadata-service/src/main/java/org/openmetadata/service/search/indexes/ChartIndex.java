package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.util.JsonUtils;

public class ChartIndex implements ElasticSearchIndex {

  final Chart chart;

  public ChartIndex(Chart chart) {
    this.chart = chart;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(chart);
    return doc;
  }
}
