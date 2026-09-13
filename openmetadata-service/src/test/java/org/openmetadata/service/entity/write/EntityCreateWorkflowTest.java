package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

class EntityCreateWorkflowTest {
  private enum Failure {
    NONE,
    RELATIONSHIPS,
    INHERIT,
    POST_CREATE,
    CACHE
  }

  private final List<String> rows = new ArrayList<>();
  private final List<UUID> extensions = new ArrayList<>();
  private final List<UUID> columnExtensions = new ArrayList<>();
  private final List<UUID> relationships = new ArrayList<>();
  private final List<UUID> published = new ArrayList<>();
  private final List<String> cache = new ArrayList<>();
  private final List<Integer> committedChunks = new ArrayList<>();
  private final EntityReference owner =
      new EntityReference().withId(UUID.randomUUID()).withType("user");
  private Failure failure = Failure.NONE;
  private UUID failingEntity;
  private boolean inTransaction;
  private String capturedJson;
  private int clearCount;

  @Test
  void singleCreateCommitsAllMetadataBeforePublishingInheritedResponse() {
    final Table table = table(0);
    assertSame(table, workflow(100).create(table));
    assertEquals(List.of(1), committedChunks);
    assertEquals(List.of(table.getId()), extensions);
    assertEquals(extensions, columnExtensions);
    assertEquals(extensions, relationships);
    assertEquals(extensions, published);
    assertEquals(rows, cache);
    assertNull(JsonUtils.readValue(rows.getFirst(), Table.class).getOwners());
    assertEquals(List.of(owner), table.getOwners());
    assertNull(capturedJson);
    assertEquals(1, clearCount);
  }

  @Test
  void failedFlushRollsBackRowsAndMetadataWithoutPublishing() {
    failure = Failure.RELATIONSHIPS;
    final Table table = table(0);
    assertThrows(IllegalStateException.class, () -> workflow(100).create(table));
    assertTrue(rows.isEmpty());
    assertTrue(extensions.isEmpty());
    assertTrue(columnExtensions.isEmpty());
    assertTrue(relationships.isEmpty());
    assertTrue(committedChunks.isEmpty());
    assertTrue(published.isEmpty());
    assertTrue(cache.isEmpty());
    assertNull(table.getOwners());
    assertNull(capturedJson);
    assertEquals(1, clearCount);
  }

  @ParameterizedTest
  @EnumSource(
      value = Failure.class,
      names = {"INHERIT", "POST_CREATE", "CACHE"})
  void failedPostCommitEffectStillClearsCapturedJson(Failure effect) {
    failure = effect;
    assertThrows(IllegalStateException.class, () -> workflow(100).create(table(0)));
    assertEquals(List.of(1), committedChunks);
    assertEquals(1, rows.size());
    assertEquals(1, relationships.size());
    assertTrue(cache.isEmpty());
    assertEquals(effect == Failure.CACHE ? 1 : 0, published.size());
    assertNull(capturedJson);
    assertEquals(1, clearCount);
  }

  @Test
  void batchCreateRetainsChunkBoundariesAndPublishesAfterAllChunks() {
    final List<Table> tables = IntStream.range(0, 205).mapToObj(this::table).toList();
    assertSame(tables, workflow(100).createMany(tables));
    assertEquals(List.of(100, 100, 5), committedChunks);
    assertEquals(tables.stream().map(Table::getId).toList(), relationships);
    assertEquals(relationships, extensions);
    assertEquals(relationships, published);
    assertTrue(columnExtensions.isEmpty());
    assertTrue(cache.isEmpty());
    assertTrue(tables.stream().allMatch(table -> table.getOwners().equals(List.of(owner))));
    assertTrue(
        rows.stream()
            .map(row -> JsonUtils.readValue(row, Table.class))
            .allMatch(table -> table.getOwners() == null));
  }

