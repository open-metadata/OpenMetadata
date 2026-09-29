package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class RequestEntityCacheTest {

  private static final Fields FIELDS = new Fields(Set.of("owners"));
  private static final RelationIncludes INCLUDES = RelationIncludes.fromInclude(NON_DELETED);

  @AfterEach
  void cleanup() {
    RequestEntityCache.clear();
  }

  @Test
  void getByIdReturnsDefensiveCopy() {
    UUID id = UUID.randomUUID();
    Fields fields = new Fields(Set.of("owners"));
    RelationIncludes includes = RelationIncludes.fromInclude(NON_DELETED);
    Table table = new Table().withId(id).withName("orders");

    RequestEntityCache.putById(Entity.TABLE, id, fields, includes, true, table, Table.class);
    table.withName("orders_mutated_after_put");

    Table first = RequestEntityCache.getById(Entity.TABLE, id, fields, includes, true, Table.class);
    assertNotSame(table, first);
    assertEquals("orders", first.getName());
    first.withName("orders_mutated_after_get");

    Table second =
        RequestEntityCache.getById(Entity.TABLE, id, fields, includes, true, Table.class);
    assertEquals("orders", second.getName());
  }

  @Test
  void cacheKeyIncludesFieldSetRelationIncludeAndFromCacheFlag() {
    UUID id = UUID.randomUUID();
    Table table = new Table().withId(id).withName("lineitem");
    Fields fields = new Fields(Set.of("owners"));
    RelationIncludes includeAll = RelationIncludes.fromInclude(NON_DELETED);

    RequestEntityCache.putById(Entity.TABLE, id, fields, includeAll, true, table, Table.class);

    assertNull(
        RequestEntityCache.getById(
            Entity.TABLE, id, new Fields(Set.of("domains")), includeAll, true, Table.class));
    assertNull(
        RequestEntityCache.getById(
            Entity.TABLE, id, fields, RelationIncludes.fromInclude(null), true, Table.class));
    assertNull(
        RequestEntityCache.getById(Entity.TABLE, id, fields, includeAll, false, Table.class));
  }

  @Test
  void getByNameAndInvalidateWorkAsExpected() {
    UUID id = UUID.randomUUID();
    String name = "orders";
    Fields fields = new Fields(Set.of("owners"));
    RelationIncludes includes = RelationIncludes.fromInclude(NON_DELETED);
    Table table = new Table().withId(id).withName(name);

    RequestEntityCache.putByName(Entity.TABLE, name, fields, includes, true, table, Table.class);

    Table cached =
        RequestEntityCache.getByName(Entity.TABLE, name, fields, includes, true, Table.class);
    assertEquals(name, cached.getName());

    RequestEntityCache.invalidate(Entity.TABLE, null, name);
    assertNull(
        RequestEntityCache.getByName(Entity.TABLE, name, fields, includes, true, Table.class));
  }

  @Test
  void cacheIsThreadIsolated() throws Exception {
    UUID id = UUID.randomUUID();
    Fields fields = new Fields(Set.of("owners"));
    RelationIncludes includes = RelationIncludes.fromInclude(NON_DELETED);
    Table table = new Table().withId(id).withName("thread_local");
    RequestEntityCache.putById(Entity.TABLE, id, fields, includes, true, table, Table.class);

    AtomicReference<Table> fromOtherThread = new AtomicReference<>();
    Thread thread =
        new Thread(
            () ->
                fromOtherThread.set(
                    RequestEntityCache.getById(
                        Entity.TABLE, id, fields, includes, true, Table.class)));
    thread.start();
    thread.join();

    assertNull(fromOtherThread.get());
    assertNotNull(
        RequestEntityCache.getById(Entity.TABLE, id, fields, includes, true, Table.class));
  }

  @Test
  void freshReadScopeHidesEarlierEntriesAndDropsItsOwn() {
    UUID id = UUID.randomUUID();
    cache(id, "before");

    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      assertNull(cachedName(id), "An entry cached before the scope must not answer inside it");
      cache(id, "during_scope");
      assertEquals("during_scope", cachedName(id), "The scope serves what it read itself");
    }

    assertEquals("before", cachedName(id), "Nothing cached inside the scope outlives it");
  }

  @Test
  void consecutiveFreshReadScopesStartEmpty() {
    UUID id = UUID.randomUUID();
    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      cache(id, "decided");
    }

    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      assertNull(cachedName(id), "A later scope must not see an earlier scope's answer");
    }
  }

  @Test
  void freshReadScopeServesRepeatedReadsFromItsOwnCache() {
    UUID id = UUID.randomUUID();
    String fqn = "service.db.schema.orders";

    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      cache(id, "orders");
      cacheByName(fqn, "orders");

      assertEquals("orders", cachedName(id));
      assertEquals("orders", cachedNameByFqn(fqn));
    }
  }

  @Test
  void nestedFreshReadScopeStartsEmptyAndRestoresOuterOnClose() {
    UUID id = UUID.randomUUID();
    try (FreshReadScope.Handle outer = FreshReadScope.enter()) {
      cache(id, "outer");
      try (FreshReadScope.Handle inner = FreshReadScope.enter()) {
        assertNull(cachedName(id), "A nested scope starts with its own empty cache");
        cache(id, "inner");
        assertEquals("inner", cachedName(id));
      }
      assertEquals("outer", cachedName(id));
    }
  }

  @Test
  void invalidateInsideScopeEvictsOuterRequestCache() {
    UUID id = UUID.randomUUID();
    cache(id, "before_write");

    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      RequestEntityCache.invalidate(Entity.TABLE, id, null);
    }

    assertNull(cachedName(id), "A write inside a scope must also evict the cache around it");
  }

  @Test
  void invalidateEvictsEveryOpenScope() {
    String fqn = "service.db.schema.lineitem";
    try (FreshReadScope.Handle outer = FreshReadScope.enter()) {
      cacheByName(fqn, "outer");
      try (FreshReadScope.Handle inner = FreshReadScope.enter()) {
        cacheByName(fqn, "inner");
        RequestEntityCache.invalidate(Entity.TABLE, null, fqn);
        assertNull(cachedNameByFqn(fqn));
      }
      assertNull(cachedNameByFqn(fqn), "The outer scope must not keep the evicted entity");
    }
  }

  @Test
  void clearInsideScopeResurrectsNothingOnClose() {
    UUID id = UUID.randomUUID();
    cache(id, "base");

    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      cache(id, "scoped");
      RequestEntityCache.clear();
      assertNull(cachedName(id));
      cache(id, "after_clear");
    }

    assertNull(cachedName(id), "Neither cleared entries nor a put after the clear may reappear");
    cache(id, "later");
    assertEquals("later", cachedName(id));
  }

  @Test
  void closingScopesOutOfOrderRemovesOnlyTheClosedOne() {
    UUID id = UUID.randomUUID();
    RequestEntityCache.Scope first = RequestEntityCache.openScope();
    RequestEntityCache.Scope second = RequestEntityCache.openScope();
    try {
      first.close();
      cache(id, "second");
      assertEquals("second", cachedName(id), "The scope still open keeps serving its reads");
    } finally {
      second.close();
      first.close();
    }

    assertNull(cachedName(id));
    assertFalse(RequestEntityCache.hasOpenScopes());
  }

  @Test
  void closingAScopeTwiceIsHarmless() {
    UUID id = UUID.randomUUID();
    try (FreshReadScope.Handle outer = FreshReadScope.enter()) {
      cache(id, "outer");
      FreshReadScope.Handle inner = FreshReadScope.enter();
      inner.close();
      inner.close();

      assertTrue(FreshReadScope.isActive());
      assertEquals("outer", cachedName(id));
    }
  }

  @Test
  void lastScopeCloseReleasesThreadLocal() {
    try (FreshReadScope.Handle outer = FreshReadScope.enter()) {
      try (FreshReadScope.Handle inner = FreshReadScope.enter()) {
        assertTrue(RequestEntityCache.hasOpenScopes());
      }
      assertTrue(RequestEntityCache.hasOpenScopes());
    }

    assertFalse(RequestEntityCache.hasOpenScopes(), "Pooled threads must not keep scope state");
    assertFalse(FreshReadScope.isActive());
  }

  private static void cache(UUID id, String name) {
    Table table = new Table().withId(id).withName(name);
    RequestEntityCache.putById(Entity.TABLE, id, FIELDS, INCLUDES, false, table, Table.class);
  }

  private static String cachedName(UUID id) {
    Table table =
        RequestEntityCache.getById(Entity.TABLE, id, FIELDS, INCLUDES, false, Table.class);
    return table == null ? null : table.getName();
  }

  private static void cacheByName(String fqn, String name) {
    Table table = new Table().withId(UUID.randomUUID()).withName(name);
    RequestEntityCache.putByName(Entity.TABLE, fqn, FIELDS, INCLUDES, false, table, Table.class);
  }

  private static String cachedNameByFqn(String fqn) {
    Table table =
        RequestEntityCache.getByName(Entity.TABLE, fqn, FIELDS, INCLUDES, false, Table.class);
    return table == null ? null : table.getName();
  }
}
