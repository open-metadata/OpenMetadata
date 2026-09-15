package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.EntityDataDAOs.ChartDAO;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityPersistenceTest {
  private final Map<UUID, String> rows = new HashMap<>();
  private final RecordingProvider provider = new RecordingProvider();
  private final CachedEntityDao cache =
      new CachedEntityDao(provider, new CacheKeys("om:persistence-test"), new CacheConfig());
  private int serializations;
  private int commits;
  private int rollbacks;
  private int retainedCalls;
  private int uncapturedCalls;
  private boolean inTransaction;

  @AfterEach
  void clearDeferredEffects() {
    PostCommitActionQueue.clear();
  }

  @Test
  void canonicalJsonIsConsumedAfterOnePublication() {
    final EntityPersistence<Chart> persistence = persistence(true, true);
    final Chart chart = chart("before");
    persistence.flush(() -> persistence.capture(chart, () -> persistence.store(chart, false)));
    chart.setDescription("response");
    persistence.publish(chart);
    assertEquals(1, serializations);
    assertEquals(List.of(rows.get(chart.getId()), rows.get(chart.getId())), provider.jsons);
    persistence.publish(chart);
    assertEquals(2, serializations);
    assertEquals(
        "response", JsonUtils.readValue(provider.jsons.getLast(), Chart.class).getDescription());
    assertEquals(1, commits);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void failedTransactionDiscardsCapturedRows(final boolean retained) {
    final EntityPersistence<Chart> persistence = persistence(true, true);
    final Chart chart = chart("failed");
    final Supplier<Void> work =
        () -> {
          persistence.capture(chart, () -> persistence.store(chart, false));
          throw new IllegalStateException("failed flush");
        };
    assertThrows(
        IllegalStateException.class,
        () -> {
          if (retained) {
            persistence.execute(work);
          } else {
            persistence.flush(work);
          }
        });
    assertTrue(rows.isEmpty());
    assertTrue(provider.jsons.isEmpty());
    chart.setDescription("after failure");
    persistence.publish(chart);
    assertEquals(
        "after failure",
        JsonUtils.readValue(provider.jsons.getFirst(), Chart.class).getDescription());
    assertEquals(2, serializations);
    assertEquals(0, commits);
    assertEquals(1, rollbacks);
  }

  @Test
  void batchCaptureUsesStoredJsonForBothAliasesWithoutRepeatedSerialization() {
    final EntityPersistence<Chart> persistence = persistence(true, true);
    final List<Chart> charts = List.of(chart("first"), chart("second"));
    final List<StoredEntity> stored =
        persistence.captureFlush(() -> persistence.insertMany(charts), this::unexpectedFlush);
    charts.forEach(chart -> chart.setDescription("response"));
    persistence.publishMany(charts, stored);
    assertEquals(2, serializations);
    assertEquals(2, rows.size());
    assertEquals(4, provider.jsons.size());
    assertTrue(provider.jsons.stream().allMatch(rows::containsValue));
    final List<StoredEntity> updated =
        persistence.captureFlush(() -> persistence.updateMany(charts), this::unexpectedFlush);
    assertEquals(2, updated.size());
    assertEquals(4, serializations);
    assertEquals(2, commits);
    assertEquals(0, retainedCalls);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void absentOrExcludedCacheKeepsTheUncapturedOwningFlush(final boolean cacheable) {
    final EntityPersistence<Chart> persistence = persistence(!cacheable, cacheable);
    final List<Chart> charts = List.of(chart("first"), chart("second"));
    final List<StoredEntity> captured =
        persistence.captureFlush(
            () -> persistence.insertMany(charts),
            operation -> {
              uncapturedCalls++;
              persistence.flush(operation);
            });
    persistence.publishMany(charts, captured);
    assertTrue(captured.isEmpty());
    assertTrue(provider.jsons.isEmpty());
    assertEquals(2, serializations);
    assertEquals(1, uncapturedCalls);
    assertEquals(1, commits);
  }

  @Test
  void retainedOuterRollbackDiscardsNestedRowsAndDeferredPublication() {
    final EntityPersistence<Chart> persistence = persistence(true, true);
    final Chart chart = chart("nested");
    assertThrows(
        IllegalStateException.class,
        () ->
            persistence.execute(
                () -> {
                  persistence.flush(
                      () -> persistence.capture(chart, () -> persistence.store(chart, false)));
                  persistence.publish(chart);
                  assertTrue(provider.jsons.isEmpty());
                  throw new IllegalStateException("outer rollback");
                }));
    assertTrue(rows.isEmpty());
    assertTrue(provider.jsons.isEmpty());
    assertEquals(1, retainedCalls);
    assertEquals(0, commits);
    assertEquals(1, rollbacks);
  }

  @Test
  void failedOptimisticWriteKeepsTheExistingPreconditionFailure() {
    final EntityPersistence<Chart> persistence = persistence(true, true);
    final Chart chart = chart("conflict");
    assertThrows(
        PreconditionFailedException.class,
        () ->
            persistence.flush(
                () -> persistence.capture(chart, () -> persistence.store(chart, true, 0.1))));
    assertTrue(rows.isEmpty());
    assertTrue(provider.jsons.isEmpty());
    assertEquals(0, commits);
  }

  @Test
  void directWritesAndExplicitClearNeverReuseAnOlderCapturedRow() {
    final EntityPersistence<Chart> persistence = persistence(true, true);
    final Chart chart = chart("original");
    persistence.flush(() -> persistence.store(chart, false));
    chart.setDescription("first response");
    persistence.publish(chart);
    assertEquals(
        "first response",
        JsonUtils.readValue(provider.jsons.getFirst(), Chart.class).getDescription());
    persistence.flush(() -> persistence.capture(chart, () -> persistence.store(chart, true)));
    persistence.clearStored();
    chart.setDescription("second response");
    persistence.publish(chart);
    assertEquals(
        "second response",
        JsonUtils.readValue(provider.jsons.getLast(), Chart.class).getDescription());
    assertEquals(4, serializations);
  }

  private EntityPersistence<Chart> persistence(final boolean available, final boolean cacheable) {
    return new EntityPersistence<>(
        new EntityPersistence.Schema<>("chart", dao()),
        new EntityPersistence.Boundaries(this::transaction, this::retained),
        new EntityPersistence.Cache(() -> available ? cache : null, cacheable),
        new EntityPersistence.Policy<>(
            entity -> {
              serializations++;
              return JsonUtils.pojoToJson(entity);
            },
            entity -> {}));
  }

  private ChartDAO dao() {
    final ChartDAO dao = mock(ChartDAO.class);
    when(dao.getTableName()).thenReturn("chart_entity");
    when(dao.getNameHashColumn()).thenReturn("fqnHash");
    doAnswer(
            call -> {
              write(call.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(any(), any(), any(), any());
    doAnswer(
            call -> {
              write(call.getArgument(2));
              return null;
            })
        .when(dao)
        .update(any(UUID.class), any(), any());
    doAnswer(
            call -> {
              writeMany(call.getArgument(3));
              return null;
            })
        .when(dao)
        .insertMany(any(), any(), any(), any());
    doAnswer(
            call -> {
              writeMany(call.getArgument(4));
              return null;
            })
        .when(dao)
        .updateMany(any(), any(), any(), any(), any());
    return dao;
  }

  private void writeMany(final List<String> jsons) {
    jsons.forEach(this::write);
  }

  private void write(final String json) {
    assertTrue(inTransaction);
    rows.put(JsonUtils.readValue(json, Chart.class).getId(), json);
  }

  private <R> R retained(final Supplier<R> work) {
    retainedCalls++;
    return transaction(work);
  }

  private <R> R transaction(final Supplier<R> work) {
    if (inTransaction) {
      return work.get();
    }
    final Map<UUID, String> before = Map.copyOf(rows);
    PostCommitActionQueue.begin();
    inTransaction = true;
    try {
      final R result = work.get();
      commits++;
      inTransaction = false;
      PostCommitActionQueue.run(PostCommitActionQueue.drain());
      return result;
    } catch (RuntimeException failure) {
      rows.clear();
      rows.putAll(before);
      PostCommitActionQueue.clear();
      rollbacks++;
      throw failure;
    } finally {
      inTransaction = false;
    }
  }

  private void unexpectedFlush(final Runnable operation) {
    throw new AssertionError("A cached batch must capture canonical rows in the owning flush");
  }

  private Chart chart(final String description) {
    return new Chart()
        .withId(UUID.randomUUID())
        .withName(description)
        .withFullyQualifiedName("service." + description)
        .withDescription(description);
  }

  private static final class RecordingProvider extends NoopCacheProvider {
    private final List<String> jsons = new ArrayList<>();

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      jsons.add(value);
    }

    @Override
    public void hset(final String key, final Map<String, String> fields, final Duration ttl) {
      jsons.add(fields.get("base"));
    }
  }
}
