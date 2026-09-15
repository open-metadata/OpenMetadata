package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.UnregisteredChartRepository;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts transaction commits around an enclosing bulk state change")
class EntitySubtreeAtomicityIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void enclosingTransactionRollsBackTheWholeStateChange(boolean restoring, TestNamespace ns) {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final Chart original = fixture(ns, repository, restoring);
    final String before = stored(original.getId());

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository.executeInTransaction(
                  () -> {
                    changeState(repository, original, restoring);
                    throw new IllegalStateException("Roll back the outer transaction");
                  }));
      assertEquals(JsonUtils.readTree(before), JsonUtils.readTree(stored(original.getId())));
      assertNull(
          Entity.getCollectionDAO()
              .entityExtensionDAO()
              .getExtension(
                  original.getId(),
                  EntityUtil.getVersionExtension(Entity.CHART, original.getVersion())));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
  }

  private Chart fixture(
      TestNamespace ns, UnregisteredChartRepository repository, boolean restoring) {
    SdkClients.adminClient();
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        repository.createInternal(
            new Chart()
                .withId(UUID.randomUUID())
                .withName(ns.prefix("atomicChart"))
                .withService(service.getEntityReference())
                .withVersion(0.1)
                .withUpdatedBy("admin")
                .withUpdatedAt(System.currentTimeMillis()));
    if (restoring) {
      repository.bulkSoftDeleteSubtree(List.of(chart.getId()), "admin");
    }
    return JsonUtils.readValue(stored(chart.getId()), Chart.class);
  }

  private void changeState(ChartRepository repository, Chart chart, boolean restoring) {
    if (restoring) {
      repository.bulkRestoreSubtree(List.of(chart.getId()), "admin");
    } else {
      repository.bulkSoftDeleteSubtree(List.of(chart.getId()), "admin");
    }
  }

  private String stored(UUID id) {
    final var rows = Entity.getCollectionDAO().chartDAO();
    return rows.findById(rows.getTableName(), id, "");
  }
}
