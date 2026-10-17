package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
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
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PipelineMetrics;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Regression integration test for the RBAC authorization gap on {@code GET /v1/pipelines/metrics}.
 *
 * <p>Before the fix, {@code PipelineResource.getPipelineMetrics} placed the {@code
 * authorizer.authorize(...)} call <em>inside</em> a {@code try { ... } catch (Exception e)} block.
 * Because {@code AuthorizationException extends RuntimeException} (an {@code Exception}), a denied
 * caller's {@code AuthorizationException} was caught and the endpoint returned {@code HTTP 200}
 * with {@code PipelineMetrics{totalPipelines:0, dataAvailable:false, errorMessage=<denial message>}}
 * instead of {@code HTTP 403 Forbidden}. After the fix, the authorize call runs <em>before</em> the
 * try block (matching the sibling {@code /executionTrend} and {@code /runtimeTrend} endpoints), so
 * a denial propagates to {@code CatalogGenericExceptionMapper} and returns {@code 403}.
 *
 * <p>There is no SDK helper for the metrics endpoint (it is a raw collection-level aggregate), so
 * the test invokes it through {@code OpenMetadataClient.getHttpClient().execute(...)} with {@link
 * PipelineMetrics} as the response class. Structure mirrors {@link PipelineStatusAuthorizationIT}:
 * standalone, {@link ExecutionMode#CONCURRENT}, fixtures cleaned via a LIFO {@link Deque} in {@link
 * AfterEach}.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PipelineMetricsAuthorizationIT {

  private static final String METRICS_PATH = "/v1/pipelines/metrics";
  private static final String EXECUTION_TREND_PATH =
      "/v1/pipelines/executionTrend?startTs=0&endTs=9999999999999";
  private static final String RUNTIME_TREND_PATH =
      "/v1/pipelines/runtimeTrend?startTs=0&endTs=9999999999999";

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
  // 2.1  Primary regression: a denied principal now hits 403 on GET /v1/pipelines/metrics.
  //      Fails on unfixed code (returns 200 with empty metrics + the denial message in
  //      errorMessage), passes on fixed code (ForbiddenException).
  // ===================================================================================
  @Test
  void get_pipelineMetrics_deniedForUnauthorizedPrincipal_403(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    // Seed a pipeline so the metrics query has data to aggregate (also exercises the happy path
    // below). The deny is collection-level on the `pipeline` entity type, so it fires before the
    // query runs regardless of which pipelines exist.
    Pipeline pipeline = createPipeline(ns);

    // Principal carrying one unconditional DENY VIEW_ALL rule (subsumes VIEW_BASIC on the deny side
    // via CompiledRule.matchesBySubsumption). Role is assigned DIRECTLY on the user.
    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "pmetricsDenyRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient denied = clientForPrincipalWithRules(ns, "pmetrics", List.of(deny));

    // Canonical control: the entity-GET already enforces VIEW_BASIC. Admin sanity check.
    assertNotNull(
        admin.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "admin must be able to read the pipeline; sanity check");

    // The canonical entity-GET denies the same principal -> 403 (control that the deny reaches
    // the principal and that VIEW_ALL deny subsumes VIEW_BASIC).
    assertThrows(
        ForbiddenException.class,
        () -> denied.pipelines().get(pipeline.getId().toString(), "pipelineStatus"),
        "Canonical GET ?fields=pipelineStatus must deny a VIEW_ALL-denied principal");

    // The fix: the collection-level metrics-GET must now also deny the principal. On unfixed code
    // this returned 200 with {totalPipelines:0, dataAvailable:false, errorMessage:<denial msg>};
    // on fixed code it throws 403.
    assertThrows(
        ForbiddenException.class,
        () ->
            denied
                .getHttpClient()
                .execute(HttpMethod.GET, METRICS_PATH, null, PipelineMetrics.class),
        "GET /v1/pipelines/metrics must deny a VIEW_ALL-denied principal after the fix");

    // No over-block / no regression for admin: admin short-circuits and reads real metrics
    // (dataAvailable=true because the DB query succeeds).
    PipelineMetrics adminMetrics =
        admin.getHttpClient().execute(HttpMethod.GET, METRICS_PATH, null, PipelineMetrics.class);
    assertNotNull(adminMetrics, "admin must get a PipelineMetrics body");
    assertTrue(
        Boolean.TRUE.equals(adminMetrics.getDataAvailable()),
        "admin metrics must report dataAvailable=true (DB query succeeded)");
  }

  // ===================================================================================
  // 2.2  No over-block for an authorized principal: a user with only the default
  //      Organization VIEW_ALL allow (auto-joined on create) still receives 200 with a real
  //      PipelineMetrics body. Confirms the new authorize call uses VIEW_BASIC and does not
  //      accidentally require a higher operation or block ordinary users.
  // ===================================================================================
  @Test
  void get_pipelineMetrics_authorizedPrincipal_200_noOverBlock(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    createPipeline(ns); // seed data behind the aggregate

    // A plain user (auto-joined to Organization, which carries OrganizationPolicy-ViewAll-Rule
    // granting allow ViewAll on ["all"]). VIEW_BASIC is subsumed by VIEW_ALL.
    User u = createTestUser(ns, "pmetricsreader");
    OpenMetadataClient reader =
        SdkClients.createClient(u.getEmail(), u.getEmail(), new String[] {});

    PipelineMetrics readerMetrics =
        reader.getHttpClient().execute(HttpMethod.GET, METRICS_PATH, null, PipelineMetrics.class);
    assertNotNull(readerMetrics, "A default-organization user may read GET /v1/pipelines/metrics");
    assertTrue(
        Boolean.TRUE.equals(readerMetrics.getDataAvailable()),
        "Authorized reader metrics must report dataAvailable=true");

    // Admin control: identical shape.
    assertNotNull(
        admin.getHttpClient().execute(HttpMethod.GET, METRICS_PATH, null, PipelineMetrics.class),
        "Admin also reads metrics");
  }

  // ===================================================================================
  // 2.3  A read-allowed / write-denied principal may read metrics (200) — confirms the authorize
  //      call uses VIEW_BASIC (allow) and not a write operation. The deny is on EDIT_STATUS, which
  //      must NOT block the read.
  // ===================================================================================
  @Test
  void get_pipelineMetrics_readAllowedButWriteDenied_readsMetricsCorrectly(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    createPipeline(ns);

    Rule allowView =
        new Rule()
            .withName(ns.shortPrefix() + "pmetricsAllowViewRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyEdit =
        new Rule()
            .withName(ns.shortPrefix() + "pmetricsDenyEditRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.EDIT_STATUS))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient reader =
        clientForPrincipalWithRules(ns, "pmetricsrw", List.of(allowView, denyEdit));

    assertNotNull(
        reader.getHttpClient().execute(HttpMethod.GET, METRICS_PATH, null, PipelineMetrics.class),
        "A VIEW_ALL-allowed / EDIT_STATUS-denied principal may read GET /v1/pipelines/metrics");
    assertNotNull(
        admin.getHttpClient().execute(HttpMethod.GET, METRICS_PATH, null, PipelineMetrics.class),
        "Admin control: reads metrics");
  }

  // ===================================================================================
  // 2.4  No regression of the sibling trend endpoints: a denied principal must still hit 403
  //      on /executionTrend and /runtimeTrend (they were already correct). Pins that the
  //      shared edit context / authorize pattern is consistent across the three observability
  //      endpoints.
  // ===================================================================================
  @Test
  void get_pipelineMetrics_siblingTrendEndpointsStillDeny_403(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    createPipeline(ns);

    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "pmetricsTrendDenyRule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient denied = clientForPrincipalWithRules(ns, "pmetricstrend", List.of(deny));

    assertThrows(
        ForbiddenException.class,
        () ->
            denied
                .getHttpClient()
                .execute(HttpMethod.GET, EXECUTION_TREND_PATH, null, Object.class),
        "GET /v1/pipelines/executionTrend must deny a VIEW_ALL-denied principal (no regression)");
    assertThrows(
        ForbiddenException.class,
        () ->
            denied.getHttpClient().execute(HttpMethod.GET, RUNTIME_TREND_PATH, null, Object.class),
        "GET /v1/pipelines/runtimeTrend must deny a VIEW_ALL-denied principal (no regression)");
  }

  // ===================================================================================
  // Helpers
  // ===================================================================================

  /** Creates a pipeline with two tasks under a fresh Airflow pipeline service. */
  private Pipeline createPipeline(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    fixtureCleanups.push(
        () ->
            admin
                .pipelineServices()
                .delete(
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_metrics_" + UUID.randomUUID().toString().substring(0, 6)));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(
        Arrays.asList(
            new Task().withName("task1").withDescription("Task 1"),
            new Task().withName("task2").withDescription("Task 2")));
    Pipeline pipeline = admin.pipelines().create(request);
    fixtureCleanups.push(
        () -> admin.pipelines().delete(pipeline.getId().toString(), Map.of("hardDelete", "true")));
    return pipeline;
  }

  /** Policy -> role -> user (role assigned directly on the user) and returns a client for that user. */
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
   * Creates a user with the default Organization team (auto-joined on create). The user's NAME
   * must equal the email LOCAL-PART because JwtFilter derives the principal name from the email
   * local-part (see {@link PipelineStatusAuthorizationIT#createTestUser}).
   */
  private User createTestUser(TestNamespace ns, String suffix) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = ns.shortPrefix(suffix).toLowerCase();
    String email = name + "@test.openmetadata.org";
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDescription("Test user for pipeline metrics auth");
    User user = admin.users().create(createUser);
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));
    return user;
  }
}
