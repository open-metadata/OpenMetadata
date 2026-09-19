package org.openmetadata.service.governance.onboarding;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingReminder;
import org.openmetadata.schema.governance.onboarding.OnboardingReminderKind;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * How onboarding chases people. Reminders travel on the task the check already opened and, for the
 * playbook's own maintainers, as a conversation on the asset - both are surfaces the product
 * already notifies on, so no new delivery channel is introduced.
 */
@Slf4j
public final class OnboardingNotifications {
  static final String BOT = "governance-bot";

  private OnboardingNotifications() {}

  private static TaskRepository tasks() {
    return (TaskRepository) Entity.getEntityRepository(Entity.TASK);
  }

  /**
   * Comment on the open task, mentioning every assignee. The change event is recorded here because
   * {@link TaskRepository#addComment} is reached from a background pass as well as a REST call, and
   * only the REST response filter would otherwise emit one.
   */
  static void remindAssignees(
      Task task, List<EntityReference> assignees, String message, String sender) {
    EntityReference author = user(sender);
    String body = mentions(assignees) + " " + message;
    Task commented =
        tasks()
            .addComment(
                task,
                new TaskComment()
                    .withId(UUID.randomUUID())
                    .withMessage(body)
                    .withAuthor(author)
                    .withCreatedAt(System.currentTimeMillis()));
    tasks()
        .storeChangeEventForAsyncOperation(
            commented, EventType.ENTITY_UPDATED, false, author.getName());
  }

  /**
   * Tell the people who maintain the playbook that an asset needs their attention. Failing to
   * deliver must not undo the gate decision that triggered it, so delivery errors are logged.
   */
  static void tellPlaybookOwners(
      OnboardingInstance instance, EntityInterface asset, String message) {
    List<EntityReference> owners = playbookOwners(instance);
    if (owners.isEmpty()) {
      LOG.debug("Playbook for {} has no owners to notify", instance.getEntity().getId());
      return;
    }
    String about =
        new MessageParser.EntityLink(
                asset.getEntityReference().getType(), asset.getFullyQualifiedName())
            .getLinkString();
    try {
      Entity.getConversationRepository()
          .createSystemConversation(user(BOT), about, mentions(owners) + " " + message);
    } catch (RuntimeException undelivered) {
      LOG.warn("Could not notify playbook owners about {}", asset.getId(), undelivered);
    }
  }

  static List<EntityReference> playbookOwners(OnboardingInstance instance) {
    if (instance.getConfiguration() == null || instance.getConfiguration().getId() == null)
      return List.of();
    try {
      EntityInterface playbook =
          Entity.getEntity(
              Entity.ONBOARDING_PLAYBOOK,
              instance.getConfiguration().getId(),
              "owners",
              Include.NON_DELETED,
              false);
      return playbook.getOwners() == null ? List.of() : playbook.getOwners();
    } catch (EntityNotFoundException retiredPlaybook) {
      return List.of();
    }
  }

  /** Append a reminder to the log and keep the latest one per check and kind on the instance. */
  static void record(OnboardingInstance instance, OnboardingReminder reminder) {
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              dao.onboardingDAO()
                  .insertReminder(
                      UUID.randomUUID().toString(),
                      instance.getId().toString(),
                      instance.getEntity().getType(),
                      reminder.getStepId(),
                      reminder.getTaskId() == null ? null : reminder.getTaskId().toString(),
                      reminder.getKind().value(),
                      reminder.getSentAt(),
                      reminder.getSentBy());
              OnboardingInstance locked =
                  OnboardingStore.read(
                      dao.onboardingDAO().lock(instance.getEntity().getId().toString()));
              if (locked == null) return;
              locked
                  .getReminders()
                  .removeIf(
                      existing ->
                          existing.getKind() == reminder.getKind()
                              && Objects.equals(existing.getStepId(), reminder.getStepId()));
              locked.getReminders().add(reminder);
              OnboardingStore.save(locked);
            });
  }

  static Long lastReminderAt(
      OnboardingInstance instance, String stepId, OnboardingReminderKind kind) {
    return OnboardingStore.dao().lastReminderAt(instance.getId().toString(), stepId, kind.value());
  }

  static String mentions(List<EntityReference> references) {
    return references.stream()
        .filter(Objects::nonNull)
        .map(OnboardingNotifications::mention)
        .collect(Collectors.joining(" "));
  }

  private static String mention(EntityReference reference) {
    String name =
        reference.getFullyQualifiedName() == null
            ? reference.getName()
            : reference.getFullyQualifiedName();
    String label =
        reference.getDisplayName() == null ? reference.getName() : reference.getDisplayName();
    return String.format("<#E::%s::%s|@%s>", reference.getType(), name, label);
  }

  private static EntityReference user(String name) {
    return Entity.getEntityReferenceByName(Entity.USER, name, Include.NON_DELETED);
  }
}
