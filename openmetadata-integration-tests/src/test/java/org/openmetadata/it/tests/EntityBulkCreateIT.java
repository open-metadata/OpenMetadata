package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.bulk.EntityBulkService;
import org.openmetadata.service.jdbi3.ChartRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Injects failures into real bulk creates and counts duplicate-row reloads")
class EntityBulkCreateIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void newDuplicateRowsUseOneReloadBeforeUpdating(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final Chart first = fixture.charts().getFirst();
    final Chart duplicate =
        JsonUtils.deepCopy(first, Chart.class).withDescription("Duplicate update");
    try (var reads = new SqlQueryCounter(Entity.getJdbi(), "from chart_entity")) {
      final BulkOperationResult result =
          upsert(fixture, List.of(first, duplicate, fixture.charts().getLast()));
      assertEquals(3, result.getNumberOfRowsPassed());
      assertEquals(ApiStatus.SUCCESS, result.getStatus());
      assertEquals(1, reads.count());
    }
    final Chart updated = SdkClients.adminClient().charts().get(first.getId());
    assertEquals("Duplicate update", updated.getDescription());
    assertEquals(0.2, updated.getVersion());
    assertCreated(fixture.charts().getLast());
  }

  @Test
  void rolledBackBatchFallsBackToIndependentCreates(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    fixture.repository().failBatchRelationships = true;
    final BulkOperationResult result = upsert(fixture, fixture.charts());
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(2, result.getNumberOfRowsPassed());
    fixture.charts().forEach(this::assertCreated);
  }

  @Test
  void failedIndividualCreateLeavesNoRowOrRelationship(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final Chart rejected = fixture.charts().getFirst();
    fixture.repository().failBatchRelationships = true;
    fixture.repository().rejectCreate = rejected.getId();
    final BulkOperationResult result = upsert(fixture, fixture.charts());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertNotStored(rejected);
    assertCreated(fixture.charts().getLast());
  }

  @Test
  void failedFirstDuplicateReportsEveryUncreatableOccurrence(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final Chart rejected = fixture.charts().getFirst();
    final Chart duplicate = JsonUtils.deepCopy(rejected, Chart.class).withId(UUID.randomUUID());
    fixture.repository().failBatchRelationships = true;
    fixture.repository().rejectCreate = rejected.getId();
    final BulkOperationResult result =
        upsert(fixture, List.of(rejected, duplicate, fixture.charts().getLast()));
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(2, result.getNumberOfRowsFailed());
    assertEquals(
        "Entity does not exist and could not be created",
        result.getFailedRequest().getLast().getMessage());
    assertNotStored(rejected);
    assertNotStored(duplicate);
    assertCreated(fixture.charts().getLast());
  }

  private Fixture fixture(TestNamespace ns) {
    final var repository = new FailingChartRepository();
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final List<Chart> charts =
        List.of(
            new Chart().withName(ns.prefix("first")), new Chart().withName(ns.prefix("second")));
    charts.forEach(
        chart -> {
          chart
              .withId(UUID.randomUUID())
              .withService(service.getEntityReference())
              .withVersion(0.1)
              .withUpdatedBy("admin")
              .withUpdatedAt(System.currentTimeMillis());
          repository.preparation().prepare(chart, false);
        });
    return new Fixture(repository, charts);
  }

  private BulkOperationResult upsert(Fixture fixture, List<Chart> charts) {
    return fixture
        .repository()
        .bulk()
        .upsert(new EntityBulkService.Request<>(null, charts, "admin", new HashMap<>(), false));
  }

  private void assertCreated(Chart expected) {
    final Chart actual = SdkClients.adminClient().charts().get(expected.getId());
    assertEquals(expected.getFullyQualifiedName(), actual.getFullyQualifiedName());
    assertEquals(expected.getService().getId(), actual.getService().getId());
    assertEquals(0.1, actual.getVersion());
    assertEquals(1, relationships(expected.getId()));
  }

  private void assertNotStored(Chart chart) {
    final var rows = Entity.getCollectionDAO().chartDAO();
    assertNull(rows.findById(rows.getTableName(), chart.getId(), ""));
    assertEquals(0, relationships(chart.getId()));
  }

  private int relationships(UUID id) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE toId = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private record Fixture(FailingChartRepository repository, List<Chart> charts) {}

  private static final class FailingChartRepository extends ChartRepository {
    private boolean failBatchRelationships;
    private UUID rejectCreate;

    private FailingChartRepository() {
      super(false);
    }

    @Override
    public void storeEntitySpecificRelationshipsForMany(List<Chart> charts) {
      super.storeEntitySpecificRelationshipsForMany(charts);
      if (failBatchRelationships) {
        failBatchRelationships = false;
        throw new IllegalStateException("Fail after bulk relationships");
      }
    }

    @Override
    public void storeEntity(Chart chart, boolean update) {
      super.storeEntity(chart, update);
      if (!update && chart.getId().equals(rejectCreate)) {
        throw new IllegalStateException("Reject individual create after its row was stored");
      }
    }
  }
}
