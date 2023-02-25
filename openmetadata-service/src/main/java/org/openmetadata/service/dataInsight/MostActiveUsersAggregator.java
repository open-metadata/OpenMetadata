package org.openmetadata.service.dataInsight;

import java.util.ArrayList;
import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.elasticsearch.search.aggregations.metrics.Max;
import org.elasticsearch.search.aggregations.metrics.Sum;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.MostActiveUsers;

public class MostActiveUsersAggregator extends DataInsightAggregatorInterface {

  public MostActiveUsersAggregator(
      Aggregations aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType) {
    super(aggregations, dataInsightChartType);
  }

  @Override
  public DataInsightChartResult process() {
    List<Object> data = this.aggregate();
    return new DataInsightChartResult().withData(data).withChartType(this.dataInsightChartType);
  }

  @Override
  List<Object> aggregate() {
    MultiBucketsAggregation userNameBuckets = this.aggregations.get("userName");
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
