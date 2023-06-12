package org.openmetadata.service.search.elasticSearch;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.DailyActiveUsers;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;

public class EsDailyActiveUsersAggregator extends DataInsightAggregatorInterface {

  public EsDailyActiveUsersAggregator(
      Aggregations aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType) {
    super(aggregations, dataInsightChartType);
  }

  @Override
  public DataInsightChartResult process() throws ParseException {
    List<Object> data = this.aggregate();
    return new DataInsightChartResult().withData(data).withChartType(this.dataInsightChartType);
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    Histogram timestampBuckets = this.aggregationsEs.get(TIMESTAMP);
    List<Object> data = new ArrayList<>();
    for (Histogram.Bucket timestampBucket : timestampBuckets.getBuckets()) {
      String dateTimeString = timestampBucket.getKeyAsString();
      Long timestamp = this.convertDatTimeStringToTimestamp(dateTimeString);
      long activeUsers = timestampBucket.getDocCount();

      data.add(new DailyActiveUsers().withTimestamp(timestamp).withActiveUsers((int) activeUsers));
    }

    return data;
  }
}
