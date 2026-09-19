package org.openmetadata.service.governance.onboarding;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingReminder;
import org.openmetadata.schema.governance.onboarding.OnboardingReminderKind;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingTaskBinding;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * What a playbook does when nobody acts. A gate can ask to be told, to hand the work to another
 * role, or both; each is applied at most once per task, which is what makes a repeating pass safe.
 */
@Slf4j
public final class OnboardingStalls {
  private static final int BATCH_SIZE = 200;
  private static final List<String> OPEN_STATUSES =
      TaskRepository.OPEN_TASK_STATUSES.stream().map(TaskEntityStatus::value).toList();

  private OnboardingStalls() {}

  public static void runPass(long now) {
    for (String type : OnboardingEvaluator.ENTITY_TYPES) {
      try {
        runPass(type, now);
      } catch (RuntimeException exception) {
        LOG.error("Could not run the onboarding stall pass for {}", type, exception);
      }
    }
  }

  static void runPass(String type, long now) {
    OnboardingPlaybook playbook = OnboardingService.configured(type);
    if (!OnboardingEvaluator.isEnabled(playbook)) return;
    for (OnboardingGate gate : playbook.getOnboarding().getGates()) {
      if (OnboardingGates.notifiesOnStall(gate)) {
        apply(type, gate, now, true);
      }
      if (OnboardingGates.reassignsOnStall(gate)) {
        apply(type, gate, now, false);
      }
    }
  }

  private static void apply(String type, OnboardingGate gate, long now, boolean notifying) {
    long threshold =
        now
            - (notifying
                ? OnboardingGates.stallMillis(gate)
                : OnboardingGates.reassignMillis(gate));
    List<String> candidates =
        notifying
            ? OnboardingStore.dao().listStallNotifiable(type, OPEN_STATUSES, threshold, BATCH_SIZE)
            : OnboardingStore.dao().listReassignable(type, OPEN_STATUSES, threshold, BATCH_SIZE);
    for (String taskId : candidates) {
      try {
        handle(UUID.fromString(taskId), gate, now, notifying);
      } catch (RuntimeException exception) {
        LOG.warn("Could not act on stalled onboarding task {}", taskId, exception);
      }
    }
  }

  private static void handle(UUID taskId, OnboardingGate gate, long now, boolean notifying) {
    OnboardingInstance instance = OnboardingStore.forTask(taskId);
    if (instance == null) return;
    OnboardingTaskBinding binding = bindingFor(instance, taskId);
    if (binding == null || !governs(gate, binding.getStepId())) return;
    if (!mark(instance, taskId, now, notifying)) return;
    if (notifying) {
      notifyOwners(instance, binding, taskId, now);
      return;
    }
    reassign(instance, gate, binding, taskId, now);
  }

  private static boolean governs(OnboardingGate gate, String stepId) {
    return OnboardingGates.steps(gate).stream().anyMatch(step -> stepId.equals(step.getId()));
  }

  private static OnboardingTaskBinding bindingFor(OnboardingInstance instance, UUID taskId) {
    return instance.getBindings().stream()
        .filter(binding -> taskId.equals(binding.getTaskId()))
        .findFirst()
        .orElse(null);
  }

  /**
   * The marker column is the idempotency key: the conditional UPDATE decides which pass owns this
   * task, and only the winner notifies or reassigns. The instance JSON carries the same marker so
   * the board and the wizard can show it without a second query.
   */
  private static boolean mark(
      OnboardingInstance instance, UUID taskId, long now, boolean notifying) {
    var applied = new AtomicBoolean();
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              int rows =
                  notifying
                      ? dao.onboardingDAO().markStallNotified(taskId.toString(), now)
                      : dao.onboardingDAO().markReassigned(taskId.toString(), now);
              if (rows != 1) return;
              OnboardingInstance locked =
                  OnboardingStore.read(
                      dao.onboardingDAO().lock(instance.getEntity().getId().toString()));
              if (locked == null) return;
              OnboardingTaskBinding marked = bindingFor(locked, taskId);
              if (marked == null) return;
              if (notifying) {
                marked.setStallNotifiedAt(now);
              } else {
                marked.setReassignedAt(now);
              }
              OnboardingStore.save(locked);
              applied.set(true);
            });
    return applied.get();
  }

  private static void notifyOwners(
      OnboardingInstance instance, OnboardingTaskBinding binding, UUID taskId, long now) {
    EntityInterface asset = asset(instance);
    if (asset == null) return;
    OnboardingNotifications.tellPlaybookOwners(
        instance,
        asset,
        String.format(
            "'%s' on %s has had no activity and is holding up onboarding.",
            binding.getStepId(), asset.getName()));
    record(instance, binding, taskId, OnboardingReminderKind.STALL_NOTICE, now);
  }

  /**
   * Only work someone can be handed is reassigned. An approval belongs to its workflow, which picks
   * its own approvers, so a stalled approval is reported rather than quietly re-addressed.
   */
  private static void reassign(
      OnboardingInstance instance,
      OnboardingGate gate,
      OnboardingTaskBinding binding,
      UUID taskId,
      long now) {
    EntityInterface asset = asset(instance);
    OnboardingStep step = stepOf(gate, binding.getStepId());
    if (asset == null || !OnboardingTasks.isFieldCheck(step)) return;
    OnboardingAssignment role =
        OnboardingGates.reassignRole(OnboardingGates.gateForStep(instance, binding.getStepId()));
    OnboardingTasks.reassign(instance, asset, binding, role);
    record(instance, binding, taskId, OnboardingReminderKind.STALL_REASSIGNMENT, now);
  }

  private static OnboardingStep stepOf(OnboardingGate gate, String stepId) {
    return OnboardingGates.steps(gate).stream()
        .filter(step -> stepId.equals(step.getId()))
        .findFirst()
        .orElse(null);
  }

  private static void record(
      OnboardingInstance instance,
      OnboardingTaskBinding binding,
      UUID taskId,
      OnboardingReminderKind kind,
      long now) {
    OnboardingNotifications.record(
        instance,
        new OnboardingReminder()
            .withStepId(binding.getStepId())
            .withTaskId(taskId)
            .withKind(kind)
            .withSentAt(now)
            .withSentBy(OnboardingNotifications.BOT));
  }

  private static EntityInterface asset(OnboardingInstance instance) {
    try {
      return OnboardingService.entity(instance.getEntity().getType(), instance.getEntity().getId());
    } catch (EntityNotFoundException deletedAsset) {
      return null;
    }
  }
}
