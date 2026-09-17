package org.openmetadata.service.governance.onboarding;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.onboarding.OnboardingBoard;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.FreshReadScope;

public final class OnboardingBoardService {
  private static final int BATCH_SIZE = 100;
  private static final int MAX_SCANNED_ROWS = 1000;

  private OnboardingBoardService() {}

  public record Filter(String entityType, String stage, UUID domain, UUID assignee) {}

  public static OnboardingBoard list(
      Filter filter, String after, int limit, Predicate<EntityInterface> canView) {
    if (filter.entityType() != null) OnboardingService.requireType(filter.entityType());
    if (limit < 1 || limit > BATCH_SIZE)
      throw new IllegalArgumentException("Board limit must be between 1 and 100");
    try (var ignored = FreshReadScope.enter()) {
      return listFresh(filter, after, limit, canView);
    }
  }

  private static OnboardingBoard listFresh(
      Filter filter, String after, int limit, Predicate<EntityInterface> canView) {
    List<OnboardingProgress> results = new ArrayList<>();
    var reads = new OnboardingBoardContext();
    String cursor = after == null ? "" : after;
    String lastResult = null;
    int scanned = 0;
    // Live domains include inheritance; assignments depend on current metadata and workflow state.
    // Bound the whole request, including lookahead and candidates the caller cannot view.
    while (scanned < MAX_SCANNED_ROWS) {
      int batchSize = Math.min(BATCH_SIZE, MAX_SCANNED_ROWS - scanned);
      var page =
          OnboardingStore.dao()
              .list(filter.entityType(), filter.stage(), cursor, batchSize)
              .stream()
              .map(OnboardingStore::read)
              .toList();
      if (page.isEmpty()) {
        return new OnboardingBoard().withData(results);
      }
      scanned += page.size();
      var assets = assets(page);
      var visible =
          page.stream()
              .filter(
                  instance -> {
                    var asset = assets.get(instance.getEntity().getId());
                    if (asset == null || !matchesDomain(asset, filter.domain())) {
                      return false;
                    }
                    try {
                      return canView.test(asset);
                    } catch (EntityNotFoundException deletedAsset) {
                      return false;
                    }
                  })
              .toList();
      reads.preload(
          visible,
          visible.stream().map(instance -> assets.get(instance.getEntity().getId())).toList());
      for (var instance : visible) {
        var asset = assets.get(instance.getEntity().getId());
        instance.setStage(OnboardingEvaluator.stageFor(asset.getEntityStatus()));
        var progress = OnboardingService.progress(instance, asset, reads);
        if (!matchesAssignee(progress, filter.assignee())) {
          continue;
        }
        // Preserve the next match when lookahead fills the page within the scan budget.
        if (results.size() == limit) {
          return new OnboardingBoard().withData(results).withAfter(lastResult);
        }
        results.add(progress);
        lastResult = instance.getId().toString();
      }
      cursor = page.getLast().getId().toString();
      if (page.size() < batchSize) {
        return new OnboardingBoard().withData(results);
      }
    }
    return new OnboardingBoard().withData(results).withAfter(cursor).withScanLimitReached(true);
  }

  private static Map<UUID, EntityInterface> assets(List<OnboardingInstance> instances) {
    var grouped =
        instances.stream()
            .map(OnboardingInstance::getEntity)
            .collect(Collectors.groupingBy(EntityReference::getType));
    return grouped.values().stream()
        .flatMap(
            refs -> Entity.<EntityInterface>getEntities(refs, "*", Include.NON_DELETED).stream())
        .collect(Collectors.toMap(EntityInterface::getId, asset -> asset));
  }

  private static boolean matchesDomain(EntityInterface asset, UUID domainId) {
    return domainId == null
        || OnboardingService.boardDomains(asset).stream()
            .anyMatch(domain -> domainId.equals(domain.getId()));
  }

  private static boolean matchesAssignee(OnboardingProgress progress, UUID assigneeId) {
    return assigneeId == null
        || progress.getSteps().stream()
            .filter(step -> !OnboardingEvaluator.isSatisfied(step))
            .flatMap(step -> step.getAssignees().stream())
            .anyMatch(assignee -> assigneeId.equals(assignee.getId()));
  }
}
