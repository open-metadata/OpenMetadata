package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class RequestEntityCacheSnapshotTest {
  private static final RequestEntityCache.Projection PROJECTION =
      RequestEntityCache.projection(
          new Fields(Set.of("columns", "extension")),
          RelationIncludes.fromInclude(NON_DELETED),
          true);

  @AfterEach
  void clear() {
    RequestEntityCache.clear();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "plain text",
        "quoted \"value\"\n\t\\",
        "caf\u00e9 \u4e16\u754c",
        "\uD83D\uDE03",
        "unpaired high \uD800 tail",
        "unpaired low \uDC00 tail",
        "nul \u0000 and separator \u2028"
      })
  void retainsStringCodecSemantics(String text) {
    final Table entity = table().withDescription(text);
    entity.setColumns(List.of(new Column().withName(text).withDescription(text)));
    assertSnapshot(entity);
  }

  @Test
  void retainsUntypedExtensionNumbersDatesBinaryAndNulls() {
    final Map<String, Object> values = new LinkedHashMap<>();
    values.put("integer", new BigInteger("123456789012345678901234567890"));
    values.put("decimal", new BigDecimal("123.000000000000000000000000001"));
    values.put("nan", Double.NaN);
    values.put("infinity", Double.POSITIVE_INFINITY);
    values.put("date", new Date(123456789));
    values.put("binary", new byte[] {0, 1, -1});
    values.put("absent", null);
    assertSnapshot(table().withExtension(values));
  }

  @Test
  void aliasesRetainIndependentNestedSnapshots() {
    final Table entity =
        table().withColumns(new ArrayList<>(List.of(new Column().withName("before"))));
    put(entity);
    entity.getColumns().getFirst().setName("source changed");
    final Table byId = byId(entity);
    final Table byName = byName(entity);
    byId.getColumns().getFirst().setName("reader changed");
    assertNotSame(byId.getColumns(), byName.getColumns());
    assertEquals("before", byName.getColumns().getFirst().getName());
    assertEquals("before", byId(entity).getColumns().getFirst().getName());
  }

  @Test
  void failedSnapshotPreservesPreviousAliasesAndExceptionContract() {
    final Table original = table();
    put(original);
    final Table broken =
        new Table() {
          @Override
          public String getDescription() {
            throw new IllegalStateException("Cannot serialize");
          }
        };
    broken.setId(original.getId());
    broken.setFullyQualifiedName(original.getFullyQualifiedName());
    final RuntimeException expected =
        assertThrows(RuntimeException.class, () -> JsonUtils.pojoToJson(broken));
    final RuntimeException actual = assertThrows(RuntimeException.class, () -> put(broken));
    assertEquals(expected.getClass(), actual.getClass());
    assertEquals(expected.getMessage(), actual.getMessage());
    assertEquals(original, byId(original));
    assertEquals(original, byName(original));
  }

  private void assertSnapshot(Table entity) {
    final Table expected = JsonUtils.readValue(JsonUtils.pojoToJson(entity), Table.class);
    put(entity);
    assertEquals(expected, byId(entity));
    assertEquals(expected, byName(entity));
  }

  private void put(Table entity) {
    RequestEntityCache.putByIdAndName(
        Entity.TABLE, entity.getId(), entity.getFullyQualifiedName(), PROJECTION, entity);
  }

  private Table byId(Table entity) {
    return RequestEntityCache.getById(Entity.TABLE, entity.getId(), PROJECTION, Table.class);
  }

  private Table byName(Table entity) {
    return RequestEntityCache.getByName(
        Entity.TABLE, entity.getFullyQualifiedName(), PROJECTION, Table.class);
  }

  private Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("service.orders");
  }
}
