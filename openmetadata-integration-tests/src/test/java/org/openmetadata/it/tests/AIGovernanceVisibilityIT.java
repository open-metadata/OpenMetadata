package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.api.ai.CreateAIGovernanceFramework;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.api.domains.CreateDomain;
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
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

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
    final OpenMetadataClient reader = domainReader(ns, List.of(allowed.getFullyQualifiedName()));
    assertForbidden(reader, "/v1/aiApplications/" + hidden.getId());
    assertNotNull(reader.aiApplications().get(visible.getId().toString()));

    final JsonNode dashboard = get(reader, GOVERNANCE + "/dashboard");
    assertEquals(1, dashboard.path("estateStats").path("total").asInt());
    assertContainsOnlyVisible(dashboard.path("topApprovals"), visible, hidden);
    assertContainsOnlyVisible(get(reader, GOVERNANCE + "/activity?limit=500"), visible, hidden);
    assertContainsOnlyVisible(
        get(reader, GOVERNANCE + "/activity?entityType=aiApplication&limit=500"), visible, hidden);

    final AIGovernancePolicy policy =
        execute(
            SdkClients.adminClient(),
            HttpMethod.POST,
            GOVERNANCE + "Policies",
            new CreateAIGovernancePolicy().withName(ns.prefix("pii_policy")),
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
        1,
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
  void auditPacksUseRequesterScopeAndCannotBeReadByAnotherUser(final TestNamespace ns) {
    final Domain allowed = createDomain(ns, "allowed");
    final AIApplication visible = createApplication(ns, allowed);
    final AIApplication hidden = createApplication(ns, createDomain(ns, "denied"));
    final OpenMetadataClient reader = domainReader(ns, List.of(allowed.getFullyQualifiedName()));
    final AuditReport report = createReport(reader, ns.prefix("scoped_pack"));
    assertNotNull(report.getRequestedBy());
    final AuditReport completed = completedReport(reader, report.getId());
    final String pack = decodedPack(completed);
    assertTrue(pack.contains(visible.getId().toString()));
    assertFalse(pack.contains(hidden.getId().toString()));
    assertEquals(1, completed.getManifest().getAssetCount());

    final AuditReport adminReport = createReport(SdkClients.adminClient(), ns.prefix("admin_pack"));
    completedReport(SdkClients.adminClient(), adminReport.getId());
    assertForbidden(reader, REPORTS + "/" + adminReport.getId());
    assertForbidden(
        reader, REPORTS + "/name/" + encodeURIComponent(adminReport.getFullyQualifiedName()));
    assertFalse(
        get(reader, REPORTS + "?limit=1000").toString().contains(adminReport.getId().toString()));
    assertNotNull(get(SdkClients.adminClient(), REPORTS + "/" + report.getId()));
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
                .withName(ns.prefix(domain.getName() + "_app"))
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
                .withRoles(List.of(role.getId())));
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
      final JsonNode result, final AIApplication visible, final AIApplication hidden) {
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
