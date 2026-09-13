package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModule;
import org.openmetadata.service.entity.bulk.EntityBulkJobs;
import org.openmetadata.service.entity.bulk.EntityBulkService;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ChartRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Verifies bulk module completion, shared job status and stale-delete commits")
class EntityBulkModuleIT {
  @Test
  void asyncCompletionKeepsAuthorizationResultsAndSharedJobHistory(final TestNamespace ns)
      throws Exception {
    final Fixture fixture = fixture(ns);
    final BulkResponse denied = new BulkResponse().withRequest("denied").withStatus(403);
    final EntityBulkJobs.Job job =
        fixture
            .module()
            .bulk()
            .submit(fixture.request(), new EntityBulkJobs.Authorization(List.of(denied), 3));
    final var result = job.result().get(60, TimeUnit.SECONDS);
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(3, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(List.of(denied), result.getFailedRequest());
    assertSame(result, fixture.module().bulk().status(job.id()).orElseThrow());
    assertSame(result, new UnregisteredChartRepository().bulk().status(job.id()).orElseThrow());
    fixture.charts().forEach(this::assertLive);
  }

  @Test
  void stalePreviewAndDeletionKeepTheSeenRowAndInvalidateDeletedAliases(final TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    assertEquals(2, fixture.module().bulk().upsert(fixture.request()).getNumberOfRowsPassed());
    fixture.charts().forEach(this::assertLive);
    final Chart retained = fixture.charts().getFirst();
    final Chart stale = fixture.charts().getLast();
    final var request =
        new BulkDeleteStaleRequest()
            .withScopeEntityType(Entity.DASHBOARD_SERVICE)
            .withScopeFqn(retained.getService().getFullyQualifiedName())
            .withSeenFqns(List.of(retained.getFullyQualifiedName()))
            .withDryRun(true);
    assertEquals(1, fixture.module().bulk().deleteStale(request, "admin").getNumberOfRowsPassed());
    assertLive(stale);
    deleteStale(fixture.module(), request.withDryRun(false));
    assertLive(retained);
    assertDeleted(stale);
  }

  private void deleteStale(final EntityModule<Chart> module, final BulkDeleteStaleRequest request) {
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertEquals(1, module.bulk().deleteStale(request, "admin").getNumberOfRowsPassed());
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
  }

  private Fixture fixture(final TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final EntityModule<Chart> module = new UnregisteredChartRepository();
    final List<Chart> charts = List.of(chart(ns, "first"), chart(ns, "second"));
    charts.forEach(
        chart -> {
          chart.withService(service.getEntityReference());
          module.preparation().prepare(chart, false);
        });
    return new Fixture(module, charts);
  }

  private Chart chart(final TestNamespace ns, final String name) {
    return new Chart()
        .withId(UUID.randomUUID())
        .withName(ns.prefix(name))
        .withVersion(0.1)
        .withUpdatedBy("admin")
        .withUpdatedAt(System.currentTimeMillis());
  }

  private void assertLive(final Chart expected) {
    final Chart actual = SdkClients.adminClient().charts().get(expected.getId());
    assertEquals(expected.getFullyQualifiedName(), actual.getFullyQualifiedName());
    assertEquals(expected.getService().getId(), actual.getService().getId());
    assertEquals(0.1, actual.getVersion());
    final Chart byName =
        Entity.getEntityByName(
            Entity.CHART, expected.getFullyQualifiedName(), "", Include.NON_DELETED);
    assertEquals(expected.getId(), byName.getId());
  }

  private void assertDeleted(final Chart chart) {
    assertThrows(
        EntityNotFoundException.class,
        () -> Entity.getEntity(Entity.CHART, chart.getId(), "", Include.NON_DELETED));
    assertThrows(
        EntityNotFoundException.class,
        () ->
            Entity.getEntityByName(
                Entity.CHART, chart.getFullyQualifiedName(), "", Include.NON_DELETED));
    final Chart deleted = Entity.getEntity(Entity.CHART, chart.getId(), "", Include.ALL);
    assertTrue(deleted.getDeleted());
  }

  private record Fixture(EntityModule<Chart> module, List<Chart> charts) {
    private EntityBulkService.Request<Chart> request() {
      return new EntityBulkService.Request<>(null, charts, "admin", new HashMap<>(), false);
    }
  }

  private static final class UnregisteredChartRepository extends ChartRepository {
    private UnregisteredChartRepository() {
      super(false);
    }
  }
}
