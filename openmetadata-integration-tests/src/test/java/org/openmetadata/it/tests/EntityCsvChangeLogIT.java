package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
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
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts CSV summary commits and injects failures after real SQL writes")
class EntityCsvChangeLogIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void summaryCommitsHistoryRowAndFeedTogether(TestNamespace ns) {
    final Chart original = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      record(original);
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertStoredSummary(original);
  }

  @ParameterizedTest
  @ValueSource(strings = {"UPDATE chart_entity", "INSERT INTO change_event"})
  void failureRollsBackHistoryRowAndFeed(String statement, TestNamespace ns) {
    final Chart original = fixture(ns);
    final String before = stored(original.getId());
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                statement,
                () -> new IllegalStateException("Injected failure after CSV summary write"))) {
      assertThrows(IllegalStateException.class, () -> record(original));
      assertUnchanged(original, before);
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
  }

  @Test
  void enclosingRollbackKeepsThePreviousVersion(TestNamespace ns) {
    final Chart original = fixture(ns);
    final String before = stored(original.getId());
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository()
                  .executeInTransaction(
                      () -> {
                        record(original);
                        throw new IllegalStateException("Roll back enclosing CSV operation");
                      }));
      assertUnchanged(original, before);
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
  }

  @Test
  void deadlockReplaysTheSummaryWithoutAnotherVersionOrEvent(TestNamespace ns) {
    final Chart original = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "INSERT INTO change_event",
                () -> new RuntimeException(new SQLException("Injected deadlock", "40001", 1213)))) {
      record(original);
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertStoredSummary(original);
  }

  private void assertStoredSummary(Chart original) {
    final Chart updated = JsonUtils.readValue(stored(original.getId()), Chart.class);
    assertEquals(EntityUtil.nextVersion(original.getVersion()), updated.getVersion());
    assertEquals(original.getVersion(), updated.getChangeDescription().getPreviousVersion());
    assertEquals("admin", updated.getUpdatedBy());
    assertEquals(1, updated.getChangeDescription().getFieldsUpdated().size());
    final var field = updated.getChangeDescription().getFieldsUpdated().getFirst();
    assertEquals("bulkImport", field.getName());
    final var summary = JsonUtils.convertValue(field.getNewValue(), CsvImportResult.class);
    assertEquals(
        "status,details,name\r\nsuccess,Imported,chart\r\n", summary.getImportResultsCsv());
    assertEquals(1, summary.getNumberOfRowsPassed());
    assertEquals(
        original.getVersion(), JsonUtils.readValue(history(original), Chart.class).getVersion());
    final List<ChangeEvent> events = events(original);
    assertEquals(1, events.size());
    final ChangeEvent event = events.getFirst();
    assertEquals(EventType.ENTITY_UPDATED, event.getEventType());
    assertEquals(original.getVersion(), event.getPreviousVersion());
    assertEquals(updated.getVersion(), event.getCurrentVersion());
    assertEquals(
        JsonUtils.readTree(JsonUtils.pojoToJson(updated)),
        JsonUtils.readTree(JsonUtils.pojoToJson(event.getEntity())));
    assertEquals(
        updated.getVersion(), SdkClients.adminClient().charts().get(original.getId()).getVersion());
  }

  private void assertUnchanged(Chart original, String before) {
    assertEquals(JsonUtils.readTree(before), JsonUtils.readTree(stored(original.getId())));
    assertNull(history(original));
    assertEquals(List.of(), events(original));
    assertEquals(
        original.getVersion(),
        SdkClients.adminClient().charts().get(original.getId()).getVersion());
  }

  private Chart fixture(TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        repository()
            .creates()
            .create(
                new Chart()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix("csvSummary"))
                    .withService(service.getEntityReference())
                    .withVersion(0.1)
                    .withUpdatedBy("admin")
                    .withUpdatedAt(System.currentTimeMillis()),
                new EntityCommandActor(null, null));
    SdkClients.adminClient().charts().get(chart.getId());
    return JsonUtils.readValue(stored(chart.getId()), Chart.class);
  }

  private void record(Chart original) {
    repository()
        .createChangeEventForBulkOperation(
            original,
            new CsvImportResult()
                .withDryRun(false)
                .withStatus(ApiStatus.SUCCESS)
                .withNumberOfRowsProcessed(1)
                .withNumberOfRowsPassed(1)
                .withNumberOfRowsFailed(0)
                .withImportResultsCsv(
                    "status,details,fullyQualifiedName,description\nsuccess,Imported,chart,Large description\n"),
            "admin");
  }

  private ChartRepository repository() {
    return (ChartRepository) Entity.getEntityRepository(Entity.CHART);
  }

  private String stored(UUID id) {
    final var rows = Entity.getCollectionDAO().chartDAO();
    return rows.findById(rows.getTableName(), id, "");
  }

  private String history(Chart original) {
    return Entity.getCollectionDAO()
        .entityExtensionDAO()
        .getExtension(
            original.getId(), EntityUtil.getVersionExtension(Entity.CHART, original.getVersion()));
  }

  private List<ChangeEvent> events(Chart original) {
    return Entity.getCollectionDAO().changeEventDAO().listUnprocessedEvents(0).stream()
        .map(json -> JsonUtils.readValue(json, ChangeEvent.class))
        .filter(event -> original.getId().equals(event.getEntityId()))
        .toList();
  }
}
