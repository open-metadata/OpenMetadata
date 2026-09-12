package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.jdbi3.ChartRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Observes cache publication immediately after each repository flush")
class BulkStorageJsonIT {
  @Test
  void enclosingTransactionRollbackDiscardsBulkCachePublication(TestNamespace ns) {
    SdkClients.adminClient();
    assumeTrue(CacheBundle.getCachedEntityDao() != null, "Requires Redis");
    final CountingChartRepository repository = new CountingChartRepository();
    final List<Chart> charts = charts(ns, repository);

    assertThrows(
        IllegalStateException.class,
        () ->
            repository.executeInTransaction(
                () -> {
                  repository.imports().create(charts, null);
                  charts.forEach(
                      chart ->
                          assertTrue(
                              CacheBundle.getCachedEntityDao()
                                  .getBase(chart.getId(), Entity.CHART)
                                  .isEmpty()));
                  throw new IllegalStateException("Roll back the enclosing transaction");
                }));

    charts.forEach(this::assertNotStoredOrCached);
  }

  @Test
  void failedBulkFlushPublishesNothingAndDoesNotRetainItsJson(TestNamespace ns) {
    SdkClients.adminClient();
    assumeTrue(CacheBundle.getCachedEntityDao() != null, "Requires Redis");
    final CountingChartRepository repository = new CountingChartRepository();
    final List<Chart> charts = charts(ns, repository);
    repository.failRelationships = true;

    assertThrows(IllegalStateException.class, () -> repository.imports().create(charts, null));

    charts.forEach(
        chart -> {
          assertNotStoredOrCached(chart);
          chart.setDescription("Committed after rollback");
        });
    repository.failRelationships = false;
    repository.serializations = 0;
    repository.imports().create(charts, null);

    assertEquals(charts.size(), repository.serializations);
    charts.forEach(this::assertStoredAndCached);
  }

  @Test
  void bulkCreatePublishesTheStoredJsonWithoutReserializing(TestNamespace ns) {
    SdkClients.adminClient();
    assumeTrue(CacheBundle.getCachedEntityDao() != null, "Requires Redis");
    final CountingChartRepository repository = new CountingChartRepository();
    final List<Chart> charts = charts(ns, repository);

    repository.imports().create(charts, null);

    assertEquals(charts.size(), repository.serializations);
    charts.forEach(this::assertStoredAndCached);
  }

  @Test
  void bulkUpdatePublishesTheStoredJsonWithoutReserializing(TestNamespace ns) {
    SdkClients.adminClient();
    assumeTrue(CacheBundle.getCachedEntityDao() != null, "Requires Redis");
    final CountingChartRepository repository = new CountingChartRepository();
    final List<Chart> originals = repository.imports().create(charts(ns, repository), null);
    final List<Chart> updates =
        originals.stream()
            .map(
                chart ->
                    JsonUtils.deepCopy(chart, Chart.class).withDescription("Updated description"))
            .toList();
    repository.serializations = 0;

    repository.imports().update(originals, updates, new EntityCommandActor("admin", null));

    assertEquals(updates.size(), repository.serializations);
    updates.forEach(this::assertStoredAndCached);
    updates.forEach(
        chart ->
            assertEquals(
                "Updated description",
                SdkClients.adminClient().charts().get(chart.getId().toString()).getDescription()));
  }

  @Test
  void failedBulkUpdateKeepsOriginalRowsRelationshipsAndCachedJson(TestNamespace ns) {
    SdkClients.adminClient();
    assumeTrue(CacheBundle.getCachedEntityDao() != null, "Requires Redis");
    final CountingChartRepository repository = new CountingChartRepository();
    final List<Chart> originals = repository.imports().create(charts(ns, repository), null);
    final List<Chart> updates =
        originals.stream()
            .map(chart -> JsonUtils.deepCopy(chart, Chart.class).withDescription("Rolled back"))
            .toList();
    final List<String> cachedBefore =
        originals.stream()
            .map(
                chart ->
                    CacheBundle.getCachedEntityDao()
                        .getBase(chart.getId(), Entity.CHART)
                        .orElseThrow())
            .toList();
    repository.failRelationships = true;

    assertThrows(
        IllegalStateException.class,
        () ->
            repository
                .imports()
                .update(originals, updates, new EntityCommandActor("admin", "import-actor")));

    for (int index = 0; index < originals.size(); index++) {
      final Chart original = originals.get(index);
      final var dao = Entity.getCollectionDAO().chartDAO();
      final Chart stored =
          JsonUtils.readValue(dao.findById(dao.getTableName(), original.getId(), ""), Chart.class);
      assertNull(stored.getDescription());
      assertEquals(original.getVersion(), stored.getVersion());
      assertEquals(
          cachedBefore.get(index),
          CacheBundle.getCachedEntityDao().getBase(original.getId(), Entity.CHART).orElseThrow());
      final Chart response = SdkClients.adminClient().charts().get(original.getId().toString());
      assertEquals(original.getService().getId(), response.getService().getId());
      assertNull(response.getDescription());
    }
    repository.failRelationships = false;
    repository.serializations = 0;
    repository
        .imports()
        .update(originals, updates, new EntityCommandActor("admin", "import-actor"));
    assertEquals(updates.size(), repository.serializations);
    updates.forEach(this::assertStoredAndCached);
  }

