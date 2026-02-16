package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.schema.type.EventType.TASK_CREATED;
import static org.openmetadata.schema.type.EventType.TASK_UPDATED;
import static org.openmetadata.service.Entity.INGESTION_BOT_NAME;
import static org.openmetadata.service.Entity.getEntityReferenceByName;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.beans.BeanInfo;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Metric;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TestCaseResolutionPayload;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.IncidentManagerException;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusMapper;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;

@Slf4j
public class TestCaseResolutionStatusRepository
    extends EntityTimeSeriesRepository<TestCaseResolutionStatus> {
  public static final String TIME_TO_RESPONSE = "timeToResponse";
  public static final String TIME_TO_RESOLUTION = "timeToResolution";

  public TestCaseResolutionStatusRepository() {
    super(
        TestCaseResolutionStatusResource.COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao(),
        TestCaseResolutionStatus.class,
        Entity.TEST_CASE_RESOLUTION_STATUS);
  }

  @Override
  protected List<String> getExcludeSearchFields() {
    return List.of("@timestamp", "domains", "testCase", "testSuite", "fqnParts");
  }

  public ResultList<TestCaseResolutionStatus> listTestCaseResolutionStatusesForStateId(
      UUID stateId) {
    List<TestCaseResolutionStatus> testCaseResolutionStatuses = new ArrayList<>();
    List<String> jsons =
        ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
            .listTestCaseResolutionStatusesForStateId(stateId.toString());

    for (String json : jsons) {
      TestCaseResolutionStatus testCaseResolutionStatus =
          JsonUtils.readValue(json, TestCaseResolutionStatus.class);
      setInheritedFields(testCaseResolutionStatus);
      testCaseResolutionStatuses.add(testCaseResolutionStatus);
    }

    return getResultList(testCaseResolutionStatuses, null, null, testCaseResolutionStatuses.size());
  }

  private TestCaseResolutionStatus listFirstTestCaseResolutionStatusForStateId(UUID stateId) {
    String json =
        ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
            .listFirstTestCaseResolutionStatusesForStateId(stateId.toString());

    if (json == null) {
      return null;
    }

    TestCaseResolutionStatus testCaseResolutionStatus =
        JsonUtils.readValue(json, TestCaseResolutionStatus.class);
    setInheritedFields(testCaseResolutionStatus);
    return testCaseResolutionStatus;
  }

  public RestUtil.PatchResponse<TestCaseResolutionStatus> patch(
      UUID id, JsonPatch patch, String user) {
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
    setInheritedFields(updated);
    postUpdate(updated);
    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, ENTITY_UPDATED);
  }

  @Override
  protected void setUpdatedFields(TestCaseResolutionStatus updated, String user) {
    updated.setUpdatedAt(System.currentTimeMillis());
    updated.setUpdatedBy(EntityUtil.getEntityReference("User", user));
  }

  @SneakyThrows
  @Override
  protected void validatePatchFields(
      TestCaseResolutionStatus updated, TestCaseResolutionStatus original) {
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

  private Task getIncidentTask(TestCaseResolutionStatus incident) {
    // Fetch the task by testCaseResolutionStatusId stored in the payload
    String jsonTask =
        Entity.getCollectionDAO()
            .taskDAO()
            .fetchTaskByTestCaseResolutionStatusId(incident.getStateId().toString());
    return jsonTask != null ? JsonUtils.readValue(jsonTask, Task.class) : null;
  }

  @Override
  @Transaction
  public void storeInternal(
      TestCaseResolutionStatus recordEntity, String recordFQN, String extension) {

    TestCaseResolutionStatus lastIncident = getLatestRecord(recordFQN);

    if (recordEntity.getStateId() == null) {
      recordEntity.setStateId(UUID.randomUUID());
    }

    // if we have an ongoing incident, set the stateId if the new record to be created
    // and validate the flow
    if (Boolean.TRUE.equals(unresolvedIncident(lastIncident))) {
      // If there is an unresolved incident update the state ID
      recordEntity.setStateId(lastIncident.getStateId());
      // If the last incident had a severity assigned and the incoming incident does not, inherit
      // the old severity
      recordEntity.setSeverity(
          recordEntity.getSeverity() == null
              ? lastIncident.getSeverity()
              : recordEntity.getSeverity());
    }

    setResolutionMetrics(lastIncident, recordEntity);
    inferIncidentSeverity(recordEntity);

    LOG.debug(
        "storeInternal switch: status={}, stateId={}",
        recordEntity.getTestCaseResolutionStatusType(),
        recordEntity.getStateId());
    switch (recordEntity.getTestCaseResolutionStatusType()) {
      case New -> {
        // If there is already an existing New incident we'll return it
        if (Boolean.TRUE.equals(unresolvedIncident(lastIncident))) {
          LOG.debug("Skipping - already have unresolved incident");
          return;
        }
      }
      case Ack, Assigned -> openOrAssignTask(recordEntity);
      case Resolved -> {
        // When the incident is Resolved, we will close the Assigned task.
        resolveTask(recordEntity, lastIncident);
        // We don't create a new record. The new status will be added via the
        // TestCaseFailureResolutionTaskWorkflow
        // implemented in the TestCaseRepository.
        return;
      }
      default -> throw new IllegalArgumentException(
          String.format("Invalid status %s", recordEntity.getTestCaseResolutionStatusType()));
    }
    EntityReference testCaseReference = recordEntity.getTestCaseReference();
    recordEntity.withTestCaseReference(null); // we don't want to store the reference in the record
    timeSeriesDao.insert(recordFQN, entityType, JsonUtils.pojoToJson(recordEntity));
    recordEntity.withTestCaseReference(testCaseReference);
  }

  @Override
  protected void storeRelationship(TestCaseResolutionStatus recordEntity) {
    addRelationship(
        recordEntity.getTestCaseReference().getId(),
        recordEntity.getId(),
        Entity.TEST_CASE,
        Entity.TEST_CASE_RESOLUTION_STATUS,
        Relationship.PARENT_OF,
        null,
        false);
  }

  @Override
  protected void setInheritedFields(TestCaseResolutionStatus recordEntity) {
    recordEntity.setTestCaseReference(
        getFromEntityRef(recordEntity.getId(), Relationship.PARENT_OF, Entity.TEST_CASE, true));
  }

  private void openOrAssignTask(TestCaseResolutionStatus incidentStatus) {
    LOG.debug(
        "openOrAssignTask called with status: {}",
        incidentStatus.getTestCaseResolutionStatusType());
    switch (incidentStatus.getTestCaseResolutionStatusType()) {
      case Ack -> {
        // If the incident has been acknowledged, the task will be assigned to the user
        // who acknowledged it
        LOG.debug("Creating task for Ack status");
        createTask(incidentStatus, Collections.singletonList(incidentStatus.getUpdatedBy()));
      }
      case Assigned -> {
        // If no existing task is found (New -> Assigned), we'll create a new one,
        // otherwise (Ack -> Assigned) we'll update the existing
        Task existingTask = getIncidentTask(incidentStatus);
        Assigned assigned =
            JsonUtils.convertValue(
                incidentStatus.getTestCaseResolutionStatusDetails(), Assigned.class);
        if (existingTask == null) {
          // New -> Assigned flow
          createTask(incidentStatus, Collections.singletonList(assigned.getAssignee()));
        } else {
          // Ack -> Assigned or Assigned -> Assigned flow
          patchTaskAssignee(
              existingTask, assigned.getAssignee(), incidentStatus.getUpdatedBy().getName());
        }
      }
        // Should not land in the default case as we only call this method for Ack and Assigned
      default -> throw new IllegalArgumentException(
          String.format(
              "Task cannot be opened for status `%s`",
              incidentStatus.getTestCaseResolutionStatusType()));
    }
  }

  private void resolveTask(
      TestCaseResolutionStatus newIncidentStatus, TestCaseResolutionStatus lastIncidentStatus) {

    if (lastIncidentStatus == null) {
      throw new IncidentManagerException(
          String.format(
              "Cannot find the last incident status for stateId %s",
              newIncidentStatus.getStateId()));
    }

    Resolved resolved =
        JsonUtils.convertValue(
            newIncidentStatus.getTestCaseResolutionStatusDetails(), Resolved.class);

    Task task = getIncidentTask(lastIncidentStatus);

    if (task != null) {
      // If there is an existing task, resolve it with Completed status
      TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      String comment =
          resolved.getTestCaseFailureComment() != null
              ? resolved.getTestCaseFailureComment()
              : "Incident resolved";

      // Create resolution with Completed type
      TaskResolution resolution =
          new TaskResolution()
              .withType(TaskResolutionType.Completed)
              .withComment(comment)
              .withResolvedBy(newIncidentStatus.getUpdatedBy())
              .withResolvedAt(System.currentTimeMillis());

      // Resolve the task (sets status to Completed)
      taskRepository.resolveTask(task, resolution, newIncidentStatus.getUpdatedBy().getName());

      // Create explicit ChangeEvent for the resolved task
      createAndPersistTaskChangeEvent(
          task, newIncidentStatus.getUpdatedBy().getName(), TASK_UPDATED);
    }
    // if there is no task, we'll simply create a new incident status (e.g. New -> Resolved)
    EntityReference testCaseReference = newIncidentStatus.getTestCaseReference();
    newIncidentStatus.setTestCaseReference(
        null); // we don't want to store the reference in the record
    timeSeriesDao.insert(
        testCaseReference.getFullyQualifiedName(),
        entityType,
        JsonUtils.pojoToJson(newIncidentStatus));
    newIncidentStatus.setTestCaseReference(testCaseReference);
  }

  /**
   * Creates a ChangeEvent for when a task is automatically created or updated during incident management.
   *
   * <p>This method is ONLY called from internal code paths (not REST endpoints).
   * REST endpoints have their ChangeEvents created by ChangeEventHandler.process().
   *
   * @param task The Task entity that was just created or updated
   * @param userName The user who triggered the incident status change
   * @param eventType The type of event: TASK_CREATED for new tasks, TASK_UPDATED for reassignments
   */
  private void createAndPersistTaskChangeEvent(Task task, String userName, EventType eventType) {
    // Create the ChangeEvent for the newly created or updated task
    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(eventType)
            .withEntityId(task.getId())
            .withEntityType(Entity.TASK)
            .withEntityFullyQualifiedName(task.getFullyQualifiedName())
            .withUserName(userName)
            .withTimestamp(System.currentTimeMillis())
            .withEntity(task);

    // Include change description if provided (tracks what changed in the update)
    if (task.getChangeDescription() != null) {
      changeEvent.withChangeDescription(task.getChangeDescription());
    }

    // Persist the ChangeEvent to the database
    // This triggers the notification pipeline to process the event
    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
  }

  private void createTask(
      TestCaseResolutionStatus incidentStatus, List<EntityReference> assignees) {

    LOG.debug(
        "createTask called with stateId: {}, assignees: {}",
        incidentStatus.getStateId(),
        assignees);

    // Fetch the TestCase to get its reference and domains
    TestCase testCase =
        Entity.getEntity(
            Entity.TEST_CASE,
            incidentStatus.getTestCaseReference().getId(),
            "domains",
            Include.ALL);

    // Create the payload with testCaseResolutionStatusId linking to the incident workflow
    TestCaseResolutionPayload payload =
        new TestCaseResolutionPayload()
            .withTestCaseResolutionStatusId(incidentStatus.getStateId())
            .withTestCaseResult(testCase.getEntityReference());

    // Create Task entity using the new Task API
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withName("Incident: " + testCase.getName())
            .withDisplayName("Test Case Incident - " + testCase.getDisplayName())
            .withDescription("New incident for test case: " + testCase.getFullyQualifiedName())
            .withCategory(TaskCategory.Incident)
            .withType(TaskEntityType.TestCaseResolution)
            .withStatus(TaskEntityStatus.Open)
            .withAbout(testCase.getEntityReference())
            .withCreatedBy(incidentStatus.getUpdatedBy())
            .withAssignees(assignees)
            .withPayload(payload)
            .withCreatedAt(System.currentTimeMillis())
            .withUpdatedBy(incidentStatus.getUpdatedBy().getName())
            .withUpdatedAt(System.currentTimeMillis());

    // Inherit domains from the test case
    if (testCase.getDomains() != null && !testCase.getDomains().isEmpty()) {
      task.withDomains(testCase.getDomains());
    }

    // Create the task using TaskRepository
    // Note: createInternal already calls prepareInternal internally
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    try {
      task = taskRepository.createInternal(task);
      LOG.debug("Task created successfully: id={}", task.getId());
    } catch (Exception e) {
      LOG.error("Error creating task: {}", e.getMessage(), e);
      throw e;
    }

    // Create explicit ChangeEvent for the auto-created task
    createAndPersistTaskChangeEvent(task, incidentStatus.getUpdatedBy().getName(), TASK_CREATED);

    // Send WebSocket Notification for the new task
    WebsocketNotificationHandler.handleTaskNotification(task);
  }

  private void patchTaskAssignee(Task originalTask, EntityReference newAssignee, String user) {
    Task updatedTask = JsonUtils.deepCopy(originalTask, Task.class);
    List<EntityReference> updatedAssignees =
        nullOrEmpty(newAssignee) ? new ArrayList<>() : Collections.singletonList(newAssignee);
    updatedTask.setAssignees(updatedAssignees);

    JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);

    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    RestUtil.PatchResponse<Task> patchResponse =
        taskRepository.patch(null, originalTask.getId(), user, patch);
    Task patchedTask = patchResponse.entity();

    // Create explicit ChangeEvent for the assignee update
    createAndPersistTaskChangeEvent(patchedTask, user, TASK_UPDATED);

    // Send WebSocket Notification
    WebsocketNotificationHandler.handleTaskNotification(patchedTask);
  }

  public void inferIncidentSeverity(TestCaseResolutionStatus incident) {
    if (incident.getSeverity() != null) {
      // If the severity is already set, we don't need to infer it
      return;
    }
    IncidentSeverityClassifierInterface incidentSeverityClassifier =
        IncidentSeverityClassifierInterface.getInstance();
    EntityReference testCaseReference = incident.getTestCaseReference();
    TestCase testCase =
        Entity.getEntityByName(
            testCaseReference.getType(),
            testCaseReference.getFullyQualifiedName(),
            "",
            Include.ALL);
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());
    EntityInterface entity =
        Entity.getEntityByName(
            entityLink.getEntityType(),
            entityLink.getEntityFQN(),
            "followers,owners,tags,votes",
            Include.ALL);
    Severity severity = incidentSeverityClassifier.classifyIncidentSeverity(entity);
    incident.setSeverity(severity);
  }

  public static String addOriginEntityFQNJoin(ListFilter filter, String condition) {
    // if originEntityFQN is present, we need to join with test_case table
    if ((filter.getQueryParam("originEntityFQN") != null)
        || (filter.getQueryParam("include") != null)) {
      condition =
          """
              INNER JOIN (SELECT entityFQN AS testCaseEntityFQN,fqnHash AS testCaseHash, deleted FROM test_case) tc \
              ON entityFQNHash = testCaseHash
              """
              + condition;
    }

    return condition;
  }

  protected static UUID getOrCreateIncident(TestCase testCase, String updatedBy) {
    CollectionDAO daoCollection = Entity.getCollectionDAO();
    TestCaseResolutionStatusRepository testCaseResolutionStatusRepository =
        (TestCaseResolutionStatusRepository)
            Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);

    String json =
        daoCollection
            .testCaseResolutionStatusTimeSeriesDao()
            .getLatestRecord(testCase.getFullyQualifiedName());

    TestCaseResolutionStatus storedTestCaseResolutionStatus =
        json != null ? JsonUtils.readValue(json, TestCaseResolutionStatus.class) : null;

    // if we already have a non resolve status then we'll simply return it
    if (Boolean.TRUE.equals(
        testCaseResolutionStatusRepository.unresolvedIncident(storedTestCaseResolutionStatus))) {
      // storedTestCaseResolutionStatus != null is checked in unresolvedIncident
      return Objects.requireNonNull(storedTestCaseResolutionStatus).getStateId();
    }

    // if the incident is null or resolved then we'll create a new one
    TestCaseResolutionStatus status =
        new TestCaseResolutionStatus()
            .withStateId(UUID.randomUUID())
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
            .withUpdatedBy(getEntityReferenceByName(Entity.USER, updatedBy, Include.ALL))
            .withUpdatedAt(System.currentTimeMillis())
            .withTestCaseReference(testCase.getEntityReference());

    testCaseResolutionStatusRepository.createNewRecord(status, testCase.getFullyQualifiedName());
    TestCaseResolutionStatus incident =
        testCaseResolutionStatusRepository.getLatestRecord(testCase.getFullyQualifiedName());

    return incident.getStateId();
  }

  private void setResolutionMetrics(
      TestCaseResolutionStatus lastIncident, TestCaseResolutionStatus newIncident) {
    List<Metric> metrics = new ArrayList<>();
    if (lastIncident == null) return;

    if (lastIncident.getTestCaseResolutionStatusType().equals(TestCaseResolutionStatusTypes.New)
        && !newIncident
            .getTestCaseResolutionStatusType()
            .equals(TestCaseResolutionStatusTypes.Resolved)) {
      // Time to response is New (1st step in the workflow) -> [Any status but Resolved (Last step
      // in the workflow)]
      long timeToResponse = newIncident.getTimestamp() - lastIncident.getTimestamp();
      Metric metric = new Metric().withName(TIME_TO_RESPONSE).withValue((double) timeToResponse);
      metrics.add(metric);
    }

    if (newIncident
        .getTestCaseResolutionStatusType()
        .equals(TestCaseResolutionStatusTypes.Resolved)) {
      TestCaseResolutionStatus firstIncidentInWorkflow =
          listFirstTestCaseResolutionStatusForStateId(newIncident.getStateId());
      if (firstIncidentInWorkflow != null) {
        long timeToResolution = newIncident.getTimestamp() - firstIncidentInWorkflow.getTimestamp();
        Metric metric =
            new Metric().withName(TIME_TO_RESOLUTION).withValue((double) timeToResolution);
        metrics.add(metric);
      }
    }
    if (!metrics.isEmpty()) newIncident.setMetrics(metrics);
  }

  public void cleanUpAssignees(String assignee) {
    List<TestCaseResolutionStatus> testCaseResolutionStatuses =
        JsonUtils.readObjects(
            ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
                .listTestCaseResolutionForAssignee(assignee),
            TestCaseResolutionStatus.class);

    for (TestCaseResolutionStatus testCaseResolutionStatus : testCaseResolutionStatuses) {
      // We'll keep the status as assigned but remove the deleted user as the assignee
      // Incidents are treated as immutable entities -- hence we create a new one
      setInheritedFields(testCaseResolutionStatus);
      TestCaseResolutionStatusMapper mapper = new TestCaseResolutionStatusMapper();
      TestCaseResolutionStatus newStatus =
          mapper.createToEntity(
              new CreateTestCaseResolutionStatus()
                  .withTestCaseReference(
                      testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName())
                  .withTestCaseResolutionStatusType(
                      testCaseResolutionStatus.getTestCaseResolutionStatusType())
                  .withTestCaseResolutionStatusDetails(new Assigned())
                  .withSeverity(testCaseResolutionStatus.getSeverity()),
              INGESTION_BOT_NAME);

      createNewRecord(newStatus, newStatus.getTestCaseReference().getFullyQualifiedName());
    }
  }
}
