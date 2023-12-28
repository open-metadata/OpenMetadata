package org.openmetadata.service.dataInsight;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.dataInsight.type.MostActiveUsers;

public abstract class MostActiveUsersAggregator<A, B, M, S, X>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  protected MostActiveUsersAggregator(A aggregations) {
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
      Optional<Long> lastSessionOptional = getMaxValue(lastSession);
      Optional<Double> sumPageViewsOptional = getSumValue(sumPageViews);
      Optional<Double> sumSessionDurationOptional = getSumValue(sumSessionDuration);
      Optional<Double> sumSessionOptional = getSumValue(sumSession);
      Double avgSessionDuration =
          sumSessionDurationOptional
              .flatMap(s -> sumSessionOptional.map(ss -> s / ss))
              .orElse(null);

      data.add(
          new MostActiveUsers()
              .withUserName(userName)
              .withLastSession(lastSessionOptional.orElse(null))
              .withPageViews(sumPageViewsOptional.orElse(null))
              .withSessionDuration(sumSessionDurationOptional.orElse(null))
              .withSessions(sumSessionOptional.orElse(null))
              .withTeam(team)
              .withAvgSessionDuration(avgSessionDuration));
    }

    return data;
  }

  protected abstract Optional<Double> getSumValue(S key);

  protected abstract Optional<Long> getMaxValue(X key);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract X getMaxAggregations(B bucket, String key);

  protected abstract List<? extends B> getBuckets(M buckets);

  protected abstract M getUserNameBuckets(A aggregations);

  protected abstract M getTeamBuckets(B bucket);
}
