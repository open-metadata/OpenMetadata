package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.util.EntityUtil;

class EntityVersionHistoryTest {
  private final UUID id = UUID.randomUUID();
  private final EntityExtensionDAO extensions = mock(EntityExtensionDAO.class);
  private final EntityVersionHistory<Table> history =
      new EntityVersionHistory<>(
          new EntityHistoryType<>("table", Table.class, "table_entity"),
          () -> extensions,
          requested -> {
            if (!id.equals(requested)) {
              throw EntityNotFoundException.byMessage("Unknown table");
            }
            return new Table().withId(id).withVersion(0.3);
          },
          new EntityVersionHistory.Hydration<>(
              table -> table.withDescription("Current fields"),
              table -> table.setDisplayName("Inherited name")));

  @Test
  void archivedVersionIsReturnedWithoutApplyingCurrentFields() {
    when(extensions.getExtension(id, EntityUtil.getVersionExtension("table", 0.1)))
        .thenReturn(json(0.1));

    final Table version = history.getVersion(id, "0.1");

    assertEquals(0.1, version.getVersion());
    assertEquals("Snapshot 0.1", version.getDescription());
  }

  @Test
  void currentVersionHasFieldsAndKeepsExistingMissingVersionErrors() {
    assertEquals("Current fields", history.getVersion(id, "0.3").getDescription());
    assertThrows(EntityNotFoundException.class, () -> history.getVersion(id, "0.4"));
    assertThrows(NumberFormatException.class, () -> history.getVersion(id, "invalid"));
    assertThrows(EntityNotFoundException.class, () -> history.getVersion(UUID.randomUUID(), "0.3"));
  }

  @Test
  void fullHistoryStartsWithHydratedCurrentVersionAndSortsSnapshotsNumerically() {
    when(extensions.getExtensions(id, EntityUtil.getVersionExtensionPrefix("table")))
        .thenReturn(List.of(record(0.1), record(0.2)));

    final List<Table> versions = versions(history.listVersions(id));

    assertEquals(List.of(0.3, 0.2, 0.1), versions.stream().map(Table::getVersion).toList());
    assertEquals("Inherited name", versions.getFirst().getDisplayName());
    assertEquals("Current fields", versions.getFirst().getDescription());
    assertEquals("Snapshot 0.2", versions.get(1).getDescription());
  }

  @Test
  void offsetPagesRetainSnapshotsAndMissingEntityContract() {
    when(extensions.getExtensionsWithOffset(
            id, EntityUtil.getVersionExtensionPrefix("table"), 1, 1))
        .thenReturn(List.of(record(0.1)));

    final var page = history.page(id, 1, 1);
    final List<Table> versions = versions(page.entityHistory());
    assertEquals(2, page.nextOffset());

    assertEquals(List.of(0.1), versions.stream().map(Table::getVersion).toList());
    assertEquals("Snapshot 0.1", versions.getFirst().getDescription());
    assertThrows(EntityNotFoundException.class, () -> history.page(UUID.randomUUID(), 1, 1));
  }

  @Test
  void firstOffsetPageIncludesLatestEvenWhenNoSnapshotsExist() {
    when(extensions.getExtensionsWithOffset(
            id, EntityUtil.getVersionExtensionPrefix("table"), 2, 0))
        .thenReturn(List.of());

    final var page = history.page(id, 2, 0);
    final List<Table> versions = versions(page.entityHistory());
    assertEquals(2, page.nextOffset());

    assertEquals(1, versions.size());
    assertEquals("Inherited name", versions.getFirst().getDisplayName());
  }

  private List<Table> versions(final EntityHistory result) {
    assertEquals("table", result.getEntityType());
    return result.getVersions().stream()
        .map(json -> JsonUtils.readValue((String) json, Table.class))
        .toList();
  }

  private ExtensionRecord record(final double version) {
    return new ExtensionRecord(EntityUtil.getVersionExtension("table", version), json(version));
  }

  private String json(final double version) {
    return JsonUtils.pojoToJson(
        new Table().withId(id).withVersion(version).withDescription("Snapshot " + version));
  }
}
