package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.entity.read.EntitySearchReader.Page;
import org.openmetadata.service.entity.read.EntitySearchReader.Query;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class EntitySearchReaderTest {
  @Test
  void pagesPreserveSearchOrderNormalizeFollowersAndKeepLenientProjection() throws IOException {
    final UUID followerId = UUID.randomUUID();
    final Map<String, Object> first = hit("second", followerId);
    final Map<String, Object> last = hit("first", followerId);
    final List<Map<String, Object>> hits = List.of(first, last);
    final Query query = query(2, 7);
    final var context = new SubjectContext(new User().withName("reader"), null, "analyst");
    final var reads = new AtomicInteger();
    final List<String> hydrated = new ArrayList<>();
    final var reader =
        new EntitySearchReader<>(
            Table.class,
            (actual, subject) -> {
              assertSame(query, actual);
              assertSame(context, subject);
              reads.incrementAndGet();
              return new SearchResultListMapper(hits, 14);
            },
            (uri, entity) -> {
              hydrated.add(entity.getName());
              return entity.withHref(URI.create("http://localhost/tables/" + entity.getName()));
            });

    final var result = reader.list(null, query, context);

    assertEquals(List.of("second", "first"), hydrated);
    assertEquals(hydrated, result.getData().stream().map(Table::getName).toList());
    assertEquals(7, result.getPaging().getOffset());
    assertEquals(14, result.getPaging().getTotal());
    assertEquals(1, reads.get());
    final Table entity = result.getData().getFirst();
    assertEquals(URI.create("http://localhost/tables/second"), entity.getHref());
    assertEquals(followerId, entity.getFollowers().getFirst().getId());
    assertEquals("user", entity.getFollowers().getFirst().getType());
    assertTrue(((List<?>) first.get("followers")).getFirst() instanceof EntityReference);
    result.getData().clear();
    assertTrue(result.getData().isEmpty());
  }

  @ParameterizedTest
  @ValueSource(ints = {0, -1})
  void countOnlyRequestsStillSearchAndDoNotInterpretHits(int limit) throws IOException {
    final var reads = new AtomicInteger();
    final var reader =
        new EntitySearchReader<>(
            Table.class,
            (query, subject) -> {
              reads.incrementAndGet();
              assertEquals(limit, query.page().limit());
              return new SearchResultListMapper(null, 27);
            },
            (uri, entity) -> {
              throw new AssertionError("Count-only search must not hydrate hits");
            });

    final var result = reader.list(null, query(limit, 19), null);

    assertTrue(result.getData().isEmpty());
    assertNull(result.getPaging().getOffset());
    assertEquals(27, result.getPaging().getTotal());
    assertEquals(1, reads.get());
  }

  @Test
  void emptyPositivePageRetainsOffsetAndTotal() throws IOException {
    final var reader =
        new EntitySearchReader<>(
            Table.class,
            (query, subject) -> new SearchResultListMapper(List.of(), 14),
            (uri, entity) -> {
              throw new AssertionError("No hit should be hydrated");
            });
    final var result = reader.list(null, query(10, 25), null);
    assertTrue(result.getData().isEmpty());
    assertEquals(25, result.getPaging().getOffset());
    assertEquals(14, result.getPaging().getTotal());
  }

  @Test
  void searchFailurePropagatesBeforeHydration() {
    final var unavailable = new IOException("Search unavailable");
    final var reader =
        new EntitySearchReader<>(
            Table.class,
            (query, subject) -> {
              throw unavailable;
            },
            (uri, entity) -> {
              throw new AssertionError("Failed search must not hydrate hits");
            });
    assertSame(
        unavailable, assertThrows(IOException.class, () -> reader.list(null, query(10, 0), null)));
  }

  @Test
  void malformedFollowerStopsLaterHitHydration() {
    final Map<String, Object> invalid = hit("invalid", UUID.randomUUID());
    invalid.put("followers", List.of("invalid-id"));
    final List<String> hydrated = new ArrayList<>();
    final var reader =
        new EntitySearchReader<>(
            Table.class,
            (query, subject) ->
                new SearchResultListMapper(
                    List.of(
                        hit("first", UUID.randomUUID()), invalid, hit("last", UUID.randomUUID())),
                    3),
            (uri, entity) -> {
              hydrated.add(entity.getName());
              return entity;
            });
    assertThrows(IllegalArgumentException.class, () -> reader.list(null, query(10, 0), null));
    assertEquals(List.of("first"), hydrated);
  }

  private static Query query(int limit, int offset) {
    return new Query(
        new SearchListFilter(Include.ALL),
        new Page(limit, offset),
        new SearchSortFilter("name.keyword", "desc", null, null),
        "query",
        "query-string");
  }

  private static Map<String, Object> hit(String name, UUID follower) {
    final Map<String, Object> hit = new LinkedHashMap<>();
    hit.put("id", UUID.randomUUID().toString());
    hit.put("name", name);
    hit.put("fullyQualifiedName", "service." + name);
    hit.put("followers", List.of(follower.toString()));
    hit.put("searchOnlyField", "ignored");
    return hit;
  }
}
