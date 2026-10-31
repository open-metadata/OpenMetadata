/*
 *  Copyright 2026 Collate.
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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatusFor;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.AIGovernanceActivityResponse;
import org.openmetadata.schema.api.ai.AIGovernanceDashboardResponse;
import org.openmetadata.schema.api.ai.AIGovernancePolicyViolationsResponse;
import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.api.ai.CreateAIGovernanceFramework;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.api.ai.FrameworkCoverageResponse;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.ApplicationType;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.entity.ai.DevelopmentStage;
import org.openmetadata.schema.entity.ai.FrameworkAutoApplyRules;
import org.openmetadata.schema.entity.ai.PolicyType;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Regression IT for the estate-wide AI governance authorization fix (issue #36761).
 *
 * <p>A principal denied {@code ViewBasic} on the hidden fixture — an {@code aiApplication} tagged
 * with the restricted tag, via a conditional deny rule — gets 403 from the by-id reads. The
 * estate-wide reads must not reveal the denied asset either: they are computed only over the
 * assets the caller may view. Audit packs additionally carry an owner: only the requester (or an
 * admin) may download the artifacts, and a pack a confined user requests contains only her
 * viewable assets.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AIGovernanceEstateVisibilityIT {

  private static final String RESTRICTED_TAG = "PII.Sensitive";

  /** The two applications under test plus the client confined from the hidden one. */
  private record Estate(AIApplication visible, AIApplication hidden, OpenMetadataClient confined) {}

  @Test
  void estateViews_hideAssetsTheCallerCannotView(TestNamespace ns) {
    Estate estate = estateFixture(ns);
    OpenMetadataClient admin = SdkClients.adminClient();

    // Control: the by-id reads refuse the hidden asset and allow the visible one.
    assertHttpStatusFor(
        estate.confined(), 403, HttpMethod.GET, byNamePath(estate.hidden().getName()), null);
    assertHttpStatusFor(
        estate.confined(), 200, HttpMethod.GET, byNamePath(estate.visible().getName()), null);

    // Dashboard: nothing in the response may name the hidden asset.
    AIGovernanceDashboardResponse dashboard =
        estate
            .confined()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/aiGovernance/dashboard",
                null,
                AIGovernanceDashboardResponse.class);
    assertNotNull(dashboard);
    String dashboardJson = JsonUtils.pojoToJson(dashboard);
    assertFalse(
        dashboardJson.contains(estate.hidden().getName()),
        "dashboard must not name the denied asset: " + dashboardJson);
    assertFalse(dashboardJson.contains(estate.hidden().getId().toString()));

    // Activity feed: the hidden asset's SubmittedForReview event must not appear; the visible
    // asset's must (it is recent, so it is inside the window other tests cannot crowd out).
    AIGovernanceActivityResponse activity =
        estate
            .confined()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/aiGovernance/activity?limit=500",
                null,
                AIGovernanceActivityResponse.class);
    assertNotNull(activity);
    assertTrue(
        activity.getEvents().stream()
            .anyMatch(event -> estate.visible().getName().equals(event.getEntityName())),
        "activity feed must name the viewable asset");
    assertTrue(
        activity.getEvents().stream()
            .noneMatch(event -> estate.hidden().getName().equals(event.getEntityName())),
        "activity feed must not name the denied asset");

    // Policy violations: the hidden asset breaches "Audit log retention" (no retention declared)
    // but must not appear in the confined caller's rows; the admin's rows carry it.
    AIGovernancePolicy retentionPolicy = retentionPolicy(ns);
    AIGovernancePolicyViolationsResponse confinedRows =
        estate
            .confined()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/aiGovernance/policies/" + retentionPolicy.getId() + "/violations?limit=500",
                null,
                AIGovernancePolicyViolationsResponse.class);
    assertNotNull(confinedRows);
    assertTrue(
        confinedRows.getData().stream()
            .noneMatch(row -> estate.hidden().getName().equals(row.getEntityName())),
        "violations must not name the denied asset");
    assertTrue(
        confinedRows.getData().stream()
            .anyMatch(row -> estate.visible().getName().equals(row.getEntityName())),
        "violations must name the viewable asset");

    AIGovernancePolicyViolationsResponse adminRows =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/aiGovernance/policies/" + retentionPolicy.getId() + "/violations?limit=500",
                null,
                AIGovernancePolicyViolationsResponse.class);
    assertTrue(
        adminRows.getData().stream()
            .anyMatch(row -> estate.hidden().getName().equals(row.getEntityName())),
        "the admin's violations must name the denied asset (control: the breach is real)");
  }

  @Test
  void frameworkCoverage_countsOnlyViewableAssets(TestNamespace ns) {
    Estate estate = estateFixture(ns);
    OpenMetadataClient admin = SdkClients.adminClient();

    // A framework whose auto-apply rules match only this test's two applications: the coverage
    // counts become exact, immune to whatever the concurrent ITs create.
    AIGovernanceFramework framework =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/aiGovernanceFrameworks",
                new CreateAIGovernanceFramework()
                    .withName(ns.prefix("retention_coverage"))
                    .withDescription("Coverage scope for estate visibility IT")
                    .withEnabled(true)
                    .withAutoApply(
                        new FrameworkAutoApplyRules()
                            .withAssetTypes(List.of("aiApplication"))
                            .withDeploymentStages(List.of("Proposal"))),
                AIGovernanceFramework.class);

    FrameworkCoverageResponse adminCoverage =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/aiGovernanceFrameworks/" + framework.getId() + "/coverage",
                null,
                FrameworkCoverageResponse.class);
    FrameworkCoverageResponse confinedCoverage =
        estate
            .confined()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/aiGovernanceFrameworks/" + framework.getId() + "/coverage",
                null,
                FrameworkCoverageResponse.class);

    assertEquals(2, adminCoverage.getAssetsInScope());
    assertEquals(
        1,
        confinedCoverage.getAssetsInScope(),
        "coverage counts only the assets the caller may view");
  }

  @Test
  void auditReportArtifacts_servedOnlyToRequesterOrAdmin(TestNamespace ns) {
    Estate estate = estateFixture(ns);
    OpenMetadataClient admin = SdkClients.adminClient();

    AuditReport adminReport = requestPack(admin, ns.prefix("admin_pack"));
    awaitCompleted(admin, adminReport.getId());

    // The confined user may read the report entity but not download the pack.
    AuditReport confinedView =
        estate
            .confined()
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/auditReports/" + adminReport.getId(), null, AuditReport.class);
    assertTrue(
        confinedView.getArtifacts() == null || confinedView.getArtifacts().isEmpty(),
        "a non-requester must not receive the pack artifacts");

    // The requester (admin) receives the artifacts, covering the whole estate.
    AuditReport adminView =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/auditReports/" + adminReport.getId(), null, AuditReport.class);
    assertFalse(adminView.getArtifacts().isEmpty(), "the requester must receive the artifacts");
    String packJson = packJson(adminView);
    assertTrue(
        packJson.contains(estate.hidden().getName()),
        "the admin's pack covers the denied asset (control: generation works)");
  }

  @Test
  void auditPack_generationScopedToTheRequestersView(TestNamespace ns) {
    Estate estate = estateFixture(ns);

    // The confined user may request a pack herself; it must contain only her viewable assets.
    AuditReport ownReport = requestPack(estate.confined(), ns.prefix("confined_pack"));
    awaitCompleted(estate.confined(), ownReport.getId());

    AuditReport ownView =
        estate
            .confined()
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/auditReports/" + ownReport.getId(), null, AuditReport.class);
    assertFalse(
        ownView.getArtifacts() == null || ownView.getArtifacts().isEmpty(),
        "the requester must receive her own pack");
    String packJson = packJson(ownView);
    assertTrue(packJson.contains(estate.visible().getName()));
    assertFalse(
        packJson.contains(estate.hidden().getName()),
        "the pack must not contain assets the requester may not view");
  }

  private Estate estateFixture(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    // The deny is per-asset: only the hidden application carries the restricted tag, so the
    // visible application stays readable by the confined principal (mirrors the finding's
    // per-asset DomainAccessDenyRule rather than a type-wide deny).
    AIApplication hidden = createApplication(ns.prefix("finance_scorer"), restrictedTag());
    AIApplication visible = createApplication(ns.prefix("marketing_writer"), null);
    submitForReview(hidden);
    submitForReview(visible);
    return new Estate(visible, hidden, confinedClient(ns));
  }

  private AIApplication createApplication(String name, TagLabel tag) {
    return SdkClients.adminClient()
        .aiApplications()
        .create(
            new CreateAIApplication()
                .withName(name)
                .withApplicationType(ApplicationType.Chatbot)
                .withDevelopmentStage(DevelopmentStage.Proposal)
                .withDescription("Estate visibility IT fixture")
                .withTags(tag == null ? null : List.of(tag)));
  }

  private static TagLabel restrictedTag() {
    return new TagLabel()
        .withTagFQN(RESTRICTED_TAG)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private void submitForReview(AIApplication app) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/aiGovernance/aiApplication/" + app.getId() + "/submitForReview",
            null,
            AIApplication.class);
  }

  /**
   * A principal denied {@code ViewBasic} on {@code aiApplication} assets tagged
   * {@value #RESTRICTED_TAG} (the hidden fixture), but allowed {@code Create} on {@code
   * auditReport} so the pack-request path is reachable. Wiring follows {@code
   * DenyPolicyPrincipals}: policy to role to team to user.
   */
  private OpenMetadataClient confinedClient(TestNamespace ns) {
    String p = ns.shortPrefix("confined");
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(p + "_policy")
                    .withDescription("Deny tagged aiApplication reads, allow audit pack requests")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName(p + "_packs")
                                .withResources(List.of("auditReport"))
                                .withOperations(List.of(MetadataOperation.CREATE))
                                .withEffect(Rule.Effect.ALLOW),
                            new Rule()
                                .withName(p + "_deny")
                                .withResources(List.of("aiApplication"))
                                .withOperations(List.of(MetadataOperation.VIEW_BASIC))
                                .withCondition("matchAnyTag('" + RESTRICTED_TAG + "')")
                                .withEffect(Rule.Effect.DENY))));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(p + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(p + "_team");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    createTeam.setDefaultRoles(List.of(role.getId()));
    Team team = admin.teams().create(createTeam);
    CreateUser createUser = new CreateUser();
    createUser.setName(p + "_user");
    createUser.setEmail(p + "_user@test.openmetadata.org");
    createUser.setTeams(List.of(team.getId()));
    User user = admin.users().create(createUser);
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  private AIGovernancePolicy retentionPolicy(TestNamespace ns) {
    // "log_retention" maps to the built-in "Audit log retention" rule both applications breach
    // (neither declares a data-retention period).
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/aiGovernancePolicies",
            new CreateAIGovernancePolicy()
                .withName(ns.prefix("audit_log_retention"))
                .withPolicyType(PolicyType.ComplianceCheck)
                .withDescription("Maps to the built-in audit log retention rule")
                .withEnabled(true),
            AIGovernancePolicy.class);
  }

  private AuditReport requestPack(OpenMetadataClient client, String name) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/auditReports",
            new CreateAuditReport()
                .withName(name)
                .withScope(AuditReportScope.Estate)
                .withFormat(AuditReportFormat.Json),
            AuditReport.class);
  }

  private AuditReport awaitCompleted(OpenMetadataClient client, UUID reportId) {
    AtomicReference<AuditReport> latest = new AtomicReference<>();
    await("audit report " + reportId + " completes")
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              AuditReport report =
                  client
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET, "/v1/auditReports/" + reportId, null, AuditReport.class);
              latest.set(report);
              return report.getStatus() == AuditReportStatus.Completed
                  || report.getStatus() == AuditReportStatus.Failed;
            });
    assertEquals(AuditReportStatus.Completed, latest.get().getStatus());
    return latest.get();
  }

  private String packJson(AuditReport report) {
    String downloadUrl = report.getArtifacts().get(0).getDownloadUrl();
    String prefix = "data:application/json;base64,";
    assertTrue(downloadUrl.startsWith(prefix), "expected a JSON data URL: " + downloadUrl);
    return new String(
        Base64.getDecoder().decode(downloadUrl.substring(prefix.length())), StandardCharsets.UTF_8);
  }

  private String byNamePath(String name) {
    return "/v1/aiApplications/name/" + name;
  }
}
