package org.openmetadata.service.search.elasticSearch;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.elasticsearch.search.aggregations.metrics.Sum;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.PercentageOfServicesWithOwner;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;

public class EsServicesOwnerAggregator extends DataInsightAggregatorInterface {
  protected EsServicesOwnerAggregator(
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
      MultiBucketsAggregation servicesBuckets = timestampBucket.getAggregations().get(SERVICE_NAME);
      for (MultiBucketsAggregation.Bucket serviceBucket : servicesBuckets.getBuckets()) {
        String serviceName = serviceBucket.getKeyAsString();
        Sum sumHasOwner = serviceBucket.getAggregations().get(HAS_OWNER_FRACTION);
        Sum sumEntityCount = serviceBucket.getAggregations().get(ENTITY_COUNT);
        data.add(
            new PercentageOfServicesWithOwner()
                .withTimestamp(timestamp)
                .withServiceName(serviceName)
                .withEntityCount(sumEntityCount.getValue())
                .withHasOwner(sumHasOwner.getValue())
                .withHasOwnerFraction(sumHasOwner.getValue() / sumEntityCount.getValue()));
      }
    }

    return data;
  }
}
