package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.INGESTION_BOT_NAME;
import static org.openmetadata.service.Entity.getEntityReferenceByName;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.beans.BeanInfo;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusMapper;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
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

  @Override
  @Transaction
  public void storeInternal(
      TestCaseResolutionStatus recordEntity, String recordFQN, String extension) {

    TestCaseResolutionStatus lastIncident = getLatestRecord(recordFQN);
    long lastTimestamp =
        lastIncident != null && lastIncident.getTimestamp() != null
            ? lastIncident.getTimestamp()
            : -1L;
    long incomingTimestamp =
        recordEntity.getTimestamp() != null
            ? recordEntity.getTimestamp()
            : System.currentTimeMillis();
    if (incomingTimestamp <= lastTimestamp) {
      incomingTimestamp = lastTimestamp + 1;
    }
    recordEntity.setTimestamp(incomingTimestamp);
    if (recordEntity.getUpdatedAt() == null || recordEntity.getUpdatedAt() < incomingTimestamp) {
      recordEntity.setUpdatedAt(incomingTimestamp);
    }

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
        if (Boolean.TRUE.equals(unresolvedIncident(lastIncident))) {
          LOG.debug("Skipping - already have unresolved incident");
          return;
        }
      }
      case Ack, Assigned -> {
        // Task mutations removed — transitions happen via POST /tasks/{id}/resolve.
        // TCRS record is still stored below for backward compatibility.
      }
      case Resolved -> {
        // Task mutations removed — resolution happens via POST /tasks/{id}/resolve.
        // TCRS record is still stored below for backward compatibility.
      }
      default -> throw new IllegalArgumentException(
          String.format("Invalid status %s", recordEntity.getTestCaseResolutionStatusType()));
    }
    EntityReference testCaseReference = recordEntity.getTestCaseReference();
    recordEntity.withTestCaseReference(null);
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
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    Task existing =
        taskRepository.findTaskByEntityTypeAndStatuses(
            testCase.getFullyQualifiedName(),
            TaskEntityType.TestCaseResolution,
            TaskRepository.OPEN_TASK_STATUSES);
    if (existing != null) {
      return existing.getId();
    }

    return createIncidentTask(testCase, updatedBy);
  }

  private static UUID createIncidentTask(TestCase testCase, String updatedBy) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    TestCase fullTestCase =
        Entity.getEntityByName(
            Entity.TEST_CASE, testCase.getFullyQualifiedName(), "owners,domains", Include.ALL);

    EntityReference updatedByRef = getEntityReferenceByName(Entity.USER, updatedBy, Include.ALL);

    List<EntityReference> assignees =
        !nullOrEmpty(fullTestCase.getOwners()) ? fullTestCase.getOwners() : List.of();

    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withName("Incident: " + fullTestCase.getName())
            .withDisplayName("Test Case Incident - " + fullTestCase.getDisplayName())
            .withDescription("New incident for test case: " + fullTestCase.getFullyQualifiedName())
            .withCategory(TaskCategory.Incident)
            .withType(TaskEntityType.TestCaseResolution)
            .withStatus(TaskEntityStatus.Open)
            .withAbout(fullTestCase.getEntityReference())
            .withCreatedBy(updatedByRef)
            .withAssignees(assignees)
            .withCreatedAt(System.currentTimeMillis())
            .withUpdatedBy(updatedBy)
            .withUpdatedAt(System.currentTimeMillis());

    if (!nullOrEmpty(fullTestCase.getDomains())) {
      task.withDomains(fullTestCase.getDomains());
    }

    task = taskRepository.createInternal(task);
    LOG.info(
        "Incident task created on test failure: id={}, testCase={}",
        task.getId(),
        fullTestCase.getFullyQualifiedName());
    return task.getId();
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

  /**
   * Write a TCRS record derived from a task lifecycle event.
   *
   * <p>This is the persistence path used by {@code IncidentTcrsSyncHandler} to keep the
   * legacy time series in sync with task-first incident transitions. Unlike {@link
   * #storeInternal}, it does not execute the legacy Ack/Assigned/Resolved task-mutation
   * branches (those are no-ops on this branch anyway) and does not apply the "skip New if
   * there's an unresolved incident" guard — the caller is expected to have already checked
   * idempotency via {@link #getLatestRecordForStateId(UUID)}.
   *
   * <p>The record should have its {@code stateId}, {@code testCaseResolutionStatusType},
   * {@code testCaseReference}, {@code testCaseResolutionStatusDetails}, {@code timestamp},
   * {@code updatedAt}, and {@code updatedBy} already populated by the caller. The
   * {@code stateId} should be set to the driving task's {@code id}, giving us a 1:1
   * mapping between incidents and Tasks.
   */
  public void syncFromTask(TestCaseResolutionStatus recordEntity, String recordFQN) {
    if (recordEntity == null || recordFQN == null) {
      return;
    }

    TestCaseResolutionStatus lastIncident = getLatestRecord(recordFQN);
    long lastTimestamp =
        lastIncident != null && lastIncident.getTimestamp() != null
            ? lastIncident.getTimestamp()
            : -1L;
    long incomingTimestamp =
        recordEntity.getTimestamp() != null
            ? recordEntity.getTimestamp()
            : System.currentTimeMillis();
    if (incomingTimestamp <= lastTimestamp) {
      incomingTimestamp = lastTimestamp + 1;
    }
    recordEntity.setTimestamp(incomingTimestamp);
    if (recordEntity.getUpdatedAt() == null || recordEntity.getUpdatedAt() < incomingTimestamp) {
      recordEntity.setUpdatedAt(incomingTimestamp);
    }

    // Inherit severity from the previous record for this stateId if the caller didn't set one
    if (recordEntity.getSeverity() == null && recordEntity.getStateId() != null) {
      TestCaseResolutionStatus priorForStateId =
          getLatestRecordForStateId(recordEntity.getStateId());
      if (priorForStateId != null && priorForStateId.getSeverity() != null) {
        recordEntity.setSeverity(priorForStateId.getSeverity());
      }
    }

    setResolutionMetrics(lastIncident, recordEntity);
    inferIncidentSeverity(recordEntity);

    LOG.debug(
        "[TCRS Sync] Inserting record: status={}, stateId={}, testCase={}",
        recordEntity.getTestCaseResolutionStatusType(),
        recordEntity.getStateId(),
        recordFQN);

    EntityReference testCaseReference = recordEntity.getTestCaseReference();
    recordEntity.withTestCaseReference(null);
    timeSeriesDao.insert(recordFQN, entityType, JsonUtils.pojoToJson(recordEntity));
    recordEntity.withTestCaseReference(testCaseReference);

    storeRelationship(recordEntity);
    postCreate(recordEntity);
  }

  /**
   * Return the most recent TCRS record for a given {@code stateId}, or {@code null} if none
   * exists. Used by {@link #syncFromTask} for idempotency checks and severity inheritance.
   */
  public TestCaseResolutionStatus getLatestRecordForStateId(UUID stateId) {
    if (stateId == null) {
      return null;
    }
    List<TestCaseResolutionStatus> records =
        listTestCaseResolutionStatusesForStateId(stateId).getData();
    if (records == null || records.isEmpty()) {
      return null;
    }
    // listTestCaseResolutionStatusesForStateId doesn't document its ordering; sort defensively
    // so we always return the highest-timestamp record.
    return records.stream()
        .filter(r -> r.getTimestamp() != null)
        .max((a, b) -> Long.compare(a.getTimestamp(), b.getTimestamp()))
        .orElse(records.get(records.size() - 1));
  }
}
