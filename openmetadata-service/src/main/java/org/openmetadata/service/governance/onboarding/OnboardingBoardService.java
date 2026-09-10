package org.openmetadata.service.governance.onboarding;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.governance.onboarding.OnboardingBoard;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;

public final class OnboardingBoardService {
  private OnboardingBoardService() {}

  public record Filter(String entityType, String stage, UUID domain, UUID assignee) {}

  public static OnboardingBoard list(
      Filter filter, String after, int limit, Predicate<EntityReference> canView) {
    if (filter.entityType() != null) OnboardingService.requireType(filter.entityType());
    List<OnboardingProgress> results = new ArrayList<>();
    String cursor = after == null ? "" : after;
    for (int scanned = 0; scanned < 1000 && results.size() < limit; ) {
      var page =
          OnboardingStore.dao()
              .list(
                  filter.entityType(),
                  filter.stage(),
                  cursor,
                  Math.min(100, limit - results.size()));
      if (page.isEmpty()) return new OnboardingBoard().withData(results);
      for (String json : page) {
        var instance = OnboardingStore.read(json);
        cursor = instance.getId().toString();
        scanned++;
        try {
          if (!canView.test(instance.getEntity())) continue;
          var progress =
              OnboardingService.get(instance.getEntity().getType(), instance.getEntity().getId());
          if (matches(progress, filter)) results.add(progress);
        } catch (EntityNotFoundException deletedAsset) {
          // Deleted assets are excluded while the lifecycle handler closes their outstanding work.
        }
      }
    }
    return new OnboardingBoard().withData(results).withAfter(cursor);
  }

  private static boolean matches(OnboardingProgress progress, Filter filter) {
    boolean domainMatches =
        filter.domain() == null
            || progress.getDomains().stream()
                .anyMatch(domain -> filter.domain().equals(domain.getId()));
    boolean assigneeMatches =
        filter.assignee() == null
            || progress.getSteps().stream()
                .filter(step -> !OnboardingEvaluator.isSatisfied(step))
                .flatMap(step -> step.getAssignees().stream())
                .anyMatch(assignee -> filter.assignee().equals(assignee.getId()));
    return domainMatches && assigneeMatches;
  }
}
