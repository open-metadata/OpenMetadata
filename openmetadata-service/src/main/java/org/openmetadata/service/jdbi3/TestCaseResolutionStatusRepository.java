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

  @Override
  protected void postCreate(TestCaseResolutionStatus entity) {
    super.postCreate(entity);
    if (entity.getTestCaseResolutionStatusType() == TestCaseResolutionStatusTypes.Assigned) {
      createAssignedTask(entity);
    }
  }

  @Override
  @Transaction
  public TestCaseResolutionStatus createNewRecord(
      TestCaseResolutionStatus recordEntity, String extension, String recordFQN) {
    TestCaseResolutionStatus latestTestCaseFailure =
        getLatestRecord(recordEntity.getTestCaseReference().getFullyQualifiedName());
    recordEntity.setStateId(
        ((latestTestCaseFailure != null)
                && (latestTestCaseFailure.getTestCaseResolutionStatusType()
                    != TestCaseResolutionStatusTypes.Resolved))
            ? latestTestCaseFailure.getStateId()
            : UUID.randomUUID());

    if (latestTestCaseFailure != null
        && latestTestCaseFailure
            .getTestCaseResolutionStatusType()
            .equals(TestCaseResolutionStatusTypes.Assigned)) {
      String jsonThread =
          Entity.getCollectionDAO()
              .feedDAO()
              .fetchThreadByTestCaseResolutionStatusId(latestTestCaseFailure.getId());
      Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
      if (recordEntity
          .getTestCaseResolutionStatusType()
          .equals(TestCaseResolutionStatusTypes.Assigned)) {
        // We have an open task and we are passing an assigned status type (i.e. we are
        // re-assigning). This scenario is
        // when the test case resolution status
        // is being sent through the API (and not resolving an open task)
        // we'll get the associated thread with the latest test case failure

        // we'll close the task (the flow will also create a new assigned test case resolution
        // status and open a new
        // task)
        Assigned assigned =
            JsonUtils.convertValue(
                recordEntity.getTestCaseResolutionStatusDetails(), Assigned.class);
        User assignee =
            Entity.getEntity(Entity.USER, assigned.getAssignee().getId(), "", Include.ALL);
        User updatedBy =
            Entity.getEntity(Entity.USER, recordEntity.getUpdatedBy().getId(), "", Include.ALL);
        CloseTask closeTask =
            new CloseTask()
                .withComment(assignee.getFullyQualifiedName())
                .withTestCaseFQN(recordEntity.getTestCaseReference().getFullyQualifiedName());
        Entity.getFeedRepository().closeTask(thread, updatedBy.getFullyQualifiedName(), closeTask);
        return getLatestRecord(recordEntity.getTestCaseReference().getFullyQualifiedName());
      } else if (recordEntity
          .getTestCaseResolutionStatusType()
          .equals(TestCaseResolutionStatusTypes.Resolved)) {
        // We have an open task and we are passing a resolved status type (i.e. we are marking it as
        // resolved). This
        // scenario is when the test case resolution status
        // is being sent through the API (and not resolving an open task)
        Resolved resolved =
            JsonUtils.convertValue(
                recordEntity.getTestCaseResolutionStatusDetails(), Resolved.class);
        TestCase testCase =
            Entity.getEntity(
                Entity.TEST_CASE, recordEntity.getTestCaseReference().getId(), "", Include.ALL);
        User updatedBy =
            Entity.getEntity(Entity.USER, recordEntity.getUpdatedBy().getId(), "", Include.ALL);
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
        return getLatestRecord(testCase.getFullyQualifiedName());
      }

      throw new IllegalArgumentException(
          String.format(
              "Test Case Resolution status %s with type `Assigned` cannot be moved to `New` or `Ack`. You can `Assign` or `Resolve` the test case failure. ",
              latestTestCaseFailure.getId().toString()));
    }
    return super.createNewRecord(recordEntity, extension, recordFQN);
  }

  private void createAssignedTask(TestCaseResolutionStatus entity) {
    Assigned assigned =
        JsonUtils.convertValue(entity.getTestCaseResolutionStatusDetails(), Assigned.class);
    List<EntityReference> assignees = Collections.singletonList(assigned.getAssignee());
    TaskDetails taskDetails =
        new TaskDetails()
            .withAssignees(assignees)
            .withType(TaskType.RequestTestCaseFailureResolution)
            .withStatus(TaskStatus.Open)
            .withTestCaseResolutionStatusId(entity.getId());

    MessageParser.EntityLink entityLink =
        new MessageParser.EntityLink(
            Entity.TEST_CASE, entity.getTestCaseReference().getFullyQualifiedName());
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withThreadTs(System.currentTimeMillis())
            .withMessage("Test Case Failure Resolution requested for ")
            .withCreatedBy(entity.getUpdatedBy().getName())
            .withAbout(entityLink.getLinkString())
            .withType(ThreadType.Task)
            .withTask(taskDetails)
            .withUpdatedBy(entity.getUpdatedBy().getName())
            .withUpdatedAt(System.currentTimeMillis());
    FeedRepository feedRepository = Entity.getFeedRepository();
    feedRepository.create(thread);
  }
}
