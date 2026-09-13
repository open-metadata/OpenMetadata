package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.ALL;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Injects SQL failures and counts commits in the canonical column flush")
class EntityColumnMutationIT {
  private static final String PROPERTY = "columnMutationProbe";
  private static final String INITIAL = "initial";
  private static final String UPDATED = "updated";
  private static final String SENSITIVE = "PII.Sensitive";

  @Test
  void columnReplacementAndDeletionShareOneCanonicalCommit(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final var updater = updater(fixture);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      updater.update();
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertCommitted(fixture);
    assertEquals(1.1, updater.getUpdated().getVersion());
  }

  @Test
  void failedEntityWriteRollsBackColumnTagsExtensionsAndVersion(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final var updater = updater(fixture);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update table_entity",
                () -> new IllegalStateException("Failure after canonical row write"))) {
      assertThrows(RuntimeException.class, updater::update);
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertUnchanged(fixture);
  }

  @Test
  void metadataDeadlockReplaysTheColumnReplacementFromItsOriginalSnapshot(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final var updater = updater(fixture);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "into entity_extension",
                () ->
                    new RuntimeException(
                        new SQLException("Column metadata deadlock", "40001", 1213)))) {
      updater.update();
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertCommitted(fixture);
    assertEquals(1.1, updater.getUpdated().getVersion());
    assertEquals(1, updater.getChangeDescription().getFieldsAdded().size());
    assertEquals(1, updater.getChangeDescription().getFieldsDeleted().size());
  }

  @Test
  void enclosingFailureRollsBackColumnsAndRetainsTheCachedEntity(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final var updater = updater(fixture);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository()
                  .executeInTransaction(
                      () -> {
                        updater.update();
                        assertEquals(
                            UPDATED,
                            extension(
                                fixture.original(), fixture.original().getColumns().getFirst()));
                        throw new IllegalStateException("Failure in owning transaction");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertUnchanged(fixture);
  }

  private Fixture fixture(final TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("columnMutation"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(List.of(column("retained"), column("removed"))));
    for (final Column column : table.getColumns()) {
      Entity.getCollectionDAO()
          .entityExtensionDAO()
          .insert(
              table.getId(),
              FullyQualifiedName.buildHash(column.getFullyQualifiedName()),
              "columnExtension",
              JsonUtils.pojoToJson(Map.of(PROPERTY, INITIAL)));
    }
    final Table original = fresh(table);
    client.tables().get(table.getId().toString(), "columns,tags,extension");
    client.tables().getByName(table.getFullyQualifiedName(), "columns,tags,extension");
    return new Fixture(original);
  }

  private Column column(final String name) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.BIGINT)
        .withDescription("Human description")
        .withTags(
            List.of(
                new TagLabel()
                    .withTagFQN(SENSITIVE)
                    .withSource(TagLabel.TagSource.CLASSIFICATION)
                    .withLabelType(TagLabel.LabelType.MANUAL)
                    .withState(TagLabel.State.CONFIRMED)));
  }

  private EntityUpdater<Table> updater(final Fixture fixture) {
    final Table original = fixture.original();
    final Table updated =
        JsonUtils.deepCopy(original, Table.class)
            .withUpdatedBy("admin")
            .withUpdatedAt(original.getUpdatedAt() + 1);
    final Column replacement =
        updated
            .getColumns()
            .getFirst()
            .withDataType(ColumnDataType.TEXT)
            .withDescription(null)
            .withTags(new ArrayList<>())
            .withExtension(Map.of(PROPERTY, UPDATED));
    updated.setColumns(List.of(replacement));
    return repository().new TableUpdater(original, updated, EntityOperation.PUT, null).mutation();
  }

  private void assertCommitted(final Fixture fixture) {
    assertCachedVersion(fixture.original(), 1.1, 1);
    final Table stored = fresh(fixture.original());
    assertEquals(1, stored.getColumns().size());
    final Column retained = stored.getColumns().getFirst();
    assertEquals(ColumnDataType.TEXT, retained.getDataType());
    assertEquals("Human description", retained.getDescription());
    assertEquals(List.of(SENSITIVE), retained.getTags().stream().map(TagLabel::getTagFQN).toList());
    assertEquals(UPDATED, extension(stored, retained));
    final Column removed = fixture.original().getColumns().getLast();
    assertNull(extension(stored, removed));
    assertTrue(
        Entity.getCollectionDAO().tagUsageDAO().getTags(removed.getFullyQualifiedName()).isEmpty());
    assertApiState(stored);
  }

  private void assertUnchanged(final Fixture fixture) {
    assertCachedVersion(fixture.original(), fixture.original().getVersion(), 2);
    final Table stored = fresh(fixture.original());
    assertEquals(fixture.original().getVersion(), stored.getVersion());
    assertEquals(2, stored.getColumns().size());
    for (final Column column : stored.getColumns()) {
      assertEquals(ColumnDataType.BIGINT, column.getDataType());
      assertEquals(INITIAL, extension(stored, column));
      assertEquals(List.of(SENSITIVE), column.getTags().stream().map(TagLabel::getTagFQN).toList());
    }
    assertApiState(stored);
  }

  private void assertCachedVersion(final Table table, final Double version, final int columns) {
    final var tables = SdkClients.adminClient().tables();
    for (final Table actual :
        List.of(
            tables.get(table.getId().toString(), "columns,tags,extension"),
            tables.getByName(table.getFullyQualifiedName(), "columns,tags,extension"))) {
      assertEquals(version, actual.getVersion());
      assertEquals(columns, actual.getColumns().size());
    }
  }

  private void assertApiState(final Table stored) {
    final var tables = SdkClients.adminClient().tables();
    final Table byId = tables.get(stored.getId().toString(), "columns,tags,extension");
    final Table byName = tables.getByName(stored.getFullyQualifiedName(), "columns,tags,extension");
    for (final Table actual : List.of(byId, byName)) {
      assertEquals(stored.getVersion(), actual.getVersion());
      assertEquals(stored.getColumns().size(), actual.getColumns().size());
      for (int index = 0; index < stored.getColumns().size(); index++) {
        assertColumnResponse(stored.getColumns().get(index), actual.getColumns().get(index));
      }
    }
  }

  private void assertColumnResponse(final Column expected, final Column actual) {
    assertEquals(expected.getName(), actual.getName());
    assertEquals(expected.getDataType(), actual.getDataType());
    assertEquals(expected.getFullyQualifiedName(), actual.getFullyQualifiedName());
    assertEquals(expected.getDescription(), actual.getDescription());
    assertEquals(
        JsonUtils.valueToTree(expected.getExtension()),
        JsonUtils.valueToTree(actual.getExtension()));
    assertEquals(expected.getTags().size(), actual.getTags().size());
    for (int index = 0; index < expected.getTags().size(); index++) {
      assertTagResponse(expected.getTags().get(index), actual.getTags().get(index));
    }
  }

  private void assertTagResponse(final TagLabel expected, final TagLabel actual) {
    assertEquals(expected.getTagFQN(), actual.getTagFQN());
    assertEquals(expected.getSource(), actual.getSource());
    assertEquals(expected.getLabelType(), actual.getLabelType());
    assertEquals(expected.getState(), actual.getState());
    assertEquals(expected.getAppliedBy(), actual.getAppliedBy());
    assertEquals(expected.getReason(), actual.getReason());
    assertEquals(expected.getMetadata(), actual.getMetadata());
  }

  private String extension(final Table table, final Column column) {
    final String json =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(
                table.getId(), FullyQualifiedName.buildHash(column.getFullyQualifiedName()));
    return json == null ? null : JsonUtils.readTree(json).get(PROPERTY).asText();
  }

  private Table fresh(final Table table) {
    RequestEntityCache.clear();
    try (var bypass = EntityCacheBypass.skip()) {
      return repository()
          .reads()
          .byId(
              table.getId(),
              new EntityReadService.Query(
                  null,
                  repository().fieldPolicy().parse("*"),
                  RelationIncludes.fromInclude(ALL),
                  false));
    } finally {
      RequestEntityCache.clear();
    }
  }

  private TableRepository repository() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private record Fixture(Table original) {}
}
