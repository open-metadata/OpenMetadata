package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * The pipeline a lineage write names, besides the edge's two ends.
 *
 * <p>The edge copies that entity, as stored, into the downstream entity's search document, which
 * every user can read. So only a pipeline or a stored procedure is accepted, and linking one needs
 * ViewBasic on it; otherwise anyone with EditLineage on two assets could copy a service's
 * connection, or an entity a policy hides from them, into search.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageEdgePipelineAuthorizationIT {

  private static final String LINEAGE_PATH = "/v1/lineage";
  private static final String SQL_QUERY = "select id from source_table";
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  private final Deque<Runnable> fixtureCleanups = new ArrayDeque<>();

  private record EdgeTables(Table from, Table to) {}

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

  @Test
  void putNamingServiceAsPipelineIsRejected(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    LineageDetails details = new LineageDetails().withPipeline(serviceOf(edge.from()));

    OpenMetadataClient admin = SdkClients.adminClient();
    assertThrows(InvalidRequestException.class, () -> putEdge(admin, edge, details));
    assertEdgeAbsent(edge);
  }

  @Test
  void patchNamingServiceAsPipelineIsRejected(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    OpenMetadataClient admin = SdkClients.adminClient();
    putEdge(admin, edge, new LineageDetails().withSqlQuery(SQL_QUERY));

    assertThrows(
        InvalidRequestException.class,
        () -> patchEdge(admin, edge, addPipelinePatch(serviceOf(edge.from()))));
    assertNull(getEdge(edge).getPipeline());
  }

  @Test
  void linkingPipelineCallerCannotViewIsForbidden(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline hidden = createPipeline(ns, "hidden");
    OpenMetadataClient caller =
        clientForPrincipalWithRules(
            ns, "nopipe", List.of(allowEditLineageOnTables(ns), denyViewingPipelines(ns)));

    assertThrows(
        ForbiddenException.class,
        () -> putEdge(caller, edge, new LineageDetails().withPipeline(ref(hidden))));
    assertEdgeAbsent(edge);
  }

  @Test
  void patchingInPipelineCallerCannotViewIsForbidden(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    putEdge(SdkClients.adminClient(), edge, new LineageDetails().withSqlQuery(SQL_QUERY));
    Pipeline hidden = createPipeline(ns, "hidden");
    OpenMetadataClient caller =
        clientForPrincipalWithRules(
            ns, "nopipepatch", List.of(allowEditLineageOnTables(ns), denyViewingPipelines(ns)));

    assertThrows(
        ForbiddenException.class, () -> patchEdge(caller, edge, addPipelinePatch(ref(hidden))));
    assertNull(getEdge(edge).getPipeline());
  }

  @Test
  void linkingPipelineCallerCanViewIsAllowed(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline visible = createPipeline(ns, "visible");
    OpenMetadataClient caller =
        clientForPrincipalWithRules(ns, "pipe", List.of(allowEditLineageOnTables(ns)));

    putEdge(caller, edge, new LineageDetails().withPipeline(ref(visible)));

    assertEquals(visible.getId(), getEdge(edge).getPipeline().getId());
  }

  @Test
  void pipelineAlreadyOnEdgeIsNotReauthorized(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline hidden = createPipeline(ns, "hidden");
    putEdge(SdkClients.adminClient(), edge, new LineageDetails().withPipeline(ref(hidden)));
    OpenMetadataClient caller =
        clientForPrincipalWithRules(
            ns, "resend", List.of(allowEditLineageOnTables(ns), denyViewingPipelines(ns)));

    // Ingestion re-sends the edge's stored pipeline on every write; that must keep working for a
    // writer who could not have linked the pipeline themselves.
    putEdge(caller, edge, new LineageDetails().withPipeline(ref(hidden)).withSqlQuery(SQL_QUERY));

    LineageDetails stored = getEdge(edge);
    assertEquals(SQL_QUERY, stored.getSqlQuery());
    assertEquals(hidden.getId(), stored.getPipeline().getId());
  }

  private static EdgeTables createEdgeTables(TestNamespace ns) {
    String schemaFqn = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    return new EdgeTables(
        TableTestFactory.createWithName(ns, schemaFqn, "src"),
        TableTestFactory.createWithName(ns, schemaFqn, "tgt"));
  }

  private static Pipeline createPipeline(TestNamespace ns, String name) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    return SdkClients.adminClient()
        .pipelines()
        .create(
            new CreatePipeline()
                .withName(ns.prefix(name))
                .withService(service.getFullyQualifiedName()));
  }

  private static EntityReference ref(Pipeline pipeline) {
    return new EntityReference().withId(pipeline.getId()).withType(Entity.PIPELINE);
  }

  private static EntityReference serviceOf(Table table) {
    return new EntityReference()
        .withId(table.getService().getId())
        .withType(Entity.DATABASE_SERVICE);
  }

  private static Rule allowEditLineageOnTables(TestNamespace ns) {
    return new Rule()
        .withName(ns.shortPrefix() + "editLineage")
        .withResources(List.of(Entity.TABLE))
        .withOperations(List.of(MetadataOperation.EDIT_LINEAGE))
        .withEffect(Rule.Effect.ALLOW);
  }

  // A deny on ViewAll also denies ViewBasic, the operation a newly linked pipeline needs.
  private static Rule denyViewingPipelines(TestNamespace ns) {
    return new Rule()
        .withName(ns.shortPrefix() + "denyPipelines")
        .withResources(List.of(Entity.PIPELINE))
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withEffect(Rule.Effect.DENY);
  }

  /** Policy, then role, then a user holding that role directly; returns a client for the user. */
  private OpenMetadataClient clientForPrincipalWithRules(
      TestNamespace ns, String label, List<Rule> rules) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = (ns.shortPrefix() + label).toLowerCase(Locale.ROOT);

    Policy policy =
        admin.policies().create(new CreatePolicy().withName(name + "_pol").withRules(rules));
    fixtureCleanups.push(() -> admin.policies().delete(policy.getId()));

    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(name + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    fixtureCleanups.push(() -> admin.roles().delete(role.getId()));

    // The principal name is the email's local part, so the two must match.
    String email = name + "_u@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(name + "_u")
                    .withEmail(email)
                    .withRoles(List.of(role.getId())));
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));

    return SdkClients.createClient(email, email, new String[] {});
  }

  private static String addPipelinePatch(EntityReference pipeline) {
    return """
        [{"op":"add","path":"/pipeline","value":{"id":"%s","type":"%s"}}]
        """
        .formatted(pipeline.getId(), pipeline.getType());
  }

  private static void putEdge(OpenMetadataClient client, EdgeTables edge, LineageDetails details) {
    client.getHttpClient().executeForString(HttpMethod.PUT, LINEAGE_PATH + edgePath(edge), details);
  }

  private static void patchEdge(OpenMetadataClient client, EdgeTables edge, String jsonPatch) {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            LINEAGE_PATH + edgePath(edge),
            JsonUtils.readTree(jsonPatch),
            JSON_PATCH);
  }

  private static LineageDetails getEdge(EdgeTables edge) {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + edgePath(edge), null);
    return JsonUtils.treeToValue(JsonUtils.readTree(response).get("edge"), LineageDetails.class);
  }

  private static void assertEdgeAbsent(EdgeTables edge) {
    ApiException missing = assertThrows(ApiException.class, () -> getEdge(edge));
    assertEquals(404, missing.getStatusCode());
  }

  private static String edgePath(EdgeTables edge) {
    return "/table/name/"
        + encodePathSegment(edge.from().getFullyQualifiedName())
        + "/table/name/"
        + encodePathSegment(edge.to().getFullyQualifiedName());
  }

  private static String encodePathSegment(String segment) {
    return URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
