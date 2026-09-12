package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.delete.EntitySubtreeUpdates;
import org.openmetadata.service.entity.history.EntityHistoryType;
import org.openmetadata.service.entity.history.EntityVersionStore;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

class EntitySubtreeUpdatesTest {
  private final List<String> historyRows = new ArrayList<>();
  private final List<Table> rows = new ArrayList<>();
  private final List<Table> indexed = new ArrayList<>();
  private final List<UUID> invalidated = new ArrayList<>();
  private final List<Runnable> pendingEffects = new ArrayList<>();
  private final EntityVersionStore<Table> history = history();
  private final EntityUpdateWorkflow<Table> workflow =
      new EntityUpdateWorkflow<>(
          history,
          new EntityUpdateStore<>(
              history,
              new EntityUpdateStore.Rows<>(rows::add, (table, version) -> rows.add(table))));
  private final EntityReference owner =
      new EntityReference().withType("user").withId(UUID.randomUUID());
  private boolean inTransaction;
  private boolean failWrite;
  private boolean retry;
  private boolean metadataOnly;
  private boolean deferEffects;
  private int commits;
  private int invalidatedCounts;

  @ParameterizedTest
  @EnumSource(EntitySubtreeUpdates.Mode.class)
  void persistsHistoryAndChangedRowsBeforePublishing(EntitySubtreeUpdates.Mode mode) {
    final Table original = table(mode == EntitySubtreeUpdates.Mode.RESTORE);
    service().update(List.of(original), "editor", mode);
    assertEquals(1, commits);
    assertEquals(1, rows.size());
    assertEquals(0.2, rows.getFirst().getVersion());
    assertEquals(mode == EntitySubtreeUpdates.Mode.SOFT_DELETE, rows.getFirst().getDeleted());
    assertEquals("editor", rows.getFirst().getUpdatedBy());
    assertEquals(1000L, rows.getFirst().getUpdatedAt());
    assertEquals(List.of(owner), rows.getFirst().getOwners());
    assertEquals(0.1, JsonUtils.readValue(historyRows.getFirst(), Table.class).getVersion());
    assertEquals(rows, indexed);
    assertEquals(List.of(original.getId()), invalidated);
    assertEquals(1, invalidatedCounts);
    assertNotSame(original, rows.getFirst());
  }

  @Test
  void failedPersistenceDiscardsHistoryAndPublishesNothing() {
    failWrite = true;
    assertThrows(
        IllegalStateException.class,
        () ->
            service()
                .update(List.of(table(false)), "editor", EntitySubtreeUpdates.Mode.SOFT_DELETE));
    assertTrue(rows.isEmpty());
    assertTrue(historyRows.isEmpty());
    assertTrue(indexed.isEmpty());
    assertTrue(invalidated.isEmpty());
    assertEquals(0, invalidatedCounts);
    assertEquals(0, commits);
  }

  @Test
  void retryRebuildsTheBaselineAndEntitySpecificCommandState() {
    failWrite = true;
    retry = true;
    service().update(List.of(table(false)), "editor", EntitySubtreeUpdates.Mode.SOFT_DELETE);
    assertEquals(1, commits);
    assertEquals(1, rows.size());
    assertEquals(0.2, rows.getFirst().getVersion());
    assertEquals("attempt 1", rows.getFirst().getDisplayName());
    assertEquals("before diff", JsonUtils.readValue(historyRows.getFirst(), Table.class).getName());
    assertEquals(1, rows.getFirst().getChangeDescription().getFieldsUpdated().size());
    assertEquals(rows, indexed);
  }

  @Test
  void enclosingTransactionOwnsPublicationUntilItCommits() {
    deferEffects = true;
    service().update(List.of(table(false)), "editor", EntitySubtreeUpdates.Mode.SOFT_DELETE);
    assertTrue(indexed.isEmpty());
    assertTrue(invalidated.isEmpty());
    assertEquals(0, invalidatedCounts);
    assertEquals(1, pendingEffects.size());
    pendingEffects.forEach(Runnable::run);
    assertEquals(rows, indexed);
    assertEquals(1, invalidatedCounts);
  }

