/*
 *  Copyright 2026 Collate
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.entity.ai.Env;
import org.openmetadata.schema.entity.ai.McpConnectionConfig;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

// Each test deploys its own Enforce workflow, which receives the signals of every event on its
// entity type, so the class runs alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestResourceIT {
  @Test
  void mcpApprovalOutputsAreMaskedWhileTheApprovedConnectionIsPreserved(TestNamespace ns)
      throws Exception {
    final String secret = "mcp-approval-secret";
    final McpConnectionConfig config =
        new McpConnectionConfig()
            .withUrl("https://example.com/?token=" + secret)
            .withArgs(List.of("package-name", "--token=" + secret))
            .withEnv(new Env().withAdditionalProperty("SETTING", secret))
            .withTimeout(1000);
    final McpService service =
        ns.trackRoot(
            Entity.MCP_SERVICE,
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    "/v1/services/mcpServices",
                    new CreateMcpService()
                        .withName(ns.prefix("mcp-approval-service"))
                        .withServiceType(CreateMcpService.McpServiceType.Mcp),
                    McpService.class));
    final McpServer server =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/mcpServers",
                new CreateMcpServer()
                    .withName(ns.prefix("mcp-approval"))
                    .withService(service.getName())
                    .withServerType(McpServerType.Database)
                    .withTransportType(McpTransportType.Stdio)
                    .withConnectionConfig(config),
                McpServer.class);
    deployWorkflowAssigning(
        ns,
        Entity.MCP_SERVER,
        "\"description\"",
        "",
        filterScopedTo(Entity.MCP_SERVER, server.getFullyQualifiedName()),
        SharedEntities.get().USER1.getEntityReference());
    final String patch =
        """
        [{"op":"add","path":"/description","value":"approved edit"},
         {"op":"replace","path":"/connectionConfig/timeout","value":4000}]
        """;
    final var preview =
        sendAsAdmin(
            "POST",
            "/v1/changeRequests/preview/mcpServer/" + server.getId(),
            "application/json-patch+json",
            patch);
    assertEquals(200, preview.statusCode());
    assertTrue(JsonUtils.readTree(preview.body()).path("requiresApproval").asBoolean());
    assertFalse(preview.body().contains(secret));
    final var staged =
        sendAsAdmin(
            "PATCH", "/v1/mcpServers/" + server.getId(), "application/json-patch+json", patch);
    assertEquals(202, staged.statusCode());
    assertFalse(staged.body().contains(secret));

    final ChangeRequest request = onlyPendingRequest(server.getId());
    for (String path :
        List.of(
            "/v1/changeRequests/" + request.getId(),
            "/v1/changeRequests/" + request.getId() + "/revisions",
            "/v1/changeRequests?entityId=" + server.getId())) {
      assertFalse(
          SdkClients.adminClient()
              .getHttpClient()
              .executeForString(HttpMethod.GET, path, null)
              .contains(secret));
    }
    assertTrue(
        JsonUtils.pojoToJson(
                Entity.getCollectionDAO()
                    .changeRevisionDAO()
                    .findById(request.getActiveRevisionId()))
            .contains(secret));
    final Task task = awaitOpenApprovalTask(server.getFullyQualifiedName());
    assertFalse(taskPayloadJson(task.getId()).contains(secret));
    resolveAs(SdkClients.user1Client(), task, "approve", TaskResolutionType.Approved, 1);
    Awaitility.await("the MCP connection update is published")
        .atMost(Duration.ofSeconds(60))
        .until(
            () ->
                Entity.getCollectionDAO()
                        .mcpServerDAO()
                        .findEntityById(server.getId())
                        .getConnectionConfig()
                        .getTimeout()
                    == 4000);
    assertEquals(
        config.withTimeout(4000),
        Entity.getCollectionDAO()
            .mcpServerDAO()
            .findEntityById(server.getId())
            .getConnectionConfig());
  }

  private Glossary gated(TestNamespace ns) {
    Glossary glossary =
        gatedGlossaryOwnedBy(ns, "dn", SharedEntities.get().USER2.getEntityReference());
    deployHookWorkflow(ns, "\"description\"", "", filterScopedTo(glossary.getFullyQualifiedName()));
    return glossary;
  }

  private ChangeRequest stageAsUser2(Glossary glossary) {
    patchAs(
        SdkClients.user2Client(),
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"staged\"}]");
    return onlyPendingRequest(glossary.getId());
  }

  private static int visibleCount(OpenMetadataClient client, UUID entityId) {
    String body =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/changeRequests?entityId=%s".formatted(entityId), null);
    JsonNode data = JsonUtils.readTree(body).path("data");
    return data.size();
  }

  private static ChangeRequest withdraw(OpenMetadataClient client, UUID id, int revision) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/changeRequests/%s/withdraw".formatted(id),
            new WithdrawChangeRequest().withExpectedRevision(revision),
            ChangeRequest.class);
  }

  @Test
  void anUngatedDescriptionEditIsPreviewedWithItsOpsAndNothingIsSaved(TestNamespace ns)
      throws Exception {
    Glossary glossary = gatedGlossary(ns);

    var preview =
        sendAsAdmin(
            "POST",
            "/v1/changeRequests/preview/glossary/" + glossary.getId(),
            "application/json-patch+json",
            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"previewed\"}]");

    assertEquals(200, preview.statusCode());
    JsonNode body = JsonUtils.readTree(preview.body());
    assertFalse(body.path("requiresApproval").asBoolean());
    JsonNode op = body.path("ops").get(0);
    assertEquals("description", op.path("field").asText());
    assertEquals("previewed", JsonUtils.readTree(op.path("value").asText()).asText());
    assertEquals(PUBLISHED, JsonUtils.readTree(op.path("baseValue").asText()).asText());
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    assertEquals(0, visibleCount(SdkClients.adminClient(), glossary.getId()));
  }

  @Test
  void anUngatedDescriptionIsPreviewedAsThePatchSavesIt(TestNamespace ns) throws Exception {
    Glossary glossary = gatedGlossary(ns);
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/description\","
            + "\"value\":\"<a href=\\\"https://example.com\\\" target=\\\"_blank\\\">link</a>\"}]";

    var preview =
        sendAsAdmin(
            "POST",
            "/v1/changeRequests/preview/glossary/" + glossary.getId(),
            "application/json-patch+json",
            patch);
    assertEquals(200, preview.statusCode());
    String previewed =
        JsonUtils.readTree(
                JsonUtils.readTree(preview.body()).path("ops").get(0).path("value").asText())
            .asText();
    patch(glossary.getId(), patch);

    assertEquals(descriptionOf(glossary.getId()), previewed);
    assertFalse(previewed.contains("target="));
  }

  @Test
  void aDescriptionPreviewDoesNotReportATagTheTableInherits(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    var tagged =
        sendAsAdmin(
            "PATCH",
            "/v1/databases/" + database.getId(),
            "application/json-patch+json",
            """
            [{"op":"add","path":"/tags","value":[{"tagFQN":"PII.NonSensitive",
              "source":"Classification","labelType":"Manual","state":"Confirmed"}]}]
            """);
    assertEquals(200, tagged.statusCode());
    var read =
        sendAsAdmin("GET", "/v1/tables/" + table.getId() + "?fields=tags", "application/json", "");
    assertTrue(
        read.body().contains("\"tagFQN\":\"PII.NonSensitive\"")
            && read.body().contains("\"labelType\":\"Derived\""),
        "the table must inherit the database tag for this test to mean anything: " + read.body());

    var preview =
        sendAsAdmin(
            "POST",
            "/v1/changeRequests/preview/table/" + table.getId(),
            "application/json-patch+json",
            "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"previewed\"}]");

    assertEquals(200, preview.statusCode());
    List<String> fields = new java.util.ArrayList<>();
    JsonUtils.readTree(preview.body())
        .path("ops")
        .forEach(op -> fields.add(op.path("field").asText()));
    assertEquals(List.of("description"), fields, preview.body());
  }

  @Test
  void anUngatedEditBeyondDescriptiveMetadataIsPreviewedWithoutOps(TestNamespace ns)
      throws Exception {
    Glossary glossary = gatedGlossary(ns);

    var preview =
        sendAsAdmin(
            "POST",
            "/v1/changeRequests/preview/glossary/" + glossary.getId(),
            "application/json-patch+json",
            """
            [{"op":"replace","path":"/description","value":"previewed"},
             {"op":"add","path":"/mutuallyExclusive","value":true}]
            """);

    assertEquals(200, preview.statusCode());
    JsonNode body = JsonUtils.readTree(preview.body());
    assertFalse(body.path("requiresApproval").asBoolean());
    assertEquals(0, body.path("ops").size());
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }

  @Test
  void anUngatedPreviewIsRefusedToACallerWhoCannotMakeTheEdit(TestNamespace ns) throws Exception {
    Glossary glossary = gatedGlossary(ns);
    String email = SharedEntities.get().USER3.getEmail();
    String consumer = JwtAuthProvider.tokenFor(email, email, new String[] {}, 600);
    String patch = "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"previewed\"}]";

    var save =
        sendWithToken(
            consumer,
            "PATCH",
            "/v1/glossaries/" + glossary.getId(),
            "application/json-patch+json",
            patch);
    var preview =
        sendWithToken(
            consumer,
            "POST",
            "/v1/changeRequests/preview/glossary/" + glossary.getId(),
            "application/json-patch+json",
            patch);

    assertEquals(403, save.statusCode(), "the caller must lack the edit for this test to mean it");
    assertEquals(403, preview.statusCode(), preview.body());
  }

  @Test
  void ungatedTagOwnerAndColumnEditsArePreviewedAsThePatchSavesThem(TestNamespace ns)
      throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    String owner = SharedEntities.get().USER1.getId().toString();

    JsonNode tags =
        previewThenSave(
            table,
            "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[{\"tagFQN\":\"PII.Sensitive\","
                + "\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]");
    assertEquals(
        identities(savedTable(table).path("tags"), "tagFQN"),
        previewedIdentities(tags, "tagFQN"),
        tags.toString());

    JsonNode owners =
        previewThenSave(
            table,
            "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\""
                + owner
                + "\",\"type\":\"user\"}]}]");
    assertEquals(
        identities(savedTable(table).path("owners"), "id"),
        previewedIdentities(owners, "id"),
        owners.toString());

    JsonNode column =
        previewThenSave(
            table, "[{\"op\":\"add\",\"path\":\"/columns/0/description\",\"value\":\"the key\"}]");
    assertEquals(
        savedTable(table).path("columns").get(0).path("description").asText(),
        previewedValue(column).get(0).path("description").asText(),
        column.toString());
  }

  /** Previews {@code patch} on the table, saves it, and returns the preview. */
  private static JsonNode previewThenSave(Table table, String patch) throws Exception {
    var preview =
        sendAsAdmin(
            "POST",
            "/v1/changeRequests/preview/table/" + table.getId(),
            "application/json-patch+json",
            patch);
    assertEquals(200, preview.statusCode(), preview.body());
    JsonNode body = JsonUtils.readTree(preview.body());
    assertEquals(1, body.path("ops").size(), preview.body());
    var saved =
        sendAsAdmin("PATCH", "/v1/tables/" + table.getId(), "application/json-patch+json", patch);
    assertEquals(200, saved.statusCode(), saved.body());
    return body;
  }

  private static JsonNode previewedValue(JsonNode preview) {
    return JsonUtils.readTree(preview.path("ops").get(0).path("value").asText());
  }

  private static JsonNode savedTable(Table table) throws Exception {
    return JsonUtils.readTree(
        sendAsAdmin(
                "GET",
                "/v1/tables/" + table.getId() + "?fields=tags,owners,columns",
                "application/json",
                "")
            .body());
  }

  /** The list a preview's op leaves: the keys it adds, or the elements it sets. */
  private static Set<String> previewedIdentities(JsonNode preview, String identity) {
    JsonNode op = preview.path("ops").get(0);
    return "add".equals(op.path("op").asText())
        ? Set.of(op.path("key").asText())
        : identities(previewedValue(preview), identity);
  }

  private static Set<String> identities(JsonNode list, String identity) {
    Set<String> values = new java.util.TreeSet<>();
    list.forEach(element -> values.add(element.path(identity).asText()));
    return values;
  }

  @Test
  void requesterAndReviewerSeeTheRequestButOthersDoNot(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary);
    assertEquals(1, visibleCount(SdkClients.user2Client(), glossary.getId()));
    assertEquals(1, visibleCount(SdkClients.user1Client(), glossary.getId()));
    assertEquals(0, visibleCount(SdkClients.user3Client(), glossary.getId()));
  }

  @Test
  void anAssigneeOfTheReviewTaskSeesTheRequestButOthersDoNot(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, "dn");
    String fqn = glossary.getFullyQualifiedName();
    User assignee = SharedEntities.get().USER3;
    deployWorkflowAssigning(
        ns,
        Entity.GLOSSARY,
        "\"description\"",
        "",
        filterScopedTo(fqn),
        assignee.getEntityReference());
    patchDescription(glossary.getId(), "staged");
    UUID requestId = onlyPendingRequest(glossary.getId()).getId();
    Task task = awaitOpenApprovalTask(fqn);
    assertEquals(Set.of(assignee.getName()), taskAssigneeNames(fqn, task.getId()));

    assertEquals(requestId, getAs(SdkClients.user3Client(), requestId).getId());
    assertEquals(1, visibleCount(SdkClients.user3Client(), glossary.getId()));
    assertThrows(ForbiddenException.class, () -> getAs(SdkClients.user2Client(), requestId));
    assertEquals(0, visibleCount(SdkClients.user2Client(), glossary.getId()));
  }

  private static ChangeRequest getAs(OpenMetadataClient client, UUID id) {
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/changeRequests/%s".formatted(id), null, ChangeRequest.class);
  }

  @Test
  void requesterWithdrawsAndTheReviewTaskCloses(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stageAsUser2(glossary);
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ChangeRequest withdrawn = withdraw(SdkClients.user2Client(), request.getId(), 1);
    assertEquals(ChangeRequestStatus.WITHDRAWN, withdrawn.getStatus());
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    Awaitility.await("withdrawn request's task closed")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus()
                    != TaskEntityStatus.Open);
    WorkflowInstance run = awaitWorkflowInstanceOf(task, WorkflowInstance.WorkflowStatus.CANCELLED);
    assertEquals("Withdrawn by the requester", run.getVariables().get("terminationReason"));
  }

  @Test
  void aSuspendedHookWorkflowNeitherHoldsNorBlocksAnother(TestNamespace ns) {
    Glossary glossary = gated(ns);
    WorkflowDefinition suspended =
        deployWorkflow(
            ns,
            Entity.GLOSSARY,
            "\"description\"",
            "",
            filterScopedTo(glossary.getFullyQualifiedName()));
    suspendWorkflow(suspended);

    ChangeRequest request = stageAsUser2(glossary);
    assertNotEquals(suspended.getId(), request.getWorkflowDefinitionId());
    awaitOpenApprovalTask(glossary.getFullyQualifiedName());
  }

  @Test
  void aNewRevisionSupersedesTheEarlierRun(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary);
    Task first = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    patchAs(
        SdkClients.user2Client(),
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"revised\"}]");
    WorkflowInstance run =
        awaitWorkflowInstanceOf(first, WorkflowInstance.WorkflowStatus.SUPERSEDED);
    assertEquals("Superseded by revision 2", run.getVariables().get("terminationReason"));
  }

  @Test
  void onlyTheRequesterCanWithdraw(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stageAsUser2(glossary);
    assertThrows(
        ForbiddenException.class, () -> withdraw(SdkClients.user1Client(), request.getId(), 1));
  }

  @Test
  void withdrawingAMovedRevisionConflicts(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stageAsUser2(glossary);
    assertThrows(
        ConflictException.class, () -> withdraw(SdkClients.user2Client(), request.getId(), 2));
  }

  @Test
  void listingNeedsAFilter() {
    assertThrows(
        InvalidRequestException.class,
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(HttpMethod.GET, "/v1/changeRequests", null));
  }

  @Test
  void enforcedEntityTypesListAnEnforceWorkflowWhileSuspendedUntilItIsDeleted(TestNamespace ns) {
    // The filter excludes every stored procedure, so no concurrent test's edit is held.
    String holdsNothing = JsonUtils.pojoToJson(Map.of(Entity.STORED_PROCEDURE, "{\"==\":[1,1]}"));
    WorkflowDefinition workflow =
        deployWorkflow(ns, Entity.STORED_PROCEDURE, INCLUDE_DESCRIPTION, "", holdsNothing);

    assertTrue(enforcedEntityTypes(SdkClients.user2Client()).contains(Entity.STORED_PROCEDURE));

    // A suspended workflow's requests stay open until it resumes, so its type stays listed.
    suspendWorkflow(workflow);
    assertTrue(enforcedEntityTypes(SdkClients.user2Client()).contains(Entity.STORED_PROCEDURE));

    SdkClients.adminClient().workflowDefinitions().delete(workflow.getId().toString());
    assertFalse(enforcedEntityTypes(SdkClients.user2Client()).contains(Entity.STORED_PROCEDURE));
  }

  private static List<String> enforcedEntityTypes(OpenMetadataClient client) {
    String body =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/metadata/types/workflows/approvalEnforcedEntityTypes", null);
    return List.of(JsonUtils.readValue(body, String[].class));
  }
}
