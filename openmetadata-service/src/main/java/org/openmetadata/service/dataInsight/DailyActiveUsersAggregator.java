package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.DailyActiveUsers;

public class DailyActiveUsersAggregator extends DataInsightAggregatorInterface<DailyActiveUsers> {

  public DailyActiveUsersAggregator(
      Aggregations aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType) {
    super(aggregations, dataInsightChartType);
  }

  @Override
  public DataInsightChartResult process() throws ParseException {
    List data = this.aggregate();
    DataInsightChartResult dataInsightChartResult = new DataInsightChartResult();
    return dataInsightChartResult.withData(data).withChartType(this.dataInsightChartType);
  }

  @Override
  List<DailyActiveUsers> aggregate() throws ParseException {
    Histogram timestampBuckets = this.aggregations.get(TIMESTAMP);
    List<DailyActiveUsers> data = new ArrayList<>();
    for (Histogram.Bucket timestampBucket : timestampBuckets.getBuckets()) {
      String dateTimeString = timestampBucket.getKeyAsString();
      Long timestamp = this.convertDatTimeStringToTimestamp(dateTimeString);
      long activeUsers = timestampBucket.getDocCount();

      data.add(new DailyActiveUsers().withTimestamp(timestamp).withActiveUsers((int) activeUsers));
    }

    return data;
  }
}