  @Test
  void failedLaterChunkPreservesEarlierCommitsWithoutPublishingBatchEffects() {
    final List<Table> tables = IntStream.range(0, 3).mapToObj(this::table).toList();
    failure = Failure.RELATIONSHIPS;
    failingEntity = tables.getLast().getId();
    assertThrows(IllegalStateException.class, () -> workflow(2).createMany(tables));
    assertEquals(List.of(2), committedChunks);
    assertEquals(tables.subList(0, 2).stream().map(Table::getId).toList(), extensions);
    assertEquals(extensions, relationships);
    assertEquals(2, rows.size());
    assertTrue(published.isEmpty());
    assertTrue(cache.isEmpty());
    assertTrue(tables.stream().allMatch(table -> table.getOwners() == null));
  }

  @Test
  void emptyBatchDoesNotOpenATransaction() {
    final List<Table> tables = List.of();
    assertSame(tables, workflow(100).createMany(tables));
    assertTrue(committedChunks.isEmpty());
    assertTrue(rows.isEmpty());
    assertTrue(published.isEmpty());
  }

  @Test
  void invalidChunkSizeIsRejected() {
    assertThrows(IllegalArgumentException.class, () -> workflow(0));
    assertThrows(IllegalArgumentException.class, () -> workflow(-1));
  }

  private EntityCreateWorkflow<Table> workflow(int chunkSize) {
    final var writes =
        new EntityCreateWorkflow.Writes<Table>(
            this::writeRow,
            table -> writeId(extensions, table),
            table -> writeId(columnExtensions, table),
            this::writeRelationships);
    final var effects =
        new EntityCreateWorkflow.Effects<Table>(
            this::inherit,
            this::publish,
            this::publishCache,
            () -> {
              capturedJson = null;
              clearCount++;
            });
    final var batch =
        new EntityCreateWorkflow.Batch<Table>(
            tables -> tables.forEach(this::writeRow),
            tables -> tables.forEach(table -> writeId(extensions, table)),
            tables -> tables.forEach(this::writeRelationships),
            tables -> tables.forEach(this::inherit),
            tables -> tables.forEach(this::publish));
    return new EntityCreateWorkflow<>(writes, effects, batch, this::flush, chunkSize);
  }

  private void flush(Runnable work) {
    assertFalse(inTransaction);
    final int rowCount = rows.size();
    final int extensionCount = extensions.size();
    final int columnCount = columnExtensions.size();
    final int relationshipCount = relationships.size();
    inTransaction = true;
    try {
      work.run();
      committedChunks.add(rows.size() - rowCount);
    } catch (RuntimeException exception) {
      rows.subList(rowCount, rows.size()).clear();
      extensions.subList(extensionCount, extensions.size()).clear();
      columnExtensions.subList(columnCount, columnExtensions.size()).clear();
      relationships.subList(relationshipCount, relationships.size()).clear();
      throw exception;
    } finally {
      inTransaction = false;
    }
  }

  private void writeRow(Table table) {
    assertTrue(inTransaction);
    capturedJson = JsonUtils.pojoToJson(table);
    rows.add(capturedJson);
  }

  private void writeId(List<UUID> target, Table table) {
    assertTrue(inTransaction);
    target.add(table.getId());
  }

  private void writeRelationships(Table table) {
    failIfSelected(Failure.RELATIONSHIPS, table);
    writeId(relationships, table);
  }

  private void inherit(Table table) {
    assertFalse(inTransaction);
    assertTrue(relationships.contains(table.getId()));
    assertEquals(rows.size(), committedChunks.stream().mapToInt(Integer::intValue).sum());
    failIfSelected(Failure.INHERIT, table);
    table.setOwners(List.of(owner));
  }

  private void publish(Table table) {
    assertFalse(inTransaction);
    assertEquals(List.of(owner), table.getOwners());
    failIfSelected(Failure.POST_CREATE, table);
    published.add(table.getId());
  }

  private void publishCache(Table table) {
    assertTrue(published.contains(table.getId()));
    failIfSelected(Failure.CACHE, table);
    cache.add(capturedJson);
  }

  private void failIfSelected(Failure point, Table table) {
    if (failure == point && (failingEntity == null || failingEntity.equals(table.getId()))) {
      throw new IllegalStateException(point.name());
    }
  }

  private Table table(int index) {
    return new Table().withId(UUID.randomUUID()).withName("table" + index).withVersion(0.1);
  }
}
