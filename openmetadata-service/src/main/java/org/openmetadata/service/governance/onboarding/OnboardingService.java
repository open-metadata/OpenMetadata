package org.openmetadata.service.governance.onboarding;

import jakarta.json.Json;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.governance.TransitionOnboarding;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.governance.onboarding.OnboardingStageTiming;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IntakeFormRepository;

public final class OnboardingService {
  private OnboardingService() {}

  public static IntakeForm configured(String entityType) {
    return ((IntakeFormRepository) Entity.getEntityRepository(Entity.INTAKE_FORM))
        .findEnabledForEntityType(entityType);
  }

  public static EntityInterface entity(String type, UUID id) {
    // Worker threads outlive HTTP requests, so their request cache can contain an earlier stage.
    org.openmetadata.service.util.RequestEntityCache.clear();
    try (var ignored = org.openmetadata.service.util.FreshReadScope.enter()) {
      return Entity.getEntity(type, id, "*", Include.NON_DELETED, false);
    }
  }

  public static boolean eligible(EntityInterface entity) {
    return entity.getEntityStatus() == null
        || entity.getEntityStatus() == EntityStatus.DRAFT
        || entity.getEntityStatus() == EntityStatus.UNPROCESSED;
  }

  public static OnboardingInstance enroll(EntityInterface entity, String type) {
    OnboardingInstance existing = OnboardingStore.find(entity.getId());
    if (existing != null) return existing;
    IntakeForm form = configured(type);
    if (!OnboardingEvaluator.isEnabled(form) || !eligible(entity)) return null;
    var instance =
        new OnboardingInstance()
            .withId(UUID.randomUUID())
            .withEntity(entity.getEntityReference())
            .withConfiguration(JsonUtils.deepCopy(form, IntakeForm.class))
            .withStage(OnboardingStage.DRAFT)
            .withEnteredAt(System.currentTimeMillis())
            .withRevision(0L)
            .withCreator(creator(entity))
            .withCreationCompleted(creationComplete(form, entity));
    try {
      OnboardingStore.dao()
          .insert(
              instance.getId().toString(),
              entity.getId().toString(),
              type,
              form.getId().toString(),
              instance.getStage().value(),
              JsonUtils.pojoToJson(instance));
    } catch (RuntimeException exception) {
      existing = OnboardingStore.find(entity.getId());
      if (existing == null) throw exception;
      return existing;
    }
    return instance;
  }

  private static EntityReference creator(EntityInterface entity) {
    String name = entity.getUpdatedBy();
    try {
      name =
          Entity.getEntityRepository(entity.getEntityReference().getType())
              .getVersion(entity.getId(), "0.1")
              .getUpdatedBy();
    } catch (org.openmetadata.service.exception.EntityNotFoundException missingHistory) {
      // Imported assets may not retain their first version.
    }
    User user = Entity.findByNameOrNull(Entity.USER, name, Include.NON_DELETED);
    return user == null ? null : user.getEntityReference();
  }

