package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response.Status;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityLockedException;
import org.openmetadata.service.jdbi3.EntityDataDAOs.ChartDAO;
import org.openmetadata.service.util.RestUtil.PutResponse;

class EntityImportServiceTest {
  private final Map<UUID, String> rows = new HashMap<>();
  private final Map<UUID, Object> extensions = new HashMap<>();
  private final Map<UUID, EntityReference> relationships = new HashMap<>();
  private final List<StoredEntity> published = new ArrayList<>();
  private final List<UUID> invalidated = new ArrayList<>();
  private final EntityReference inheritedOwner =
      new EntityReference().withType("user").withId(UUID.randomUUID());
  private final EntityStore<Chart> store = store();
  private boolean inTransaction;
  private boolean failRelationships;
  private boolean locked;
  private int commits;
  private int serializations;

  @Test
  void createPreservesPreparedAuditAndPublishesCanonicalRowsAfterCommit() {
    final List<Chart> charts = List.of(chart(), chart());
    assertSame(charts, service().create(charts, "import-actor"));
    assertEquals(1, commits);
    assertEquals(charts.size(), serializations);
    assertEquals(charts.size(), published.size());
    for (Chart chart : charts) {
      final Chart stored = JsonUtils.readValue(rows.get(chart.getId()), Chart.class);
      assertEquals("prepared", stored.getUpdatedBy());
      assertEquals("import-actor", stored.getImpersonatedBy());
      assertNull(stored.getOwners());
      assertEquals(List.of(inheritedOwner), chart.getOwners());
      assertEquals(chart.getExtension(), extensions.get(chart.getId()));
      assertEquals(chart.getService(), relationships.get(chart.getId()));
    }
  }

