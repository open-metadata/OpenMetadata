package org.openmetadata.service.resources.databases;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.json.Json;
import jakarta.json.JsonValue;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TableExecutionSource;
import org.openmetadata.schema.type.TableSharding;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.utils.JsonUtils;

class DatabaseUtilTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "/tableSharding/prefix",
        "/tableSharding/suffixFormat",
        "/tableSharding/representative",
        "/tableSharding/shardCount",
        "/tableSharding/firstShardDate",
        "/tableSharding/lastShardDate",
        "/tableSharding/representative/databaseName",
        "/tableSharding/representative/schemaName",
        "/tableSharding/representative/tableName",
        "/tableSharding/representative/shardDate"
      })
  void rejectsMissingRequiredShardingFieldsAfterPatch(String path) {
    var original = shardedTable("events_");
    for (var patch :
        List.of(
            Json.createPatchBuilder().remove(path).build(),
            Json.createPatchBuilder().replace(path, JsonValue.NULL).build())) {
      var updated = JsonUtils.applyPatch(original, patch, Table.class);
      assertThrows(
          IllegalArgumentException.class, () -> DatabaseUtil.validateTableSharding(updated));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"databaseName", "schemaName", "tableName"})
  void rejectsEmptyRepresentativeNamesAfterPatch(String field) {
    var patch =
        Json.createPatchBuilder().replace("/tableSharding/representative/" + field, "").build();
    var updated = JsonUtils.applyPatch(shardedTable("events_"), patch, Table.class);
    assertThrows(IllegalArgumentException.class, () -> DatabaseUtil.validateTableSharding(updated));
  }

  @ParameterizedTest
  @ValueSource(strings = {"events_", ""})
  void acceptsCompleteDescriptorIncludingDateOnlyFamilies(String prefix) {
    assertDoesNotThrow(() -> DatabaseUtil.validateTableSharding(shardedTable(prefix)));
  }

  @Test
  void acceptsOrdinaryTableWithoutDescriptor() {
    assertDoesNotThrow(
        () -> DatabaseUtil.validateTableSharding(new Table().withTableType(TableType.Regular)));
  }

  private Table shardedTable(String prefix) {
    return new Table()
        .withName(prefix + "yyyymmdd")
        .withTableType(TableType.Sharded)
        .withTableSharding(
            new TableSharding()
                .withPrefix(prefix)
                .withSuffixFormat(TableSharding.SuffixFormat.YYYYMMDD)
                .withShardCount(1)
                .withFirstShardDate("2026-01-01")
                .withLastShardDate("2026-01-01")
                .withRepresentative(
                    new TableExecutionSource()
                        .withDatabaseName("demo_db")
                        .withSchemaName("demo_schema")
                        .withTableName(prefix + "20260101")
                        .withShardDate("2026-01-01")));
  }
}
