package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class RequestEntityCacheAliasesTest {
  private static final Fields FIELDS = new Fields(Set.of("owners", "domains"));
  private static final RelationIncludes INCLUDES = RelationIncludes.fromInclude(NON_DELETED);

  @AfterEach
  void clearCache() {
    RequestEntityCache.clear();
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void aliasesSerializeTheResponseOnlyOnce(boolean byNameFirst) {
    AtomicInteger nameReads = new AtomicInteger();
    Table entity =
        new Table() {
          @Override
          public String getName() {
            nameReads.incrementAndGet();
            return super.getName();
          }
        };
    entity.withId(UUID.randomUUID()).withName("orders").withFullyQualifiedName("service.orders");

    if (byNameFirst) {
      RequestEntityCache.putByNameAndId(
          Entity.TABLE,
          entity.getFullyQualifiedName(),
          entity.getId(),
          RequestEntityCache.projection(FIELDS, INCLUDES, true),
          entity);
    } else {
      putAliases(entity);
    }

    assertEquals(
        1, nameReads.get(), "Building two lookup aliases must not encode the entity twice");
    assertEquals("orders", byId(entity).getName());
    assertEquals("orders", byName(entity).getName());
  }

  @Test
  void aliasesKeepIndependentMutableResultsAndInvalidateTogether() {
    Table entity = table();
    putAliases(entity);
    entity.setName("changed after put");

    Table idResult = byId(entity);
    idResult.setName("changed after get");
    Table nameResult = byName(entity);
    assertNotSame(idResult, nameResult);
    assertEquals("orders", nameResult.getName());

    RequestEntityCache.invalidate(Entity.TABLE, entity.getId(), entity.getFullyQualifiedName());
    assertNull(byId(entity));
    assertNull(byName(entity));
  }

  @Test
  void bothAliasesCountTowardsTheExistingCapacity() {
    Table oldest = table();
    putAliases(oldest);
    for (int i = 0; i < 25; i++) {
      putAliases(table());
    }
    assertNull(byId(oldest));
    assertNull(byName(oldest));
  }

  @Test
  void absentSecondaryAliasesDoNotCreateInvalidKeys() {
    Table entity = table();
    var projection = RequestEntityCache.projection(FIELDS, INCLUDES, true);
    RequestEntityCache.putByIdAndName(Entity.TABLE, entity.getId(), null, projection, entity);
    assertEquals(entity, byId(entity));
    assertNull(byName(entity));
    RequestEntityCache.clear();
    RequestEntityCache.putByNameAndId(
        Entity.TABLE, entity.getFullyQualifiedName(), null, projection, entity);
    assertEquals(entity, byName(entity));
    assertNull(byId(entity));
  }

  private void putAliases(Table entity) {
    RequestEntityCache.putByIdAndName(
        Entity.TABLE,
        entity.getId(),
        entity.getFullyQualifiedName(),
        RequestEntityCache.projection(FIELDS, INCLUDES, true),
        entity);
  }

  private Table byId(Table entity) {
    return RequestEntityCache.getById(
        Entity.TABLE, entity.getId(), FIELDS, INCLUDES, true, Table.class);
  }

  private Table byName(Table entity) {
    return RequestEntityCache.getByName(
        Entity.TABLE, entity.getFullyQualifiedName(), FIELDS, INCLUDES, true, Table.class);
  }

  private Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("service." + UUID.randomUUID());
  }
}
