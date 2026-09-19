package org.openmetadata.service.governance.onboarding;

import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.governance.NudgeOnboarding;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.governance.onboarding.OnboardingReminder;
import org.openmetadata.schema.governance.onboarding.OnboardingReminderKind;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Chasing an open check by hand. The reminder is a comment on the task the check already opened, so
 * it reaches the assignees through the notification path they are already subscribed to, and it is
 * recorded so the board can show how much manual chasing the playbook still needs.
 */
public final class OnboardingNudge {
  private static final long COOLDOWN_MILLIS = TimeUnit.HOURS.toMillis(24);

  private OnboardingNudge() {}

  public static OnboardingProgress send(
      String type, UUID id, NudgeOnboarding request, String sender) {
    OnboardingService.requireType(type);
    OnboardingInstance instance = OnboardingStore.find(id);
    if (instance == null || !type.equals(instance.getEntity().getType()))
      throw new NotFoundException("Asset is not enrolled in onboarding");
    EntityInterface asset = OnboardingService.entity(type, id);
    OnboardingStepResult target =
        target(OnboardingService.progress(instance, asset), request.getStepId());
    Task task = openTask(target);
    requireCooledDown(instance, target.getStep().getId());
    long sentAt = System.currentTimeMillis();
    OnboardingNotifications.remindAssignees(
        task, target.getAssignees(), message(target, asset, request), sender);
    OnboardingNotifications.record(
        instance,
        new OnboardingReminder()
            .withStepId(target.getStep().getId())
            .withTaskId(task.getId())
            .withKind(OnboardingReminderKind.MANUAL)
            .withSentAt(sentAt)
            .withSentBy(sender));
    return OnboardingService.get(type, id);
  }

  /** The named check, or the first outstanding one that actually has someone to chase. */
  private static OnboardingStepResult target(OnboardingProgress progress, String stepId) {
    if (stepId != null) {
      return progress.getSteps().stream()
          .filter(result -> stepId.equals(result.getStep().getId()))
          .filter(OnboardingNudge::chaseable)
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      String.format("Check '%s' has no open assigned work to chase", stepId)));
    }
    // Blocking work first: that is what the board's "waiting on" column is pointing at. A row whose
    // only open work is recommended still has someone to chase, so it falls back rather than 400s.
    return progress.getSteps().stream()
        .filter(OnboardingNudge::chaseable)
        .min(Comparator.comparingInt(result -> Boolean.TRUE.equals(result.getRequired()) ? 0 : 1))
        .orElseThrow(
            () -> new IllegalArgumentException("No open check on this asset has assigned work"));
  }

  private static boolean chaseable(OnboardingStepResult result) {
    return !OnboardingEvaluator.isSatisfied(result)
        && result.getTaskId() != null
        && !CommonUtil.nullOrEmpty(result.getAssignees());
  }

  private static Task openTask(OnboardingStepResult result) {
    Task task =
        ((TaskRepository) Entity.getEntityRepository(Entity.TASK))
            .findCommittedTask(result.getTaskId());
    if (task == null || !TaskRepository.OPEN_TASK_STATUSES.contains(task.getStatus()))
      throw new IllegalArgumentException(
          String.format("Check '%s' has no open task to chase", result.getStep().getId()));
    return task;
  }

  /**
   * One reminder per check per day. A board that lets an impatient steward send ten reminders an
   * hour turns the notification into noise and makes the follow-up count meaningless.
   */
  private static void requireCooledDown(OnboardingInstance instance, String stepId) {
    Long last =
        OnboardingNotifications.lastReminderAt(instance, stepId, OnboardingReminderKind.MANUAL);
    if (last == null) return;
    long elapsed = System.currentTimeMillis() - last;
    if (elapsed >= COOLDOWN_MILLIS) return;
    long retryAfter = TimeUnit.MILLISECONDS.toSeconds(COOLDOWN_MILLIS - elapsed) + 1;
    throw new ClientErrorException(
        Response.status(Response.Status.TOO_MANY_REQUESTS)
            .header(HttpHeaders.RETRY_AFTER, retryAfter)
            .type(MediaType.APPLICATION_JSON)
            .entity(
                new ErrorMessage(
                    Response.Status.TOO_MANY_REQUESTS.getStatusCode(),
                    String.format(
                        "'%s' was already chased today; try again in %d seconds",
                        stepId, retryAfter)))
            .build());
  }

  private static String message(
      OnboardingStepResult result, EntityInterface asset, NudgeOnboarding request) {
    String title =
        result.getStep().getTitle() == null
            ? result.getStep().getId()
            : result.getStep().getTitle();
    String reminder = String.format("'%s' is still open on %s.", title, asset.getName());
    return CommonUtil.nullOrEmpty(request.getMessage())
        ? reminder
        : reminder + " " + request.getMessage();
  }
}