  @Test
  void updateRetainsOriginalIdentityAndVersionWhileReplacingMetadata() {
    final Chart original = chart();
    service().create(List.of(original), "previous-actor");
    final Chart updated = chart().withDescription("updated").withExtension(Map.of("new", "value"));
    published.clear();
    final List<Chart> result =
        service()
            .update(List.of(original), List.of(updated), new EntityCommandActor("editor", null));
    assertSame(updated, result.getFirst());
    assertEquals(original.getId(), updated.getId());
    assertEquals(0.2, updated.getVersion());
    assertEquals("editor", updated.getUpdatedBy());
    assertEquals(1000L, updated.getUpdatedAt());
    assertNull(updated.getImpersonatedBy());
    assertEquals(2, commits);
    assertEquals(2, serializations);
    assertEquals(List.of(original.getId()), invalidated);
    assertEquals(updated.getExtension(), extensions.get(original.getId()));
    assertEquals(updated.getService(), relationships.get(original.getId()));
    assertEquals(rows.get(original.getId()), published.getFirst().json());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void failedFlushPreservesPreviousRowsAndMetadataWithoutPublication(boolean updating) {
    final Chart original = chart();
    if (updating) {
      service().create(List.of(original), null);
    }
    final Map<UUID, String> originalRows = Map.copyOf(rows);
    final Map<UUID, Object> originalExtensions = Map.copyOf(extensions);
    final Map<UUID, EntityReference> originalRelationships = Map.copyOf(relationships);
    final Chart updated = chart().withExtension(Map.of("replacement", "value"));
    published.clear();
    failRelationships = true;
    assertThrows(
        IllegalStateException.class,
        () -> {
          if (updating) {
            service()
                .update(
                    List.of(original), List.of(updated), new EntityCommandActor("editor", null));
          } else {
            service().create(List.of(updated), null);
          }
        });
    assertEquals(originalRows, rows);
    assertEquals(originalExtensions, extensions);
    assertEquals(originalRelationships, relationships);
    assertTrue(published.isEmpty());
    assertEquals(updating ? 1 : 0, commits);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void lockedBatchIsRejectedBeforeChangingAuditOrOpeningATransaction(boolean updating) {
    locked = true;
    final Chart entity = chart();
    assertThrows(
        EntityLockedException.class,
        () -> {
          if (updating) {
            service()
                .update(List.of(chart()), List.of(entity), new EntityCommandActor("editor", null));
          } else {
            service().create(List.of(entity), "import-actor");
          }
        });
    assertEquals("prepared", entity.getUpdatedBy());
    assertNull(entity.getImpersonatedBy());
    assertEquals(0, commits);
    assertTrue(rows.isEmpty());
  }

  @Test
  void emptyAndNullBatchesKeepTheirExistingReturnValueWithoutWork() {
    final List<Chart> empty = new ArrayList<>();
    locked = true;
    assertNull(service().create(null, null));
    assertSame(empty, service().create(empty, null));
    assertNull(service().update(null, null, new EntityCommandActor("editor", null)));
    assertSame(empty, service().update(null, empty, new EntityCommandActor("editor", null)));
    assertEquals(0, commits);
    assertEquals(0, serializations);
  }

  @Test
  void mixedImportReturnsCreatedRowsBeforeUpdatesWithOneCommitForEachExistingFlush() {
    final Chart original = chart();
    service().create(List.of(original), null);
    final Chart first = chart();
    final Chart second = chart();
    final Chart update = chart().withFullyQualifiedName(original.getFullyQualifiedName());
    final List<String> lookedUp = new ArrayList<>();
    final var result =
        batch(
                name -> {
                  assertEquals(1, commits);
                  lookedUp.add(name);
                  return original.getFullyQualifiedName().equals(name) ? original : null;
                })
            .upsert(List.of(update, first, second), "editor");
    assertEquals(
        List.of(
            update.getFullyQualifiedName(),
            first.getFullyQualifiedName(),
            second.getFullyQualifiedName()),
        lookedUp);
    assertEquals(3, commits);
    assertEquals(3, rows.size());
    assertSame(first, result.getFirst().getEntity());
    assertSame(second, result.get(1).getEntity());
    assertSame(update, result.getLast().getEntity());
    assertEquals(Status.CREATED, result.getFirst().getStatus());
    assertEquals(EventType.ENTITY_CREATED, result.getFirst().getChangeType());
    assertEquals(Status.OK, result.getLast().getStatus());
    assertEquals(EventType.ENTITY_UPDATED, result.getLast().getChangeType());
    assertEquals(original.getId(), update.getId());
    assertEquals(0.2, update.getVersion());
    assertEquals("editor", update.getUpdatedBy());
    assertEquals("prepared", first.getUpdatedBy());
    result.clear();
    assertTrue(result.isEmpty());
  }

  @Test
  void lookupFailureLeavesEveryPreparedRowUnwritten() {
    final Chart first = chart();
    final Chart second = chart();
    final var failure = new IllegalStateException("Lookup unavailable");
    final var batch =
        batch(
            name -> {
              if (second.getFullyQualifiedName().equals(name)) {
                throw failure;
              }
              return null;
            });
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class, () -> batch.upsert(List.of(first, second), "editor")));
    assertTrue(rows.isEmpty());
    assertEquals(0, commits);
    assertEquals(0, serializations);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aSinglePartitionUsesOnlyItsExistingFlush(boolean updating) {
    final Chart original = chart();
    final Chart updated = chart();
    final var result = batch(name -> updating ? original : null).upsert(List.of(updated), "editor");
    assertEquals(1, commits);
    assertEquals(1, rows.size());
    assertSame(updated, result.getFirst().getEntity());
    assertEquals(updating ? Status.OK : Status.CREATED, result.getFirst().getStatus());
    assertEquals(updating ? 0.2 : 0.1, updated.getVersion());
  }

  @Test
  void failedCreateStopsTheUpdatePartitionAndRollsBackItsRows() {
    final Chart original = chart();
    service().create(List.of(original), null);
    final String before = rows.get(original.getId());
    final Chart created = chart();
    final Chart update = chart().withFullyQualifiedName(original.getFullyQualifiedName());
    failRelationships = true;
    assertThrows(
        IllegalStateException.class,
        () ->
            batch(name -> original.getFullyQualifiedName().equals(name) ? original : null)
                .upsert(List.of(update, created), "editor"));
    assertEquals(Map.of(original.getId(), before), rows);
    assertEquals(1, commits);
    assertEquals(0.1, update.getVersion());
    assertEquals("prepared", update.getUpdatedBy());
  }

  @Test
  void duplicateMissingNamesRemainInTheCreatePartitionResolvedBeforeWrites() {
    final Chart first = chart();
    final Chart second = chart().withFullyQualifiedName(first.getFullyQualifiedName());
    final List<String> lookups = new ArrayList<>();
    final var result =
        batch(
                name -> {
                  assertTrue(rows.isEmpty());
                  lookups.add(name);
                  return null;
                })
            .upsert(List.of(first, second), "editor");
    assertEquals(List.of(first.getFullyQualifiedName(), first.getFullyQualifiedName()), lookups);
    assertEquals(1, commits);
    assertEquals(2, rows.size());
    assertEquals(Status.CREATED, result.getFirst().getStatus());
    assertEquals(Status.CREATED, result.getLast().getStatus());
  }

  @Test
  void emptyUpsertReturnsAMutableListWithoutLookupOrFlush() {
    final var result =
        batch(
                name -> {
                  throw new AssertionError("Unexpected lookup");
                })
            .upsert(List.of(), "editor");
    assertTrue(result.isEmpty());
    result.clear();
    assertEquals(0, commits);
  }

  @Test
  void matchingBindsOnlyAnExistingIdentityAndLeavesMissingInputsUntouched() {
    final Chart original = chart();
    final Chart requested = chart();
    final UUID before = requested.getId();
    final EntityImports<Chart> imports = batch(name -> original);
    assertSame(original, imports.match(requested));
    assertEquals(before, requested.getId());
    assertTrue(imports.identifyUpdate(requested));
    assertEquals(original.getId(), requested.getId());
    final Chart missing = chart();
    final UUID missingId = missing.getId();
    assertFalse(service().identifyUpdate(missing));
    assertEquals(missingId, missing.getId());
  }

  @Test
  void explicitActorsKeepCanonicalUpsertSeparateFromEntitySpecificImportPolicy() {
    final EntityImports<Chart> imports = service();
    final Chart specific = chart();
    assertSame(specific, imports.upsert(null, specific, "editor").getEntity());
    assertEquals("entity policy", specific.getDescription());
    final Chart canonical = chart();
    assertSame(
        canonical,
        imports
            .upsertAs(null, canonical, new EntityCommandActor("editor", "delegate"))
            .getEntity());
    assertEquals("canonical", canonical.getDescription());
    assertEquals("delegate", canonical.getImpersonatedBy());
  }

  private EntityImports<Chart> service() {
    return batch(name -> null);
  }

  private EntityImports<Chart> batch(Function<String, Chart> lookup) {
    final EntityImportService<Chart> service = preparedWrites();
    final var batch =
        new EntityImportBatch<>(
            lookup,
            new EntityImportBatch.Writes<>(
                values -> service.create(values, null),
                (originals, updates, actor) ->
                    service.update(originals, updates, new EntityCommandActor(actor, null))));
    final var policy =
        new EntityImportCommands.Policy<Chart>(
            entity -> lookup.apply(entity.getFullyQualifiedName()),
            (uri, entity, actor) ->
                new PutResponse<>(
                    Status.OK,
                    entity.withDescription("entity policy").withUpdatedBy(actor),
                    EventType.ENTITY_UPDATED));
    return new EntityImportCommands<>(
        service,
        batch,
        policy,
        (uri, entity, actor) ->
            new PutResponse<>(
                Status.OK,
                entity
                    .withDescription("canonical")
                    .withUpdatedBy(actor.user())
                    .withImpersonatedBy(actor.impersonatedBy()),
                EventType.ENTITY_UPDATED));
  }

  private EntityImportService<Chart> preparedWrites() {
    final var metadata =
        new EntityImportService.Metadata<Chart>(
            values -> values.forEach(value -> extensions.remove(value.getId())),
            values -> values.forEach(value -> extensions.put(value.getId(), value.getExtension())),
            values -> values.forEach(value -> relationships.remove(value.getId())),
            this::writeRelationships,
            value -> invalidated.add(value.getId()));
    final var effects =
        new EntityImportService.Effects<Chart>(
            values -> values.forEach(value -> value.setOwners(List.of(inheritedOwner))),
            values -> assertFalse(inTransaction),
            this::publish);
    final var boundary =
        new EntityImportService.Boundary<Chart>(
            values -> {
              if (locked) {
                throw new EntityLockedException("Parent deletion");
              }
            },
            this::flush);
    return new EntityImportService<>(
        new EntityImportService.Rows<>(store::insertMany, store::updateMany),
        metadata,
        effects,
        boundary,
        Clock.fixed(Instant.ofEpochMilli(1000), ZoneOffset.UTC));
  }

  private EntityStore<Chart> store() {
    final ChartDAO dao = mock(ChartDAO.class);
    when(dao.getTableName()).thenReturn("chart_entity");
    when(dao.getNameHashColumn()).thenReturn("fqnHash");
    doAnswer(
            call -> {
              persist(call.getArgument(3));
              return null;
            })
        .when(dao)
        .insertMany(any(), any(), any(), any());
    doAnswer(
            call -> {
              persist(call.getArgument(4));
              return null;
            })
        .when(dao)
        .updateMany(any(), any(), any(), any(), any());
    return new EntityStore<>(
        "chart",
        dao,
        value -> {
          serializations++;
          return JsonUtils.pojoToJson(value);
        },
        value -> {});
  }

  private void persist(List<String> jsons) {
    assertTrue(inTransaction);
    jsons.forEach(json -> rows.put(JsonUtils.readValue(json, Chart.class).getId(), json));
  }

  private void writeRelationships(List<Chart> values) {
    assertTrue(inTransaction);
    values.forEach(value -> relationships.put(value.getId(), value.getService()));
    if (failRelationships) {
      throw new IllegalStateException("Injected relationship failure");
    }
  }

  private List<StoredEntity> flush(Runnable work) {
    final var originalRows = new HashMap<>(rows);
    final var originalExtensions = new HashMap<>(extensions);
    final var originalRelationships = new HashMap<>(relationships);
    inTransaction = true;
    try {
      final List<StoredEntity> stored = store.capture(work);
      commits++;
      return stored;
    } catch (RuntimeException exception) {
      rows.clear();
      rows.putAll(originalRows);
      extensions.clear();
      extensions.putAll(originalExtensions);
      relationships.clear();
      relationships.putAll(originalRelationships);
      throw exception;
    } finally {
      inTransaction = false;
    }
  }

  private void publish(List<Chart> values, List<StoredEntity> stored) {
    assertFalse(inTransaction);
    assertEquals(values.size(), stored.size());
    stored.forEach(value -> assertEquals(rows.get(value.id()), value.json()));
    published.addAll(stored);
  }

  private Chart chart() {
    return new Chart()
        .withId(UUID.randomUUID())
        .withFullyQualifiedName(UUID.randomUUID().toString())
        .withVersion(0.1)
        .withUpdatedBy("prepared")
        .withUpdatedAt(1L)
        .withService(new EntityReference().withType("dashboardService").withId(UUID.randomUUID()))
        .withExtension(Map.of("original", "value"));
  }
}
