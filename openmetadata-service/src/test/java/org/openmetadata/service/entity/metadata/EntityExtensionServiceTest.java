package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadBundleContext;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;

class EntityExtensionServiceTest {
  private static final String PREFIX = "table.customProperties";
  private static final String FIELD = PREFIX + ".choice";
  private static final EntityExtensionService.Properties PROPERTIES =
      new EntityExtensionService.Properties(
          PREFIX,
          field -> PREFIX + "." + field,
          fqn -> fqn.substring(PREFIX.length() + 1),
          field -> "enum");
  private final Table table = new Table().withId(UUID.randomUUID());
  private final EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
  private final EntityExtensionService extensions =
      new EntityExtensionService(() -> dao, PROPERTIES, true);

  @Test
  void selectedBulkFieldsPopulateStoredValuesAndClearMissingRows() {
    final Table other = new Table().withId(UUID.randomUUID()).withExtension("stale");
    when(dao.getExtensionsBatch(
            List.of(table.getId().toString(), other.getId().toString()), PREFIX))
        .thenReturn(List.of(new ExtensionRecordWithId(table.getId(), FIELD, "[\"b\",\"a\"]")));
    extensions.populate(List.of(table, other), true);
    assertEquals(JsonUtils.readTree("{\"choice\":[\"b\",\"a\"]}"), table.getExtension());
    assertNull(other.getExtension());
  }

  @Test
  void excludedUnsupportedAndEmptyBulkFieldsDoNotLoadOrClearValues() {
    final var unloaded =
        new EntityExtensionService(
            () -> {
              throw new AssertionError("Unexpected extension query");
            },
            PROPERTIES,
            true);
    final var unsupported =
        new EntityExtensionService(
            () -> {
              throw new AssertionError("Unexpected extension query");
            },
            PROPERTIES,
            false);
    table.setExtension("preserved");
    unloaded.populate(List.of(table), false);
    unloaded.populate(List.of(), true);
    unloaded.populate(null, true);
    unsupported.populate(List.of(table), true);
    assertEquals("preserved", table.getExtension());
  }

  @Test
  void detailReadsRetainEnumNormalizationAndDuplicateValues() {
    when(dao.getExtensions(table.getId(), PREFIX))
        .thenReturn(List.of(new ExtensionRecord(FIELD, "[\"b\",\"a\",\"a\"]")));

    assertEquals(JsonUtils.readTree("{\"choice\":[\"a\",\"a\",\"b\"]}"), extensions.read(table));
  }

  @Test
  void bulkReadsRetainStoredValuesAndGroupByEntity() {
    final Table other = new Table().withId(UUID.randomUUID());
    when(dao.getExtensionsBatch(
            List.of(table.getId().toString(), other.getId().toString()), PREFIX))
        .thenReturn(
            List.of(
                new ExtensionRecordWithId(table.getId(), FIELD, "[\"b\",\"a\"]"),
                new ExtensionRecordWithId(other.getId(), FIELD, "[\"c\"]"),
                new ExtensionRecordWithId(table.getId(), PREFIX + ".note", "\"retained\"")));

    final var values = extensions.readMany(List.of(table, other));

    assertEquals(2, values.size());
    assertEquals(
        JsonUtils.readTree("{\"choice\":[\"b\",\"a\"],\"note\":\"retained\"}"),
        values.get(table.getId()));
    assertEquals(JsonUtils.readTree("{\"choice\":[\"c\"]}"), values.get(other.getId()));
  }

  @Test
  void bundleCoverageIncludesNullAndAvoidsDatabaseFallback() {
    final var unreadable =
        new EntityExtensionService(
            () -> {
              throw new AssertionError("Covered extensions must not query the database");
            },
            PROPERTIES,
            true);
    final ReadBundle bundle = new ReadBundle();
    bundle.putExtension(table.getId(), null);
    ReadBundleContext.push(bundle);
    try {
      assertNull(unreadable.read(table));
      final var value = JsonUtils.readTree("{\"choice\":[\"a\"]}");
      bundle.putExtension(table.getId(), value);
      assertSame(value, unreadable.read(table));
    } finally {
      ReadBundleContext.pop();
    }
  }

  @Test
  void unsupportedMissingAndEmptyExtensionsRetainNullOrEmptyResults() {
    final var disabled = new EntityExtensionService(() -> dao, PROPERTIES, false);
    assertNull(disabled.read(table));
    assertTrue(disabled.readMany(List.of(table)).isEmpty());
    assertNull(extensions.read(null));
    assertNull(extensions.read(new Table()));
    assertNull(extensions.read(table));
    assertTrue(extensions.readMany(List.of()).isEmpty());
    assertTrue(extensions.readMany(null).isEmpty());
  }
}
