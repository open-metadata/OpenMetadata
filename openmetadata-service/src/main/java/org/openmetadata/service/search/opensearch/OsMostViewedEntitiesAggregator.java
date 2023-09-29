package org.openmetadata.service.search.opensearch;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.MostViewedEntities;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.opensearch.search.aggregations.Aggregations;
import org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.opensearch.search.aggregations.metrics.Sum;

public class OsMostViewedEntitiesAggregator extends DataInsightAggregatorInterface {

  public OsMostViewedEntitiesAggregator(
      Aggregations aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType) {
    super(aggregations, dataInsightChartType);
  }

  @Override
  public DataInsightChartResult process() {
    List<Object> data = this.aggregate();
    return new DataInsightChartResult().withData(data).withChartType(this.dataInsightChartType);
  }

  @Override
  public List<Object> aggregate() {
    MultiBucketsAggregation entityFqnBuckets = this.aggregationsOs.get("entityFqn");
    List<Object> data = new ArrayList<>();
    for (MultiBucketsAggregation.Bucket entityFqnBucket : entityFqnBuckets.getBuckets()) {
      String tableFqn = entityFqnBucket.getKeyAsString();
      Sum sumPageViews = entityFqnBucket.getAggregations().get("pageViews");
      MultiBucketsAggregation ownerBucket = entityFqnBucket.getAggregations().get("owner");
      MultiBucketsAggregation entityTypeBucket = entityFqnBucket.getAggregations().get("entityType");
      MultiBucketsAggregation entityHrefBucket = entityFqnBucket.getAggregations().get("entityHref");
      String owner = null;
      String entityType = null;
      String entityHref = null;
      if (!ownerBucket.getBuckets().isEmpty()) {
        owner = ownerBucket.getBuckets().get(0).getKeyAsString();
      }

      if (!entityTypeBucket.getBuckets().isEmpty()) {
        entityType = entityTypeBucket.getBuckets().get(0).getKeyAsString();
      }

      if (!entityHrefBucket.getBuckets().isEmpty()) {
        entityHref = entityHrefBucket.getBuckets().get(0).getKeyAsString();
      }

      data.add(
          new MostViewedEntities()
              .withEntityFqn(tableFqn)
              .withOwner(owner)
              .withEntityType(entityType)
              .withEntityHref(entityHref)
              .withPageViews(sumPageViews.getValue()));
    }
    return data;
  }
}
