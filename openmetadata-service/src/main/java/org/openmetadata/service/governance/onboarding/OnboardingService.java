package org.openmetadata.service.governance.onboarding;

import jakarta.json.Json;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.governance.TransitionOnboarding;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.governance.onboarding.OnboardingReminder;
import org.openmetadata.schema.governance.onboarding.OnboardingReminderKind;
import org.openmetadata.schema.governance.onboarding.OnboardingStageTiming;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OnboardingPlaybookRepository;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

public final class OnboardingService {
  /** An asset that left a gate its author chose not to make a hard stop, with work still open. */
  private record SoftGateExit(
      OnboardingInstance instance, EntityInterface asset, String stage, List<String> open) {}

  private OnboardingService() {}

  public static OnboardingPlaybook configured(String entityType) {
    return ((OnboardingPlaybookRepository) Entity.getEntityRepository(Entity.ONBOARDING_PLAYBOOK))
        .findEnabledForEntityType(entityType);
  }

  public static EntityInterface entity(String type, UUID id) {
    // Worker threads outlive HTTP requests, so their request cache can contain an earlier stage.
    RequestEntityCache.clear();
    try (var ignored = FreshReadScope.enter()) {
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
    OnboardingPlaybook playbook = configured(type);
    if (!OnboardingEvaluator.isEnabled(playbook) || !eligible(entity)) return null;
    EntityInterface origin = firstVersion(entity);
    long createdAt = createdAt(entity, origin);
    var instance =
        new OnboardingInstance()
            .withId(UUID.randomUUID())
            .withEntity(entity.getEntityReference())
            .withConfiguration(JsonUtils.deepCopy(playbook, OnboardingPlaybook.class))
            .withStage(OnboardingLifecycle.firstAfterCreation(playbook.getOnboarding()))
            .withCreatedAt(createdAt)
            .withEnteredAt(createdAt)
            .withRevision(0L)
            .withCreator(creator(entity, origin))
            .withCreationCompleted(creationComplete(playbook, entity));
    try {
      OnboardingStore.dao()
          .insert(
              instance.getId().toString(),
              entity.getId().toString(),
              type,
              playbook.getId().toString(),
              instance.getStage(),
              instance.getCreatedAt(),
              instance.getEnteredAt(),
              JsonUtils.pojoToJson(instance));
    } catch (RuntimeException exception) {
      existing = OnboardingStore.find(entity.getId());
      if (existing == null) throw exception;
      return existing;
    }
    return instance;
  }

  /** The asset as first written, which is where its creator and its onboarding clock come from. */
  private static EntityInterface firstVersion(EntityInterface entity) {
    try {
      return Entity.getEntityRepository(entity.getEntityReference().getType())
          .getVersion(entity.getId(), "0.1");
    } catch (EntityNotFoundException missingHistory) {
      // Imported assets may not retain their first version.
      return null;
    }
  }

  private static EntityReference creator(EntityInterface entity, EntityInterface origin) {
    String name = origin == null ? entity.getUpdatedBy() : origin.getUpdatedBy();
    User user = Entity.findByNameOrNull(Entity.USER, name, Include.NON_DELETED);
    return user == null ? null : user.getEntityReference();
  }

  private static long createdAt(EntityInterface entity, EntityInterface origin) {
    Long first = origin == null ? null : origin.getUpdatedAt();
    if (first != null) return first;
    return entity.getUpdatedAt() == null ? System.currentTimeMillis() : entity.getUpdatedAt();
  }

  public static void validateWrite(EntityInterface entity, String type, boolean update) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type)) return;
    OnboardingInstance instance = OnboardingStore.find(entity.getId());
    OnboardingPlaybook playbook = instance == null ? configured(type) : instance.getConfiguration();
    if (!OnboardingEvaluator.isEnabled(playbook)) return;
    if (!update) entity.setEntityStatus(EntityStatus.DRAFT);
    if (instance == null && update && !eligible(entity)) return;
    String current = OnboardingEvaluator.stageFor(playbook, entity.getEntityStatus());
    for (String stage : OnboardingLifecycle.stageKeys(playbook.getOnboarding())) {
      if (OnboardingLifecycle.indexOf(playbook.getOnboarding(), stage)
          >= OnboardingLifecycle.indexOf(playbook.getOnboarding(), current)) break;
      // A gate its author chose not to block on let the asset past with work open; re-imposing it
      // on every later write would strand the asset it deliberately released.
      if (!OnboardingGates.blocks(OnboardingGates.gateFor(playbook, stage))) continue;
      requireComplete(outstandingAt(playbook, instance, entity, type, stage));
    }
  }

  private static List<OnboardingStepResult> outstandingAt(
      OnboardingPlaybook playbook,
      OnboardingInstance instance,
      EntityInterface entity,
      String type,
      String stage) {
    return OnboardingEvaluator.evaluate(playbook, entity, stage).stream()
        .filter(
            result ->
                result.getRequired() && result.getStep().getType() != OnboardingCheckType.APPROVAL)
        .filter(result -> enforcedAtCreation(playbook, instance, type, stage, result))
        .filter(result -> !OnboardingEvaluator.isSatisfied(result))
        .toList();
  }

  /**
   * A backfilled asset predates the playbook, so its Creation gate is only enforced for fields the
   * API itself refuses to write without - until someone revises it and completes the gate.
   */
  private static boolean enforcedAtCreation(
      OnboardingPlaybook playbook,
      OnboardingInstance instance,
      String type,
      String stage,
      OnboardingStepResult result) {
    return instance == null
        || Boolean.TRUE.equals(instance.getCreationCompleted())
        || !OnboardingLifecycle.isCreation(playbook.getOnboarding(), stage)
        || OnboardingConfigurationValidator.creationFields(type)
            .contains(result.getStep().getFieldPath());
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
    instance.setStage(OnboardingEvaluator.stageFor(configured(type), original.getEntityStatus()));
    EntityStatus target = updated.getEntityStatus();
    if (target == EntityStatus.DRAFT
        && (original.getEntityStatus() == EntityStatus.REJECTED
            || original.getEntityStatus() == EntityStatus.UNPROCESSED)) return;
    var progress = progress(instance, updated);
    if (Boolean.TRUE.equals(progress.getPaused()))
      throw new IllegalArgumentException("Onboarding is paused");
    // A non-blocking gate raises a warning instead of refusing the move.
    if (!Boolean.TRUE.equals(progress.getGateBlocking())) return;
    requireComplete(
        progress.getSteps().stream()
            .filter(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result))
            .toList());
  }

  private static void requireComplete(List<OnboardingStepResult> failures) {
    if (!failures.isEmpty())
      throw new IllegalArgumentException(
          "Onboarding checks incomplete: " + String.join(", ", titles(failures)));
  }

  private static List<String> titles(List<OnboardingStepResult> results) {
    return results.stream()
        .map(
            result ->
                result.getStep().getTitle() != null
                    ? result.getStep().getTitle()
                    : result.getStep().getId())
        .toList();
  }

  public static OnboardingProgress get(String type, UUID id) {
    requireType(type);
    var instance = OnboardingStore.find(id);
    if (instance == null || !type.equals(instance.getEntity().getType()))
      throw new NotFoundException("Asset is not enrolled in onboarding");
    var asset = entity(type, id);
    instance.setStage(OnboardingEvaluator.stageFor(configured(type), asset.getEntityStatus()));
    return progress(instance, asset);
  }

  public static OnboardingProgress progress(OnboardingInstance instance, EntityInterface entity) {
    return progress(instance, entity, OnboardingReadContext.DIRECT);
  }

  static OnboardingProgress progress(
      OnboardingInstance instance, EntityInterface entity, OnboardingReadContext reads) {
    List<OnboardingStepResult> results =
        new ArrayList<>(
            OnboardingEvaluator.evaluateThrough(
                instance.getConfiguration(), entity, instance.getStage()));
    for (var result : results) OnboardingTasks.hydrate(result, instance, entity, reads);
    List<OnboardingStepResult> outstanding =
        results.stream()
            .filter(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result))
            .toList();
    List<String> blockers = outstanding.stream().map(result -> result.getStep().getId()).toList();
    boolean completed =
        entity.getEntityStatus() == EntityStatus.APPROVED
            || entity.getEntityStatus() == EntityStatus.DEPRECATED;
    boolean paused = !completed && !reads.enabled(instance.getEntity().getType());
    boolean blocking =
        OnboardingGates.blocks(OnboardingGates.gateFor(instance, instance.getStage()));
    return new OnboardingProgress()
        .withEntity(entity.getEntityReference())
        .withEntityVersion(entity.getVersion())
        .withConfigurationId(instance.getConfiguration().getId())
        .withConfigurationVersion(instance.getConfiguration().getVersion())
        .withDomains(boardDomains(entity))
        .withStage(instance.getStage())
        .withCreatedAt(instance.getCreatedAt())
        .withEnteredAt(instance.getEnteredAt())
        .withSteps(results)
        .withBlockingSteps(blockers)
        .withGateBlocking(blocking)
        .withWarnings(blocking ? List.of() : titles(outstanding))
        .withNextStage(
            OnboardingLifecycle.next(
                instance.getConfiguration() == null
                    ? null
                    : instance.getConfiguration().getOnboarding(),
                instance.getStage()))
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
    if (request.getTargetStage() != null
        && !request.getTargetStage().equals(progress.getNextStage()))
      throw new IllegalArgumentException("Use the next onboarding gate");
    if (!mayHandOff(progress, entity)) return progress;
    // The gate has passed. Its workflow runs the approval and sets the resulting status; onboarding
    // deliberately does not move the asset itself.
    handOff(OnboardingGates.gateFor(instance, progress.getStage()), entity, user);
    synchronize(entity(type, id), type, false);
    return get(type, id);
  }

  /** A gate that does not block releases the asset with its open checks recorded as warnings. */
  private static boolean mayHandOff(OnboardingProgress progress, EntityInterface entity) {
    if (Boolean.TRUE.equals(progress.getCanAdvance())) return true;
    return !Boolean.TRUE.equals(progress.getGateBlocking())
        && !Boolean.TRUE.equals(progress.getPaused())
        && entity.getEntityStatus() != EntityStatus.DEPRECATED;
  }

  private static void handOff(OnboardingGate gate, EntityInterface entity, String user) {
    EntityReference workflow = gate == null ? null : gate.getHandoffWorkflow();
    if (workflow == null) return;
    if (OnboardingHandoff.start(gate, entity, user) == null)
      throw new WebApplicationException(
          String.format("Handoff workflow '%s' is not deployed", workflow.getFullyQualifiedName()),
          409);
  }

  static List<EntityReference> boardDomains(EntityInterface entity) {
    if (Entity.DOMAIN.equals(entity.getEntityReference().getType()))
      return List.of(entity.getEntityReference());
    return entity.getDomains() == null ? List.of() : entity.getDomains();
  }

  /**
   * Set an asset's status directly. This is enrolment only - bringing an unprocessed asset into the
   * lifecycle. Gate transitions go through the gate's workflow, never through here.
   */
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
    var released = new AtomicReference<SoftGateExit>();
    Entity.getCollectionDAO()
        .useTransaction(dao -> released.set(reconcile(dao, entity, type, retry)));
    if (released.get() != null) announceSoftGateExit(released.get());
    if (OnboardingEvaluator.isEnabled(configured(type)))
      OnboardingTasks.startPending(
          OnboardingStore.find(entity.getId()), entity(type, entity.getId()));
  }

  private static SoftGateExit reconcile(
      CollectionDAO dao, EntityInterface entity, String type, boolean retry) {
    var locked = OnboardingStore.read(dao.onboardingDAO().lock(entity.getId().toString()));
    EntityInterface current = entity(type, entity.getId());
    String stage = OnboardingEvaluator.stageFor(configured(type), current.getEntityStatus());
    SoftGateExit released = null;
    if (!Objects.equals(stage, locked.getStage())) {
      released = recordStageExit(dao, locked, current);
      locked.setStage(stage);
      locked.setEnteredAt(System.currentTimeMillis());
    }
    locked.setEntity(current.getEntityReference());
    if (creationComplete(locked.getConfiguration(), current)) locked.setCreationCompleted(true);
    if (OnboardingEvaluator.isEnabled(configured(type)))
      OnboardingTasks.reserve(locked, current, retry);
    locked.setSteps(progress(locked, current).getSteps());
    OnboardingStore.save(locked);
    return released;
  }

  /**
   * Close the stay the asset is leaving. The timing is projected to its own table in the same
   * transaction as the JSON append, because the board's medians are range scans over completed
   * stays and a JSON array cannot answer those.
   */
  private static SoftGateExit recordStageExit(
      CollectionDAO dao, OnboardingInstance locked, EntityInterface asset) {
    long exitedAt = System.currentTimeMillis();
    String stage = locked.getStage();
    locked
        .getStageHistory()
        .add(
            new OnboardingStageTiming()
                .withStage(stage)
                .withEnteredAt(locked.getEnteredAt())
                .withExitedAt(exitedAt));
    dao.onboardingDAO()
        .insertStageTiming(
            UUID.randomUUID().toString(),
            locked.getId().toString(),
            locked.getEntity().getType(),
            stage,
            locked.getEnteredAt(),
            exitedAt);
    List<String> open = openRequiredChecks(locked, stage);
    if (open.isEmpty() || OnboardingGates.blocks(OnboardingGates.gateFor(locked, stage)))
      return null;
    return new SoftGateExit(locked, asset, stage, open);
  }

  private static List<String> openRequiredChecks(OnboardingInstance instance, String stage) {
    return titles(
        instance.getSteps().stream()
            .filter(result -> stage.equals(result.getStage()))
            .filter(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result))
            .toList());
  }

  private static void announceSoftGateExit(SoftGateExit released) {
    OnboardingNotifications.tellPlaybookOwners(
        released.instance(),
        released.asset(),
        String.format(
            "%s moved past the %s gate with %d check(s) still open: %s.",
            released.asset().getName(),
            released.stage(),
            released.open().size(),
            String.join(", ", released.open())));
    OnboardingNotifications.record(
        released.instance(),
        new OnboardingReminder()
            .withKind(OnboardingReminderKind.SOFT_GATE_NOTICE)
            .withSentAt(System.currentTimeMillis())
            .withSentBy(OnboardingNotifications.BOT));
  }

  public static void requireType(String type) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(type))
      throw new IllegalArgumentException("Unsupported onboarding entity type");
  }

  private static boolean creationComplete(OnboardingPlaybook playbook, EntityInterface entity) {
    return OnboardingEvaluator.evaluate(playbook, entity, OnboardingLifecycle.CREATION).stream()
        .noneMatch(step -> step.getRequired() && !OnboardingEvaluator.isSatisfied(step));
  }
}
