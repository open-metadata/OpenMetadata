package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.elasticsearch.search.aggregations.metrics.Sum;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.datatInsight.type.MostViewedEntities;

public class MostViewedEntitiesAggregator extends DataInsightAggregatorInterface<MostViewedEntities> {

  public MostViewedEntitiesAggregator(
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
  List<MostViewedEntities> aggregate() throws ParseException {
    MultiBucketsAggregation entityFqnBuckets = this.aggregations.get("entityFqn");
    List<MostViewedEntities> data = new ArrayList();
    for (MultiBucketsAggregation.Bucket entityFqnBucket : entityFqnBuckets.getBuckets()) {
      String tableFqn = entityFqnBucket.getKeyAsString();
      Sum sumPageViews = entityFqnBucket.getAggregations().get("pageViews");
      MultiBucketsAggregation ownerBucket = entityFqnBucket.getAggregations().get("owner");
      String owner = null;
      if (!ownerBucket.getBuckets().isEmpty()) {
        owner = ownerBucket.getBuckets().get(0).getKeyAsString();
      }

      data.add(
          new MostViewedEntities().withEntityFqn(tableFqn).withOwner(owner).withPageViews(sumPageViews.getValue()));
    }
    return data;
  }
}