  @Test
  void importAuditIsStoredBeforeCachePublication(TestNamespace ns) {
    SdkClients.adminClient();
    assumeTrue(CacheBundle.getCachedEntityDao() != null, "Requires Redis");
    final CountingChartRepository repository = new CountingChartRepository();
    final List<Chart> created = repository.imports().create(charts(ns, repository), "import-actor");
    for (Chart chart : created) {
      assertEquals("admin", chart.getUpdatedBy());
      assertEquals("import-actor", chart.getImpersonatedBy());
      assertStoredAndCached(chart);
    }
    final List<Chart> updates =
        created.stream()
            .map(chart -> JsonUtils.deepCopy(chart, Chart.class).withDescription("Imported update"))
            .toList();
    repository.imports().update(created, updates, new EntityCommandActor("admin", null));
    for (Chart chart : updates) {
      assertEquals(0.2, chart.getVersion());
      assertEquals("admin", chart.getUpdatedBy());
      assertNull(chart.getImpersonatedBy());
      assertStoredAndCached(chart);
    }
  }

  private List<Chart> charts(TestNamespace ns, CountingChartRepository repository) {
    final DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    final List<Chart> charts = List.of(chart(ns, service, "first"), chart(ns, service, "second"));
    charts.forEach(chart -> repository.preparation().prepare(chart, false));
    return charts;
  }

  private Chart chart(TestNamespace ns, DashboardService service, String name) {
    return new Chart()
        .withId(UUID.randomUUID())
        .withName(ns.prefix(name))
        .withService(service.getEntityReference())
        .withVersion(0.1)
        .withUpdatedBy("admin")
        .withUpdatedAt(System.currentTimeMillis());
  }

  private void assertStoredAndCached(Chart chart) {
    final var dao = Entity.getCollectionDAO().chartDAO();
    final String stored = dao.findById(dao.getTableName(), chart.getId(), "");
    final var cache = CacheBundle.getCachedEntityDao();
    final var cached = cache.getBase(chart.getId(), Entity.CHART);
    assertTrue(cached.isPresent());
    assertEquals(JsonUtils.readTree(stored), JsonUtils.readTree(cached.orElseThrow()));
    assertEquals(
        chart.getId(),
        SdkClients.adminClient().charts().getByName(chart.getFullyQualifiedName()).getId());
  }

  private void assertNotStoredOrCached(final Chart chart) {
    assertTrue(CacheBundle.getCachedEntityDao().getBase(chart.getId(), Entity.CHART).isEmpty());
    assertTrue(
        CacheBundle.getCachedEntityDao()
            .getByName(Entity.CHART, chart.getFullyQualifiedName())
            .isEmpty());
    final int rowCount =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT COUNT(*) FROM chart_entity WHERE id = :id")
                        .bind("id", chart.getId().toString())
                        .mapTo(Integer.class)
                        .one());
    assertEquals(0, rowCount);
  }

  private static final class CountingChartRepository extends ChartRepository {
    private int serializations;
    private boolean failRelationships;

    private CountingChartRepository() {
      super(false);
    }

    @Override
    public String serializeForStorage(Chart chart) {
      serializations++;
      return super.serializeForStorage(chart);
    }

    @Override
    public void storeEntitySpecificRelationshipsForMany(List<Chart> charts) {
      super.storeEntitySpecificRelationshipsForMany(charts);
      if (failRelationships) {
        throw new IllegalStateException(
            "Injected failure after rows and relationships were written");
      }
    }
  }
}
