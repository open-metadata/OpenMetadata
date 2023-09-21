package org.openmetadata.service.search.opensearch;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.PageViewsByEntities;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.opensearch.search.aggregations.Aggregations;
import org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.opensearch.search.aggregations.bucket.histogram.Histogram;
import org.opensearch.search.aggregations.metrics.Sum;

public class OsPageViewsByEntitiesAggregator extends DataInsightAggregatorInterface {
  public OsPageViewsByEntitiesAggregator(
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
    Histogram timestampBuckets = this.aggregationsOs.get(TIMESTAMP);
    List<Object> data = new ArrayList<>();
    for (Histogram.Bucket timestampBucket : timestampBuckets.getBuckets()) {
      String dateTimeString = timestampBucket.getKeyAsString();
      Long timestamp = this.convertDatTimeStringToTimestamp(dateTimeString);
      MultiBucketsAggregation entityTypeBuckets = timestampBucket.getAggregations().get(ENTITY_TYPE);
      for (MultiBucketsAggregation.Bucket entityTypeBucket : entityTypeBuckets.getBuckets()) {
        String entityType = entityTypeBucket.getKeyAsString();
        Sum sumPageViews = entityTypeBucket.getAggregations().get("pageViews");

        data.add(
            new PageViewsByEntities()
                .withEntityType(entityType)
                .withTimestamp(timestamp)
                .withPageViews(sumPageViews.getValue()));
      }
    }
    return data;
  }
}
