package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;

public interface DataInsightAggregatorInterface {
  String ENTITY_TYPE = "entityType";
  String SERVICE_NAME = "serviceName";
  String COMPLETED_DESCRIPTION_FRACTION = "completedDescriptionFraction";
  String HAS_OWNER_FRACTION = "hasOwnerFraction";
  String ENTITY_COUNT = "entityCount";
  String TIMESTAMP = "timestamp";
  String ENTITY_TIER = "entityTier";

  default DataInsightChartResult process(DataInsightChartResult.DataInsightChartType chartType)
      throws ParseException {
    List<Object> data = this.aggregate();
    return new DataInsightChartResult().withData(data).withChartType(chartType);
  }

  List<Object> aggregate() throws ParseException;

  default Long convertDatTimeStringToTimestamp(String dateTimeString) throws ParseException {
    SimpleDateFormat dateTimeFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    return dateTimeFormat.parse(dateTimeString).getTime();
  }
}
