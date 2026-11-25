package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.LLMServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.api.ai.CreateAIGovernanceFramework;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.ApplicationType;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.PolicyType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AIGovernanceVisibilityIT {
  private static final String GOVERNANCE = "/v1/aiGovernance";
  private static final String REPORTS = "/v1/auditReports";

  @Test
  void estateReadsExcludeAssetsDeniedByDomainPolicy(final TestNamespace ns) {
    final Domain allowed = createDomain(ns, "allowed");
    final Domain denied = createDomain(ns, "denied");
    final AIApplication visible = createApplication(ns, allowed);
    final AIApplication hidden = createApplication(ns, denied);
    final List<EntityInterface<?>> visibleOthers = createOtherAssets(ns, allowed);
    final List<EntityInterface<?>> hiddenOthers = createOtherAssets(ns, denied);
    final OpenMetadataClient reader = domainReader(ns, List.of(allowed.getFullyQualifiedName()));
    assertForbidden(reader, "/v1/aiApplications/" + hidden.getId());
    assertNotNull(reader.aiApplications().get(visible.getId().toString()));

    final JsonNode dashboard = get(reader, GOVERNANCE + "/dashboard");
    assertEquals(3, dashboard.path("estateStats").path("total").asInt());
    assertContainsOnlyVisible(dashboard.path("topApprovals"), visible, hidden);
    assertContainsOnlyVisible(get(reader, GOVERNANCE + "/activity?limit=500"), visible, hidden);
    for (int i = 0; i < visibleOthers.size(); i++) {
      final EntityInterface<?> permitted = visibleOthers.get(i);
      final EntityInterface<?> forbidden = hiddenOthers.get(i);
      final String type = permitted.getEntityReference().getType();
      assertContainsOnlyVisible(dashboard.path("topApprovals"), permitted, forbidden);
      assertContainsOnlyVisible(
          get(reader, GOVERNANCE + "/activity?limit=500"), permitted, forbidden);
      assertContainsOnlyVisible(
          get(reader, GOVERNANCE + "/activity?entityType=" + type + "&limit=500"),
          permitted,
          forbidden);
    }
    assertContainsOnlyVisible(
        get(reader, GOVERNANCE + "/activity?entityType=aiApplication&limit=500"), visible, hidden);

    final AIGovernancePolicy policy =
        execute(
            SdkClients.adminClient(),
            HttpMethod.POST,
            GOVERNANCE + "Policies",
            new CreateAIGovernancePolicy()
                .withName(ns.prefix("pii_policy"))
                .withPolicyType(PolicyType.DataAccess),
            AIGovernancePolicy.class);
    assertContainsOnlyVisible(
        get(reader, GOVERNANCE + "/policies/" + policy.getId() + "/violations?limit=500"),
        visible,
        hidden);

    final AIGovernanceFramework framework =
        execute(
            SdkClients.adminClient(),
            HttpMethod.POST,
            GOVERNANCE + "Frameworks",
            new CreateAIGovernanceFramework().withName(ns.prefix("framework")),
            AIGovernanceFramework.class);
    assertEquals(
        3,
        get(reader, GOVERNANCE + "Frameworks/" + framework.getId() + "/coverage")
            .path("assetsInScope")
            .asInt());
    assertTrue(
        get(SdkClients.adminClient(), GOVERNANCE + "/dashboard")
                .path("estateStats")
                .path("total")
                .asInt()
            >= 2);
  }

  @Test
  void callerWithNoDomainsCannotAggregateDomainAssets(final TestNamespace ns) {
    final AIApplication hidden = createApplication(ns, createDomain(ns, "private"));
    final OpenMetadataClient reader = domainReader(ns, List.of());
    assertForbidden(reader, "/v1/aiApplications/" + hidden.getId());
    assertEquals(
        0, get(reader, GOVERNANCE + "/dashboard").path("estateStats").path("total").asInt());
    assertFalse(
        get(reader, GOVERNANCE + "/activity?limit=500")
            .toString()
            .contains(hidden.getId().toString()));
  }

  @Test
  void estateReadsHonorAnExplicitOwnerBasedDeny(final TestNamespace ns) {
    final Domain domain = createDomain(ns, "owner_scope");
    final Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("deny_owned"))
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("denyOwned")
                                .withResources(List.of(Entity.AI_APPLICATION))
                                .withOperations(
                                    List.of(
                                        MetadataOperation.VIEW_ALL, MetadataOperation.VIEW_BASIC))
                                .withEffect(Rule.Effect.DENY)
                                .withCondition("isOwner()"))));
    final Role role =
        SdkClients.adminClient()
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("deny_owned_role"))
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    final String userName = "ai_policy_" + UUID.randomUUID().toString().substring(0, 8);
    final String email = userName + "@test.om.org";
    final User user =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(email)
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withRoles(
                        List.of(
                            role.getId(),
                            excludeUnassignedAssetsRole(ns).getId(),
                            SdkClients.adminClient()
                                .roles()
                                .getByName("DomainOnlyAccessRole")
                                .getId())));
    final OpenMetadataClient reader = SdkClients.createClient(email, email, new String[] {});
    final AIApplication visible = createApplication(ns, domain);
    final AIApplication hidden = createApplication(ns, domain);
    hidden.setOwners(List.of(user.getEntityReference()));
    hidden.setGovernanceMetadata(
        JsonUtils.readValue(
            """
        {"registrationStatus":"PendingApproval","registeredAt":1700000000000,"registeredBy":"admin",
         "aiCompliance":{"complianceRecords":[{"framework":"EU_AI_Act","status":"NonCompliant",
         "euAIAct":{"riskClassification":"High"}}]}}
        """,
            GovernanceMetadata.class));
    SdkClients.adminClient().aiApplications().update(hidden.getId().toString(), hidden);
    assertForbidden(reader, "/v1/aiApplications/" + hidden.getId());
    assertEquals(
        0, get(reader, GOVERNANCE + "/dashboard").path("estateStats").path("highRisk").asInt());
    assertContainsOnlyVisible(get(reader, GOVERNANCE + "/activity?limit=500"), visible, hidden);
  }

  @Test
  void auditPacksUseRequesterScopeAndCannotBeReadByAnotherUser(final TestNamespace ns) {
    final Domain allowed = createDomain(ns, "allowed");
    final Domain denied = createDomain(ns, "denied");
    final AIApplication visible = createApplication(ns, allowed);
    final AIApplication hidden = createApplication(ns, denied);
    final List<EntityInterface<?>> visibleOthers = createOtherAssets(ns, allowed);
    final List<EntityInterface<?>> hiddenOthers = createOtherAssets(ns, denied);
    final OpenMetadataClient reader = domainReader(ns, List.of(allowed.getFullyQualifiedName()));
    final AuditReport report = createReport(reader, ns.prefix("scoped_pack"));
    assertNotNull(report.getRequestedBy());
    assertNotNull(report.getRequestedBy().getId());
    final AuditReport completed = completedReport(reader, report.getId());
    final String pack = decodedPack(completed);
    assertTrue(pack.contains(visible.getId().toString()));
    assertFalse(pack.contains(hidden.getId().toString()));
    for (final EntityInterface<?> asset : visibleOthers) {
      assertTrue(pack.contains(asset.getId().toString()));
    }
    for (final EntityInterface<?> asset : hiddenOthers) {
      assertFalse(pack.contains(asset.getId().toString()));
    }
    assertEquals(3, completed.getManifest().getAssetCount());

    final AuditReport adminReport = createReport(SdkClients.adminClient(), ns.prefix("admin_pack"));
    completedReport(SdkClients.adminClient(), adminReport.getId());
    assertForbidden(reader, REPORTS + "/" + adminReport.getId());
    assertForbidden(
        reader, REPORTS + "/name/" + encodeURIComponent(adminReport.getFullyQualifiedName()));
    assertFalse(
        get(reader, REPORTS + "?limit=1000").toString().contains(adminReport.getId().toString()));
    assertNotNull(get(SdkClients.adminClient(), REPORTS + "/" + report.getId()));
    assertSearchCannotSharePack(reader, adminReport);
    assertRequesterIsImmutable(reader, completed, adminReport);
  }

  private static void assertSearchCannotSharePack(
      final OpenMetadataClient reader, final AuditReport report) {
    final JsonNode patch =
        JsonUtils.readValue(
            """
        [{"op":"add","path":"/description","value":"Index the completed audit artifact"}]
        """,
            JsonNode.class);
    execute(
        SdkClients.adminClient(),
        HttpMethod.PATCH,
        REPORTS + "/" + report.getId(),
        patch,
        AuditReport.class);
    final String query =
        "/v1/search/query?index=auditReport&q=" + encodeURIComponent("id:" + report.getId());
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () ->
                assertTrue(
                    get(SdkClients.adminClient(), query)
                        .toString()
                        .contains(report.getId().toString())));
    assertEquals(0, get(reader, query).path("hits").path("total").path("value").asInt());
    final String fieldQuery =
        "/v1/search/fieldQuery?index=auditReport&fieldName=name.keyword&fieldValue="
            + encodeURIComponent(report.getName());
    assertEquals(
        1,
        get(SdkClients.adminClient(), fieldQuery).path("hits").path("total").path("value").asInt());
    assertEquals(0, get(reader, fieldQuery).path("hits").path("total").path("value").asInt());
    assertReportCounts(SdkClients.adminClient(), report, 1);
    assertReportCounts(reader, report, 0);
  }

  private static void assertReportCounts(
      final OpenMetadataClient client, final AuditReport report, final int expected) {
    final String query = "index=auditReport&q=" + encodeURIComponent("id:" + report.getId());
    final JsonNode aggregation =
        get(client, "/v1/search/aggregate?field=entityType&value=.*&" + query);
    int count = 0;
    for (final JsonNode field : aggregation.path("aggregations")) {
      for (final JsonNode bucket : field.path("buckets")) {
        if (Entity.AUDIT_REPORT.equals(bucket.path("key").asText())) {
          count += bucket.path("doc_count").asInt();
        }
      }
    }
    assertEquals(expected, count, aggregation.toString());
    assertEquals(
        expected,
        get(client, "/v1/search/entityTypeCounts?" + query)
            .path("hits")
            .path("total")
            .path("value")
            .asInt());
  }

  private static void assertRequesterIsImmutable(
      final OpenMetadataClient reader, final AuditReport report, final AuditReport other) {
    final ArrayNode replacement = JsonUtils.getObjectMapper().createArrayNode();
    replacement
        .addObject()
        .put("op", "replace")
        .put("path", "/requestedBy")
        .set("value", JsonUtils.getObjectMapper().valueToTree(other.getRequestedBy()));
    final AuditReport replaced =
        execute(
            SdkClients.adminClient(),
            HttpMethod.PATCH,
            REPORTS + "/" + report.getId(),
            replacement,
            AuditReport.class);
    assertEquals(report.getRequestedBy().getId(), replaced.getRequestedBy().getId());
    final JsonNode clearing =
        JsonUtils.readValue(
            """
        [{"op":"replace","path":"/requestedBy","value":null}]
        """,
            JsonNode.class);
    final AuditReport cleared =
        execute(
            SdkClients.adminClient(),
            HttpMethod.PATCH,
            REPORTS + "/" + report.getId(),
            clearing,
            AuditReport.class);
    assertEquals(report.getRequestedBy().getId(), cleared.getRequestedBy().getId());
    final String ownQuery =
        "/v1/search/query?index=auditReport&q=" + encodeURIComponent("id:" + report.getId());
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () ->
                assertEquals(
                    1, get(reader, ownQuery).path("hits").path("total").path("value").asInt()));
    final String ownFieldQuery =
        "/v1/search/fieldQuery?index=auditReport&fieldName=name.keyword&fieldValue="
            + encodeURIComponent(report.getName());
    assertEquals(1, get(reader, ownFieldQuery).path("hits").path("total").path("value").asInt());
    assertReportCounts(reader, report, 1);
    final AuditReport updated =
        execute(
            SdkClients.adminClient(),
            HttpMethod.PUT,
            REPORTS,
            new CreateAuditReport()
                .withName(report.getName())
                .withDescription("Updated by administrator"),
            AuditReport.class);
    assertEquals(report.getRequestedBy().getId(), updated.getRequestedBy().getId());
    assertNotNull(get(reader, REPORTS + "/" + report.getId()));
    assertForbidden(reader, REPORTS + "/" + other.getId());
  }

  private static Domain createDomain(final TestNamespace ns, final String suffix) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(suffix))
                .withDescription("AI governance visibility regression #36761")
                .withDomainType(CreateDomain.DomainType.AGGREGATE));
  }

  private static List<EntityInterface<?>> createOtherAssets(
      final TestNamespace ns, final Domain domain) {
    final LLMService llmService = LLMServiceTestFactory.createOpenAI(ns);
    final LLMModel model =
        SdkClients.adminClient()
            .llmModels()
            .create(
                new CreateLLMModel()
                    .withName(ns.prefix("model_" + domain.getId().toString().substring(0, 8)))
                    .withService(llmService.getFullyQualifiedName())
                    .withBaseModel("gpt-4")
                    .withModelProvider("OpenAI")
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withGovernanceStatus(CreateLLMModel.GovernanceStatus.PENDING_REVIEW));
    final McpService mcpService =
        execute(
            SdkClients.adminClient(),
            HttpMethod.POST,
            "/v1/services/mcpServices",
            new CreateMcpService()
                .withName(ns.prefix("mcp_service_" + domain.getId().toString().substring(0, 8)))
                .withServiceType(CreateMcpService.McpServiceType.Mcp),
            McpService.class);
    final McpServer server =
        SdkClients.adminClient()
            .mcpServers()
            .create(
                new CreateMcpServer()
                    .withName(ns.prefix("server"))
                    .withService(mcpService.getFullyQualifiedName())
                    .withServerType(McpServerType.DataAccess)
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withGovernanceMetadata(
                        JsonUtils.readValue(
                            """
                {"registrationStatus":"PendingApproval","registeredAt":1700000000000,"registeredBy":"admin",
                 "dataClassification":{"accessesPII":true}}
                """,
                            McpGovernanceMetadata.class)));
    return List.of(model, server);
  }

  private static AIApplication createApplication(final TestNamespace ns, final Domain domain) {
    final GovernanceMetadata metadata =
        JsonUtils.readValue(
            """
        {"registrationStatus":"PendingApproval","registeredAt":1700000000000,
         "registeredBy":"admin","dataClassification":{"accessesPII":true}}
        """,
            GovernanceMetadata.class);
    return SdkClients.adminClient()
        .aiApplications()
        .create(
            new CreateAIApplication()
                .withName(ns.prefix("app_" + UUID.randomUUID().toString().substring(0, 8)))
                .withApplicationType(ApplicationType.Chatbot)
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withGovernanceMetadata(metadata));
  }

  private static OpenMetadataClient domainReader(
      final TestNamespace ns, final List<String> domains) {
    final Role role = SdkClients.adminClient().roles().getByName("DomainOnlyAccessRole");
    final String user = "ai_reader_" + UUID.randomUUID().toString().substring(0, 8);
    final String email = user + "@test.om.org";
    SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(user)
                .withEmail(email)
                .withDomains(domains)
                .withRoles(List.of(role.getId(), excludeUnassignedAssetsRole(ns).getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static AuditReport createReport(final OpenMetadataClient client, final String name) {
    return execute(
        client,
        HttpMethod.POST,
        REPORTS,
        new CreateAuditReport()
            .withName(name)
            .withScope(AuditReportScope.Estate)
            .withFormat(AuditReportFormat.Json),
        AuditReport.class);
  }

  private static Role excludeUnassignedAssetsRole(final TestNamespace ns) {
    // DomainOnlyAccessRole permits unassigned assets created by concurrent integration tests.
    final Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("exclude_unassigned"))
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("excludeUnassigned")
                                .withResources(
                                    List.of(
                                        Entity.AI_APPLICATION, Entity.LLM_MODEL, Entity.MCP_SERVER))
                                .withOperations(
                                    List.of(
                                        MetadataOperation.VIEW_ALL, MetadataOperation.VIEW_BASIC))
                                .withEffect(Rule.Effect.DENY)
                                .withCondition("noDomain()"))));
    return SdkClients.adminClient()
        .roles()
        .create(
            new CreateRole()
                .withName(ns.prefix("isolated_role"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  private static AuditReport completedReport(final OpenMetadataClient client, final UUID id) {
    await()
        .atMost(Duration.ofSeconds(30))
        .until(
            () -> {
              final AuditReport report =
                  execute(client, HttpMethod.GET, REPORTS + "/" + id, null, AuditReport.class);
              return report.getStatus() == AuditReportStatus.Completed
                  || report.getStatus() == AuditReportStatus.Failed;
            });
    final AuditReport report =
        execute(client, HttpMethod.GET, REPORTS + "/" + id, null, AuditReport.class);
    assertEquals(AuditReportStatus.Completed, report.getStatus(), report.getFailureReason());
    return report;
  }

  private static String decodedPack(final AuditReport report) {
    final String url = report.getArtifacts().getFirst().getDownloadUrl();
    return new String(
        Base64.getDecoder().decode(url.substring(url.indexOf(',') + 1)), StandardCharsets.UTF_8);
  }

  private static void assertContainsOnlyVisible(
      final JsonNode result, final EntityInterface<?> visible, final EntityInterface<?> hidden) {
    assertTrue(result.toString().contains(visible.getId().toString()), result.toString());
    assertFalse(result.toString().contains(hidden.getId().toString()), result.toString());
  }

  private static void assertForbidden(final OpenMetadataClient client, final String path) {
    assertEquals(
        403, assertThrows(ForbiddenException.class, () -> get(client, path)).getStatusCode());
  }

  private static JsonNode get(final OpenMetadataClient client, final String path) {
    return execute(client, HttpMethod.GET, path, null, JsonNode.class);
  }

  private static <T> T execute(
      final OpenMetadataClient client,
      final HttpMethod method,
      final String path,
      final Object body,
      final Class<T> response) {
    return client.getHttpClient().execute(method, path, body, response);
  }
}
