package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.schema.type.Include.ALL;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.Json;
import java.io.StringReader;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityPatchService;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Registers custom properties and counts SQL in the retained transaction")
@ExtendWith(TestNamespaceExtension.class)
class EntityExtensionMutationIT {
  @Test
  void hardDeleteRemovesCustomPropertiesWithOneDelete(TestNamespace ns) {
    try (final var fixture = fixture(ns)) {
      RequestEntityCache.clear();
      try (var deletes = new SqlQueryCounter(Entity.getJdbi(), "delete from entity_extension")) {
        repository().deletes().byId("admin", fixture.table().getId(), false, true);
        assertEquals(
            1, deletes.count(), "Deleting all extensions must not repeat each property delete");
      }
      assertThrows(EntityNotFoundException.class, () -> read(fixture.table()));
    }
  }

  @Test
  void identicalPropertiesDoNotDeleteOrInsertRows(TestNamespace ns) {
    try (final var fixture = fixture(ns)) {
      final TableRepository repository = repository();
      final Table original = read(fixture.table());
      final Table updated =
          JsonUtils.deepCopy(original, Table.class)
              .withUpdatedBy("admin")
              .withUpdatedAt(original.getUpdatedAt() + 1);
      try (var deletes = new SqlQueryCounter(Entity.getJdbi(), "delete from entity_extension");
          var inserts = new SqlQueryCounter(Entity.getJdbi(), "into entity_extension")) {
        repository.executeInTransaction(
            () -> {
              final var updater =
                  repository.new TableUpdater(original, updated, EntityOperation.PUT, null)
                      .mutation();
              updater.updateWithDeferredStore();
              assertFalse(updater.isVersionChanged());
              return null;
            });
        assertAll(
            () ->
                assertEquals(0, deletes.count(), "Equal custom-property JSON must not delete rows"),
            () ->
                assertEquals(
                    0, inserts.count(), "Equal custom-property JSON must not insert rows"));
      }
      assertEquals(original.getUpdatedAt(), updated.getUpdatedAt());
      assertEquals(
          JsonUtils.valueToTree(original.getExtension()),
          JsonUtils.valueToTree(read(original).getExtension()));
    }
  }

  @Test
  void consolidationKeepsRequestedPropertiesAfterReplayingThePreviousVersion(TestNamespace ns)
      throws Exception {
    try (final var fixture = fixture(ns)) {
      final Table first = patch(fixture.table(), fixture.property(), "second");
      final Table unchanged = patch(first, fixture.property(), "second");
      assertEquals(first.getVersion(), unchanged.getVersion());
      assertEquals("second", extension(read(first), fixture.property()));
      final Table restored = patch(unchanged, fixture.property(), "initial");
      assertEquals(fixture.table().getVersion(), restored.getVersion());
      assertEquals("initial", extension(read(restored), fixture.property()));
      assertEquals(
          "initial",
          extension(
              SdkClients.adminClient().tables().get(restored.getId().toString(), "extension"),
              fixture.property()));
    }
  }

  @Test
  void propertyWritesRollBackWithTheEntityFlush(TestNamespace ns) {
    try (final var fixture = fixture(ns)) {
      final Table original = read(fixture.table());
      final Table updated =
          JsonUtils.deepCopy(original, Table.class)
              .withExtension(Map.of(fixture.property(), "rolled back"))
              .withUpdatedBy("admin")
              .withUpdatedAt(original.getUpdatedAt() + 1);
      assertThrows(
          IllegalStateException.class,
          () ->
              repository()
                  .executeInTransaction(
                      () -> {
                        repository().new TableUpdater(original, updated, EntityOperation.PUT, null)
                            .mutation()
                            .updateWithDeferredStore();
                        assertEquals("rolled back", extension(read(original), fixture.property()));
                        throw new IllegalStateException(
                            "Injected failure after custom-property writes");
                      }));
      assertEquals("initial", extension(read(original), fixture.property()));
      assertEquals(original.getVersion(), read(original).getVersion());
    }
  }

  private Table patch(Table table, String property, String value) throws Exception {
    final JsonNode patch =
        JsonUtils.valueToTree(
            List.of(Map.of("op", "replace", "path", "/extension/" + property, "value", value)));
    RequestEntityCache.clear();
    try {
      return repository()
          .patches()
          .patch(
              new EntityPatchService.Target.Id(table.getId()),
              Json.createPatch(Json.createReader(new StringReader(patch.toString())).readArray()),
              new EntityCommandActor("admin", null),
              null,
              new EntityPatchService.Options(null, null))
          .entity();
    } finally {
      RequestEntityCache.clear();
    }
  }

  private String extension(Table table, String property) {
    return JsonUtils.valueToTree(table.getExtension()).get(property).asText();
  }

  private Table read(Table table) {
    RequestEntityCache.clear();
    try (var bypass = EntityCacheBypass.skip()) {
      return repository()
          .reads()
          .byId(
              table.getId(),
              new EntityReadService.Query(
                  null,
                  repository().fieldPolicy().parse("*"),
                  RelationIncludes.fromInclude(ALL),
                  false));
    } finally {
      RequestEntityCache.clear();
    }
  }

  private TableRepository repository() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private Fixture fixture(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var http = client.getHttpClient();
    final Type type =
        http.execute(HttpMethod.GET, "/v1/metadata/types/name/table", null, Type.class);
    final Type string =
        http.execute(HttpMethod.GET, "/v1/metadata/types/name/string", null, Type.class);
    final String property = ns.prefix("extensionProperty");
    http.execute(
        HttpMethod.PUT,
        "/v1/metadata/types/" + type.getId(),
        new CustomProperty()
            .withName(property)
            .withDescription("Mutation regression property")
            .withPropertyType(string.getEntityReference()),
        Type.class);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("extensionMutation"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                    .withExtension(Map.of(property, "initial")));
    return new Fixture(table, property, "/v1/metadata/types/" + type.getId());
  }

  private record Fixture(Table table, String property, String cleanupPath)
      implements AutoCloseable {
    @Override
    public void close() {
      final var http = SdkClients.adminClient().getHttpClient();
      final Type type =
          http.execute(HttpMethod.GET, cleanupPath + "?fields=customProperties", null, Type.class);
      final var retained =
          type.getCustomProperties().stream()
              .filter(value -> !property.equals(value.getName()))
              .toList();
      http.executeForString(
          HttpMethod.PATCH,
          cleanupPath,
          JsonUtils.pojoToJson(
              List.of(Map.of("op", "replace", "path", "/customProperties", "value", retained))),
          RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
      RequestEntityCache.clear();
    }
  }
}
