package org.openmetadata.service.search.opensearch;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.elasticsearch.search.aggregations.metrics.Sum;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.AggregatedUnusedAssets;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.opensearch.search.aggregations.Aggregations;

public class OsAggregatedUnusedAssetsAggregator extends DataInsightAggregatorInterface {
  public OsAggregatedUnusedAssetsAggregator(
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
      Sum threeDays = timestampBucket.getAggregations().get("threeDays");
      Sum sevenDays = timestampBucket.getAggregations().get("sevenDays");
      Sum fourteenDays = timestampBucket.getAggregations().get("fourteenDays");
      Sum thirtyDays = timestampBucket.getAggregations().get("thirtyDays");
      Sum sixtyDays = timestampBucket.getAggregations().get("sixtyDays");

      data.add(
          new AggregatedUnusedAssets()
              .withTimestamp(timestamp)
              .withThreeDays(threeDays.getValue())
              .withSevenDays(sevenDays.getValue())
              .withFourteenDays(fourteenDays.getValue())
              .withThirtyDays(thirtyDays.getValue())
              .withSixtyDays(sixtyDays.getValue()));
    }
    return data;
  }
}
