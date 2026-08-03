/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.services.connections.database.PolicyAgentConfig;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for Data Access Request capability validation in {@link
 * org.openmetadata.service.tasks.TaskFieldValidator#validateDataAccessCapabilities(Task)}.
 *
 * <p>Covers: connectors that have not configured a policy agent (lenient — all access types
 * allowed), connectors that enabled the policy agent with specific support flags (each accessType
 * checked against the matching flag), and Data Product targets (ColumnLevel always rejected
 * because the request can span multiple backing services).
 *
 * <p>Also covers the one-active-request-per-entity rule enforced in {@link
 * org.openmetadata.service.jdbi3.TaskRepository}: a user cannot submit a second active Data Access
 * Request for an entity they already have an active request for, while a different user requesting
 * the same entity, the same user requesting a different entity, or the same user re-requesting an
 * entity whose prior request has reached a terminal status, all remain allowed.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataAccessRequestValidationIT {

  private static String entityLink(String entityType, String entityFqn) {
    return String.format("<#E::%s::%s>", entityType, entityFqn);
  }

  private static Map<String, Object> dataAccessPayload(String accessType) {
    return Map.of(
        "accessType",
        accessType,
        "requestedAccess",
        "Read",
        "reason",
        "integration-test",
        "expirationDate",
        System.currentTimeMillis() + 14L * 24 * 60 * 60 * 1000);
  }

  private static Table createTableOnSnowflakeService(
      TestNamespace ns, SnowflakeConnection connection) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String serviceName = ns.prefix("dar_snowflake_" + uniqueId);
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withConnection(new DatabaseConnection().withConfig(connection));
    DatabaseService service = SdkClients.adminClient().databaseServices().create(createService);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private static SnowflakeConnection baseSnowflakeConnection() {
    return new SnowflakeConnection()
        .withAccount("dar-test")
        .withUsername("dar-user")
        .withWarehouse("dar-warehouse");
  }

  private static DataProduct createDataProductWithDomain(TestNamespace ns) {
    String domainName = ns.prefix("dar_domain");
    Domain domain;
    try {
      domain = SdkClients.adminClient().domains().getByName(domainName);
    } catch (Exception e) {
      domain =
          SdkClients.adminClient()
              .domains()
              .create(
                  new CreateDomain()
                      .withName(domainName)
                      .withDescription("Domain for DAR validation")
                      .withDomainType(DomainType.AGGREGATE));
    }
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("dar_dataproduct"))
                .withDescription("DataProduct for DAR validation")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Task createDataAccessRequest(
      TestNamespace ns, String entityType, String entityFqn, Map<String, Object> payload) {
    return createDataAccessRequest(SdkClients.adminClient(), ns, entityType, entityFqn, payload);
  }

  private static Task createDataAccessRequest(
      OpenMetadataClient client,
      TestNamespace ns,
      String entityType,
      String entityFqn,
      Map<String, Object> payload) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("dar_" + entityType + "_" + UUID.randomUUID()))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(entityLink(entityType, entityFqn))
            .withPayload(payload);
    return client.tasks().create(request);
  }

  @Test
  void testDarOnTableWithUnconfiguredPolicyAgent_allowsAllAccessTypes(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    String tableFqn = table.getFullyQualifiedName();

    Task fullAccessTask =
        createDataAccessRequest(
            SdkClients.user1Client(), ns, "table", tableFqn, dataAccessPayload("FullAccess"));
    Task maskedTask =
        createDataAccessRequest(
            SdkClients.user2Client(), ns, "table", tableFqn, dataAccessPayload("Masked"));
    Task columnLevelTask =
        createDataAccessRequest(
            SdkClients.user3Client(), ns, "table", tableFqn, dataAccessPayload("ColumnLevel"));

    assertNotNull(fullAccessTask.getId());
    assertNotNull(maskedTask.getId());
    assertNotNull(columnLevelTask.getId());
  }

  @Test
  void testDarOnTableWithEnabledPolicyAgent_rejectsUnsupportedColumnLevel(TestNamespace ns) {
    SnowflakeConnection connection =
        baseSnowflakeConnection()
            .withPolicyAgentConfig(
                new PolicyAgentConfig()
                    .withEnabled(true)
                    .withSupportsFullAccess(true)
                    .withSupportsMaskedAccess(true)
                    .withSupportsColumnAccess(false));
    Table table = createTableOnSnowflakeService(ns, connection);
    String tableFqn = table.getFullyQualifiedName();

    Task fullAccessTask =
        createDataAccessRequest(
            SdkClients.user1Client(), ns, "table", tableFqn, dataAccessPayload("FullAccess"));
    assertNotNull(fullAccessTask.getId());

    Task maskedTask =
        createDataAccessRequest(
            SdkClients.user2Client(), ns, "table", tableFqn, dataAccessPayload("Masked"));
    assertNotNull(maskedTask.getId());

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    SdkClients.user3Client(),
                    ns,
                    "table",
                    tableFqn,
                    dataAccessPayload("ColumnLevel")));
    assertTrue(
        rejection.getMessage().contains("Column-level access is not supported"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarOnTableWithEnabledPolicyAgent_rejectsFullAccessWhenUnsupported(TestNamespace ns) {
    SnowflakeConnection connection =
        baseSnowflakeConnection()
            .withPolicyAgentConfig(
                new PolicyAgentConfig()
                    .withEnabled(true)
                    .withSupportsFullAccess(false)
                    .withSupportsMaskedAccess(true)
                    .withSupportsColumnAccess(false));
    Table table = createTableOnSnowflakeService(ns, connection);

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess")));
    assertTrue(
        rejection.getMessage().contains("Full access is not supported"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarOnTableWithDisabledPolicyAgent_allowsAllAccessTypes(TestNamespace ns) {
    SnowflakeConnection connection =
        baseSnowflakeConnection()
            .withPolicyAgentConfig(
                new PolicyAgentConfig()
                    .withEnabled(false)
                    .withSupportsFullAccess(false)
                    .withSupportsMaskedAccess(false)
                    .withSupportsColumnAccess(false));
    Table table = createTableOnSnowflakeService(ns, connection);

    Task columnLevelTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("ColumnLevel"));
    assertEquals(TaskEntityType.DataAccessRequest, columnLevelTask.getType());
  }

  @Test
  void testDarOnDataProduct_rejectsColumnLevel(TestNamespace ns) {
    DataProduct dataProduct = createDataProductWithDomain(ns);

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns,
                    "dataProduct",
                    dataProduct.getFullyQualifiedName(),
                    dataAccessPayload("ColumnLevel")));
    assertTrue(
        rejection.getMessage().contains("Column-level access is not supported for Data Products"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarOnDataProduct_allowsFullAccessAndMasked(TestNamespace ns) {
    DataProduct dataProduct = createDataProductWithDomain(ns);
    String dataProductFqn = dataProduct.getFullyQualifiedName();

    Task fullAccessTask =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "dataProduct",
            dataProductFqn,
            dataAccessPayload("FullAccess"));
    Task maskedTask =
        createDataAccessRequest(
            SdkClients.user2Client(),
            ns,
            "dataProduct",
            dataProductFqn,
            dataAccessPayload("Masked"));

    assertNotNull(fullAccessTask.getId());
    assertNotNull(maskedTask.getId());
  }

  @Test
  void testDuplicateActiveDarBySameUser_rejected(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task firstRequest =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    assertNotNull(firstRequest.getId());

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("Masked")));
    assertTrue(
        rejection.getMessage().contains("active data access request"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
    assertTrue(
        rejection.getMessage().contains(firstRequest.getTaskId()),
        () -> "Rejection should reference existing task: " + rejection.getMessage());
  }

  @Test
  void testDuplicateDarByDifferentUsers_allowed(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task user1Request =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));
    Task user2Request =
        createDataAccessRequest(
            SdkClients.user2Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    assertNotNull(user1Request.getId());
    assertNotNull(user2Request.getId());
  }

  @Test
  void testActiveDarBySameUserOnDifferentEntities_allowed(TestNamespace ns) {
    Table firstTable = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Table secondTable = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task firstRequest =
        createDataAccessRequest(
            ns, "table", firstTable.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    Task secondRequest =
        createDataAccessRequest(
            ns, "table", secondTable.getFullyQualifiedName(), dataAccessPayload("FullAccess"));

    assertNotNull(firstRequest.getId());
    assertNotNull(secondRequest.getId());
  }

  @Test
  void testDarAfterPreviousRequestTerminal_allowed(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task firstRequest =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    SdkClients.adminClient().tasks().close(firstRequest.getId().toString());

    Task secondRequest =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    assertNotNull(secondRequest.getId());
  }

  @Test
  void testDarWithInvalidAccessType_rejectedByFormSchema(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("Bogus")));
    assertTrue(
        rejection.getMessage().contains("Invalid task payload"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  /**
   * DataAccessRequestTaskWorkflow declares the {@code reject} transition with {@code
   * requiresComment: true}. {@code TaskResource.validateTransitionComment} enforces that at the API
   * boundary; without it the resolution was stored with no reason and the requester never learned
   * why they were denied.
   */
  @Test
  void testDarResolve_rejectWithoutComment_returns400(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    ResolveTask rejectWithoutComment = new ResolveTask().withTransitionId("reject");

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                SdkClients.adminClient()
                    .tasks()
                    .resolve(dar.getId().toString(), rejectWithoutComment));
    assertTrue(
        rejection.getMessage().contains("requires a non-empty comment"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarResolve_rejectWithComment_succeeds(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    ResolveTask rejectWithComment =
        new ResolveTask()
            .withTransitionId("reject")
            .withComment("Access denied for compliance reasons.");

    Task resolved =
        SdkClients.adminClient().tasks().resolve(dar.getId().toString(), rejectWithComment);
    assertNotNull(resolved);
  }

  /**
   * Regression test for the DAR self-approval leak: the workflow's {@code taskUpdatedBy} carries
   * the requester's username. {@code SetApprovalAssigneesImpl} must remove that user from the
   * assignees list even when it landed there via {@code taskReviewers}. Before the fix, filing a
   * DAR while listed as reviewer left the requester on the assignees list and they could approve
   * their own request.
   */
  @Test
  void testDarCreation_requesterAsReviewer_notInAssignees(TestNamespace ns) throws Exception {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    String requesterFqn = "shared_user1";

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("dar_selfapproval_" + UUID.randomUUID()))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(entityLink("table", table.getFullyQualifiedName()))
            .withReviewers(List.of(requesterFqn))
            .withPayload(dataAccessPayload("FullAccess"));
    Task dar = SdkClients.user1Client().tasks().create(request);

    Awaitility.await("DAR workflow to populate assignees for " + dar.getId())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .ignoreExceptions()
        .until(
            () -> {
              Task fresh =
                  SdkClients.adminClient()
                      .tasks()
                      .get(dar.getId().toString(), "assignees,createdBy");
              List<EntityReference> assignees = fresh.getAssignees();
              return assignees != null && !assignees.isEmpty();
            });

    Task refreshed =
        SdkClients.adminClient().tasks().get(dar.getId().toString(), "assignees,createdBy");
    List<EntityReference> assignees =
        refreshed.getAssignees() == null ? List.of() : refreshed.getAssignees();
    List<String> assigneeNames =
        assignees.stream()
            .map(ref -> ref.getName() == null ? "" : ref.getName())
            .collect(Collectors.toList());
    assertTrue(
        assigneeNames.stream().noneMatch(name -> name.equalsIgnoreCase(requesterFqn)),
        () -> "Requester leaked into assignees: " + assigneeNames);
  }

  private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

  /**
   * The DAR workflow runs the create → start → TaskReview steps on a Flowable thread pool, so
   * {@code availableTransitions} is not yet stamped on the row when the create call returns.
   * Every resolve-driven regression below must wait for the transition it targets to appear
   * before firing — otherwise the API's new "unknown transitionId" guard rejects the call
   * before the code path under test executes.
   */
  private static void awaitTransitionAvailable(java.util.UUID taskId, String transitionId) {
    java.util.concurrent.atomic.AtomicReference<Task> latest =
        new java.util.concurrent.atomic.AtomicReference<>();
    try {
      Awaitility.await("DAR workflow to expose transition '" + transitionId + "'")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofMillis(500))
          .ignoreExceptions()
          .until(
              () -> {
                Task fresh =
                    SdkClients.adminClient().tasks().get(taskId.toString(), "availableTransitions");
                latest.set(fresh);
                return fresh.getAvailableTransitions() != null
                    && fresh.getAvailableTransitions().stream()
                        .anyMatch(t -> transitionId.equals(t.getId()));
              });
    } catch (org.awaitility.core.ConditionTimeoutException timeout) {
      Task snapshot = latest.get();
      String state =
          snapshot == null
              ? "no snapshot"
              : String.format(
                  "status=%s stageId=%s workflowInstanceId=%s availableTransitions=%s",
                  snapshot.getStatus(),
                  snapshot.getWorkflowStageId(),
                  snapshot.getWorkflowInstanceId(),
                  snapshot.getAvailableTransitions());
      throw new AssertionError(
          "Workflow never surfaced transition '"
              + transitionId
              + "' on task "
              + taskId
              + " within 60s. Last snapshot: "
              + state,
          timeout);
    }
  }

  /**
   * H1: resolve endpoint used to accept any string (including "garbage-word" and an empty body)
   * and silently drive the task to Approved via TaskWorkflowHandler.resolveResolutionType's
   * "positive-default" fallback. It must now reject unknown transitionIds with a 400.
   */
  @Test
  void testDarResolve_unknownTransitionId_returns400(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    ResolveTask garbage = new ResolveTask().withTransitionId("garbage-word");

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().tasks().resolve(dar.getId().toString(), garbage));
    assertTrue(
        rejection.getMessage().contains("is not available"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  /**
   * H2: transitionId=reject + resolutionType=Approved used to end in Approved because
   * TaskWorkflowHandler.resolveResolutionType short-circuited on the caller-supplied
   * resolutionType. The cross-check in TaskResource.validateTransition now rejects the mismatch.
   */
  @Test
  void testDarResolve_transitionResolutionMismatch_returns400(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    awaitTransitionAvailable(dar.getId(), "reject");
    ResolveTask spoof =
        new ResolveTask()
            .withTransitionId("reject")
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("attempting to spoof approve through the reject transition");

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().tasks().resolve(dar.getId().toString(), spoof));
    assertTrue(
        rejection.getMessage().contains("conflicts"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  /**
   * H4: PATCH /status used to accept any value (Granted, Rejected, ...) with no workflow check
   * — status/workflowStageId are workflow-owned and must not be changed via JSON-Patch.
   */
  @Test
  void testDarPatch_statusReplace_returns400(TestNamespace ns) throws Exception {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    JsonNode statusForge =
        JSON_MAPPER.readTree("[{\"op\":\"replace\",\"path\":\"/status\",\"value\":\"Granted\"}]");

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().tasks().patch(dar.getId(), statusForge));
    assertTrue(
        rejection.getMessage().contains("workflow- or audit-owned"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  /**
   * H5: once the task has left Open, the requester used to be able to PATCH the payload and
   * widen their own approved access — the payload must be frozen from Approved onward.
   * Also covers H6 for /about since the same guard blocks both.
   */
  @Test
  void testDarPatch_payloadAfterOpen_returns400(TestNamespace ns) throws Exception {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("Masked"));
    awaitTransitionAvailable(dar.getId(), "approve");
    SdkClients.adminClient()
        .tasks()
        .resolve(
            dar.getId().toString(),
            new ResolveTask()
                .withTransitionId("approve")
                .withComment("approving the smaller ask before the widening attempt"));
    Awaitility.await("DAR to leave Open after approve")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .ignoreExceptions()
        .until(
            () ->
                !"Open"
                    .equals(
                        SdkClients.adminClient()
                            .tasks()
                            .get(dar.getId().toString(), "availableTransitions")
                            .getStatus()
                            .value()));

    JsonNode widen =
        JSON_MAPPER.readTree(
            "[{\"op\":\"replace\",\"path\":\"/payload/accessType\",\"value\":\"FullAccess\"}]");

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.user1Client().tasks().patch(dar.getId(), widen));
    assertTrue(
        rejection.getMessage().contains("frozen"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  /**
   * H3: closing a Granted DAR used to mark it Cancelled without running any revoke enforcement.
   * The close guard now rejects with 400, forcing callers through the revoke transition.
   */
  @Test
  void testDarClose_onGranted_returns400(TestNamespace ns) throws Exception {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Task dar =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    awaitTransitionAvailable(dar.getId(), "approve");
    SdkClients.adminClient()
        .tasks()
        .resolve(
            dar.getId().toString(),
            new ResolveTask().withTransitionId("approve").withComment("approve for close test"));
    Awaitility.await("DAR to reach Approved after approve transition")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .ignoreExceptions()
        .until(
            () -> {
              Task fresh =
                  SdkClients.adminClient()
                      .tasks()
                      .get(dar.getId().toString(), "availableTransitions");
              return fresh.getAvailableTransitions() != null
                  && fresh.getAvailableTransitions().stream()
                      .anyMatch(t -> "markAsGranted".equals(t.getId()));
            });
    SdkClients.adminClient()
        .tasks()
        .resolve(
            dar.getId().toString(),
            new ResolveTask().withTransitionId("markAsGranted").withComment("mark granted"));
    Awaitility.await("DAR to reach Granted after markAsGranted")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .ignoreExceptions()
        .until(
            () ->
                SdkClients.adminClient()
                    .tasks()
                    .get(dar.getId().toString(), "availableTransitions")
                    .getStatus()
                    .value()
                    .equals("Granted"));

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .executeForString(HttpMethod.POST, "/tasks/" + dar.getId() + "/close", null));
    assertTrue(
        rejection.getMessage().contains("close is not allowed"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  /**
   * H8: concurrent create used to bypass the SELECT-then-INSERT duplicate check (TOCTOU). The
   * partial unique index at the DB layer now closes the race — exactly one of the parallel
   * INSERTs wins and the losers surface as 400 duplicate-request errors.
   */
  @Test
  void testDarCreate_concurrentBySameUser_onlyOneWins(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    String tableFqn = table.getFullyQualifiedName();
    int parallelism = 5;

    AtomicInteger successes = new AtomicInteger();
    AtomicInteger duplicates = new AtomicInteger();
    List<CompletableFuture<Void>> attempts =
        java.util.stream.IntStream.range(0, parallelism)
            .mapToObj(
                i ->
                    CompletableFuture.runAsync(
                        () -> {
                          try {
                            createDataAccessRequest(
                                SdkClients.user1Client(),
                                ns,
                                "table",
                                tableFqn,
                                dataAccessPayload("FullAccess"));
                            successes.incrementAndGet();
                          } catch (InvalidRequestException expected) {
                            if (expected.getMessage().contains("already exists")) {
                              duplicates.incrementAndGet();
                            } else {
                              throw expected;
                            }
                          }
                        }))
            .collect(Collectors.toList());
    CompletableFuture.allOf(attempts.toArray(new CompletableFuture[0])).join();

    assertEquals(
        1,
        successes.get(),
        () ->
            "Only one concurrent DAR should have won. successes="
                + successes
                + " duplicates="
                + duplicates);
    assertEquals(parallelism - 1, duplicates.get(), "Every loser must be a duplicate rejection");
  }

  /**
   * H7: expirationDate = 1e400 used to parse as Double.POSITIVE_INFINITY, fail the Long coercion
   * silently in TaskFieldValidator.readDataAccessPayload, and store "never-expires" access. The
   * schema now caps expirationDate at ~year 2200 and the swallow-catch is gone.
   */
  @Test
  void testDarCreate_expirationDateInfinity_returns400(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Map<String, Object> payload =
        Map.of(
            "accessType",
            "FullAccess",
            "requestedAccess",
            "Read",
            "reason",
            "integration-test-h7-bounds",
            "expirationDate",
            Double.POSITIVE_INFINITY);

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () -> createDataAccessRequest(ns, "table", table.getFullyQualifiedName(), payload));
    assertNotNull(rejection);
  }
}
