package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TableRepository;

@Isolated("Injects a committed write during a real SQL read to exercise the cache race guard")
@ExtendWith(TestNamespaceExtension.class)
class EntityCacheRecoveryIT {
  private enum Lookup {
    ID,
    NAME
  }

  @ParameterizedTest
  @ValueSource(strings = {"{malformed", "{\"name\":\"missing identity\"}"})
  void corruptRedisEntriesRecoverFromDatabase(String corrupt, TestNamespace ns) {
    final var table = table(ns);
    final var cache = CacheBundle.getCachedEntityDao();
    assumeTrue(cache != null);
    for (Lookup lookup : Lookup.values()) {
      clear(table);
      if (lookup == Lookup.ID) {
        cache.putBase(Entity.TABLE, table.getId(), corrupt);
      } else {
        cache.putByName(Entity.TABLE, table.getFullyQualifiedName(), corrupt);
      }
      try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from table_entity")) {
        final var actual = find(lookup, table);
        assertEquals(table.getId(), actual.getId());
        assertEquals(table.getFullyQualifiedName(), actual.getFullyQualifiedName());
        assertEquals(1, queries.count(), "Corruption recovery must read the row once");
      }
      final String repaired =
          lookup == Lookup.ID
              ? cache.getBase(table.getId(), Entity.TABLE).orElseThrow()
              : cache.getByName(Entity.TABLE, table.getFullyQualifiedName()).orElseThrow();
      assertEquals(table.getId(), JsonUtils.readValue(repaired, Table.class).getId());
      try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from table_entity")) {
        assertEquals(table.getId(), find(lookup, table).getId());
        assertEquals(0, queries.count(), "The recovered cache must serve the next read");
      }
    }
  }

  @ParameterizedTest
  @EnumSource(Lookup.class)
  void writerDuringLoadCannotPublishAnOlderCacheValue(Lookup lookup, TestNamespace ns) {
    final var table = table(ns);
    clear(table);
    final var patch =
        JsonUtils.readTree(
            "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"committed during read\"}]");
    try (var reads =
        SqlQueryCounter.afterFirst(
            Entity.getJdbi(),
            "from table_entity",
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(
                        HttpMethod.PATCH, "/v1/tables/" + table.getId(), patch, Table.class))) {
      assertEquals("committed during read", find(lookup, table).getDescription());
      assertEquals(
          2, reads.count(), "A raced load requires one fresh read after the writer commits");
    }
    assertEquals("committed during read", find(lookup, table).getDescription());
    final var cache = CacheBundle.getCachedEntityDao();
    if (cache != null) {
      for (String json :
          List.of(
              cache.getBase(table.getId(), Entity.TABLE).orElse("{}"),
              cache.getByName(Entity.TABLE, table.getFullyQualifiedName()).orElse("{}"))) {
        final var value = JsonUtils.readTree(json);
        if (value.has("id")) {
          assertEquals("committed during read", value.path("description").asText());
        }
      }
    }
  }

  private static Table table(TestNamespace ns) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private static Table find(Lookup lookup, Table table) {
    final var repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    return switch (lookup) {
      case ID -> repository.find(table.getId(), Include.NON_DELETED);
      case NAME -> repository.findByName(table.getFullyQualifiedName(), Include.NON_DELETED);
    };
  }

  private static void clear(Table table) {
    assertNotNull(table.getId());
    EntityRepository.CACHE_WITH_ID.invalidate(Pair.of(Entity.TABLE, table.getId()));
    EntityRepository.CACHE_WITH_NAME.invalidate(
        Pair.of(Entity.TABLE, table.getFullyQualifiedName()));
    final var cache = CacheBundle.getCachedEntityDao();
    if (cache != null) {
      cache.deleteBase(Entity.TABLE, table.getId());
      cache.deleteByName(Entity.TABLE, table.getFullyQualifiedName());
    }
  }
}
