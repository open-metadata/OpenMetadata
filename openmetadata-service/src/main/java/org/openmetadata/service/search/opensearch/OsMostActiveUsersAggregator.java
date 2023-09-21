package org.openmetadata.service.search.opensearch;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.MostActiveUsers;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.opensearch.search.aggregations.Aggregations;
import org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.opensearch.search.aggregations.metrics.Max;
import org.opensearch.search.aggregations.metrics.Sum;

public class OsMostActiveUsersAggregator extends DataInsightAggregatorInterface {

  public OsMostActiveUsersAggregator(
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
    MultiBucketsAggregation userNameBuckets = this.aggregationsOs.get("userName");
    List<Object> data = new ArrayList<>();
    for (MultiBucketsAggregation.Bucket userNameBucket : userNameBuckets.getBuckets()) {
      String userName = userNameBucket.getKeyAsString();
      Sum sumSession = userNameBucket.getAggregations().get("sessions");
      Sum sumPageViews = userNameBucket.getAggregations().get("pageViews");
      Sum sumSessionDuration = userNameBucket.getAggregations().get("sessionDuration");
      Max lastSession = userNameBucket.getAggregations().get("lastSession");
      MultiBucketsAggregation teamBucket = userNameBucket.getAggregations().get("team");

      String team = null;
      if (!teamBucket.getBuckets().isEmpty()) {
        team = teamBucket.getBuckets().get(0).getKeyAsString();
      }

      data.add(
          new MostActiveUsers()
              .withUserName(userName)
              .withLastSession((long) lastSession.getValue())
              .withPageViews(sumPageViews.getValue())
              .withSessionDuration(sumSessionDuration.getValue())
              .withSessions(sumSession.getValue())
              .withTeam(team)
              .withAvgSessionDuration(sumSessionDuration.getValue() / sumSession.getValue()));
    }

    return data;
  }
}
