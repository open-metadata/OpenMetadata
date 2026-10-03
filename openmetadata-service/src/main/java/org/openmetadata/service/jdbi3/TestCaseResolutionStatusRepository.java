package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.INGESTION_BOT_NAME;
import static org.openmetadata.service.Entity.getEntityReferenceByName;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getAfterOffset;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getBeforeOffset;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getOffset;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.beans.BeanInfo;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.IncidentGroupBy;
import org.openmetadata.schema.tests.type.IncidentStatusCount;
import org.openmetadata.schema.tests.type.IncidentTrendDirection;
import org.openmetadata.schema.tests.type.Metric;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TestCaseResolutionPayload;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.TestCaseResolutionStatusTimeSeriesDAO.IncidentGroupPage;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusMapper;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.tasks.IncidentWorkflowStages;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;

@Slf4j
public class TestCaseResolutionStatusRepository
    extends EntityTimeSeriesRepository<TestCaseResolutionStatus> {
  public static final String TIME_TO_RESPONSE = "timeToResponse";
  public static final String TIME_TO_RESOLUTION = "timeToResolution";
  public static final String INCIDENT_DATE_FIELD_CREATED_AT = "createdAt";
  public static final String INCIDENT_DATE_FIELD_UPDATED_AT = "updatedAt";
  public static final String INCIDENT_SORT_TYPE_ASC = "asc";
  public static final String INCIDENT_SORT_TYPE_DESC = "desc";
  public static final String INCIDENT_GROUP_SORT_FIELD_INCIDENT_COUNT = "incidentCount";
  public static final String INCIDENT_GROUP_SORT_FIELD_SEVERITY = "severity";
  public static final String INCIDENT_GROUP_SORT_FIELD_LAST_SEEN = "lastSeen";
  private static final String SQL_ASCENDING = "ASC";
  private static final String SQL_DESCENDING = "DESC";
  private static final String INCIDENT_COUNT_COLUMN = "incidentCount";
  private static final String LAST_SEEN_EXPR = "MAX(i.updatedAt)";
  private static final String LARGER_GROUP_FIRST = INCIDENT_COUNT_COLUMN + " " + SQL_DESCENDING;
  // Severity1 is the most severe and the values compare as strings, so the worst first is the
  // lowest value first. Groups with no severity come after every graded one, and before them in
  // the reverse ordering.
  private static final String SEVERITY_WORST_FIRST = "MIN(i.severity) IS NULL, MIN(i.severity) ASC";
  private static final String SEVERITY_MILDEST_FIRST =
      "MIN(i.severity) IS NOT NULL, MIN(i.severity) DESC";
  private static final int TREND_BUCKET_COUNT = 8;
  // A record range that holds every record, for listings whose range applies to the incidents.
  // Boxed, as a listing without a range passes null bounds through the same expression.
  private static final Long ALL_RECORDS_START_TS = 0L;
  private static final Long ALL_RECORDS_END_TS = Long.MAX_VALUE;

  // Open statuses from the most actionable to the least. Shared with the query rather than
  // restated here, so the breakdown order, the statusRank expression and the set of statuses a
  // group is counted over cannot drift apart.
  private static final List<TestCaseResolutionStatusTypes> STATUS_TRIAGE_ORDER =
      CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.OPEN_STATUSES;

  // Name the owner dimension gives the group of incidents whose test cases have no owner.
  public static final String NO_OWNER_GROUP_NAME = "No Owner";

  /** Group-by field of the latest-status-per-test-case incident listings. */
  public static final String LATEST_PER_TEST_CASE = "testCase.fullyQualifiedName.keyword";

  private static final UnaryOperator<String> USER_FQN_NAME = name -> name.toLowerCase(Locale.ROOT);

  // An incident's test case, and the asset that test case belongs to, never change.
  private static final Set<String> TEST_CASE_INVARIANT_PARAMS =
      Set.of("testCaseFqn", "originEntityFQN");

  /**
   * Incident timestamp a date range applies to. Each value is also the name of the {@code
   * test_case_incident} column holding that timestamp.
   */
  public enum IncidentDateField {
    CREATED_AT(INCIDENT_DATE_FIELD_CREATED_AT),
    UPDATED_AT(INCIDENT_DATE_FIELD_UPDATED_AT);

    private final String value;

    IncidentDateField(String value) {
      this.value = value;
    }

    public String value() {
      return value;
    }

    // Query params bind through toString, so it is the API value rather than the constant name.
    @Override
    public String toString() {
      return value;
    }

    public static IncidentDateField fromValue(String value) {
      return Arrays.stream(values())
          .filter(field -> field.value.equals(value))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      String.format(
                          "Invalid dateField '%s'. Must be one of %s",
                          value, Arrays.toString(values()))));
    }
  }

  /** What the incident groups are ordered by. */
  public enum IncidentGroupSortField {
    INCIDENT_COUNT(INCIDENT_GROUP_SORT_FIELD_INCIDENT_COUNT),
    SEVERITY(INCIDENT_GROUP_SORT_FIELD_SEVERITY),
    LAST_SEEN(INCIDENT_GROUP_SORT_FIELD_LAST_SEEN);

    private final String value;

    IncidentGroupSortField(String value) {
      this.value = value;
    }

    // Query params bind through toString, so it is the API value rather than the constant name.
    @Override
    public String toString() {
      return value;
    }
  }

  /** A flat incident listing's range, and the incident timestamp it applies to if any. */
  public record IncidentListRange(IncidentDateField dateField, Long startTs, Long endTs) {}

  public TestCaseResolutionStatusRepository() {
    super(
        TestCaseResolutionStatusResource.COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao(),
        TestCaseResolutionStatus.class,
        Entity.TEST_CASE_RESOLUTION_STATUS);
  }

  @Override
  protected Set<String> getGroupInvariantParams(String groupBy) {
    return LATEST_PER_TEST_CASE.equals(groupBy) ? TEST_CASE_INVARIANT_PARAMS : Set.of();
  }

  // {@code testSuites} stays on the exclude list to scrub legacy docs written before the
  // SearchRepository inheritable-field refactor stopped propagating testCase.testSuites onto
  // child TCRS docs. The field is absent from the {@link TestCaseResolutionStatus} schema
  // ({@code additionalProperties: false}), so any surviving polluted source would otherwise
  // 400 strict Jackson deserialization on /testCaseIncidentStatus/search/list.
  @Override
  protected List<String> getExcludeSearchFields() {
    return List.of("@timestamp", "domains", "testCase", "testSuite", "testSuites", "fqnParts");
  }

  // The {@code latest=false} listing path skips client-side {@code extractAndFilterSource} and
  // feeds the raw ES hit straight into strict deserialization, so the full set of non-schema
  // search fields must be pushed into the {@code _source.exclude} of the query itself — matching
  // exactly what the {@code latest=true} path strips client-side. Excluding only {@code testSuites}
  // leaves {@code @timestamp}, {@code domains}, {@code testCase}, and {@code testSuite} in the
  // source, each of which 400s strict Jackson in turn.
  @Override
  protected void setExcludeSearchFields(SearchListFilter searchListFilter) {
    String existingExcludeFields = searchListFilter.getQueryParam("excludeFields");
    String scrubFields = String.join(",", getExcludeSearchFields());
    String mergedExcludeFields =
        nullOrEmpty(existingExcludeFields)
            ? scrubFields
            : existingExcludeFields + "," + scrubFields;
    searchListFilter.addQueryParam("excludeFields", mergedExcludeFields);
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
      if (resolveTestCaseReference(testCaseResolutionStatus)) {
        testCaseResolutionStatuses.add(testCaseResolutionStatus);
      }
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
    syncIncidentSeverity(updated);
    setInheritedFields(updated);
    postUpdate(updated);
    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, ENTITY_UPDATED);
  }

  // The incident groups read severity off the denormalized incident row, which is only written
  // when a record is created; a severity edited afterwards has to be carried over by hand.
  private void syncIncidentSeverity(TestCaseResolutionStatus record) {
    if (record.getStateId() != null) {
      ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
          .updateIncidentSeverity(
              record.getStateId().toString(),
              record.getId().toString(),
              record.getSeverity() != null ? record.getSeverity().value() : null);
    }
  }

  /**
   * Applies one entry of a bulk status change. An entry that keeps the open incident's status as
   * it is only edits its severity; one that would change nothing at all — or that sends an open
   * incident back to New, which the status flow ignores — is rejected, so the bulk result reports
   * it instead of counting it as applied.
   */
  public void applyBulkStatus(TestCaseResolutionStatus incoming, String testCaseFqn) {
    TestCaseResolutionStatus latest = getLatestRecord(testCaseFqn);
    boolean isOpen = Boolean.TRUE.equals(unresolvedIncident(latest));
    if (isOpen && isSameStatus(incoming, latest)) {
      if (incoming.getSeverity() == null || incoming.getSeverity() == latest.getSeverity()) {
        throw new IllegalArgumentException(
            String.format(
                "Incident is already %s", latest.getTestCaseResolutionStatusType().value()));
      }
      updateSeverity(latest, incoming.getSeverity(), incoming.getUpdatedBy());
    } else if (isOpen
        && incoming.getTestCaseResolutionStatusType() == TestCaseResolutionStatusTypes.New) {
      throw new IllegalArgumentException("An open incident cannot be moved back to New");
    } else {
      createNewRecord(incoming, testCaseFqn);
    }
  }

  private static boolean isSameStatus(
      TestCaseResolutionStatus incoming, TestCaseResolutionStatus latest) {
    return incoming.getTestCaseResolutionStatusType() == latest.getTestCaseResolutionStatusType()
        && isSameAssignee(extractAssignee(incoming), extractAssignee(latest));
  }

  // A request may name its assignee by id alone, while the stored record carries both.
  private static boolean isSameAssignee(EntityReference incoming, EntityReference stored) {
    if (incoming == null || stored == null) {
      return incoming == stored;
    }
    return incoming.getId() != null
        ? incoming.getId().equals(stored.getId())
        : Objects.equals(incoming.getName(), stored.getName());
  }

  // Same write as a PATCH of the severity: the stored record, without its inherited test case.
  private void updateSeverity(
      TestCaseResolutionStatus latest, Severity severity, EntityReference updatedBy) {
    TestCaseResolutionStatus stored =
        JsonUtils.readValue(timeSeriesDao.getById(latest.getId()), entityClass);
    stored
        .withSeverity(severity)
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(updatedBy);
    timeSeriesDao.update(JsonUtils.pojoToJson(stored), stored.getId());
    syncIncidentSeverity(stored);
    setInheritedFields(stored);
    postUpdate(stored);
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

  /** StateId of the test case's ongoing incident: latest unresolved record, or null if resolved. */
  public UUID getOngoingIncidentStateId(String testCaseFqn) {
    TestCaseResolutionStatus latest = getLatestRecord(testCaseFqn);
    return Boolean.TRUE.equals(unresolvedIncident(latest)) ? latest.getStateId() : null;
  }

  private static boolean isReopeningStatus(TestCaseResolutionStatus recordEntity) {
    TestCaseResolutionStatusTypes statusType = recordEntity.getTestCaseResolutionStatusType();
    return statusType == TestCaseResolutionStatusTypes.Ack
        || statusType == TestCaseResolutionStatusTypes.Assigned
        || statusType == TestCaseResolutionStatusTypes.Resolved;
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
      // the old severity; same for the denormalized failure summary so the chain's latest record
      // never loses the failure reason on a status transition.
      recordEntity.setSeverity(
          recordEntity.getSeverity() == null
              ? lastIncident.getSeverity()
              : recordEntity.getSeverity());
      recordEntity.setFailureSummary(
          recordEntity.getFailureSummary() == null
              ? lastIncident.getFailureSummary()
              : recordEntity.getFailureSummary());
    } else if (lastIncident != null && isReopeningStatus(recordEntity)) {
      // Ack/Assigned/Resolved after a Resolved incident reopens it: reuse the stateId, severity,
      // and failure summary so the timeline stays contiguous. New is excluded — a new failure
      // starts a fresh incident.
      recordEntity.setStateId(lastIncident.getStateId());
      recordEntity.setSeverity(
          recordEntity.getSeverity() == null
              ? lastIncident.getSeverity()
              : recordEntity.getSeverity());
      recordEntity.setFailureSummary(
          recordEntity.getFailureSummary() == null
              ? lastIncident.getFailureSummary()
              : recordEntity.getFailureSummary());
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
        // Bridge legacy TCRS status writes onto the task-first incident workflow so existing
        // clients keep working while Task remains the source of truth.
        if (applyLegacyStatusToIncidentTask(recordEntity, recordFQN)) {
          return;
        }
      }
      case Resolved -> {
        // Bridge legacy TCRS status writes onto the task-first incident workflow so existing
        // clients keep working while Task remains the source of truth.
        if (applyLegacyStatusToIncidentTask(recordEntity, recordFQN)) {
          return;
        }
      }
      default -> throw new IllegalArgumentException(
          String.format("Invalid status %s", recordEntity.getTestCaseResolutionStatusType()));
    }
    persistRecord(recordFQN, recordEntity);
  }

  private void persistRecord(String recordFQN, TestCaseResolutionStatus recordEntity) {
    EntityReference testCaseReference = recordEntity.getTestCaseReference();
    recordEntity.withTestCaseReference(null);
    String recordJson = JsonUtils.pojoToJson(recordEntity);
    recordEntity.withTestCaseReference(testCaseReference);
    DeadlockRetry.execute(
        () ->
            Entity.getJdbi()
                .inTransaction(
                    handle -> {
                      timeSeriesDao.insert(recordFQN, entityType, recordJson);
                      ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
                          .upsertIncident(
                              recordEntity.getStateId().toString(),
                              recordFQN,
                              recordEntity.getTestCaseResolutionStatusType().value(),
                              extractAssigneeName(recordEntity),
                              recordEntity.getSeverity() != null
                                  ? recordEntity.getSeverity().value()
                                  : null,
                              recordEntity.getTimestamp(),
                              recordEntity.getId().toString());
                      storeRelationship(recordEntity);
                      return null;
                    }));
  }

  // The PARENT_OF relationship is written inside persistRecord's transaction. The base
  // createNewRecord's post-insert hook must not insert it a second time
  @Override
  protected void storeRelationshipInternal(TestCaseResolutionStatus recordEntity) {
    // Relationship persisted atomically in persistRecord.
  }

  private static String extractAssigneeName(TestCaseResolutionStatus recordEntity) {
    EntityReference assignee = extractAssignee(recordEntity);
    return assignee != null ? assignee.getName() : null;
  }

  private static EntityReference extractAssignee(TestCaseResolutionStatus recordEntity) {
    if (recordEntity.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Assigned
        || recordEntity.getTestCaseResolutionStatusDetails() == null) {
      return null;
    }
    Assigned assigned =
        JsonUtils.convertValue(recordEntity.getTestCaseResolutionStatusDetails(), Assigned.class);
    return assigned != null ? assigned.getAssignee() : null;
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

  /**
   * Resolves the parent test case reference, returning false for orphaned rows whose parentOf
   * relationship no longer exists. Such rows are skipped rather than failing the whole request; the
   * DataRetention job removes them.
   */
  private boolean resolveTestCaseReference(TestCaseResolutionStatus recordEntity) {
    boolean resolved = true;
    try {
      setInheritedFields(recordEntity);
    } catch (RuntimeException exception) {
      if (!shouldSkipSearchResultOnInheritedFieldError(exception, recordEntity)) {
        throw exception;
      }
      LOG.warn(
          "Skipping orphaned testCaseResolutionStatus {} with no parent test case relationship",
          recordEntity.getId());
      resolved = false;
    }
    return resolved;
  }

  @Override
  protected boolean shouldSkipSearchResultOnInheritedFieldError(
      RuntimeException exception, TestCaseResolutionStatus entity) {
    if (exception instanceof EntityNotFoundException) {
      return true;
    }

    String message = exception.getMessage();
    return message != null
        && message.contains(Entity.TEST_CASE_RESOLUTION_STATUS)
        && message.contains(Relationship.PARENT_OF.value());
  }

  /**
   * Bridge a legacy-style {@link TestCaseResolutionStatus} onto the task-first incident workflow,
   * advancing the workflow task to match the recorded status. Used by {@link #storeInternal} on
   * live Ack/Assigned/Resolved writes so existing TCRS clients keep working while Task remains the
   * source of truth. Idempotent: {@link #resolveLegacyTransitionId} returns null (no-op) when the
   * task is already at the target stage.
   */
  public boolean applyLegacyStatusToIncidentTask(
      TestCaseResolutionStatus recordEntity, String recordFQN) {
    Task incidentTask = findIncidentTaskForLegacyStatus(recordEntity, recordFQN);
    if (incidentTask == null) {
      LOG.debug(
          "No workflow-managed incident task found for legacy status {} on {}. Falling back to direct TCRS insert.",
          recordEntity.getTestCaseResolutionStatusType(),
          recordFQN);
      return false;
    }

    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task task =
        taskRepository.get(
            null,
            incidentTask.getId(),
            taskRepository.getFields(
                "assignees,reviewers,watchers,about,domains,comments,createdBy,payload,resolution,availableTransitions"));

    if (TaskRepository.isTerminalStatus(task.getStatus())
        && recordEntity.getTestCaseResolutionStatusType()
            != TestCaseResolutionStatusTypes.Resolved) {
      // Ack/Assigned on a resolved incident reopens it: same task/stateId, workflow restarted.
      String reopeningUser =
          recordEntity.getUpdatedBy() != null ? recordEntity.getUpdatedBy().getName() : null;
      try {
        task = taskRepository.reopenTaskWithWorkflow(task, reopeningUser);
      } catch (Exception e) {
        LOG.error("Failed to reopen incident task {} for {}", task.getId(), recordFQN, e);
        if (e instanceof RuntimeException) {
          throw (RuntimeException) e;
        }
        throw new RuntimeException(e);
      }
    }

    String transitionId = resolveLegacyTransitionId(task, recordEntity);
    if (transitionId == null) {
      LOG.debug(
          "Skipping legacy status {} for incident task {} already at stage {}",
          recordEntity.getTestCaseResolutionStatusType(),
          task.getId(),
          task.getWorkflowStageId());
      return true;
    }

    TaskResolutionType resolutionType =
        recordEntity.getTestCaseResolutionStatusType() == TestCaseResolutionStatusTypes.Resolved
            ? TaskResolutionType.Completed
            : null;
    Object resolvedPayload = buildLegacyResolvedPayload(recordEntity);
    String comment = extractLegacyResolutionComment(recordEntity);

    taskRepository.resolveTaskWithWorkflow(
        task,
        transitionId,
        resolutionType,
        null,
        resolvedPayload,
        comment,
        recordEntity.getUpdatedBy() != null ? recordEntity.getUpdatedBy().getName() : null);

    LOG.info(
        "Applied legacy incident status {} to task {} using transition {}",
        recordEntity.getTestCaseResolutionStatusType(),
        task.getId(),
        transitionId);
    return true;
  }

  private Task findIncidentTaskForLegacyStatus(
      TestCaseResolutionStatus recordEntity, String recordFQN) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    UUID stateId = recordEntity.getStateId();
    if (stateId != null) {
      try {
        // `about` is relationship-backed and stripped from stored JSON — request it explicitly,
        // or a bare find() leaves it null and the FQN guard below never matches.
        Task task =
            taskRepository.get(
                null, stateId, taskRepository.getFields("about"), Include.ALL, false);
        if (task != null
            && !Boolean.TRUE.equals(task.getDeleted())
            && task.getType() == TaskEntityType.TestCaseResolution
            && task.getAbout() != null
            && recordFQN.equals(task.getAbout().getFullyQualifiedName())) {
          return task;
        }
      } catch (EntityNotFoundException ignored) {
        // Fall through to lookup by entity/type.
      }
    }

    return taskRepository.findOpenTaskByEntityAndType(recordFQN, TaskEntityType.TestCaseResolution);
  }

  private String resolveLegacyTransitionId(Task task, TestCaseResolutionStatus recordEntity) {
    return switch (recordEntity.getTestCaseResolutionStatusType()) {
      case Ack -> "ack".equals(task.getWorkflowStageId()) ? null : "ack";
      case Assigned -> "assigned".equals(task.getWorkflowStageId()) ? "reassign" : "assign";
      case Resolved -> TaskEntityStatus.Completed == task.getStatus() ? null : "resolve";
      default -> null;
    };
  }

  private Object buildLegacyResolvedPayload(TestCaseResolutionStatus recordEntity) {
    if (recordEntity.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Resolved) {
      if (recordEntity.getTestCaseResolutionStatusType()
          == TestCaseResolutionStatusTypes.Assigned) {
        Assigned assigned =
            JsonUtils.convertValue(
                recordEntity.getTestCaseResolutionStatusDetails(), Assigned.class);
        if (assigned == null || assigned.getAssignee() == null) {
          return null;
        }
        return Map.of("assignees", List.of(assigned.getAssignee()));
      }
      return null;
    }

    Resolved resolved =
        JsonUtils.convertValue(recordEntity.getTestCaseResolutionStatusDetails(), Resolved.class);
    if (resolved == null || resolved.getTestCaseFailureReason() == null) {
      return null;
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("testCaseFailureReason", resolved.getTestCaseFailureReason().value());
    return payload;
  }

  private String extractLegacyResolutionComment(TestCaseResolutionStatus recordEntity) {
    if (recordEntity.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Resolved) {
      return null;
    }

    Resolved resolved =
        JsonUtils.convertValue(recordEntity.getTestCaseResolutionStatusDetails(), Resolved.class);
    return resolved != null ? resolved.getTestCaseFailureComment() : null;
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

  protected static UUID getOrCreateIncident(
      TestCase testCase, String updatedBy, String failureReason) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    Task existing =
        taskRepository.findTaskByEntityTypeAndStatuses(
            testCase.getFullyQualifiedName(),
            TaskEntityType.TestCaseResolution,
            TaskRepository.OPEN_TASK_STATUSES);
    if (existing != null) {
      return existing.getId();
    }

    return createIncidentTask(testCase, updatedBy, failureReason);
  }

  private static UUID createIncidentTask(
      TestCase testCase, String updatedBy, String failureReason) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    TestCase fullTestCase =
        Entity.getEntityByName(
            Entity.TEST_CASE, testCase.getFullyQualifiedName(), "owners,domains", Include.ALL);

    EntityReference updatedByRef = getEntityReferenceByName(Entity.USER, updatedBy, Include.ALL);

    List<EntityReference> assignees =
        !nullOrEmpty(fullTestCase.getOwners()) ? fullTestCase.getOwners() : List.of();
    UUID taskId = UUID.randomUUID();

    Task task =
        new Task()
            .withId(taskId)
            .withName("Incident: " + fullTestCase.getName())
            .withDisplayName("Test Case Incident - " + fullTestCase.getDisplayName())
            .withDescription("New incident for test case: " + fullTestCase.getFullyQualifiedName())
            .withCategory(TaskCategory.Incident)
            .withType(TaskEntityType.TestCaseResolution)
            .withStatus(TaskEntityStatus.Open)
            .withAbout(fullTestCase.getEntityReference())
            .withPayload(
                new TestCaseResolutionPayload()
                    .withTestCaseResolutionStatusId(taskId)
                    .withFailureReason(failureReason))
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
    advanceAutoAssignedIncident(taskRepository, task.getId(), assignees, updatedBy);
    return task.getId();
  }

  /**
   * Moves an incident that was auto-assigned from the test case owners out of the workflow's {@code
   * new} stage and into {@code assigned}, by driving the same {@code assign} transition a manual
   * assignment uses.
   *
   * <p>Without this the incident stays in {@code New}, and because the TCRS mirror only carries
   * assignee details on {@code Assigned} records, the Incident Manager renders it as unassigned even
   * though the task itself has assignees.
   */
  private static void advanceAutoAssignedIncident(
      TaskRepository taskRepository,
      UUID taskId,
      List<EntityReference> assignees,
      String updatedBy) {
    if (!nullOrEmpty(assignees)) {
      try {
        Task current = taskRepository.get(null, taskId, taskRepository.getFields("*"));
        if (canAdvanceToAssignedStage(current)) {
          taskRepository.resolveTaskWithWorkflow(
              current,
              IncidentWorkflowStages.ASSIGN_TRANSITION_ID,
              null,
              null,
              null,
              null,
              updatedBy);
          LOG.info("Incident task {} auto-advanced to the assigned stage", taskId);
        } else {
          LOG.warn(
              "Incident task {} has assignees but sits at stage '{}' instead of '{}'; it stays New and renders as unassigned",
              taskId,
              current.getWorkflowStageId(),
              IncidentWorkflowStages.NEW_STAGE_ID);
        }
      } catch (Exception e) {
        // Best effort: an incident that fails to advance is still a usable incident sitting in
        // New, so never fail test result ingestion over it.
        LOG.warn("Failed to auto-advance incident task {} to the assigned stage", taskId, e);
      }
    }
  }

  private static boolean canAdvanceToAssignedStage(Task task) {
    return IncidentWorkflowStages.NEW_STAGE_ID.equals(task.getWorkflowStageId())
        && TaskWorkflowLifecycleResolver.findTransition(
                task, IncidentWorkflowStages.ASSIGN_TRANSITION_ID)
            != null;
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

    // Inherit severity and failure summary from the previous record for this stateId if the
    // caller didn't set them (e.g. tasks created before the payload carried a failure reason)
    if ((recordEntity.getSeverity() == null || recordEntity.getFailureSummary() == null)
        && recordEntity.getStateId() != null) {
      TestCaseResolutionStatus priorForStateId =
          getLatestRecordForStateId(recordEntity.getStateId());
      if (priorForStateId != null) {
        if (recordEntity.getSeverity() == null && priorForStateId.getSeverity() != null) {
          recordEntity.setSeverity(priorForStateId.getSeverity());
        }
        if (recordEntity.getFailureSummary() == null
            && priorForStateId.getFailureSummary() != null) {
          recordEntity.setFailureSummary(priorForStateId.getFailureSummary());
        }
      }
    }

    setResolutionMetrics(lastIncident, recordEntity);
    inferIncidentSeverity(recordEntity);

    LOG.debug(
        "[TCRS Sync] Inserting record: status={}, stateId={}, testCase={}",
        recordEntity.getTestCaseResolutionStatusType(),
        recordEntity.getStateId(),
        recordFQN);

    persistRecord(recordFQN, recordEntity);
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

  /**
   * The flat incident listing. With a date field the range applies to the incidents themselves, the
   * way the groups apply it, so the records are no longer filtered by their own timestamp. The
   * record range is opened up rather than dropped: {@code latest} is only honoured over a range.
   */
  public ResultList<TestCaseResolutionStatus> listIncidentRecords(
      String offset, int limit, ListFilter filter, boolean latest, IncidentListRange range) {
    boolean isIncidentRange = range.dateField() != null;
    if (isIncidentRange) {
      addIncidentListRange(filter, range);
    }
    return list(
        offset,
        isIncidentRange ? ALL_RECORDS_START_TS : range.startTs(),
        isIncidentRange ? ALL_RECORDS_END_TS : range.endTs(),
        limit,
        filter,
        latest);
  }

  private static void addIncidentListRange(ListFilter filter, IncidentListRange range) {
    filter.addQueryParam("incidentListDateField", range.dateField().value());
    if (range.startTs() != null) {
      filter.addQueryParam("incidentListStartTs", String.valueOf(range.startTs()));
    }
    if (range.endTs() != null) {
      filter.addQueryParam("incidentListEndTs", String.valueOf(range.endTs()));
    }
  }

  /**
   * Scopes the flat incident listing to the test cases a user or team owns directly, or to those
   * nobody owns — the owner dimension's "No Owner" group.
   */
  public void addTestCaseOwnerFilter(ListFilter filter, String owner, boolean unowned) {
    if (unowned && !nullOrEmpty(owner)) {
      throw new IllegalArgumentException("`owner` and `unowned` cannot be combined");
    }
    UUID ownerId = resolveOwnerFilterId(owner);
    if (ownerId != null) {
      filter.addQueryParam("testCaseOwnerId", ownerId.toString());
    }
    if (unowned) {
      filter.addQueryParam("testCaseUnowned", Boolean.TRUE.toString());
    }
  }

  public static UUID resolveFilterEntityId(String entityType, String name) {
    UUID entityId = null;
    if (!nullOrEmpty(name)) {
      EntityReference result = getEntityReferenceByName(entityType, name, Include.NON_DELETED);
      if (!nullOrEmpty(result)) {
        entityId = result.getId();
      }
    }
    return entityId;
  }

  private static UUID resolveOwnerFilterId(String owner) {
    UUID result = null;
    if (!nullOrEmpty(owner)) {
      try {
        result = resolveFilterEntityId(Entity.USER, owner);
      } catch (EntityNotFoundException e) {
        result = resolveFilterEntityId(Entity.TEAM, owner);
      }
    }
    return result;
  }

  public ResultList<TestCaseIncidentGroup> listIncidentGroups(
      IncidentGroupBy groupBy,
      ListFilter filter,
      IncidentGroupSortField sortField,
      String sortType,
      int limit,
      String offset) {
    int offsetInt = getOffset(offset);
    IncidentGroupPage page =
        ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
            .listIncidentGroups(
                groupBy, filter, incidentGroupOrderBy(sortField, sortType), limit, offsetInt);
    return new ResultList<>(
        toIncidentGroups(groupBy, page),
        getBeforeOffset(offsetInt, limit),
        getAfterOffset(offsetInt, limit, page.total()),
        page.total());
  }

  // The ordering is rendered into the SQL, so it is spelled out here from fixed strings and never
  // taken from the request. Ties under severity or last seen fall back to the larger group first.
  private static String incidentGroupOrderBy(IncidentGroupSortField sortField, String sortType) {
    String direction = incidentGroupSortOrder(sortType);
    String severityOrder =
        SQL_DESCENDING.equals(direction) ? SEVERITY_WORST_FIRST : SEVERITY_MILDEST_FIRST;
    return switch (sortField) {
      case INCIDENT_COUNT -> INCIDENT_COUNT_COLUMN + " " + direction;
      case SEVERITY -> String.join(", ", severityOrder, LARGER_GROUP_FIRST);
      case LAST_SEEN -> String.join(", ", LAST_SEEN_EXPR + " " + direction, LARGER_GROUP_FIRST);
    };
  }

  private static List<TestCaseIncidentGroup> toIncidentGroups(
      IncidentGroupBy groupBy, IncidentGroupPage page) {
    IncidentGroupReferences references = resolveIncidentGroupReferences(page);
    return page.counts().stream()
        .map(
            count ->
                withRelatedEntities(
                    toIncidentGroup(
                        groupBy,
                        count,
                        parseIncidentCreatedAt(count),
                        references.groups().get(count.groupKey())),
                    count,
                    page,
                    references))
        .toList();
  }

  // The entities a page of groups names, each looked up once for the whole page.
  private record IncidentGroupReferences(
      Map<String, EntityReference> groups,
      Map<String, EntityReference> tables,
      Map<String, EntityReference> assignees,
      Map<String, EntityReference> testDefinitions) {}

  private static IncidentGroupReferences resolveIncidentGroupReferences(IncidentGroupPage page) {
    return new IncidentGroupReferences(
        resolveIncidentGroupEntities(page.counts()),
        findReferences(Entity.TABLE, relatedKeys(page.tables())),
        findAssignees(
            page.counts().stream()
                .flatMap(count -> parseAssignees(count.assignees()).stream())
                .collect(Collectors.toSet())),
        findReferences(Entity.TEST_DEFINITION, relatedKeys(page.testDefinitions())));
  }

  private static Set<String> relatedKeys(Map<String, List<String>> keysByGroup) {
    return keysByGroup.values().stream().flatMap(List::stream).collect(Collectors.toSet());
  }

  private static TestCaseIncidentGroup withRelatedEntities(
      TestCaseIncidentGroup group,
      CollectionDAO.TestCaseIncidentGroupCount count,
      IncidentGroupPage page,
      IncidentGroupReferences references) {
    List<String> testDefinitionIds =
        page.testDefinitions().getOrDefault(count.groupKey(), List.of());
    return group
        .withAssigneeReferences(
            knownReferences(parseAssignees(count.assignees()), references.assignees()))
        .withTableCount(count.tableCount())
        .withTables(
            relatedTables(page.tables().getOrDefault(count.groupKey(), List.of()), references))
        .withTestDefinitionCount(count.testDefinitionCount())
        .withTestDefinitions(knownReferences(testDefinitionIds, references.testDefinitions()));
  }

  private static List<EntityReference> knownReferences(
      List<String> keys, Map<String, EntityReference> references) {
    return keys.stream().map(references::get).filter(Objects::nonNull).toList();
  }

  private static String incidentGroupSortOrder(String sortType) {
    return switch (sortType == null ? INCIDENT_SORT_TYPE_DESC : sortType) {
      case INCIDENT_SORT_TYPE_ASC -> SQL_ASCENDING;
      case INCIDENT_SORT_TYPE_DESC -> SQL_DESCENDING;
      default -> throw new IllegalArgumentException(
          String.format(
              "Invalid sortType '%s'. Must be one of [%s, %s]",
              sortType, INCIDENT_SORT_TYPE_ASC, INCIDENT_SORT_TYPE_DESC));
    };
  }

  private static TestCaseIncidentGroup toIncidentGroup(
      IncidentGroupBy groupBy,
      CollectionDAO.TestCaseIncidentGroupCount count,
      List<Long> incidentCreatedAt,
      EntityReference reference) {
    TestCaseIncidentGroup group =
        new TestCaseIncidentGroup()
            .withGroupBy(groupBy)
            .withIncidentCount(count.incidentCount())
            .withStatus(statusFromRank(count.statusRank()))
            .withStatusCounts(statusCounts(count))
            .withAssigneeCount(count.assigneeCount())
            .withFirstSeen(count.firstSeen())
            .withLastSeen(count.lastSeen());
    if (count.severity() != null) {
      group.withSeverity(Severity.fromValue(count.severity()));
    }
    List<String> assignees = parseAssignees(count.assignees());
    if (!assignees.isEmpty()) {
      group.withAssignees(assignees);
    }
    setIncidentTrend(group, incidentCreatedAt);
    if (reference != null) {
      group
          .withId(reference.getId())
          .withName(reference.getName())
          .withDisplayName(reference.getDisplayName())
          .withFullyQualifiedName(reference.getFullyQualifiedName());
    } else {
      setFallbackIncidentGroupIdentity(group, count);
    }
    return group;
  }

  private static List<String> parseAssignees(String assigneesJson) {
    List<String> result = List.of();
    if (!nullOrEmpty(assigneesJson)) {
      result =
          Arrays.stream(JsonUtils.readValue(assigneesJson, String[].class))
              .filter(assignee -> !nullOrEmpty(assignee))
              .distinct()
              .toList();
    }
    return result;
  }

  private static List<Long> parseIncidentCreatedAt(CollectionDAO.TestCaseIncidentGroupCount count) {
    List<Long> result = List.of();
    if (!nullOrEmpty(count.incidentCreatedAt())) {
      result = Arrays.asList(JsonUtils.readValue(count.incidentCreatedAt(), Long[].class));
    }
    return result;
  }

  // The group's open incidents split across the statuses they currently sit in, ordered the way
  // the triage order ranks them. A status no incident is in is left out rather than reported as a
  // zero, so the breakdown only ever names statuses that are actually occupied.
  private static List<IncidentStatusCount> statusCounts(
      CollectionDAO.TestCaseIncidentGroupCount count) {
    return STATUS_TRIAGE_ORDER.stream()
        .filter(status -> count.statusCounts().getOrDefault(status.value(), 0) > 0)
        .map(
            status ->
                new IncidentStatusCount()
                    .withStatus(status)
                    .withCount(count.statusCounts().get(status.value())))
        .toList();
  }

  // The query ranks a group by the 1-based position of its most actionable status in the triage
  // order; anything past the end falls to the least actionable one, as the old CASE default did.
  private static TestCaseResolutionStatusTypes statusFromRank(int statusRank) {
    int index = Math.min(Math.max(statusRank, 1), STATUS_TRIAGE_ORDER.size()) - 1;
    return STATUS_TRIAGE_ORDER.get(index);
  }

  private static void setIncidentTrend(TestCaseIncidentGroup group, List<Long> incidentCreatedAt) {
    List<Long> timestamps = listOrEmpty(incidentCreatedAt);
    if (!timestamps.isEmpty()) {
      long min = Collections.min(timestamps);
      long max = Collections.max(timestamps);
      List<Integer> buckets = bucketIncidentCreatedAt(timestamps, min, max);
      group.withTrend(buckets).withTrendDirection(trendDirection(buckets, max > min));
    }
  }

  private static List<Integer> bucketIncidentCreatedAt(List<Long> timestamps, long min, long max) {
    int[] buckets = new int[TREND_BUCKET_COUNT];
    long span = max - min;
    for (long timestamp : timestamps) {
      int bucket = span == 0 ? 0 : (int) ((timestamp - min) * TREND_BUCKET_COUNT / span);
      buckets[Math.min(bucket, TREND_BUCKET_COUNT - 1)]++;
    }
    return Arrays.stream(buckets).boxed().toList();
  }

  private static IncidentTrendDirection trendDirection(List<Integer> buckets, boolean hasSpan) {
    IncidentTrendDirection result = IncidentTrendDirection.Steady;
    if (hasSpan) {
      int half = TREND_BUCKET_COUNT / 2;
      int firstHalf = buckets.subList(0, half).stream().mapToInt(Integer::intValue).sum();
      int lastHalf =
          buckets.subList(half, TREND_BUCKET_COUNT).stream().mapToInt(Integer::intValue).sum();
      if (lastHalf > firstHalf) {
        result = IncidentTrendDirection.Rising;
      } else if (lastHalf < firstHalf) {
        result = IncidentTrendDirection.Falling;
      }
    }
    return result;
  }

  // A table can be gone while incidents raised on it are still open; it is then named after its
  // FQN, the way a table group whose table is gone is.
  private static List<EntityReference> relatedTables(
      List<String> tableFqns, IncidentGroupReferences references) {
    return tableFqns.stream()
        .map(
            fqn ->
                references
                    .tables()
                    .getOrDefault(
                        fqn,
                        new EntityReference()
                            .withType(Entity.TABLE)
                            .withName(List.of(FullyQualifiedName.split(fqn)).getLast())
                            .withFullyQualifiedName(fqn)))
        .toList();
  }

  // Tables are keyed by FQN — that is what an incident row knows them by — everything else by id.
  private static Map<String, EntityReference> findReferences(
      String entityType, Collection<String> keys) {
    Map<String, EntityReference> result = new HashMap<>();
    if (!keys.isEmpty()) {
      EntityDAO<?> entityDAO = Entity.getEntityRepository(entityType).getDao();
      if (Entity.TABLE.equals(entityType)) {
        for (EntityReference reference :
            entityDAO.findReferencesByFqns(List.copyOf(keys), Include.ALL)) {
          result.put(reference.getFullyQualifiedName(), reference);
        }
      } else {
        List<UUID> ids = keys.stream().map(UUID::fromString).toList();
        for (EntityReference reference : entityDAO.findReferencesByIds(ids, Include.ALL)) {
          result.put(reference.getId().toString(), reference);
        }
      }
    }
    return result;
  }

  // An incident row keeps only its assignee's name, which a user or a team holds. Their references
  // carry the type and display name the groups show; users are looked up first, as the incident
  // workflow assigns users far more often than teams.
  private static Map<String, EntityReference> findAssignees(Collection<String> names) {
    Map<String, EntityReference> result =
        new HashMap<>(findAssigneesByName(Entity.USER, names, USER_FQN_NAME));
    List<String> unresolved = names.stream().filter(name -> !result.containsKey(name)).toList();
    result.putAll(findAssigneesByName(Entity.TEAM, unresolved, UnaryOperator.identity()));
    return result;
  }

  // A user's FQN is its lowercased name, while a record written before assignees were resolved
  // keeps the name in the case it was sent. The references are keyed by the row's own names.
  private static Map<String, EntityReference> findAssigneesByName(
      String entityType, Collection<String> names, UnaryOperator<String> toFqnName) {
    Map<String, List<String>> namesByFqnName =
        names.stream().collect(Collectors.groupingBy(toFqnName));
    List<String> fqns =
        namesByFqnName.keySet().stream().map(FullyQualifiedName::quoteName).toList();
    Map<String, EntityReference> result = new HashMap<>();
    for (EntityReference reference :
        Entity.getEntityRepository(entityType)
            .getDao()
            .findReferencesByFqns(fqns, Include.NON_DELETED)) {
      namesByFqnName
          .getOrDefault(toFqnName.apply(reference.getName()), List.of())
          .forEach(name -> result.put(name, reference));
    }
    return result;
  }

  private static Map<String, EntityReference> resolveIncidentGroupEntities(
      List<CollectionDAO.TestCaseIncidentGroupCount> counts) {
    Map<String, EntityReference> result = new HashMap<>();
    Map<String, List<String>> keysByType =
        counts.stream()
            // The owner dimension buckets incidents whose test case has no owner under an empty
            // key; there is no entity to look that group up by.
            .filter(count -> !nullOrEmpty(count.groupKey()))
            .collect(
                Collectors.groupingBy(
                    CollectionDAO.TestCaseIncidentGroupCount::groupType,
                    Collectors.mapping(
                        CollectionDAO.TestCaseIncidentGroupCount::groupKey, Collectors.toList())));
    keysByType.forEach(
        (groupType, groupKeys) -> result.putAll(findReferences(groupType, groupKeys)));
    return result;
  }

  private static void setFallbackIncidentGroupIdentity(
      TestCaseIncidentGroup group, CollectionDAO.TestCaseIncidentGroupCount count) {
    if (nullOrEmpty(count.groupKey())) {
      // The owner dimension's catch-all bucket: real incidents on test cases nobody owns. It
      // stands for no entity, so it carries only a name.
      group.withName(NO_OWNER_GROUP_NAME);
    } else if (Entity.TABLE.equals(count.groupType())) {
      List<String> fqnParts = List.of(FullyQualifiedName.split(count.groupKey()));
      group.withName(fqnParts.getLast()).withFullyQualifiedName(count.groupKey());
    } else {
      group.withName(count.groupKey());
    }
  }
}