  @Test
  void unchangedEntitiesAndEmptyLevelsDoNotWriteOrPublish() {
    service().update(List.of(), "editor", EntitySubtreeUpdates.Mode.RESTORE);
    assertEquals(0, commits);
    service().update(List.of(table(false)), "editor", EntitySubtreeUpdates.Mode.RESTORE);
    assertTrue(rows.isEmpty());
    assertTrue(historyRows.isEmpty());
    assertTrue(indexed.isEmpty());
    assertEquals(0, invalidatedCounts);
  }

  @Test
  void metadataOnlyChangesPersistWithoutCreatingHistory() {
    metadataOnly = true;
    service().update(List.of(table(false)), "editor", EntitySubtreeUpdates.Mode.RESTORE);
    assertEquals(1, rows.size());
    assertEquals(0.1, rows.getFirst().getVersion());
    assertTrue(historyRows.isEmpty());
    assertEquals(rows, indexed);
  }

  private EntitySubtreeUpdates<Table> service() {
    final var preparation =
        new EntitySubtreeUpdates.Preparation<Table>(
            Table.class, entities -> entities.forEach(entity -> entity.setOwners(List.of(owner))));
    final var writes =
        new EntitySubtreeUpdates.Rows<Table>(history::insertMany, this::writeRows, this::flush);
    final var effects =
        new EntitySubtreeUpdates.Effects<Table>(
            entities -> entities.forEach(entity -> invalidated.add(entity.getId())),
            entities -> {
              assertFalse(inTransaction);
              indexed.addAll(entities);
            },
            () -> invalidatedCounts++,
            action -> {
              if (deferEffects) {
                pendingEffects.add(action);
              } else {
                action.run();
              }
            });
    return new EntitySubtreeUpdates<>(
        preparation,
        Command::new,
        writes,
        effects,
        Clock.fixed(Instant.ofEpochMilli(1000), ZoneOffset.UTC));
  }

  private EntityVersionStore<Table> history() {
    final EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
    doAnswer(
            call -> {
              assertTrue(inTransaction);
              historyRows.addAll(call.getArgument(3));
              return null;
            })
        .when(dao)
        .insertMany(any(), any(), any(), any());
    return new EntityVersionStore<>(
        new EntityHistoryType<>("table", Table.class, "table_entity"),
        () -> dao,
        JsonUtils::pojoToJson);
  }

  private void writeRows(List<Table> entities) {
    assertTrue(inTransaction);
    assertEquals(metadataOnly, historyRows.isEmpty());
    rows.addAll(entities);
    if (failWrite) {
      throw new IllegalStateException("Row persistence failed");
    }
  }

  private List<Table> flush(Supplier<List<Table>> work) {
    try {
      return attempt(work);
    } catch (IllegalStateException exception) {
      if (!retry) {
        throw exception;
      }
      failWrite = false;
      return attempt(work);
    }
  }

  private List<Table> attempt(Supplier<List<Table>> work) {
    inTransaction = true;
    try {
      final List<Table> result = work.get();
      commits++;
      return result;
    } catch (RuntimeException exception) {
      rows.clear();
      historyRows.clear();
      throw exception;
    } finally {
      inTransaction = false;
    }
  }

  private Table table(boolean deleted) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("before")
        .withDeleted(deleted)
        .withVersion(0.1)
        .withUpdatedBy("creator")
        .withUpdatedAt(10L);
  }

  private final class Command extends MutationState<Table>
      implements EntityDeferredUpdate<Table>, EntityUpdateWorkflow.Session<Table> {
    private final EntitySubtreeUpdates.Mode mode;
    private int attempts;

    private Command(Table before, Table after, EntitySubtreeUpdates.Mode mode) {
      super(before, after);
      this.mode = mode;
    }

    @Override
    public void updateWithDeferredStore() {
      workflow.updateWithDeferredStore(this);
    }

    @Override
    public boolean canConsolidateChanges() {
      return false;
    }

    @Override
    public void applyChanges(boolean importMode, boolean consolidatingChanges) {
      final boolean deleted = mode == EntitySubtreeUpdates.Mode.SOFT_DELETE;
      getUpdated().setDeleted(deleted);
      getUpdated().setDisplayName("attempt " + ++attempts);
      getOriginal().setName(getOriginal().getName() + " diff");
      if (!Objects.equals(getOriginal().getDeleted(), deleted)) {
        EntityChangeRecorder.recordValue(
            getChangeDescription(), "deleted", getOriginal().getDeleted(), deleted, false);
      }
      setEntityChanged(metadataOnly);
    }
  }
}
