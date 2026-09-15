package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntityHistoryType;
import org.openmetadata.service.entity.history.EntityVersionStore;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

class EntityUpdateStoreTest {
  private final EntityExtensionDAO extensions = mock(EntityExtensionDAO.class);
  private final EntityVersionStore<Table> history =
      new EntityVersionStore<>(
          new EntityHistoryType<>("table", Table.class, "table_entity"),
          () -> extensions,
          JsonUtils::pojoToJson);
  private final List<Row> rows = new ArrayList<>();
  private final EntityUpdateStore<Table> store =
      new EntityUpdateStore<>(
          history,
          new EntityUpdateStore.Rows<>(
              entity -> rows.add(new Row(JsonUtils.pojoToJson(entity), null)),
              (entity, version) -> rows.add(new Row(JsonUtils.pojoToJson(entity), version))));

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void changedVersionStoresHistoricalSnapshotAndCurrentRow(boolean optimistic) {
    final var state = state();
    state.getChangeDescription().getFieldsUpdated().add(new FieldChange().withName("description"));
    final var storedHistory = captureHistory();
    store.store(state, optimistic);
    assertEquals(state.getOriginal(), JsonUtils.readValue(storedHistory.get(), Table.class));
    assertEquals(1.1, JsonUtils.readValue(rows.getFirst().json(), Table.class).getVersion());
    assertEquals(optimistic ? 1.0 : null, rows.getFirst().expectedVersion());
    assertTrue(state.isVersionChanged());
    assertTrue(state.isEntityStored());
  }

  @Test
  void noOpRestoresAuditWithoutWritingRowsOrHistory() {
    final var state = state();
    final var storedHistory = captureHistory();
    store.store(state, false);
    assertTrue(rows.isEmpty());
    assertNull(storedHistory.get());
    assertEquals("before", state.getUpdated().getUpdatedBy());
    assertEquals(10L, state.getUpdated().getUpdatedAt());
    assertSame(
        state.getOriginal().getChangeDescription(), state.getUpdated().getChangeDescription());
    assertFalse(state.isEntityStored());
  }

  @Test
  void unversionedMetadataPersistsNewAuditWithoutHistory() {
    final var state = state();
    state.setEntityChanged(true);
    final var storedHistory = captureHistory();
    store.store(state, true);
    final var row = JsonUtils.readValue(rows.getFirst().json(), Table.class);
    assertEquals(1.0, row.getVersion());
    assertEquals("after", row.getUpdatedBy());
    assertEquals(20L, row.getUpdatedAt());
    assertNull(storedHistory.get());
    assertFalse(state.isVersionChanged());
    assertTrue(state.isEntityStored());
  }

  @Test
  void inverseConsolidationStoresPreviousVersionAndRemovesRedundantHistory() {
    final var state = state();
    state.setPrevious(JsonUtils.deepCopy(state.getOriginal(), Table.class));
    final var removedVersion = new AtomicReference<String>();
    doAnswer(
            call -> {
              removedVersion.set(call.getArgument(1));
              return null;
            })
        .when(extensions)
        .delete(any(UUID.class), anyString());
    store.store(state, true);
    assertEquals("table.version.1.0", removedVersion.get());
    assertNull(rows.getFirst().expectedVersion());
    assertEquals(1.0, JsonUtils.readValue(rows.getFirst().json(), Table.class).getVersion());
    assertTrue(state.isEntityStored());
  }

  @Test
  void consolidationBypassesOptimisticVersionCheckBeforeVersionDecision() {
    final var state = state();
    state.setPrevious(new Table().withVersion(0.9));
    state.getChangeDescription().setPreviousVersion(0.9);
    state.getChangeDescription().getFieldsUpdated().add(new FieldChange().withName("description"));
    store.store(state, true);
    assertNull(rows.getFirst().expectedVersion());
    assertEquals(1.1, state.getUpdated().getVersion());
  }

  @Test
  void differentPreviousVersionDoesNotCauseAnUnchangedRowWrite() {
    final var state = state();
    state.setPrevious(new Table().withVersion(0.9));
    store.store(state, false);
    assertTrue(rows.isEmpty());
    assertFalse(state.isEntityStored());
  }

  @Test
  void failedRowStoreDoesNotMarkTheEntityStored() {
    final var state = state();
    state.setEntityChanged(true);
    final var failing =
        new EntityUpdateStore<>(
            history,
            new EntityUpdateStore.Rows<Table>(
                entity -> {
                  throw new IllegalStateException("row failure");
                },
                (entity, version) -> {}));
    assertThrows(IllegalStateException.class, () -> failing.store(state, false));
    assertFalse(state.isEntityStored());
  }

  @Test
  void previousVersionReturnsHistoricalFieldsWithoutLiveHydration() {
    final var state = state();
    final var historical = new Table().withDescription("historical");
    state.getOriginal().setChangeDescription(new ChangeDescription().withPreviousVersion(0.9));
    when(extensions.getExtension(state.getOriginal().getId(), "table.version.0.9"))
        .thenReturn(JsonUtils.pojoToJson(historical));
    assertEquals(historical, history.previous(state.getOriginal()));
  }

  private AtomicReference<String> captureHistory() {
    final var stored = new AtomicReference<String>();
    doAnswer(
            call -> {
              stored.set(call.getArgument(3));
              return null;
            })
        .when(extensions)
        .insert(any(UUID.class), anyString(), anyString(), anyString());
    return stored;
  }

  private MutationState<Table> state() {
    final var original =
        new Table()
            .withId(UUID.randomUUID())
            .withVersion(1.0)
            .withUpdatedBy("before")
            .withUpdatedAt(10L)
            .withChangeDescription(new ChangeDescription());
    final var updated =
        JsonUtils.deepCopy(original, Table.class).withUpdatedBy("after").withUpdatedAt(20L);
    final var state = new MutationState<>(original, updated);
    state.setChangeDescription(new ChangeDescription());
    return state;
  }

  private record Row(String json, Double expectedVersion) {}
}
