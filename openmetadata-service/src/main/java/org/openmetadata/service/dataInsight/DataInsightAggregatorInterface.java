package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;

public interface DataInsightAggregatorInterface {
  String TIMESTAMP = "timestamp";

  default DataInsightChartResult process(DataInsightChartResult.DataInsightChartType chartType)
      throws ParseException {
    List<Object> data = this.aggregate();
    return new DataInsightChartResult().withData(data).withChartType(chartType);
  }

  List<Object> aggregate() throws ParseException;
}
