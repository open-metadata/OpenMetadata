package org.openmetadata.service.governance.onboarding;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingStageDefinition;
import org.openmetadata.schema.type.EntityStatus;

/**
 * The lifecycle a playbook declares. Stages are playbook-defined, so this resolves the ordered stage
 * list for a configuration and falls back to the default lifecycle when one declares none.
 *
 * <p>Onboarding never moves an asset between stages. A stage's {@code entityStatus} is the status the
 * gate's handoff workflow is expected to set, which is what lets the playbook read the asset's
 * current stage back off the asset itself.
 */
public final class OnboardingLifecycle {
  public static final String CREATION = "creation";
  public static final String DRAFT = "draft";
  public static final String IN_REVIEW = "inReview";
  public static final String APPROVED = "approved";
  public static final String PUBLISHED = "published";
  public static final String DEPRECATED = "deprecated";

  /**
   * Published carries no {@link EntityStatus} because the platform has none - a playbook that
   * declares it tracks it as a stage, and its handoff workflow decides what status to leave behind.
   */
  private static final List<OnboardingStageDefinition> DEFAULT_STAGES =
      List.of(
          stage(CREATION, "Creation", 0, null, true, false),
          stage(DRAFT, "Draft", 1, EntityStatus.DRAFT, false, false),
          stage(IN_REVIEW, "In Review", 2, EntityStatus.IN_REVIEW, false, false),
          stage(APPROVED, "Approved", 3, EntityStatus.APPROVED, false, false),
          stage(PUBLISHED, "Published", 4, null, false, false),
          stage(DEPRECATED, "Deprecated", 5, EntityStatus.DEPRECATED, false, true));

  private OnboardingLifecycle() {}

  private static OnboardingStageDefinition stage(
      String key,
      String displayName,
      int order,
      EntityStatus status,
      boolean entry,
      boolean terminal) {
    return new OnboardingStageDefinition()
        .withKey(key)
        .withDisplayName(displayName)
        .withOrder(order)
        .withEntityStatus(status)
        .withEntryStage(entry)
        .withTerminal(terminal);
  }

  public static List<OnboardingStageDefinition> defaultStages() {
    return DEFAULT_STAGES;
  }

  /** Ordered stages for a configuration, or the default lifecycle when it declares none. */
  public static List<OnboardingStageDefinition> stages(OnboardingConfiguration configuration) {
    if (configuration == null
        || configuration.getStages() == null
        || configuration.getStages().isEmpty()) {
      return DEFAULT_STAGES;
    }
    return configuration.getStages().stream()
        .sorted(Comparator.comparingInt(OnboardingStageDefinition::getOrder))
        .toList();
  }

  public static List<String> stageKeys(OnboardingConfiguration configuration) {
    return stages(configuration).stream().map(OnboardingStageDefinition::getKey).toList();
  }

  public static Optional<OnboardingStageDefinition> stage(
      OnboardingConfiguration configuration, String key) {
    return stages(configuration).stream().filter(s -> s.getKey().equals(key)).findFirst();
  }

  /** Position of a stage in the lifecycle, or -1 when the playbook does not declare it. */
  public static int indexOf(OnboardingConfiguration configuration, String key) {
    List<String> keys = stageKeys(configuration);
    return key == null ? -1 : keys.indexOf(key);
  }

  public static boolean isCreation(OnboardingConfiguration configuration, String key) {
    return stage(configuration, key)
        .map(s -> Boolean.TRUE.equals(s.getEntryStage()))
        .orElse(CREATION.equals(key));
  }

  /** Stage the asset is in, read from the status its handoff workflow last set. */
  public static String stageFor(OnboardingConfiguration configuration, EntityStatus status) {
    if (status != null && status != EntityStatus.UNPROCESSED) {
      Optional<String> match =
          stages(configuration).stream()
              .filter(s -> status.equals(entityStatus(s)))
              .map(OnboardingStageDefinition::getKey)
              .findFirst();
      if (match.isPresent()) {
        return match.get();
      }
    }
    return firstAfterCreation(configuration);
  }

  /**
   * The status a stage maps to. {@code status.json} defaults every generated {@code EntityStatus}
   * field to {@code Unprocessed}, so a stage declared without a status deserialises as Unprocessed
   * rather than null - and no asset ever carries Unprocessed while onboarding. Treat it as "not set"
   * and fall back to the default lifecycle's status for the same key, so a playbook that declares the
   * standard stages by key alone still maps statuses back to stages.
   */
  public static EntityStatus entityStatus(OnboardingStageDefinition stage) {
    if (stage.getEntityStatus() != null && stage.getEntityStatus() != EntityStatus.UNPROCESSED) {
      return stage.getEntityStatus();
    }
    return DEFAULT_STAGES.stream()
        .filter(s -> s.getKey().equals(stage.getKey()))
        .map(OnboardingStageDefinition::getEntityStatus)
        .filter(s -> s != null && s != EntityStatus.UNPROCESSED)
        .findFirst()
        .orElse(null);
  }

  /**
   * Where an asset sits once it exists but before any gate has been passed - the stage directly after
   * the entry stage.
   */
  public static String firstAfterCreation(OnboardingConfiguration configuration) {
    List<OnboardingStageDefinition> stages = stages(configuration);
    for (OnboardingStageDefinition stage : stages) {
      if (!Boolean.TRUE.equals(stage.getEntryStage())) {
        return stage.getKey();
      }
    }
    return stages.isEmpty() ? DRAFT : stages.getFirst().getKey();
  }

  /** The stage that follows {@code key}, or null when {@code key} is terminal. */
  public static String next(OnboardingConfiguration configuration, String key) {
    List<String> keys = stageKeys(configuration);
    int i = keys.indexOf(key);
    return i < 0 || i + 1 >= keys.size() ? null : keys.get(i + 1);
  }
}
