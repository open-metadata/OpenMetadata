package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts transaction commits and injects a failure after bulk row writes")
class EntitySubtreeAtomicityIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void deadlockReplayChangesTheVersionOnce(boolean restoring, TestNamespace ns) {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final Chart original = fixture(ns, repository, restoring);

    try (var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update chart_entity set",
                () ->
                    new RuntimeException(
                        new SQLException("Injected deadlock after subtree rows", "40001", 1213)));
        var transactions = new TransactionCounter(Entity.getJdbi())) {
      changeState(repository, original, restoring);
      final Chart updated = JsonUtils.readValue(stored(original.getId()), Chart.class);
      assertEquals(!restoring, updated.getDeleted());
      assertEquals(EntityUtil.nextVersion(original.getVersion()), updated.getVersion());
      assertEquals(1, updated.getChangeDescription().getFieldsUpdated().size());
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
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

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void bulkStateChangeRollsBackHistoryAndRowsTogether(boolean restoring, TestNamespace ns) {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final Chart original = fixture(ns, repository, restoring);
    final String before = stored(original.getId());

    try (var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update chart_entity set",
                () ->
                    new IllegalStateException("Injected failure after subtree rows were written"));
        var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(IllegalStateException.class, () -> changeState(repository, original, restoring));
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

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void successfulBulkStateChangeCommitsOnce(boolean restoring, TestNamespace ns) {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final Chart original = fixture(ns, repository, restoring);

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      changeState(repository, original, restoring);
      final Chart updated = JsonUtils.readValue(stored(original.getId()), Chart.class);
      assertEquals(!restoring, updated.getDeleted());
      assertEquals(EntityUtil.nextVersion(original.getVersion()), updated.getVersion());
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
  }

  private Chart fixture(
      TestNamespace ns, UnregisteredChartRepository repository, boolean restoring) {
    SdkClients.adminClient();
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        repository
            .creates()
            .create(
                new Chart()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix("atomicChart"))
                    .withService(service.getEntityReference())
                    .withVersion(0.1)
                    .withUpdatedBy("admin")
                    .withUpdatedAt(System.currentTimeMillis()),
                new EntityCommandActor(null, null));
    if (restoring) {
      repository.subtrees().bulkSoftDeleteSubtree(List.of(chart.getId()), "admin");
    }
    return JsonUtils.readValue(stored(chart.getId()), Chart.class);
  }

  private void changeState(ChartRepository repository, Chart chart, boolean restoring) {
    if (restoring) {
      repository.subtrees().bulkRestoreSubtree(List.of(chart.getId()), "admin");
    } else {
      repository.subtrees().bulkSoftDeleteSubtree(List.of(chart.getId()), "admin");
    }
  }

  private String stored(UUID id) {
    final var rows = Entity.getCollectionDAO().chartDAO();
    return rows.findById(rows.getTableName(), id, "");
  }

  private static final class UnregisteredChartRepository extends ChartRepository {

    private UnregisteredChartRepository() {
      super(false);
    }
  }
}
