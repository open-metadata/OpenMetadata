package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tasks.BulkTaskOperation;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.BulkTaskOperationParams;
import org.openmetadata.schema.type.BulkTaskOperationResult;
import org.openmetadata.schema.type.BulkTaskOperationType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.DescriptionUpdatePayload;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A task lifecycle change (resolve, close, reopen, workflow transition) records exactly one
 * {@code entityUpdated} change event whose diff names the status and resolution change, whichever
 * caller made it: the REST API, a bulk operation, the legacy incident status API or an automatic
 * close.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TaskChangeEventIT {

  private static final String EVENTS_PATH = "/v1/events";
  private static final Duration EVENT_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration QUIET_PERIOD = Duration.ofSeconds(5);
  private static final String STATUS = "status";
  private static final String RESOLUTION = "resolution";
  private static final String COMMENTS = "comments";
  private static final String NEW_STAGE = "new";

  @Test
  void resolvingAWorkflowTaskRecordsItsStatusAndResolution(TestNamespace ns) throws Exception {
    Table table = createTable(ns);
    long createdAt = System.currentTimeMillis();
    Task task = client().tasks().create(descriptionUpdateTask(ns, table));
    awaitWorkflowBound(task.getId());
    assertUpdatedEventCount(task.getId(), createdAt, 0);

    long resolvedAt = System.currentTimeMillis();
    client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withResolutionType(TaskResolutionType.Approved)
                .withNewValue("approved description"));

    ChangeEvent event = awaitUpdatedEvents(task.getId(), resolvedAt, 1).getFirst();
    assertStatusChange(event, TaskEntityStatus.Open, TaskEntityStatus.Approved);
    assertTrue(names(event.getChangeDescription().getFieldsAdded()).contains(RESOLUTION));
    assertTrue(event.getCurrentVersion() > event.getPreviousVersion());
  }

  @Test
  void closingATaskRecordsItsCancellation(TestNamespace ns) throws Exception {
    Task task = client().tasks().create(standaloneTask(ns, "close"));

    long closedAt = System.currentTimeMillis();
    client().tasks().close(task.getId().toString(), "no longer needed");

    ChangeEvent event = awaitUpdatedEvents(task.getId(), closedAt, 1).getFirst();
    assertStatusChange(event, TaskEntityStatus.Open, TaskEntityStatus.Cancelled);
    assertTrue(names(event.getChangeDescription().getFieldsAdded()).contains(RESOLUTION));
  }

  @Test
  void resolvingACommentedTaskDescribesOnlyTheResolution(TestNamespace ns) throws Exception {
    Task task = client().tasks().create(standaloneTask(ns, "comment"));
    long commentedAt = System.currentTimeMillis();
    client().tasks().addComment(task.getId().toString(), "a comment before resolving");
    awaitUpdatedEvents(task.getId(), commentedAt, 1);

    long resolvedAt = System.currentTimeMillis();
    client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withResolutionType(TaskResolutionType.Approved));

    ChangeEvent event = awaitUpdatedEvents(task.getId(), resolvedAt, 1).getFirst();
    assertFalse(allNames(event.getChangeDescription()).contains(COMMENTS));
    assertStatusChange(event, TaskEntityStatus.Open, TaskEntityStatus.Approved);
    Task storedVersion =
        client().tasks().getVersion(task.getId().toString(), event.getCurrentVersion());
    assertEquals(
        allNames(event.getChangeDescription()), allNames(storedVersion.getChangeDescription()));
  }

  @Test
  void bulkOperationsRecordOneEventPerTask(TestNamespace ns) throws Exception {
    List<Task> cancelled = createStandaloneTasks(ns, "bulk-cancel");
    List<Task> approved = createStandaloneTasks(ns, "bulk-approve");
    List<Task> reprioritised = createStandaloneTasks(ns, "bulk-priority");

    long operatedAt = System.currentTimeMillis();
    runBulk(cancelled, BulkTaskOperationType.Cancel, new BulkTaskOperationParams());
    runBulk(approved, BulkTaskOperationType.Approve, new BulkTaskOperationParams());
    runBulk(
        reprioritised,
        BulkTaskOperationType.UpdatePriority,
        new BulkTaskOperationParams().withPriority(TaskPriority.High));

    for (Task task : cancelled) {
      assertStatusChange(
          awaitUpdatedEvents(task.getId(), operatedAt, 1).getFirst(),
          TaskEntityStatus.Open,
          TaskEntityStatus.Cancelled);
    }
    for (Task task : approved) {
      assertStatusChange(
          awaitUpdatedEvents(task.getId(), operatedAt, 1).getFirst(),
          TaskEntityStatus.Open,
          TaskEntityStatus.Approved);
    }
    for (Task task : reprioritised) {
      ChangeEvent event = awaitUpdatedEvents(task.getId(), operatedAt, 1).getFirst();
      assertTrue(names(event.getChangeDescription().getFieldsUpdated()).contains("priority"));
    }
  }

  @Test
  void legacyIncidentStatusUpdatesRecordTaskEvents(TestNamespace ns) throws Exception {
    TestCase testCase = createTestCase(ns);
    Task incident = openIncident(testCase);

    long ackedAt = System.currentTimeMillis();
    createIncidentStatus(testCase, TestCaseResolutionStatusTypes.Ack);
    assertStatusChange(
        awaitUpdatedEvents(incident.getId(), ackedAt, 1).getFirst(),
        TaskEntityStatus.Open,
        TaskEntityStatus.InProgress);

    long resolvedAt = System.currentTimeMillis();
    createResolvedIncidentStatus(testCase);
    ChangeEvent resolution = awaitUpdatedEvents(incident.getId(), resolvedAt, 1).getFirst();
    assertStatusChange(resolution, TaskEntityStatus.InProgress, TaskEntityStatus.Completed);

    long reopenedAt = System.currentTimeMillis();
    createIncidentStatus(testCase, TestCaseResolutionStatusTypes.Ack);
    List<ChangeEvent> reopenAndAck = awaitUpdatedEvents(incident.getId(), reopenedAt, 2);
    ChangeEvent reopen = eventWithNewStatus(reopenAndAck, TaskEntityStatus.Open);
    assertStatusChange(reopen, TaskEntityStatus.Completed, TaskEntityStatus.Open);
    assertTrue(names(reopen.getChangeDescription().getFieldsDeleted()).contains(RESOLUTION));
    assertNotNull(eventWithNewStatus(reopenAndAck, TaskEntityStatus.InProgress));
  }

  @Test
  void nonTerminalTransitionOverRestRecordsOneEvent(TestNamespace ns) throws Exception {
    Task incident = openIncident(createTestCase(ns));

    long ackedAt = System.currentTimeMillis();
    client()
        .tasks()
        .resolve(incident.getId().toString(), new ResolveTask().withTransitionId("ack"));

    assertStatusChange(
        awaitUpdatedEvents(incident.getId(), ackedAt, 1).getFirst(),
        TaskEntityStatus.Open,
        TaskEntityStatus.InProgress);
  }

  @Test
  void autoClosingAnIncidentRecordsItsResolution(TestNamespace ns) throws Exception {
    TestCase testCase = createTestCase(ns);
    enableAutoCloseIncident(testCase);
    Task incident = openIncident(testCase);

    long closedAt = System.currentTimeMillis();
    createTestResult(testCase, TestCaseStatus.Success);

    ChangeEvent event = awaitUpdatedEvents(incident.getId(), closedAt, 1).getFirst();
    assertStatusChange(event, TaskEntityStatus.Open, TaskEntityStatus.Completed);
    assertEquals("governance-bot", event.getUserName());
  }

  // ---------------------------------------------------------------- change events

  private List<ChangeEvent> awaitUpdatedEvents(UUID taskId, long since, int expected)
      throws Exception {
    Awaitility.await("%d entityUpdated event(s) for task %s".formatted(expected, taskId))
        .atMost(EVENT_TIMEOUT)
        .pollInterval(Duration.ofMillis(500))
        .until(() -> updatedEvents(taskId, since).size() >= expected);
    assertUpdatedEventCount(taskId, since, expected);
    return updatedEvents(taskId, since);
  }

  /**
   * Keeps asserting the count for a while: events are read back asynchronously, so a single read
   * straight after the write would pass simply by being early.
   */
  private void assertUpdatedEventCount(UUID taskId, long since, int expected) {
    Awaitility.await("exactly %d entityUpdated event(s) for task %s".formatted(expected, taskId))
        .during(QUIET_PERIOD)
        .atMost(QUIET_PERIOD.plusSeconds(10))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(() -> assertEquals(expected, updatedEvents(taskId, since).size()));
  }

  private List<ChangeEvent> updatedEvents(UUID taskId, long since) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityUpdated", Entity.TASK)
            .queryParam("timestamp", Long.toString(since))
            .queryParam("limit", "1000")
            .build();
    String json =
        client().getHttpClient().executeForString(HttpMethod.GET, EVENTS_PATH, null, options);
    ListResponse<ChangeEvent> events =
        JsonUtils.readValue(json, new TypeReference<ListResponse<ChangeEvent>>() {});
    return events.getData().stream()
        .filter(event -> taskId.equals(event.getEntityId()))
        .filter(event -> event.getEventType() == EventType.ENTITY_UPDATED)
        .toList();
  }

  private static void assertStatusChange(
      ChangeEvent event, TaskEntityStatus from, TaskEntityStatus to) {
    assertNotNull(event.getChangeDescription(), "no changeDescription in " + event);
    FieldChange status =
        event.getChangeDescription().getFieldsUpdated().stream()
            .filter(change -> STATUS.equals(change.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("no status change in " + event));
    assertEquals(from.value(), String.valueOf(status.getOldValue()));
    assertEquals(to.value(), String.valueOf(status.getNewValue()));
  }

  private static ChangeEvent eventWithNewStatus(List<ChangeEvent> events, TaskEntityStatus to) {
    return events.stream()
        .filter(
            event ->
                event.getChangeDescription().getFieldsUpdated().stream()
                    .anyMatch(
                        change ->
                            STATUS.equals(change.getName())
                                && to.value().equals(String.valueOf(change.getNewValue()))))
        .findFirst()
        .orElseThrow(() -> new AssertionError("no event moving the task to " + to));
  }

  private static List<String> names(List<FieldChange> changes) {
    return changes.stream().map(FieldChange::getName).toList();
  }

  private static List<String> allNames(ChangeDescription change) {
    return List.of(
            names(change.getFieldsAdded()),
            names(change.getFieldsUpdated()),
            names(change.getFieldsDeleted()))
        .stream()
        .flatMap(List::stream)
        .sorted()
        .toList();
  }

  // ---------------------------------------------------------------- tasks

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }

  /**
   * A task with no target entity runs no workflow. Same shape as the suite's minimal task, so no
   * custom form schema another test registers for a task type can reject it.
   */
  private static CreateTask standaloneTask(TestNamespace ns, String name) {
    return new CreateTask()
        .withName(ns.prefix(name))
        .withCategory(TaskCategory.Approval)
        .withType(TaskEntityType.GlossaryApproval);
  }

  private static List<Task> createStandaloneTasks(TestNamespace ns, String name) {
    return List.of(
        client().tasks().create(standaloneTask(ns, name + "-1")),
        client().tasks().create(standaloneTask(ns, name + "-2")));
  }

  private static CreateTask descriptionUpdateTask(TestNamespace ns, Table table) {
    return new CreateTask()
        .withName(ns.prefix("description-update"))
        .withCategory(TaskCategory.MetadataUpdate)
        .withType(TaskEntityType.DescriptionUpdate)
        .withAbout("<#E::table::%s>".formatted(table.getFullyQualifiedName()))
        .withPayload(
            new DescriptionUpdatePayload()
                .withFieldPath("description")
                .withCurrentDescription(table.getDescription())
                .withNewDescription("approved description"));
  }

  private static void awaitWorkflowBound(UUID taskId) {
    Awaitility.await("task %s bound to its workflow".formatted(taskId))
        .atMost(EVENT_TIMEOUT)
        .pollInterval(Duration.ofMillis(500))
        .until(() -> client().tasks().get(taskId.toString()).getWorkflowInstanceId() != null);
  }

  private static void runBulk(
      List<Task> tasks, BulkTaskOperationType operation, BulkTaskOperationParams params) {
    BulkTaskOperation request =
        new BulkTaskOperation()
            .withTaskIds(tasks.stream().map(task -> task.getId().toString()).toList())
            .withOperation(operation)
            .withParams(params);
    BulkTaskOperationResult result =
        client()
            .getHttpClient()
            .execute(HttpMethod.POST, "/v1/tasks/bulk", request, BulkTaskOperationResult.class);
    assertEquals(tasks.size(), result.getSuccessful(), "bulk " + operation + ": " + result);
  }

  // ---------------------------------------------------------------- incidents

  /** Short names: a test case's suite FQN nests every parent name and must fit 256 characters. */
  private static Table createTable(TestNamespace ns) {
    String id = ns.uniqueShortId();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    return TableTestFactory.createSimpleWithName("tb" + id, ns, schema.getFullyQualifiedName());
  }

  private static TestCase createTestCase(TestNamespace ns) {
    return TestCaseBuilder.create(client())
        .name("tc" + ns.uniqueShortId())
        .forTable(createTable(ns))
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private static Task openIncident(TestCase testCase) {
    createTestResult(testCase, TestCaseStatus.Failed);
    AtomicReference<Task> incident = new AtomicReference<>();
    Awaitility.await("incident task for " + testCase.getFullyQualifiedName())
        .atMost(EVENT_TIMEOUT)
        .pollInterval(Duration.ofMillis(500))
        .until(() -> incidentAtNewStage(testCase, incident));
    return incident.get();
  }

  private static boolean incidentAtNewStage(TestCase testCase, AtomicReference<Task> incident) {
    UUID incidentId =
        client()
            .testCases()
            .getByName(testCase.getFullyQualifiedName(), "incidentId")
            .getIncidentId();
    if (incidentId != null) {
      incident.set(client().tasks().get(incidentId.toString()));
    }
    return incident.get() != null && NEW_STAGE.equals(incident.get().getWorkflowStageId());
  }

  private static void createTestResult(TestCase testCase, TestCaseStatus status) {
    client()
        .testCaseResults()
        .create(
            testCase.getFullyQualifiedName(),
            new CreateTestCaseResult()
                .withTimestamp(System.currentTimeMillis())
                .withTestCaseStatus(status)
                .withResult(status.value()));
  }

  private static void enableAutoCloseIncident(TestCase testCase) {
    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/dataQuality/testCases/" + testCase.getId(),
            "[{\"op\":\"add\",\"path\":\"/autoCloseIncident\",\"value\":true}]",
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private static void createIncidentStatus(
      TestCase testCase, TestCaseResolutionStatusTypes statusType) {
    client()
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseReference(testCase.getFullyQualifiedName())
                .withTestCaseResolutionStatusType(statusType));
  }

  private static void createResolvedIncidentStatus(TestCase testCase) {
    client()
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseReference(testCase.getFullyQualifiedName())
                .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
                .withTestCaseResolutionStatusDetails(
                    new Resolved()
                        .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
                        .withTestCaseFailureComment("not a real failure")));
  }
}
