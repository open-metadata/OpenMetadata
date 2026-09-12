package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Regression integration test for the RBAC authorization gap on {@code GET /v1/pipelines/{fqn}/status}.
 *
 * <p>Before the fix, {@code PipelineResource.list} never called {@code authorizer.authorize(...)} so
 * the dedicated status-GET returned the full raw {@link PipelineStatus} time-series to any
 * authenticated caller, even when an owner-team deny policy (e.g. the shipped
 * {@code TeamOnlyPolicy.json} predicate {@code !matchTeam()}) withheld the canonical
 * {@code GET /v1/pipelines/{id}?fields=pipelineStatus} from a non-member of the owning team with a
 * paired 403. After the fix, the dedicated status-GET enforces {@link
 * MetadataOperation#VIEW_BASIC} with a per-resource {@link
 * org.openmetadata.service.security.policyevaluator.ResourceContext} (bound to the {@code fqn}
 * path param), matching the canonical entity-GET and the {@code getPipelineObservability} sibling.
 *
 * <p>The test exercises both a role-scoped unconditional view-deny (deterministic) and the exact
 * bug-report exploit scenario (a {@code !matchTeam()} conditional deny attached directly to the
 * owning team's {@code policies}). Structure mirrors {@link QueryVisibilityPolicyIT}:
 * standalone, {@link ExecutionMode#CONCURRENT}, fixtures cleaned via a LIFO {@link Deque} in
 * {@link AfterEach}.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PipelineStatusAuthorizationIT {

  private final Deque<Runnable> fixtureCleanups = new ArrayDeque<>();

  @AfterEach
  void removeFixtures() {
    while (!fixtureCleanups.isEmpty()) {
      try {
        fixtureCleanups.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown: a cleanup failure must not mask the assertion result.
      }
    }
  }

  // ===================================================================================
  // 2.1  Primary regression: a denied principal now hits 403 on GET /{fqn}/status too.
  //      Fails on unfixed code (returns 200), passes on fixed code (ForbiddenException).
  // ===================================================================================
  @Test
  void get_pipelineStatus_deniedForUnauthorizedPrincipal_403(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Pipeline pipeline = createPipeline(ns, null);
    String fqn = pipeline.getFullyQualifiedName();
    seedPipelineStatuses(admin, fqn, 5);
    long startTs = 0L;
    long endTs = 9999999999999L;

    // Principal carrying one unconditional DENY VIEW_ALL rule (subsumes VIEW_BASIC on the deny
    // side via CompiledRule.matchesBySubsumption). Role is assigned DIRECTLY on the user (a role
    // granted only through a team's defaultRoles is not applied during policy evaluation).
    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "pstatDenyRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient denied = clientForPrincipalWithRules(ns, "pstat", List.of(deny));

    // Canonical control: the dedicated entity-GET already enforces VIEW_BASIC. Admin sanity
    // check (admin short-circuits and CAN read the pipeline status).
    assertNotNull(
        admin.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "admin must be able to read the pipeline status; sanity check");

    // The canonical entity-GET denies the same principal → 403 (control).
    assertThrows(
        ForbiddenException.class,
        () -> denied.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "Canonical GET ?fields=pipelineStatus must deny a VIEW_ALL-denied principal");

    // The fix: the dedicated status-GET must now also deny the principal. On unfixed code this
    // returned 200 with the full time-series (the bypass); on fixed code it throws 403.
    assertThrows(
        ForbiddenException.class,
        () -> denied.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "GET /{fqn}/status must deny a VIEW_ALL-denied principal after the fix");

    // No over-block / no regression for an authorized principal: admin short-circuits and reads
    // the full time-series; the count and shape are unchanged (guarantee B2). Pagination of the
    // dedicated status-GET is already exercised by PipelineResourceIT.put_bulkPipelineStatus_200_OK
    // (limit/before/after against the same time-series); this assertion pins the total count.
    @SuppressWarnings("unchecked")
    ListResponse<PipelineStatus> all =
        (ListResponse<PipelineStatus>) admin.pipelines().listPipelineStatuses(fqn, startTs, endTs);
    assertEquals(5, all.getData().size(), "admin must see all 5 seeded statuses");
  }

  // ===================================================================================
  // 2.2  The exact bug-report exploit: a !matchTeam() conditional deny attached directly to the
  //      owning team's policies. Non-member is denied (the bypass, now fixed); direct member and
  //      child-team member keep access (the shipped hierarchy-aware predicate does not over-block).
  // ===================================================================================
  @Test
  void get_pipelineStatus_ownerTeamMatchTeamDeny_enforcesPerResource(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();

    // The shipped TeamOnlyPolicy.json predicate: deny All operations when !matchTeam().
    Rule teamOnlyDeny =
        new Rule()
            .withName(ns.shortPrefix() + "teamOnlyDenyRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.ALL))
            .withEffect(Rule.Effect.DENY)
            .withCondition("!matchTeam()");
    Policy denyPolicy =
        admin.policies().create(denyPolicy(ns, "teamOnlyPol", List.of(teamOnlyDeny)));
    fixtureCleanups.push(() -> admin.policies().delete(denyPolicy.getId()));

    // Hierarchy design (the only constructible form under OpenMetadata's team-type rules: only a
    // GROUP may own entities, but a GROUP can't be a parent — so the owning team is a GROUP whose
    // ancestor carries the deny policy, and the "same-hierarchy" principal is a sibling GROUP under
    // that same ancestor):
    //   D (DEPARTMENT, carries the !matchTeam() deny on its policies)
    //     ├── T (GROUP, owns the pipeline)         — owner team
    //     └── C (GROUP)                            — sibling under D
    // The deny reaches the T-owned pipeline via the resource-owner policy loader, which walks the
    // owner team's parent chain and loads D's direct policies (skipRoles=true). matchTeam() then
    // evaluates policyContext=D and walks the user's and owner's parent chains up to D.
    CreateTeam createD =
        new CreateTeam()
            .withName(ns.prefix("hierarchyRootD"))
            .withTeamType(TeamType.DEPARTMENT)
            .withPolicies(List.of(denyPolicy.getId()))
            .withIsJoinable(true)
            .withDescription("Hierarchy root carrying the !matchTeam() deny");
    Team teamD = admin.teams().create(createD);
    fixtureCleanups.push(
        () ->
            admin
                .teams()
                .delete(
                    teamD.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));

    // T (GROUP, parent D) — the owner team.
    CreateTeam createT =
        new CreateTeam()
            .withName(ns.prefix("ownerTeamT"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(teamD.getId()))
            .withIsJoinable(true)
            .withDescription("Owner GROUP team under D");
    Team teamT = admin.teams().create(createT);
    fixtureCleanups.push(
        () -> admin.teams().delete(teamT.getId().toString(), Map.of("hardDelete", "true")));

    // C (GROUP, parent D) — sibling of T, to exercise hierarchy-aware !matchTeam() beyond direct
    // ownership (the principal is NOT a member of the owning team T but is in the same hierarchy D,
    // so isUserUnderTeam(D) is true and matchTeam() is true → access preserved).
    CreateTeam createC =
        new CreateTeam()
            .withName(ns.prefix("siblingTeamC"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(teamD.getId()))
            .withIsJoinable(true)
            .withDescription("Sibling GROUP team under D");
    Team teamC = admin.teams().create(createC);
    fixtureCleanups.push(
        () -> admin.teams().delete(teamC.getId().toString(), Map.of("hardDelete", "true")));

    // Pipeline owned by team T.
    Pipeline pipeline = createPipeline(ns, teamT.getEntityReference());
    String fqn = pipeline.getFullyQualifiedName();
    seedPipelineStatuses(admin, fqn, 3);
    long startTs = 0L;
    long endTs = 9999999999999L;

    // Non-member: in Organization only (auto-joined on create), NOT under D's hierarchy.
    User uOutside = createTestUser(ns, "u_outside", null);
    OpenMetadataClient cOutside =
        SdkClients.createClient(uOutside.getEmail(), uOutside.getEmail(), new String[] {});

    // Direct member of T (also under D via T's parent D).
    User uMember = createTestUser(ns, "u_member", List.of(teamT.getId()));
    OpenMetadataClient cMember =
        SdkClients.createClient(uMember.getEmail(), uMember.getEmail(), new String[] {});

    // Sibling member: member of C (NOT of T), but under D like the owner T — exercises hierarchy.
    User uSibling = createTestUser(ns, "u_sibling", List.of(teamC.getId()));
    OpenMetadataClient cSibling =
        SdkClients.createClient(uSibling.getEmail(), uSibling.getEmail(), new String[] {});

    // --- Non-member (outside D): the bypass, now closed ---
    // Canonical control: 403 (deny fires: matchTeam() false → !matchTeam() true).
    assertThrows(
        ForbiddenException.class,
        () -> cOutside.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "Principal outside D's hierarchy must be denied the canonical pipelineStatus read");
    // The fix: the dedicated status-GET must also 403 (was 200 before the fix).
    assertThrows(
        ForbiddenException.class,
        () -> cOutside.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "Principal outside D's hierarchy must be denied GET /{fqn}/status after the fix");

    // --- Direct member of T: no over-block ---
    assertNotNull(
        cMember.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "Direct member of T keeps canonical pipelineStatus access");
    assertNotNull(
        cMember.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "Direct member of T keeps GET /{fqn}/status access");

    // --- Sibling member of C (same hierarchy D as the owner T, but NOT a member of T):
    //     hierarchy-aware matchTeam() preserves access ---
    assertNotNull(
        cSibling.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "Sibling under D keeps canonical pipelineStatus access (hierarchy-aware !matchTeam)");
    assertNotNull(
        cSibling.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "Sibling under D keeps GET /{fqn}/status access (hierarchy-aware !matchTeam)");

    // --- Admin control: unaffected ---
    assertNotNull(
        admin.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "Admin must still read the full time-series");
  }

  // ===================================================================================
  // 2.3  Ownerless pipeline edge (report Exploit §4): the role-scoped VIEW_ALL deny denies
  //      regardless of owners, so both the canonical read and the dedicated status-GET are 403
  //      after the fix (both were 200 before the fix on the dedicated GET).
  // ===================================================================================
  @Test
  void get_pipelineStatus_ownerlessPipeline_deniedPrincipal_403(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Pipeline pipeline = createPipeline(ns, null); // no owners
    String fqn = pipeline.getFullyQualifiedName();
    seedPipelineStatuses(admin, fqn, 2);
    long startTs = 0L;
    long endTs = 9999999999999L;

    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "pstatOwnerlessDenyRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient denied = clientForPrincipalWithRules(ns, "pstatless", List.of(deny));

    assertThrows(
        ForbiddenException.class,
        () -> denied.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "Canonical read of an ownerless pipeline must deny a VIEW_ALL-denied principal");
    assertThrows(
        ForbiddenException.class,
        () -> denied.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "Dedicated status-GET of an ownerless pipeline must deny after the fix");

    assertNotNull(
        admin.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "Admin still reads the ownerless pipeline's statuses");
  }

  // ===================================================================================
  // 2.5  Write-sibling no-regression + correct operation: a principal allowed VIEW_ALL but
  //      denied EDIT_STATUS may READ the status (200) but may NOT write/delete it (403). Confirms
  //      the new authorize call uses VIEW_BASIC (allow) and does not accidentally require edit,
  //      and the three /{fqn}/status* write siblings still enforce EDIT_STATUS.
  // ===================================================================================
  @Test
  void get_pipelineStatus_readAllowedButWriteDenied_viewsEditStatusCorrectly(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Pipeline pipeline = createPipeline(ns, null);
    String fqn = pipeline.getFullyQualifiedName();
    long ts = seedPipelineStatuses(admin, fqn, 1);
    long startTs = 0L;
    long endTs = 9999999999999L;

    // ALLOW VIEW_ALL (reads allowed via this rule; also via default OrganizationPolicy) and a
    // DENY on EDIT_STATUS (writes denied).
    Rule allowView =
        new Rule()
            .withName(ns.shortPrefix() + "pstatAllowViewRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyEdit =
        new Rule()
            .withName(ns.shortPrefix() + "pstatDenyEditRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.EDIT_STATUS))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient reader =
        clientForPrincipalWithRules(ns, "pstatrw", List.of(allowView, denyEdit));

    // Reading the dedicated status-GET is allowed → 200 (the new authorize call uses VIEW_BASIC,
    // subsumed by the VIEW_ALL allow).
    assertNotNull(
        reader.pipelines().listPipelineStatuses(fqn, startTs, endTs),
        "A VIEW_ALL-allowed principal may read GET /{fqn}/status");

    // Writing/clearing statuses is denied at EDIT_STATUS → 403 (no regression in the write
    // siblings; deny-first evaluation fires).
    PipelineStatus newStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Successful)
            .withTimestamp(System.currentTimeMillis())
            .withTaskStatus(
                Arrays.asList(
                    new Status().withName("task1").withExecutionStatus(StatusType.Successful)));
    assertThrows(
        ForbiddenException.class,
        () -> reader.pipelines().addPipelineStatus(fqn, newStatus),
        "PUT /{fqn}/status must deny an EDIT_STATUS-denied principal");
    assertThrows(
        ForbiddenException.class,
        () -> reader.pipelines().addBulkPipelineStatus(fqn, List.of(newStatus)),
        "PUT /{fqn}/status/bulk must deny an EDIT_STATUS-denied principal");
    assertThrows(
        ForbiddenException.class,
        () ->
            reader
                .getHttpClient()
                .execute(HttpMethod.DELETE, deleteStatusPath(fqn, ts), null, Pipeline.class),
        "DELETE /{fqn}/status/{timestamp} must deny an EDIT_STATUS-denied principal");

    // Admin still writes fine (no regression for admins).
    assertNotNull(admin.pipelines().listPipelineStatuses(fqn, startTs, endTs));
  }

  // ===================================================================================
  // Helpers
  // ===================================================================================

  /** Creates a pipeline (with tasks task1/task2) optionally owned by {@code owner}. */
  private Pipeline createPipeline(TestNamespace ns, EntityReference owner) {
    OpenMetadataClient admin = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    fixtureCleanups.push(
        () ->
            admin
                .pipelineServices()
                .delete(
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_status_" + UUID.randomUUID().toString().substring(0, 6)));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(
        Arrays.asList(
            new Task().withName("task1").withDescription("Task 1"),
            new Task().withName("task2").withDescription("Task 2")));
    if (owner != null) {
      request.setOwners(List.of(owner));
    }
    Pipeline pipeline = admin.pipelines().create(request);
    fixtureCleanups.push(
        () -> admin.pipelines().delete(pipeline.getId().toString(), Map.of("hardDelete", "true")));
    return pipeline;
  }

  /**
   * Seeds {@code count} pipeline status records on {@code fqn} via the admin client and returns the
   * oldest timestamp it wrote (used by callers that need a DELETE target).
   */
  private long seedPipelineStatuses(OpenMetadataClient admin, String fqn, int count)
      throws Exception {
    long base = System.currentTimeMillis() - count * 60_000L;
    List<PipelineStatus> bulk = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      bulk.add(
          new PipelineStatus()
              .withExecutionStatus(i % 2 == 0 ? StatusType.Successful : StatusType.Failed)
              .withTimestamp(base + i * 60_000L)
              .withTaskStatus(
                  Arrays.asList(
                      new Status().withName("task1").withExecutionStatus(StatusType.Successful),
                      new Status().withName("task2").withExecutionStatus(StatusType.Failed))));
    }
    admin.pipelines().addBulkPipelineStatus(fqn, bulk);
    return base;
  }

  /** Policy → role → user (role assigned directly on the user) and returns a client for that user. */
  private OpenMetadataClient clientForPrincipalWithRules(
      TestNamespace ns, String label, List<Rule> rules) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String p = ns.shortPrefix() + label;

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(p + "_pol");
    createPolicy.setRules(rules);
    Policy policy = admin.policies().create(createPolicy);
    fixtureCleanups.push(() -> admin.policies().delete(policy.getId()));

    org.openmetadata.schema.api.teams.CreateRole createRoleRequest =
        new org.openmetadata.schema.api.teams.CreateRole();
    createRoleRequest.setName(p + "_role");
    createRoleRequest.setPolicies(List.of(policy.getFullyQualifiedName()));
    org.openmetadata.schema.entity.teams.Role role = admin.roles().create(createRoleRequest);
    fixtureCleanups.push(() -> admin.roles().delete(role.getId()));

    String email = p + "_u@test.openmetadata.org";
    CreateUser createUser = new CreateUser();
    createUser.setName(p + "_u");
    createUser.setEmail(email);
    createUser.setRoles(List.of(role.getId()));
    User user = admin.users().create(createUser);
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));

    return SdkClients.createClient(email, email, new String[] {});
  }

  /**
   * Creates a user optionally assigned to the given teams. The user's NAME must equal the email
   * LOCAL-PART because the server's JwtFilter derives the principal name from the email local-part
   * (SecurityUtil.findUserNameFromClaims splits the JWT subject on '@') and the authorizer then
   * loads the user by that name — so name != email-local-part yields 404. We use {@link
   * TestNamespace#shortPrefix(String)} (short and stable across the test method) for both, mirroring
   * the working {@code principalWithRules} pattern in {@link QueryVisibilityPolicyIT}. Created
   * users are auto-joined to the Organization team by the server (see {@code UserRepository}), so a
   * {@code null} teamIds list still gives them the default VIEW_ALL allow from {@code
   * OrganizationPolicy}.
   */
  private User createTestUser(TestNamespace ns, String suffix, List<UUID> teamIds) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = ns.shortPrefix(suffix).toLowerCase();
    String email = name + "@test.openmetadata.org";
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withTeams(teamIds)
            .withDescription("Test user");
    User user = admin.users().create(createUser);
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));
    return user;
  }

  private CreatePolicy denyPolicy(TestNamespace ns, String name, List<Rule> rules) {
    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(ns.prefix(name));
    createPolicy.setRules(rules);
    return createPolicy;
  }

  private String deleteStatusPath(String fqn, long timestamp) {
    return "/v1/pipelines/"
        + URLEncoder.encode(fqn, StandardCharsets.UTF_8).replace("+", "%20")
        + "/status/"
        + timestamp;
  }
}
