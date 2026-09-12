package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.SecurityContext;
import java.net.URI;
import java.security.Principal;
import java.util.List;
import java.util.stream.IntStream;
import org.glassfish.jersey.internal.MapPropertiesDelegate;
import org.glassfish.jersey.server.ContainerRequest;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.limits.DefaultLimits;
import org.openmetadata.service.resources.charts.ChartResource;
import org.openmetadata.service.security.NoopAuthorizer;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.FullyQualifiedName;

@Isolated("Temporarily registers a repository that measures bulk name preparation")
@ExtendWith(TestNamespaceExtension.class)
class EntityBulkPreparationIT {
  @ParameterizedTest
  @ValueSource(ints = {1, 50})
  void sharedParentsRequireOneSqlReadAndLeaveNoThreadState(int count, TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final List<Chart> charts =
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new Chart()
                        .withName(ns.prefix("shared_parent_" + index))
                        .withService(service.getEntityReference()))
            .toList();
    try (var fresh = FreshReadScope.enter();
        var queries = new SqlQueryCounter(Entity.getJdbi(), "from dashboard_service_entity")) {
      final var result = repository.bulkPreparation().prepare(charts);
      assertEquals(charts, result.prepared());
      assertTrue(result.failures().isEmpty());
      assertEquals(1, queries.count(), "All rows must use the same batched parent snapshot");
    }
    assertNull(repository.context().parentCache().get());
    for (final Chart chart : charts) {
      assertEquals(service.getServiceType(), chart.getServiceType());
      assertEquals(
          FullyQualifiedName.add(service.getFullyQualifiedName(), chart.getName()),
          chart.getFullyQualifiedName());
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 3})
  void bulkCreationUsesThePreparedNamesAndPersistsEveryEntity(int count, TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final var original = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final var repository = new CountingChartRepository();
    final List<CreateChart> requests =
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new CreateChart()
                        .withName(ns.prefix("prepared_" + count + "_" + index))
                        .withService(service.getFullyQualifiedName()))
            .toList();
    try {
      Entity.registerEntity(Chart.class, Entity.CHART, repository);
      final var resource = new ChartResource(new NoopAuthorizer(), new DefaultLimits());
      final var request =
          new ContainerRequest(
              URI.create("http://localhost/api/"),
              URI.create("http://localhost/api/v1/charts/bulk"),
              "PUT",
              new AdminContext(),
              new MapPropertiesDelegate());
      try (var response =
          resource.bulkCreateOrUpdate(
              request.getUriInfo(), request.getSecurityContext(), false, requests)) {
        assertEquals(200, response.getStatus());
        final BulkOperationResult result = (BulkOperationResult) response.getEntity();
        assertEquals(ApiStatus.SUCCESS, result.getStatus());
        assertEquals(count, result.getNumberOfRowsPassed());
        assertEquals(0, result.getNumberOfRowsFailed());
      }
      assertEquals(
          count,
          repository.namePreparations,
          "Bulk preparation must reuse the name already produced by preparation");
      for (final CreateChart create : requests) {
        final String fqn =
            FullyQualifiedName.add(service.getFullyQualifiedName(), create.getName());
        final Chart stored = SdkClients.adminClient().charts().getByName(fqn);
        assertEquals(create.getName(), stored.getName());
        assertEquals(service.getId(), stored.getService().getId());
      }
    } finally {
      Entity.registerEntity(Chart.class, Entity.CHART, original);
    }
  }

  private static final class CountingChartRepository extends ChartRepository {
    private int namePreparations;

    private CountingChartRepository() {
      super(false);
    }

    @Override
    public void setFullyQualifiedName(Chart entity) {
      namePreparations++;
      super.setFullyQualifiedName(entity);
    }
  }

  private static final class AdminContext implements SecurityContext {
    @Override
    public Principal getUserPrincipal() {
      return () -> Entity.ADMIN_USER_NAME;
    }

    @Override
    public boolean isUserInRole(String role) {
      return false;
    }

    @Override
    public boolean isSecure() {
      return false;
    }

    @Override
    public String getAuthenticationScheme() {
      return SecurityContext.BASIC_AUTH;
    }
  }
}
