package org.openmetadata.service.jdbi3;

import java.beans.BeanInfo;
import java.beans.IntrospectionException;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.InvocationTargetException;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.IncidentManagerException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class TestCaseResolutionStatusRepository
    extends EntityTimeSeriesRepository<TestCaseResolutionStatus> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases/testCaseIncidentStatus";

  public TestCaseResolutionStatusRepository() {
    super(
        COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao(),
        TestCaseResolutionStatus.class,
        Entity.TEST_CASE_RESOLUTION_STATUS);
  }

  public ResultList<TestCaseResolutionStatus> listTestCaseResolutionStatusesForStateId(
      UUID stateId) {
    List<String> jsons =
        ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
            .listTestCaseResolutionStatusesForStateId(stateId.toString());
    List<TestCaseResolutionStatus> testCaseResolutionStatuses =
        JsonUtils.readObjects(jsons, TestCaseResolutionStatus.class);

    return getResultList(testCaseResolutionStatuses, null, null, testCaseResolutionStatuses.size());
  }

  public RestUtil.PatchResponse<TestCaseResolutionStatus> patch(
      UUID id, JsonPatch patch, String user)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    String originalJson = timeSeriesDao.getById(id);
    if (originalJson == null) {
      throw new EntityNotFoundException(String.format("Entity with id %s not found", id));
    }
    TestCaseResolutionStatus original = JsonUtils.readValue(originalJson, entityClass);
    TestCaseResolutionStatus updated = JsonUtils.applyPatch(original, patch, entityClass);

    updated.setUpdatedAt(System.currentTimeMillis());
    updated.setUpdatedBy(EntityUtil.getEntityReference("User", user));
    validatePatchFields(updated, original);

    timeSeriesDao.update(JsonUtils.pojoToJson(updated), id);
    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, RestUtil.ENTITY_UPDATED);
  }

  private void validatePatchFields(
      TestCaseResolutionStatus updated, TestCaseResolutionStatus original)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    // Validate that only updatedAt and updatedBy fields are updated
    BeanInfo beanInfo = Introspector.getBeanInfo(TestCaseResolutionStatus.class);

    for (PropertyDescriptor propertyDescriptor : beanInfo.getPropertyDescriptors()) {
      String propertyName = propertyDescriptor.getName();
      if ((!propertyName.equals("updatedBy"))
          && (!propertyName.equals("updatedAt"))
          && (!propertyName.equals("severity"))) {
        Object originalValue = propertyDescriptor.getReadMethod().invoke(original);
        Object updatedValue = propertyDescriptor.getReadMethod().invoke(updated);
        if (originalValue != null && !originalValue.equals(updatedValue)) {
          throw new IllegalArgumentException(
              String.format("Field %s is not allowed to be updated", propertyName));
        }
      }
    }
  }

  public Boolean unresolvedIncident(TestCaseResolutionStatus incident) {
    return incident != null
        && !incident
            .getTestCaseResolutionStatusType()
            .equals(TestCaseResolutionStatusTypes.Resolved);
  }

  private Thread getIncidentTask(TestCaseResolutionStatus incident) {
    // Fetch the latest task (which comes from the NEW state) and close it
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(incident.getStateId());
    return JsonUtils.readValue(jsonThread, Thread.class);
  }

  /**
   * Ensure we are following the correct status flow
   */
  private void validateStatus(
      TestCaseResolutionStatusTypes lastStatus, TestCaseResolutionStatusTypes newStatus) {
    switch (lastStatus) {
      case New -> {
        /* New can go to any status */
      }
      case Ack -> {
        if (newStatus.equals(TestCaseResolutionStatusTypes.New)) {
          throw IncidentManagerException.invalidStatus(lastStatus, newStatus);
        }
      }
      case Assigned -> {
        if (List.of(TestCaseResolutionStatusTypes.New, TestCaseResolutionStatusTypes.Ack)
            .contains(newStatus)) {
          throw IncidentManagerException.invalidStatus(lastStatus, newStatus);
        }
      }
      case Resolved -> {
        if (!newStatus.equals(TestCaseResolutionStatusTypes.Resolved)) {
          throw IncidentManagerException.invalidStatus(lastStatus, newStatus);
        }
      }
    }
  }

  @Override
  @Transaction
  public TestCaseResolutionStatus createNewRecord(
      TestCaseResolutionStatus recordEntity, String extension, String recordFQN) {

    TestCaseResolutionStatus lastIncident =
        getLatestRecord(recordEntity.getTestCaseReference().getFullyQualifiedName());

    if (recordEntity.getStateId() == null) {
      recordEntity.setStateId(UUID.randomUUID());
    }

    // if we have an ongoing incident, set the stateId if the new record to be created
    // and validate the flow
    if (Boolean.TRUE.equals(unresolvedIncident(lastIncident))) {
      recordEntity.setStateId(lastIncident.getStateId());
      validateStatus(
          lastIncident.getTestCaseResolutionStatusType(),
          recordEntity.getTestCaseResolutionStatusType());
    }

    switch (recordEntity.getTestCaseResolutionStatusType()) {
        // When we create a NEW incident, we need to open a task with the test case owner as the
        // assignee. We don't need to check any past history
      case New -> {
        // If there is already an unresolved incident, return it without doing any
        // further logic.
        if (Boolean.TRUE.equals(unresolvedIncident(lastIncident))) {
          return getLatestRecord(lastIncident.getTestCaseReference().getFullyQualifiedName());
        }
        openNewTask(recordEntity);
      }
      case Ack -> {
        /* nothing to do for ACK. The Owner already has the task open. It will close it when reassigning it */
      }
      case Assigned -> assignTask(recordEntity, lastIncident);
        // When the incident is Resolved, we will close the Assigned task.
      case Resolved -> {
        resolveTask(recordEntity, lastIncident);
        // We don't create a new record. The new status will be added via the
        // TestCaseFailureResolutionTaskWorkflow
        // implemented in the TestCaseRepository.
        return getLatestRecord(recordEntity.getTestCaseReference().getFullyQualifiedName());
      }
      default -> throw new IllegalArgumentException(
          String.format("Invalid status %s", recordEntity.getTestCaseResolutionStatusType()));
    }
    return super.createNewRecord(recordEntity, extension, recordFQN);
  }

  private void openNewTask(TestCaseResolutionStatus incidentStatus) {

    List<EntityReference> owners =
        EntityUtil.getEntityReferences(
            daoCollection
                .relationshipDAO()
                .findFrom(
                    incidentStatus.getTestCaseReference().getId(),
                    Entity.TEST_CASE,
                    Relationship.OWNS.ordinal(),
                    Entity.USER));
    createTask(incidentStatus, owners, "New Incident");
  }

  private void assignTask(
      TestCaseResolutionStatus newIncidentStatus, TestCaseResolutionStatus lastIncidentStatus) {

    if (lastIncidentStatus == null) {
      throw new IncidentManagerException(
          String.format(
              "Cannot find the last incident status for stateId %s",
              newIncidentStatus.getStateId()));
    }

    Thread thread = getIncidentTask(lastIncidentStatus);

    Assigned assigned =
        JsonUtils.convertValue(
            newIncidentStatus.getTestCaseResolutionStatusDetails(), Assigned.class);
    User updatedBy =
        Entity.getEntity(Entity.USER, newIncidentStatus.getUpdatedBy().getId(), "", Include.ALL);

    patchTaskAssignee(thread, assigned.getAssignee(), updatedBy.getName());
  }

  private void resolveTask(
      TestCaseResolutionStatus newIncidentStatus, TestCaseResolutionStatus lastIncidentStatus) {

    if (lastIncidentStatus == null) {
      throw new IncidentManagerException(
          String.format(
              "Cannot find the last incident status for stateId %s",
              newIncidentStatus.getStateId()));
    }

    Thread thread = getIncidentTask(lastIncidentStatus);

    Resolved resolved =
        JsonUtils.convertValue(
            newIncidentStatus.getTestCaseResolutionStatusDetails(), Resolved.class);
    TestCase testCase =
        Entity.getEntity(
            Entity.TEST_CASE, newIncidentStatus.getTestCaseReference().getId(), "", Include.ALL);
    User updatedBy =
        Entity.getEntity(Entity.USER, newIncidentStatus.getUpdatedBy().getId(), "", Include.ALL);
    ResolveTask resolveTask =
        new ResolveTask()
            .withTestCaseFQN(testCase.getFullyQualifiedName())
            .withTestCaseFailureReason(resolved.getTestCaseFailureReason())
            .withNewValue(resolved.getTestCaseFailureComment());
    Entity.getFeedRepository()
        .resolveTask(
            new FeedRepository.ThreadContext(thread),
            updatedBy.getFullyQualifiedName(),
            resolveTask);
  }

  private void createTask(
      TestCaseResolutionStatus incidentStatus, List<EntityReference> assignees, String message) {

    TaskDetails taskDetails =
        new TaskDetails()
            .withAssignees(assignees)
            .withType(TaskType.RequestTestCaseFailureResolution)
            .withStatus(TaskStatus.Open)
            // Each incident flow - flagged by its State ID - will have a single unique Task
            .withTestCaseResolutionStatusId(incidentStatus.getStateId());

    MessageParser.EntityLink entityLink =
        new MessageParser.EntityLink(
            Entity.TEST_CASE, incidentStatus.getTestCaseReference().getFullyQualifiedName());
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withThreadTs(System.currentTimeMillis())
            .withMessage(message)
            .withCreatedBy(incidentStatus.getUpdatedBy().getName())
            .withAbout(entityLink.getLinkString())
            .withType(ThreadType.Task)
            .withTask(taskDetails)
            .withUpdatedBy(incidentStatus.getUpdatedBy().getName())
            .withUpdatedAt(System.currentTimeMillis());
    FeedRepository feedRepository = Entity.getFeedRepository();
    feedRepository.create(thread);
  }

  private void patchTaskAssignee(Thread originalTask, EntityReference newAssignee, String user) {
    Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
    updatedTask.setTask(
        updatedTask.getTask().withAssignees(Collections.singletonList(newAssignee)));

    JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);

    FeedRepository feedRepository = Entity.getFeedRepository();
    feedRepository.patchThread(null, originalTask.getId(), user, patch);
  }
}
