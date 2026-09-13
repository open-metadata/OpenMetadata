package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntityHistoryType;
import org.openmetadata.service.entity.history.EntityVersionStore;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

class EntityUpdateWorkflowTest {
  private final EntityExtensionDAO extensions = mock(EntityExtensionDAO.class);
  private final List<Table> rows = new ArrayList<>();
  private final EntityVersionStore<Table> history =
      new EntityVersionStore<>(
          new EntityHistoryType<>("table", Table.class, "table_entity"),
          () -> extensions,
          JsonUtils::pojoToJson);
  private final EntityUpdateStore<Table> store =
      new EntityUpdateStore<>(
          history, new EntityUpdateStore.Rows<>(this::write, (entity, version) -> write(entity)));
  private final EntityUpdateWorkflow<Table> workflow = new EntityUpdateWorkflow<>(history, store);

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void nonConsolidatingUpdatesCompareOnceAndCaptureAnIndependentIncrementalDiff(
      boolean importMode) {
    final var session = session("next", false);
    workflow.flush(session, false, importMode);
    assertEquals(List.of(importMode), session.importModes);
    assertEquals(List.of("current -> next"), session.indexChanges);
    assertEquals(0.3, rows.getFirst().getVersion());
    assertEquals("next", rows.getFirst().getDescription());
    assertNotSame(session.getChangeDescription(), session.getIncrementalChangeDescription());
    session.getChangeDescription().getFieldsUpdated().clear();
    assertEquals(
        "current",
        session.getIncrementalChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertEquals(0.2, session.getIncrementalChangeDescription().getPreviousVersion());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void consolidationRetainsBothRequestAndSessionBaselines(boolean importMode) {
    final var session = session("next", true);
    final var previous =
        JsonUtils.deepCopy(session.getOriginal(), Table.class)
            .withVersion(0.1)
            .withDescription("before session");
    when(extensions.getExtension(any(UUID.class), anyString()))
        .thenReturn(JsonUtils.pojoToJson(previous));
    workflow.flush(session, false, importMode);
    assertEquals(List.of(importMode, importMode, importMode, importMode), session.importModes);
    assertEquals(List.of("current -> next"), session.indexChanges);
    assertEquals("before session", session.getOriginal().getDescription());
    assertEquals("next", rows.getFirst().getDescription());
    assertEquals(0.2, rows.getFirst().getVersion());
    assertEquals(
        "before session",
        session.getChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertEquals(
        "current",
        session.getIncrementalChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertEquals(0.1, session.getChangeDescription().getPreviousVersion());
    assertEquals(0.2, session.getIncrementalChangeDescription().getPreviousVersion());
    assertNull(session.getPatchedFields());
  }

  @Test
  void absentPreviousSnapshotRetainsTheCurrentBaseline() {
    final var session = session("next", true);
    when(extensions.getExtension(any(UUID.class), anyString())).thenReturn("null");
    workflow.flush(session, false, false);
    assertEquals(List.of(false, false), session.importModes);
    assertEquals(List.of("current -> next"), session.indexChanges);
    assertEquals("current", session.getOriginal().getDescription());
    assertEquals(0.3, rows.getFirst().getVersion());
    assertNull(session.getPrevious());
  }

  @ParameterizedTest
  @ValueSource(strings = {"current", "next"})
  void deferredUpdatesCaptureChangesAndVersionWithoutPersisting(String description) {
    final var session = session(description, false);
    workflow.updateWithDeferredStore(session);
    final boolean changed = !"current".equals(description);
    assertEquals(changed, session.isVersionChanged());
    assertEquals(
        changed, EntityChangeRecorder.hasChanges(session.getIncrementalChangeDescription()));
    assertEquals(changed ? 0.3 : 0.2, session.getUpdated().getVersion());
    assertEquals(changed ? "after" : "before", session.getUpdated().getUpdatedBy());
    assertEquals(List.of(false), session.importModes);
    assertEquals(changed ? List.of("current -> next") : List.of(), session.indexChanges);
    assertTrue(rows.isEmpty());
  }

  @Test
  void deferredUnversionedChangesPreserveTheNewAudit() {
    final var session = session("current", false);
    session.setEntityChanged(true);
    workflow.updateWithDeferredStore(session);
    assertFalse(session.isVersionChanged());
    assertEquals("after", session.getUpdated().getUpdatedBy());
    assertTrue(rows.isEmpty());
  }

  private Session session(String description, boolean consolidate) {
    final var original =
        new Table()
            .withId(UUID.randomUUID())
            .withVersion(0.2)
            .withDescription("current")
            .withUpdatedBy("before")
            .withUpdatedAt(10L)
            .withChangeDescription(new ChangeDescription().withPreviousVersion(0.1));
    final var updated =
        JsonUtils.deepCopy(original, Table.class)
            .withDescription(description)
            .withUpdatedBy("after")
            .withUpdatedAt(20L);
    return new Session(original, updated, consolidate);
  }

  private void write(Table table) {
    rows.add(JsonUtils.deepCopy(table, Table.class));
  }

  private static final class Session extends MutationState<Table>
      implements EntityUpdateWorkflow.Session<Table> {
    private final boolean consolidate;
    private final List<Boolean> importModes = new ArrayList<>();
    private final List<String> indexChanges = new ArrayList<>();

    private Session(Table original, Table updated, boolean consolidate) {
      super(original, updated);
      this.consolidate = consolidate;
      setPatchedFields(Set.of("description"));
    }

    @Override
    public boolean canConsolidateChanges() {
      return consolidate;
    }

    @Override
    public void applyChanges(boolean importMode, boolean consolidatingChanges) {
      importModes.add(importMode);
      final String original = getOriginal().getDescription();
      final String updated = getUpdated().getDescription();
      if (!Objects.equals(original, updated)) {
        if (isIndexBaselinePass()) {
          indexChanges.add(original + " -> " + updated);
        }
        EntityChangeRecorder.recordValue(
            getChangeDescription(), "description", original, updated, false);
        setEntityChanged(true);
      }
    }
  }
}
