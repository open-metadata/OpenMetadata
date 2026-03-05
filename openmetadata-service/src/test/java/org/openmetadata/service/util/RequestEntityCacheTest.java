package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
    assertTrue(
        RequestEntityCache.getById(Entity.TABLE, id, fields, includes, true, Table.class) != null);
  }
}