  public static void validateWrite(EntityInterface entity, String type, boolean update) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type)) return;
    OnboardingInstance instance = OnboardingStore.find(entity.getId());
    IntakeForm form = instance == null ? configured(type) : instance.getConfiguration();
    if (!OnboardingEvaluator.isEnabled(form)) return;
    if (!update) entity.setEntityStatus(EntityStatus.DRAFT);
    if (instance == null && update && !eligible(entity)) return;
    OnboardingStage current = OnboardingEvaluator.stageFor(entity.getEntityStatus());
    for (OnboardingStage stage : OnboardingEvaluator.STAGES) {
      if (stage.ordinal() >= current.ordinal()) break;
      var failures =
          OnboardingEvaluator.evaluate(form, entity, stage).stream()
              .filter(
                  result ->
                      result.getRequired()
                          && result.getStep().getType() != OnboardingStep.Type.APPROVAL)
              .filter(
                  result ->
                      instance == null
                          || Boolean.TRUE.equals(instance.getCreationCompleted())
                          || stage != OnboardingStage.CREATION
                          || OnboardingConfigurationValidator.creationFields(type)
                              .contains(result.getStep().getFieldPath()))
              .filter(result -> !OnboardingEvaluator.isSatisfied(result))
              .toList();
      requireComplete(failures);
    }
  }

  public static void validateUpdate(
      EntityInterface original, EntityInterface updated, String type, boolean replace) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type)) return;
    // PUT preparation uses a temporary ID before the persisted asset and its pinned form are
    // loaded.
    updated.setId(original.getId());
    if (replace
        && updated.getEntityStatus() == EntityStatus.UNPROCESSED
        && OnboardingStore.find(original.getId()) != null) {
      updated.setEntityStatus(original.getEntityStatus());
    }
    validateWrite(updated, type, true);
    validateStatus(original, updated, type);
  }

  public static boolean preserveStatusDefault(EntityInterface entity, String type) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type)
        || (entity.getEntityStatus() != null
            && entity.getEntityStatus() != EntityStatus.UNPROCESSED)) return false;
    var original =
        Entity.getEntityRepository(type)
            .findByNameOrNull(entity.getFullyQualifiedName(), Include.NON_DELETED);
    if (original == null) return false;
    if (OnboardingStore.find(original.getId()) == null
        && (!OnboardingEvaluator.isEnabled(configured(type)) || !eligible(original))) return false;
    // Legacy glossary defaults infer Approved from reviewers before PUT has loaded its original.
    entity.setEntityStatus(
        original.getEntityStatus() == null || original.getEntityStatus() == EntityStatus.UNPROCESSED
            ? EntityStatus.DRAFT
            : original.getEntityStatus());
    return true;
  }

  public static void validateStatus(
      EntityInterface original, EntityInterface updated, String type) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type)
        || original.getEntityStatus() == updated.getEntityStatus()) return;
    OnboardingInstance instance = OnboardingStore.find(original.getId());
    if (instance == null) instance = enroll(original, type);
    if (instance == null) return;
    instance.setStage(OnboardingEvaluator.stageFor(original.getEntityStatus()));
    EntityStatus target = updated.getEntityStatus();
    if (target == EntityStatus.DRAFT
        && (original.getEntityStatus() == EntityStatus.REJECTED
            || original.getEntityStatus() == EntityStatus.UNPROCESSED)) return;
    if (target != OnboardingEvaluator.nextStatus(instance.getStage()))
      throw new IllegalArgumentException("Use the next onboarding gate");
    var progress = progress(instance, updated);
    if (Boolean.TRUE.equals(progress.getPaused()))
      throw new IllegalArgumentException("Onboarding is paused");
    requireComplete(
        progress.getSteps().stream()
            .filter(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result))
            .toList());
  }

  private static void requireComplete(List<OnboardingStepResult> failures) {
    if (!failures.isEmpty())
      throw new IllegalArgumentException(
          "Onboarding checks incomplete: "
              + String.join(
                  ", ",
                  failures.stream()
                      .map(
                          result ->
                              result.getStep().getTitle() != null
                                  ? result.getStep().getTitle()
                                  : result.getStep().getId())
                      .toList()));
  }

  public static OnboardingProgress get(String type, UUID id) {
    requireType(type);
    var instance = OnboardingStore.find(id);
    if (instance == null || !type.equals(instance.getEntity().getType()))
      throw new NotFoundException("Asset is not enrolled in onboarding");
    var asset = entity(type, id);
    instance.setStage(OnboardingEvaluator.stageFor(asset.getEntityStatus()));
    return progress(instance, asset);
  }

  public static OnboardingProgress progress(OnboardingInstance instance, EntityInterface entity) {
    List<OnboardingStepResult> results =
        new ArrayList<>(
            OnboardingEvaluator.evaluateThrough(
                instance.getConfiguration(), entity, instance.getStage()));
    for (var result : results) OnboardingTasks.hydrate(result, instance, entity);
    List<String> blockers =
        results.stream()
            .filter(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result))
            .map(result -> result.getStep().getId())
            .toList();
    boolean completed =
        entity.getEntityStatus() == EntityStatus.APPROVED
            || entity.getEntityStatus() == EntityStatus.DEPRECATED;
    boolean paused =
        !completed && !OnboardingEvaluator.isEnabled(configured(instance.getEntity().getType()));
    return new OnboardingProgress()
        .withEntity(entity.getEntityReference())
        .withEntityVersion(entity.getVersion())
        .withConfigurationId(instance.getConfiguration().getId())
        .withConfigurationVersion(instance.getConfiguration().getVersion())
        .withDomains(boardDomains(entity))
        .withStage(instance.getStage())
        .withEnteredAt(instance.getEnteredAt())
        .withSteps(results)
        .withBlockingSteps(blockers)
        .withNextStatus(OnboardingEvaluator.nextStatus(instance.getStage()))
        .withPaused(paused)
        .withCanAdvance(
            blockers.isEmpty() && !paused && entity.getEntityStatus() != EntityStatus.DEPRECATED)
        .withCompleted(completed);
  }

  public static OnboardingProgress transition(
      String type, UUID id, TransitionOnboarding request, String user) {
    requireType(type);
    EntityInterface entity = entity(type, id);
    if (!Objects.equals(request.getExpectedVersion(), entity.getVersion()))
      throw new WebApplicationException("Asset changed; refresh before advancing", 409);
    OnboardingInstance instance = enroll(entity, type);
    if (instance == null) throw new NotFoundException("Asset is not enrolled in onboarding");
    synchronize(entity, type, Boolean.TRUE.equals(request.getRetry()));
    instance = OnboardingStore.find(id);
    var progress = progress(instance, entity);
    if (request.getTargetStatus() != progress.getNextStatus())
      throw new IllegalArgumentException("Use the next onboarding gate");
    if (!Boolean.TRUE.equals(progress.getCanAdvance())) return progress;
    patchStatus(type, id, entity.getVersion(), request.getTargetStatus(), user);
    synchronize(entity(type, id), type, false);
    return get(type, id);
  }

  private static List<EntityReference> boardDomains(EntityInterface entity) {
    if (Entity.DOMAIN.equals(entity.getEntityReference().getType()))
      return List.of(entity.getEntityReference());
    return entity.getDomains() == null ? List.of() : entity.getDomains();
  }

  public static void patchStatus(
      String type, UUID id, Double version, EntityStatus status, String user) {
    var patch =
        Json.createPatchBuilder()
            .test("/version", Json.createValue(version))
            .add("/entityStatus", status.value())
            .build();
    Entity.getEntityRepository(type).patch(null, id, user, patch);
  }

  public static void synchronize(EntityInterface entity, String type, boolean retry) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type)) return;
    OnboardingInstance instance = enroll(entity, type);
    if (instance == null) return;
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              var locked =
                  OnboardingStore.read(dao.onboardingDAO().lock(entity.getId().toString()));
              EntityInterface current = entity(type, entity.getId());
              OnboardingStage stage = OnboardingEvaluator.stageFor(current.getEntityStatus());
              if (stage != locked.getStage()) {
                locked
                    .getStageHistory()
                    .add(
                        new OnboardingStageTiming()
                            .withStage(locked.getStage())
                            .withEnteredAt(locked.getEnteredAt())
                            .withExitedAt(System.currentTimeMillis()));
                locked.setStage(stage);
                locked.setEnteredAt(System.currentTimeMillis());
              }
              locked.setEntity(current.getEntityReference());
              if (creationComplete(locked.getConfiguration(), current))
                locked.setCreationCompleted(true);
              if (OnboardingEvaluator.isEnabled(configured(type)))
                OnboardingTasks.reserve(locked, current, retry);
              locked.setSteps(progress(locked, current).getSteps());
              OnboardingStore.save(locked);
            });
    if (OnboardingEvaluator.isEnabled(configured(type)))
      OnboardingTasks.startPending(
          OnboardingStore.find(entity.getId()), entity(type, entity.getId()));
  }

  public static void requireType(String type) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type))
      throw new IllegalArgumentException("Unsupported onboarding entity type");
  }

  private static boolean creationComplete(IntakeForm form, EntityInterface entity) {
    return OnboardingEvaluator.evaluate(form, entity, OnboardingStage.CREATION).stream()
        .noneMatch(step -> step.getRequired() && !OnboardingEvaluator.isSatisfied(step));
  }
}
