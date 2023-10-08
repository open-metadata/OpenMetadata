package org.openmetadata.service.dataInsight;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.MostActiveUsers;

public abstract class MostActiveUsersAggregator<A, B, M, S, X> implements DataInsightAggregatorInterface {
  private final A aggregations;

  public MostActiveUsersAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() {
    M userNameBuckets = getUserNameBuckets(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B userNameBucket : getBuckets(userNameBuckets)) {
      String userName = getKeyAsString(userNameBucket);
      S sumSession = getSumAggregations(userNameBucket, "sessions");
      S sumPageViews = getSumAggregations(userNameBucket, "pageViews");
      S sumSessionDuration = getSumAggregations(userNameBucket, "sessionDuration");
      X lastSession = getMaxAggregations(userNameBucket, "lastSession");
      M teamBucket = getTeamBuckets(userNameBucket);
      String team = null;
      if (!getBuckets(teamBucket).isEmpty()) {
        // we'll assign the first team in the list if user belongs to multiple teams
        team = getKeyAsString(getBuckets(teamBucket).get(0));
      }
      data.add(
          new MostActiveUsers()
              .withUserName(userName)
              .withLastSession(getMaxValue(lastSession))
              .withPageViews(getSumValue(sumPageViews))
              .withSessionDuration(getSumValue(sumSessionDuration))
              .withSessions(getSumValue(sumSession))
              .withTeam(team)
              .withAvgSessionDuration(getSumValue(sumSessionDuration) / getSumValue(sumSession)));
    }

    return data;
  }

  protected abstract Double getSumValue(S key);

  protected abstract Long getMaxValue(X key);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract X getMaxAggregations(B bucket, String key);

  protected abstract List<? extends B> getBuckets(M buckets);

  protected abstract M getUserNameBuckets(A aggregations);

  protected abstract M getTeamBuckets(B bucket);
}
