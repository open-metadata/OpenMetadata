package org.openmetadata.service.events.lifecycle.handlers;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Strangler Fig bridge: syncs Task lifecycle events to TCRS (TestCaseResolutionStatus) records.
 *
 * <p>Listens for Task entity events. When a Task with category=Incident and an aboutEntityLink
 * containing "incidents" is created or updated, writes corresponding TCRS records to the
 * time-series table. This keeps the existing incident UI and API working while Tasks become the
 * source of truth.
 *
 * <p>Removable: delete this file + one registration line in Entity.java.
 */
@Slf4j
public class IncidentTcrsSyncHandler implements EntityLifecycleEventHandler {

  private static final String HANDLER_NAME = "IncidentTcrsSyncHandler";
  private static final String INCIDENTS_FIELD = "incidents";

  @Override
  public String getHandlerName() {
    return HANDLER_NAME;
  }

  @Override
  public Set<String> getSupportedEntityTypes() {
    return Set.of(Entity.TASK);
  }

  @Override
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    if (!(entity instanceof Task task) || !isIncidentTask(task)) {
      return;
    }

    MessageParser.EntityLink link = MessageParser.EntityLink.parse(task.getAboutEntityLink());
    String testCaseFqn = link.getEntityFQN();
    UUID stateId = UUID.fromString(link.getArrayFieldName());

    if (incidentResolutionStatusExists(stateId)) {
      LOG.debug("[{}] TCRS(New) already exists for stateId={}, skipping.", HANDLER_NAME, stateId);
      return;
    }

    EntityReference updatedBy = task.getCreatedBy();

    TestCaseResolutionStatus tcrs =
        new TestCaseResolutionStatus()
            .withId(UUID.randomUUID())
            .withStateId(stateId)
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
            .withUpdatedBy(updatedBy)
            .withUpdatedAt(System.currentTimeMillis());

    insertIncidentResolutionStatus(testCaseFqn, tcrs);
    LOG.info(
        "[{}] Synced Task created -> TCRS(New) for testCase='{}', stateId='{}'",
        HANDLER_NAME,
        testCaseFqn,
        stateId);
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (!(entity instanceof Task task) || !isIncidentTask(task)) {
      return;
    }

    MessageParser.EntityLink link = MessageParser.EntityLink.parse(task.getAboutEntityLink());
    String testCaseFqn = link.getEntityFQN();
    UUID stateId = UUID.fromString(link.getArrayFieldName());

    TestCaseResolutionStatusTypes tcrsType =
        mapTaskChangeToResolutionStatusType(task, changeDescription);
    if (tcrsType == null) {
      return;
    }

    EntityReference updatedBy = resolveUpdatedBy(task);

    TestCaseResolutionStatus tcrs =
        new TestCaseResolutionStatus()
            .withId(UUID.randomUUID())
            .withStateId(stateId)
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseResolutionStatusType(tcrsType)
            .withUpdatedBy(updatedBy)
            .withUpdatedAt(System.currentTimeMillis());

    if (tcrsType == TestCaseResolutionStatusTypes.Resolved) {
      Resolved resolved =
          new Resolved()
              .withResolvedBy(updatedBy)
              .withTestCaseFailureComment("Resolved via governance workflow task");
      tcrs.withTestCaseResolutionStatusDetails(resolved);
    }

    insertIncidentResolutionStatus(testCaseFqn, tcrs);
    LOG.info(
        "[{}] Synced Task update -> TCRS({}) for testCase='{}', stateId='{}'",
        HANDLER_NAME,
        tcrsType,
        testCaseFqn,
        stateId);
  }

  boolean isIncidentTask(Task task) {
    if (task.getCategory() != TaskCategory.Incident) {
      return false;
    }
    String aboutLink = task.getAboutEntityLink();
    if (aboutLink == null || aboutLink.isBlank()) {
      return false;
    }
    try {
      MessageParser.EntityLink link = MessageParser.EntityLink.parse(aboutLink);
      return INCIDENTS_FIELD.equals(link.getFieldName()) && link.getArrayFieldName() != null;
    } catch (Exception e) {
      LOG.warn("[{}] Failed to parse aboutEntityLink: {}", HANDLER_NAME, aboutLink, e);
      return false;
    }
  }

  private TestCaseResolutionStatusTypes mapTaskChangeToResolutionStatusType(
      Task task, ChangeDescription changeDescription) {
    if (isTerminalStatus(task.getStatus())) {
      return TestCaseResolutionStatusTypes.Resolved;
    }

    if (changeDescription == null) {
      return null;
    }

    for (FieldChange fc : safeList(changeDescription.getFieldsUpdated())) {
      if ("status".equals(fc.getName())) {
        String newStatus = extractStringValue(fc.getNewValue());
        if (TaskEntityStatus.InProgress.value().equals(newStatus)) {
          return TestCaseResolutionStatusTypes.Ack;
        }
      }
    }

    for (FieldChange fc : safeList(changeDescription.getFieldsUpdated())) {
      if ("assignees".equals(fc.getName())) {
        return TestCaseResolutionStatusTypes.Assigned;
      }
    }
    for (FieldChange fc : safeList(changeDescription.getFieldsAdded())) {
      if ("assignees".equals(fc.getName())) {
        return TestCaseResolutionStatusTypes.Assigned;
      }
    }

    return null;
  }

  private boolean isTerminalStatus(TaskEntityStatus status) {
    return status == TaskEntityStatus.Completed
        || status == TaskEntityStatus.Cancelled
        || status == TaskEntityStatus.Failed;
  }

  private EntityReference resolveUpdatedBy(Task task) {
    String updatedBy = task.getUpdatedBy();
    if (updatedBy != null && !updatedBy.isBlank()) {
      try {
        return Entity.getEntityReferenceByName(Entity.USER, updatedBy, Include.NON_DELETED);
      } catch (Exception e) {
        LOG.warn(
            "[{}] Could not resolve updatedBy '{}': {}", HANDLER_NAME, updatedBy, e.getMessage());
      }
    }
    return task.getCreatedBy();
  }

  private boolean incidentResolutionStatusExists(UUID stateId) {
    List<String> records =
        ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO)
                Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao())
            .listTestCaseResolutionStatusesForStateId(stateId.toString());
    return !records.isEmpty();
  }

  private void insertIncidentResolutionStatus(String testCaseFqn, TestCaseResolutionStatus tcrs) {
    Entity.getCollectionDAO()
        .testCaseResolutionStatusTimeSeriesDao()
        .insert(testCaseFqn, Entity.TEST_CASE_RESOLUTION_STATUS, JsonUtils.pojoToJson(tcrs));

    EntityReference testCaseRef =
        Entity.getEntityReferenceByName(Entity.TEST_CASE, testCaseFqn, Include.ALL);
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(
            testCaseRef.getId(),
            tcrs.getId(),
            Entity.TEST_CASE,
            Entity.TEST_CASE_RESOLUTION_STATUS,
            Relationship.PARENT_OF.ordinal());
  }

  private String extractStringValue(Object value) {
    if (value instanceof String s) {
      return (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\""))
          ? s.substring(1, s.length() - 1)
          : s;
    }
    return value != null ? value.toString() : null;
  }

  private <T> List<T> safeList(List<T> list) {
    return list != null ? list : Collections.emptyList();
  }
}
