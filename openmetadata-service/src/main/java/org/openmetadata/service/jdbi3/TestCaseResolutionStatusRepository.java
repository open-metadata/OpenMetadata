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
import org.openmetadata.schema.api.feed.CloseTask;
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
        && incident.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Resolved;
  }

  /**
   * Creating new records in the incident table triggers the task management.
   * We won't allow any direct interaction with the underlying task, e.g., the assigned
   * person cannot close the task directly. It should be managed via the UI when updating the
   * state of the ongoing incident.
   */
  @Override
  @Transaction
  public TestCaseResolutionStatus createNewRecord(
      TestCaseResolutionStatus recordEntity, String extension, String recordFQN) {

    TestCaseResolutionStatus lastIncident =
        getLatestRecord(recordEntity.getTestCaseReference().getFullyQualifiedName());

    if (lastIncident != null) {
      // if we have an ongoing incident, set the stateId if the new record to be created
      recordEntity.setStateId(
          Boolean.TRUE.equals(unresolvedIncident(recordEntity))
              ? lastIncident.getStateId()
              : recordEntity.getStateId());

      switch (recordEntity.getTestCaseResolutionStatusType()) {
          // When we create a NEW incident, we need to open a task with the test case owner as the
          // assignee
        case New -> openNewTask(recordEntity);
        case Ack -> {
          /* nothing to do for ACK. The Owner already has the task open. It will close it when reassigning it*/
        }
          // If the incident is in the Assign state, it means that the owner found the right person
          // to provide
          // the fix. We will close the NEW task, and create a task for the new assigned person
        case Assigned -> openAssignedTask(recordEntity);
          // When the incident is Resolved, we will close the Assigned task.
        case Resolved -> resolveTask(recordEntity);
        default -> throw new IllegalArgumentException(
            String.format("Invalid status %s", recordEntity.getTestCaseResolutionStatusType()));
      }
    }

    return super.createNewRecord(recordEntity, extension, recordFQN);
  }

  private void openNewTask(TestCaseResolutionStatus incident) {
    List<EntityReference> owners =
        EntityUtil.getEntityReferences(
            daoCollection
                .relationshipDAO()
                .findFrom(
                    incident.getTestCaseReference().getId(),
                    Entity.TEST_CASE,
                    Relationship.OWNS.ordinal(),
                    Entity.USER));
    createTask(incident, owners, "New Incident");
  }

  private void openAssignedTask(TestCaseResolutionStatus incident) {

    // Fetch the latest task (which comes from the NEW state) and close it
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(incident.getId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);

    Assigned assigned =
        JsonUtils.convertValue(incident.getTestCaseResolutionStatusDetails(), Assigned.class);
    User assignee = Entity.getEntity(Entity.USER, assigned.getAssignee().getId(), "", Include.ALL);
    User updatedBy =
        Entity.getEntity(Entity.USER, incident.getUpdatedBy().getId(), "", Include.ALL);

    CloseTask closeTask =
        new CloseTask()
            .withComment(String.format("Incident assigned to %s", assignee.getFullyQualifiedName()))
            .withTestCaseFQN(incident.getTestCaseReference().getFullyQualifiedName());
    Entity.getFeedRepository().closeTask(thread, updatedBy.getFullyQualifiedName(), closeTask);

    // Then create a new task for the new assignee requested by the incident owner
    createTask(
        incident,
        Collections.singletonList(assigned.getAssignee()),
        "Incident Resolution Requested");
  }

  private void resolveTask(TestCaseResolutionStatus incident) {

    // Fetch the latest task (which comes from the NEW or ASSIGNED state) and close it
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(incident.getId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);

    Resolved resolved =
        JsonUtils.convertValue(incident.getTestCaseResolutionStatusDetails(), Resolved.class);
    TestCase testCase =
        Entity.getEntity(
            Entity.TEST_CASE, incident.getTestCaseReference().getId(), "", Include.ALL);
    User updatedBy =
        Entity.getEntity(Entity.USER, incident.getUpdatedBy().getId(), "", Include.ALL);
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
      TestCaseResolutionStatus incident, List<EntityReference> assignees, String message) {

    TaskDetails taskDetails =
        new TaskDetails()
            .withAssignees(assignees)
            .withType(TaskType.RequestTestCaseFailureResolution)
            .withStatus(TaskStatus.Open)
            .withTestCaseResolutionStatusId(incident.getId());

    MessageParser.EntityLink entityLink =
        new MessageParser.EntityLink(
            Entity.TEST_CASE, incident.getTestCaseReference().getFullyQualifiedName());
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withThreadTs(System.currentTimeMillis())
            .withMessage(message)
            .withCreatedBy(incident.getUpdatedBy().getName())
            .withAbout(entityLink.getLinkString())
            .withType(ThreadType.Task)
            .withTask(taskDetails)
            .withUpdatedBy(incident.getUpdatedBy().getName())
            .withUpdatedAt(System.currentTimeMillis());
    FeedRepository feedRepository = Entity.getFeedRepository();
    feedRepository.create(thread);
  }
}
