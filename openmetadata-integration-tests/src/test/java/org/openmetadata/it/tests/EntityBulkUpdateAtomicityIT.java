package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.bulk.EntityBulkService;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Checks partial failures, transaction boundaries and replay of bulk metadata mutations")
class EntityBulkUpdateAtomicityIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void unchangedSourceHashesSkipAllSqlAndTransactions(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var queries = new SqlQueryCounter(Entity.getJdbi(), "select")) {
      assertEquals(ApiStatus.SUCCESS, update(fixture, false).getStatus());
      assertEquals(0, queries.count());
      assertEquals(0, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    fixture.originals().forEach(this::assertUnchanged);
    assertEquals(List.of(), fixture.repository().published);
  }

  @Test
  void failedDiffInAnEnclosingTransactionRollsBackAllEntries(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    fixture.repository().rejectDiff = fixture.originals().getFirst().getId();
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () -> fixture.repository().executeInTransaction(() -> update(fixture)));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    fixture.originals().forEach(this::assertUnchanged);
    assertEquals(List.of(), fixture.repository().published);
  }

  @Test
  void failedPostCommitHookDoesNotRepeatWritesOrDropOtherEvents(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    fixture.repository().failPublication = true;
    assertCommittedDespitePublicationFailure(fixture);
  }

  @Test
  void failedInheritanceAfterCommitStillInvalidatesRowsAndPublishesEvents(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    fixture.repository().failInheritance = true;
    assertCommittedDespitePublicationFailure(fixture);
  }

  private void assertCommittedDespitePublicationFailure(Fixture fixture) {
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertEquals(ApiStatus.SUCCESS, update(fixture).getStatus());
      assertEquals(2, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    fixture.originals().forEach(original -> assertUpdated(fixture, original));
    assertEquals(2, fixture.repository().published.size());
    final List<UUID> ids = fixture.originals().stream().map(Chart::getId).toList();
    final long events =
        Entity.getCollectionDAO().changeEventDAO().listUnprocessedEvents(0).stream()
            .map(json -> JsonUtils.readValue(json, ChangeEvent.class))
            .filter(event -> ids.contains(event.getEntityId()))
            .count();
    assertEquals(2, events);
  }

  @Test
  void successfulBatchUsesOneMutationCommitAndOneFeedCommit(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertEquals(ApiStatus.SUCCESS, update(fixture).getStatus());
      assertEquals(2, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    fixture.originals().forEach(original -> assertUpdated(fixture, original));
    assertEquals(2, fixture.repository().published.size());
  }

  @Test
  void failedMetadataDiffLeavesNoRelationshipsOrVersionBehind(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final Chart rejected = fixture.originals().getFirst();
    fixture.repository().rejectDiff = rejected.getId();
    final BulkOperationResult result = update(fixture);
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertUnchanged(rejected);
    assertUpdated(fixture, fixture.originals().getLast());
    assertEquals(List.of(fixture.originals().getLast().getId()), fixture.repository().published);
  }

  @Test
  void fallbackRecreatesMutationsFromTheOriginalSnapshots(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update chart_entity set",
                () -> new IllegalStateException("Rejected after bulk rows"));
        var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertEquals(ApiStatus.SUCCESS, update(fixture).getStatus());
      assertEquals(3, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    fixture.originals().forEach(original -> assertUpdated(fixture, original));
    assertEquals(2, fixture.repository().published.size());
  }

  @Test
  void failedFallbackRollsBackItsRowsHistoryAndMetadata(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final Chart rejected = fixture.originals().getFirst();
    fixture.repository().rejectRow = rejected.getId();
    final BulkOperationResult result;
    try (var failure =
        new SqlFailureProbe(
            Entity.getJdbi(),
            "update chart_entity set",
            () -> new IllegalStateException("Rejected after bulk rows"))) {
      result = update(fixture);
    }
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertUnchanged(rejected);
    assertUpdated(fixture, fixture.originals().getLast());
  }

  @Test
  void deadlockReplaysTheWholeBatchWithOneVersionIncrement(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update chart_entity set",
                () ->
                    new RuntimeException(
                        new SQLException("Deadlock after bulk rows", "40001", 1213)));
        var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertEquals(ApiStatus.SUCCESS, update(fixture).getStatus());
      assertEquals(2, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    fixture.originals().forEach(original -> assertUpdated(fixture, original));
    assertEquals(2, fixture.repository().published.size());
  }

  @Test
  void enclosingRollbackPublishesNothing(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              fixture
                  .repository()
                  .executeInTransaction(
                      () -> {
                        assertEquals(ApiStatus.SUCCESS, update(fixture).getStatus());
                        assertEquals(List.of(), fixture.repository().published);
                        throw new IllegalStateException("Roll back the enclosing bulk operation");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    fixture.originals().forEach(this::assertUnchanged);
  }

  private Fixture fixture(TestNamespace ns) {
    final var repository = new FailingChartRepository();
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final var owner = UserTestFactory.createUser(ns, "bulkOwner").getEntityReference();
    final List<Chart> originals = new ArrayList<>();
    for (int index = 0; index < 2; index++) {
      final Chart created =
          repository
              .creates()
              .create(
                  new Chart()
                      .withId(UUID.randomUUID())
                      .withName(ns.prefix("bulkAtomic" + index))
                      .withService(service.getEntityReference())
                      .withSourceHash("baseline")
                      .withVersion(0.1)
                      .withUpdatedBy("admin")
                      .withUpdatedAt(System.currentTimeMillis()),
                  new EntityCommandActor(null, null));
      originals.add(JsonUtils.readValue(stored(created.getId()), Chart.class));
    }
    return new Fixture(repository, originals, owner);
  }

  private BulkOperationResult update(Fixture fixture) {
    return update(fixture, true);
  }

  private BulkOperationResult update(Fixture fixture, boolean overrideMetadata) {
    final List<Chart> updates =
        fixture.originals().stream()
            .map(
                original ->
                    JsonUtils.deepCopy(original, Chart.class)
                        .withDescription("Updated in bulk")
                        .withOwners(List.of(fixture.owner())))
            .toList();
    final Map<String, Chart> originals =
        fixture.originals().stream()
            .collect(Collectors.toMap(Chart::getFullyQualifiedName, Function.identity()));
    return fixture
        .repository()
        .bulk()
        .upsert(
            new EntityBulkService.Request<>(null, updates, "admin", originals, overrideMetadata));
  }

  private void assertUpdated(Fixture fixture, Chart original) {
    final Chart updated =
        SdkClients.adminClient().charts().get(original.getId().toString(), "owners");
    assertEquals("Updated in bulk", updated.getDescription());
    assertEquals(EntityUtil.nextVersion(original.getVersion()), updated.getVersion());
    assertEquals(
        List.of(fixture.owner().getId()),
        updated.getOwners().stream().map(EntityReference::getId).toList());
    final Chart historical = JsonUtils.readValue(history(original), Chart.class);
    assertNull(historical.getDescription());
    assertEquals(original.getVersion(), historical.getVersion());
  }

  private void assertUnchanged(Chart original) {
    final Chart updated =
        SdkClients.adminClient().charts().get(original.getId().toString(), "owners");
    assertNull(updated.getDescription());
    assertEquals(original.getVersion(), updated.getVersion());
    assertEquals(List.of(), updated.getOwners());
    assertNull(history(original));
  }

  private String history(Chart original) {
    return Entity.getCollectionDAO()
        .entityExtensionDAO()
        .getExtension(
            original.getId(), EntityUtil.getVersionExtension(Entity.CHART, original.getVersion()));
  }

  private String stored(UUID id) {
    final var rows = Entity.getCollectionDAO().chartDAO();
    return rows.findById(rows.getTableName(), id, "");
  }

  private record Fixture(
      FailingChartRepository repository, List<Chart> originals, EntityReference owner) {}

  private static final class FailingChartRepository extends ChartRepository {
    private UUID rejectDiff;
    private UUID rejectRow;
    private boolean failPublication;
    private boolean failInheritance;
    private final List<UUID> published = new ArrayList<>();

    private FailingChartRepository() {
      super(false);
    }

    @Override
    public EntityUpdater<Chart> getUpdater(
        Chart original, Chart updated, EntityOperation operation, ChangeSource changeSource) {
      return new ChartUpdater(original, updated, operation) {
        @Override
        public void update(EntityUpdater<Chart> entityUpdate, boolean consolidatingChanges) {
          super.update(entityUpdate, consolidatingChanges);
          if (original.getId().equals(rejectDiff)) {
            throw new IllegalStateException("Rejected after metadata writes");
          }
        }
      }.mutation();
    }

    @Override
    public void storeEntity(Chart entity, boolean update) {
      super.storeEntity(entity, update);
      if (entity.getId().equals(rejectRow)) {
        throw new IllegalStateException("Rejected after individual row");
      }
    }

    @Override
    public void setInheritedFields(List<Chart> entities, Fields fields) {
      if (failInheritance
          && !entities.isEmpty()
          && entities.stream().allMatch(entity -> entity.getVersion() > 0.1)) {
        failInheritance = false;
        throw new IllegalStateException("Inheritance failed after committed rows");
      }
      super.setInheritedFields(entities, fields);
    }

    @Override
    public void postUpdate(Chart original, Chart updated) {
      super.postUpdate(original, updated);
      published.add(updated.getId());
      if (failPublication) {
        failPublication = false;
        throw new IllegalStateException("Hook failed after committed rows");
      }
    }
  }
}
