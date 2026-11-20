package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageRootTypeIT {

  @ParameterizedTest
  @CsvSource({
    "getLineage,Upstream",
    "getLineage/Upstream,Upstream",
    "getLineage/Downstream,Downstream",
    "getLineageByEntityCount,Upstream",
    "getLineageByEntityCount,Downstream"
  })
  void sameNamedChartAndDashboardHaveSeparateGraphs(
      String endpoint, String direction, TestNamespace ns) {
    var client = SdkClients.adminClient();
    var service = DashboardServiceTestFactory.createMetabase(ns);
    var chart =
        client
            .charts()
            .create(new CreateChart().withName("375").withService(service.getFullyQualifiedName()));
    var dashboard =
        client
            .dashboards()
            .create(
                new CreateDashboard().withName("375").withService(service.getFullyQualifiedName()));
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table chartSource =
        TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "chart_source");
    Table dashboardSource =
        TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "dashboard_source");
    if (direction.equals("Upstream")) {
      putEdge(chartSource.getEntityReference(), chart.getEntityReference());
      putEdge(dashboardSource.getEntityReference(), dashboard.getEntityReference());
    } else {
      putEdge(chart.getEntityReference(), chartSource.getEntityReference());
      putEdge(dashboard.getEntityReference(), dashboardSource.getEntityReference());
    }
    assertEquals(chart.getFullyQualifiedName(), dashboard.getFullyQualifiedName());

    Awaitility.await("both independent lineage documents are indexed")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              assertGraph(
                  endpoint, direction, chart.getEntityReference(), chartSource, dashboardSource);
              assertGraph(
                  endpoint,
                  direction,
                  dashboard.getEntityReference(),
                  dashboardSource,
                  chartSource);
            });
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "getLineage",
        "getLineage/Upstream",
        "getLineage/Downstream",
        "getLineageByEntityCount",
        "getPaginationInfo"
      })
  void ambiguousUntypedRootsReturnBadRequest(final String endpoint, final TestNamespace ns) {
    final var admin = SdkClients.adminClient();
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final var chart =
        admin
            .charts()
            .create(new CreateChart().withName("375").withService(service.getFullyQualifiedName()));
    admin
        .dashboards()
        .create(new CreateDashboard().withName("375").withService(service.getFullyQualifiedName()));
    final var reader = chartReader(ns);
    final var options =
        RequestOptions.builder()
            .queryParams(Map.of("fqn", chart.getFullyQualifiedName(), "direction", "Downstream"))
            .build();
    Awaitility.await("ambiguous roots require an explicit type")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              for (final var client : List.of(admin, reader)) {
                final InvalidRequestException ambiguous =
                    assertThrows(
                        InvalidRequestException.class,
                        () ->
                            client
                                .getHttpClient()
                                .executeForString(
                                    HttpMethod.GET, "/v1/lineage/" + endpoint, null, options));
                assertEquals(400, ambiguous.getStatusCode());
                assertTrue(ambiguous.getMessage().contains("chart"));
                assertTrue(ambiguous.getMessage().contains("dashboard"));
              }
            });
  }

  @Test
  void requestedRootTypeControlsAuthorization(TestNamespace ns) {
    var admin = SdkClients.adminClient();
    var service = DashboardServiceTestFactory.createMetabase(ns);
    var chart =
        admin
            .charts()
            .create(new CreateChart().withName("375").withService(service.getFullyQualifiedName()));
    var dashboard =
        admin
            .dashboards()
            .create(
                new CreateDashboard().withName("375").withService(service.getFullyQualifiedName()));
    OpenMetadataClient reader = chartReader(ns);
    for (String endpoint :
        List.of("getLineage", "getLineage/Upstream", "getLineageByEntityCount")) {
      String typeParameter = endpoint.equals("getLineageByEntityCount") ? "entityType" : "type";
      var chartOptions = rootOptions(chart.getFullyQualifiedName(), typeParameter, Entity.CHART);
      String chartBody =
          reader
              .getHttpClient()
              .executeForString(HttpMethod.GET, "/v1/lineage/" + endpoint, null, chartOptions);
      assertEquals(
          chart.getId().toString(),
          JsonUtils.readTree(chartBody)
              .path("nodes")
              .path(chart.getFullyQualifiedName())
              .path("entity")
              .path("id")
              .asText());
      var dashboardOptions =
          rootOptions(dashboard.getFullyQualifiedName(), typeParameter, Entity.DASHBOARD);
      ForbiddenException denied =
          assertThrows(
              ForbiddenException.class,
              () ->
                  reader
                      .getHttpClient()
                      .executeForString(
                          HttpMethod.GET, "/v1/lineage/" + endpoint, null, dashboardOptions));
      assertEquals(403, denied.getStatusCode());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void untypedRequestSelectsAndAuthorizesTheLiveRoot(boolean deleteChart, TestNamespace ns) {
    var admin = SdkClients.adminClient();
    var service = DashboardServiceTestFactory.createMetabase(ns);
    var chart =
        admin
            .charts()
            .create(new CreateChart().withName("375").withService(service.getFullyQualifiedName()));
    var dashboard =
        admin
            .dashboards()
            .create(
                new CreateDashboard().withName("375").withService(service.getFullyQualifiedName()));
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table chartTarget =
        TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "chart_target");
    Table dashboardTarget =
        TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "dashboard_target");
    putEdge(chart.getEntityReference(), chartTarget.getEntityReference());
    putEdge(dashboard.getEntityReference(), dashboardTarget.getEntityReference());
    if (deleteChart) {
      admin.charts().delete(chart.getId().toString());
    } else {
      admin.dashboards().delete(dashboard.getId().toString());
    }
    var reader = chartReader(ns);
    var options =
        RequestOptions.builder()
            .queryParams(
                Map.of(
                    "fqn",
                    chart.getFullyQualifiedName(),
                    "includeDeleted",
                    "false",
                    "direction",
                    "Downstream",
                    "nodeDepth",
                    "1",
                    "size",
                    "1",
                    "upstreamDepth",
                    "0",
                    "downstreamDepth",
                    "1"))
            .build();
    Awaitility.await("authorization and traversal select the same live root")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              for (String endpoint :
                  List.of("getLineage", "getLineage/Downstream", "getLineageByEntityCount")) {
                String path = "/v1/lineage/" + endpoint;
                if (deleteChart) {
                  ForbiddenException denied =
                      assertThrows(
                          ForbiddenException.class,
                          () ->
                              reader
                                  .getHttpClient()
                                  .executeForString(HttpMethod.GET, path, null, options));
                  assertEquals(403, denied.getStatusCode());
                } else {
                  JsonNode nodes =
                      JsonUtils.readTree(
                              reader
                                  .getHttpClient()
                                  .executeForString(HttpMethod.GET, path, null, options))
                          .path("nodes");
                  assertEquals(
                      chart.getId().toString(),
                      nodes.path(chart.getFullyQualifiedName()).path("entity").path("id").asText());
                  assertTrue(nodes.has(chartTarget.getFullyQualifiedName()));
                  assertFalse(nodes.has(dashboardTarget.getFullyQualifiedName()));
                }
              }
            });
  }

  private static RequestOptions rootOptions(String fqn, String typeParameter, String type) {
    return RequestOptions.builder()
        .queryParams(
            Map.of(
                "fqn",
                fqn,
                typeParameter,
                type,
                "direction",
                "Upstream",
                "nodeDepth",
                "0",
                "upstreamDepth",
                "0",
                "downstreamDepth",
                "0"))
        .build();
  }

  private static OpenMetadataClient chartReader(TestNamespace ns) {
    var admin = SdkClients.adminClient();
    String name = ns.shortPrefix("reader").toLowerCase(Locale.ROOT);
    Rule charts =
        new Rule()
            .withName("readCharts")
            .withResources(List.of(Entity.CHART, Entity.TABLE))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule dashboards =
        new Rule()
            .withName("denyDashboards")
            .withResources(List.of(Entity.DASHBOARD))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    var policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(name + "_policy")
                        .withRules(List.of(charts, dashboards))));
    var role =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(name + "_role")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    String email = name + "@test.openmetadata.org";
    ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId()))));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static void putEdge(EntityReference from, EntityReference to) {
    SdkClients.adminClient()
        .lineage()
        .addLineage(
            new AddLineage().withEdge(new EntitiesEdge().withFromEntity(from).withToEntity(to)));
  }

  private static void assertGraph(
      String endpoint, String direction, EntityReference root, Table ownSource, Table otherSource) {
    String typeParameter = endpoint.equals("getLineageByEntityCount") ? "entityType" : "type";
    var options =
        RequestOptions.builder()
            .queryParams(
                Map.of(
                    "fqn",
                    root.getFullyQualifiedName(),
                    typeParameter,
                    root.getType(),
                    "direction",
                    direction,
                    "upstreamDepth",
                    "1",
                    "downstreamDepth",
                    direction.equals("Downstream") ? "1" : "0",
                    "nodeDepth",
                    "1",
                    "size",
                    "1"))
            .build();
    String body =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/" + endpoint, null, options);
    JsonNode nodes = JsonUtils.readTree(body).path("nodes");
    assertEquals(
        root.getId().toString(),
        nodes.path(root.getFullyQualifiedName()).path("entity").path("id").asText());
    assertTrue(nodes.has(ownSource.getFullyQualifiedName()));
    assertFalse(nodes.has(otherSource.getFullyQualifiedName()));
  }
}
