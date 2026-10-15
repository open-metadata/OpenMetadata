package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.Entity;

class SearchDocumentContextLoaderTest {
  @Test
  void absentPrefetchesRetainPerEntityFallbacks() {
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> null, (type, entities) -> null, (type, ids) -> Map.of());
    assertTrue(loader.load(Entity.TABLE, List.of(table()), Map.of()).isEmpty());
  }

  @Test
  void emptyLineageAndStylesSuppressRedundantReads() {
    final Table first = table();
    final Table second = table();
    final var edges = List.of(new EsLineageData());
    final Style style = new Style().withColor("blue");
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> Map.of(first.getId(), edges, second.getId(), List.of()),
            (type, entities) ->
                Map.of(first.getId(), Optional.of(style), second.getId(), Optional.empty()),
            (type, ids) -> Map.of());

    final var result = loader.load(Entity.TABLE, List.of(first, second), Map.of());
    assertEquals(edges, result.get(first.getId()).prefetchedUpstreamLineage());
    assertTrue(result.get(second.getId()).prefetchedUpstreamLineage().isEmpty());
    assertEquals(Optional.of(style), result.get(first.getId()).serviceStylePrefetch().style());
    assertTrue(result.get(second.getId()).serviceStylePrefetch().prefetched());
    assertTrue(result.get(second.getId()).serviceStylePrefetch().style().isEmpty());
    assertThrows(UnsupportedOperationException.class, result::clear);
  }

  @Test
  void missingAndUnidentifiedEntitiesDoNotAcquirePrefetches() {
    final Table known = table();
    final Table missing = table();
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> Map.of(known.getId(), List.of()),
            (type, entities) -> Map.of(),
            (type, ids) -> Map.of());
    final var result = loader.load(Entity.TABLE, List.of(known, missing, new Table()), Map.of());
    assertEquals(List.of(known.getId()), List.copyOf(result.keySet()));
    assertFalse(result.get(known.getId()).serviceStylePrefetch().prefetched());
  }

  @Test
  void suppliedRevisionsRemainBoundToTheSnapshotWithoutAnotherRead() {
    final TestCase test = new TestCase().withId(UUID.randomUUID());
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> null,
            (type, entities) -> null,
            (type, ids) -> {
              throw new AssertionError("Supplied revisions must not be reread");
            });
    assertEquals(
        23L,
        loader
            .load(Entity.TEST_CASE, List.of(test), Map.of(test.getId(), 23L))
            .get(test.getId())
            .relationshipRevision());
  }

  @Test
  void onlyMissingLogicalSuiteRevisionsAreLoadedInOneBatch() {
    final TestSuite supplied = suite(false);
    final TestSuite stored = suite(false);
    final TestSuite absent = suite(false);
    final TestSuite basic = suite(true);
    final TestSuite unspecified = suite(null);
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> null,
            (type, entities) -> null,
            (type, ids) -> {
              assertEquals(List.of(stored.getId(), absent.getId()), ids);
              return Map.of(stored.getId(), 29L);
            });
    final var result =
        loader.load(
            Entity.TEST_SUITE,
            List.of(supplied, stored, absent, basic, unspecified, new TestSuite().withBasic(false)),
            Map.of(supplied.getId(), 31L));
    assertEquals(3, result.size());
    assertEquals(31L, result.get(supplied.getId()).relationshipRevision());
    assertEquals(29L, result.get(stored.getId()).relationshipRevision());
    assertEquals(0L, result.get(absent.getId()).relationshipRevision());
  }

  @Test
  void onePrefetchFailureDoesNotDiscardAnotherDependency() {
    final Table table = table();
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> Map.of(table.getId(), List.of()),
            (type, entities) -> {
              throw new IllegalStateException("database unavailable");
            },
            (type, ids) -> Map.of());
    final var context = loader.load(Entity.TABLE, List.of(table), Map.of()).get(table.getId());
    assertTrue(context.prefetchedUpstreamLineage().isEmpty());
    assertFalse(context.serviceStylePrefetch().prefetched());
  }

  @Test
  void classInitializationFailureRetainsRevisionPrefetch() {
    final TestCase test = new TestCase().withId(UUID.randomUUID());
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> {
              throw new NoClassDefFoundError("unavailable mapper");
            },
            (type, entities) -> null,
            (type, ids) -> Map.of(test.getId(), 17L));
    final var context = loader.load(Entity.TEST_CASE, List.of(test), Map.of()).get(test.getId());
    assertNull(context.prefetchedUpstreamLineage());
    assertEquals(17L, context.relationshipRevision());
  }

  @Test
  void fatalVmErrorsAreNotConvertedIntoMissingData() {
    final var loader =
        new SearchDocumentContextLoader(
            (type, entities) -> {
              throw new OutOfMemoryError("simulated");
            },
            (type, entities) -> null,
            (type, ids) -> Map.of());
    assertThrows(
        OutOfMemoryError.class, () -> loader.load(Entity.TABLE, List.of(table()), Map.of()));
  }

  private static Table table() {
    return new Table().withId(UUID.randomUUID());
  }

  private static TestSuite suite(final Boolean basic) {
    return new TestSuite().withId(UUID.randomUUID()).withBasic(basic);
  }
}
