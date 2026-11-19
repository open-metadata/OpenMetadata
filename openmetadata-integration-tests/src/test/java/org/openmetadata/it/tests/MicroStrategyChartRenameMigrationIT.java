package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.services.connections.dashboard.MicroStrategyConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.utils.v209.MicroStrategyChartRename;

/**
 * MicroStrategy charts were named {@code <pageKey><vizKey>}, which repeats across dossiers, so two
 * dossiers could share one chart. The 2.0.9 migration renames each chart after its dashboard's
 * dossier id and keeps what users added; a shared chart is copied for every other dashboard.
 */
// Sequential: renameAll sweeps every MicroStrategy service in the database.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class MicroStrategyChartRenameMigrationIT {
  private static final String FIELDS = "owners,followers,tags,dashboards";
  private static final String DESCRIPTION = "Written by hand";
  private static final String TAG = "PII.Sensitive";

  @Test
  void chartsAreRenamedByDossierAndKeepWhatUsersAdded(TestNamespace ns) {
    DashboardService service = createService(ns);
    EntityReference admin =
        SdkClients.adminClient().users().getByName("admin").getEntityReference();
    Chart shared = createChart(service, "K53W63", admin);
    Chart own = createChart(service, "K53W64", admin);
    follow(shared, admin);
    Dashboard first = createDashboard(service, dossierId(), shared, own);
    Dashboard second = createDashboard(service, dossierId(), shared);
    List<Dashboard> byId =
        Stream.of(first, second)
            .sorted(Comparator.comparing(dashboard -> dashboard.getId().toString()))
            .toList();
    Dashboard keeper = byId.get(0);
    Dashboard other = byId.get(1);

    assertEquals(3, renameAll(), "two renamed in place, one copy of the shared chart");

    Chart renamedOwn = getChart(service, first.getName() + "_K53W64");
    assertEquals(own.getId(), renamedOwn.getId());
    assertKeepsUserMetadata(renamedOwn);

    Chart renamedShared = getChart(service, keeper.getName() + "_K53W63");
    assertEquals(shared.getId(), renamedShared.getId());
    assertKeepsUserMetadata(renamedShared);
    assertEquals(List.of(keeper.getId()), dashboardIds(renamedShared));

    Chart copy = getChart(service, other.getName() + "_K53W63");
    assertNotEquals(shared.getId(), copy.getId());
    assertKeepsUserMetadata(copy);
    assertEquals(List.of(other.getId()), dashboardIds(copy));
    assertEquals(
        List.of(admin.getId()), copy.getFollowers().stream().map(EntityReference::getId).toList());

    assertThrows(
        OpenMetadataException.class,
        () -> SdkClients.adminClient().charts().getByName(fqn(service, "K53W63")));
    assertEquals(0, renameAll(), "a renamed chart needs nothing on a second run");
  }

  @Test
  void chartsOfOtherDashboardServicesAreNotRenamed(TestNamespace ns) {
    DashboardService service = createService(ns, DashboardServiceType.Metabase);
    Chart chart = createChart(service, "K53W63", null);
    createDashboard(service, dossierId(), chart);

    renameAll();

    assertEquals(
        "K53W63", SdkClients.adminClient().charts().get(chart.getId().toString()).getName());
  }

  private static int renameAll() {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle -> MicroStrategyChartRename.renameAll(handle, Entity.getCollectionDAO()));
  }

  private static void assertKeepsUserMetadata(Chart chart) {
    assertEquals(DESCRIPTION, chart.getDescription());
    assertEquals(List.of(TAG), chart.getTags().stream().map(TagLabel::getTagFQN).toList());
    assertEquals(
        List.of("admin"), chart.getOwners().stream().map(EntityReference::getName).toList());
  }

  private static DashboardService createService(TestNamespace ns) {
    return createService(ns, DashboardServiceType.MicroStrategy);
  }

  private static DashboardService createService(TestNamespace ns, DashboardServiceType type) {
    CreateDashboardService request =
        new CreateDashboardService()
            .withName(ns.prefix("mstr_" + UUID.randomUUID().toString().substring(0, 8)))
            .withServiceType(type);
    if (type == DashboardServiceType.MicroStrategy) {
      request.withConnection(
          new DashboardConnection()
              .withConfig(
                  new MicroStrategyConnection()
                      .withHostPort(URI.create("http://localhost:8080"))
                      .withUsername("admin")));
    }
    return ns.trackRoot(
        Entity.DASHBOARD_SERVICE, SdkClients.adminClient().dashboardServices().create(request));
  }

  private static Chart createChart(DashboardService service, String name, EntityReference owner) {
    CreateChart request =
        new CreateChart()
            .withName(name)
            .withService(service.getFullyQualifiedName())
            .withDescription(DESCRIPTION)
            .withTags(
                List.of(
                    new TagLabel()
                        .withTagFQN(TAG)
                        .withSource(TagLabel.TagSource.CLASSIFICATION)
                        .withLabelType(TagLabel.LabelType.MANUAL)
                        .withState(TagLabel.State.CONFIRMED)));
    if (owner != null) {
      request.withOwners(List.of(owner));
    }
    return SdkClients.adminClient().charts().create(request);
  }

  private static Dashboard createDashboard(
      DashboardService service, String dossierId, Chart... charts) {
    return SdkClients.adminClient()
        .dashboards()
        .create(
            new CreateDashboard()
                .withName(dossierId)
                .withService(service.getFullyQualifiedName())
                .withCharts(Stream.of(charts).map(Chart::getFullyQualifiedName).toList()));
  }

  private static void follow(Chart chart, EntityReference user) {
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(
            user.getId(), chart.getId(), Entity.USER, Entity.CHART, Relationship.FOLLOWS.ordinal());
  }

  private static Chart getChart(DashboardService service, String name) {
    return SdkClients.adminClient().charts().getByName(fqn(service, name), FIELDS);
  }

  private static List<UUID> dashboardIds(Chart chart) {
    return chart.getDashboards().stream().map(EntityReference::getId).toList();
  }

  private static String fqn(DashboardService service, String name) {
    return service.getFullyQualifiedName() + "." + name;
  }

  private static String dossierId() {
    return UUID.randomUUID().toString().replace("-", "").toUpperCase();
  }
}
