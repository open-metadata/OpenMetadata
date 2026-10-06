/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.openlineage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.resources.databases.DatabaseUtil;

class OpenLineageColumnMapperTest {

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "string|STRING",
        "STRING|STRING",
        "integer|INT",
        "int4|INT",
        "bigint|BIGINT",
        "long|BIGINT",
        "smallint|SMALLINT",
        "double|DOUBLE",
        "double precision|DOUBLE",
        "float|FLOAT",
        "decimal(10,2)|DECIMAL",
        "numeric|NUMERIC",
        "boolean|BOOLEAN",
        "bool|BOOLEAN",
        "date|DATE",
        "timestamp|TIMESTAMP",
        "timestamp without time zone|TIMESTAMP",
        "timestamp with time zone|TIMESTAMPZ",
        "time|TIME",
        "interval|INTERVAL",
        "point|POINT",
        "map<string,int>|MAP",
        "jsonb|JSON",
        "uuid|UUID",
        "custom_type|UNKNOWN"
      })
  void mapsTheTypesProducersEmit(String rawType, ColumnDataType expected) {
    assertEquals(expected, column(rawType).getDataType());
  }

  @Test
  void sizedTypeWithoutSizeFallsBackToItsUnsizedFamily() {
    assertEquals(ColumnDataType.STRING, column("varchar").getDataType());
    assertEquals(ColumnDataType.STRING, column("character varying").getDataType());
    assertEquals(ColumnDataType.STRING, column("char").getDataType());
    assertEquals(ColumnDataType.BYTES, column("binary").getDataType());
    assertNull(column("varchar").getDataLength());
  }

  @Test
  void sizedTypeWithSizeKeepsTypeAndLength() {
    Column varchar = column("character varying(20)");
    Column binary = column("binary(16)");

    assertEquals(ColumnDataType.VARCHAR, varchar.getDataType());
    assertEquals(20, varchar.getDataLength());
    assertEquals(ColumnDataType.BINARY, binary.getDataType());
    assertEquals(16, binary.getDataLength());
  }

  @Test
  void arrayCarriesItsElementType() {
    assertEquals(ColumnDataType.STRING, column("array<string>").getArrayDataType());
    assertEquals(ColumnDataType.UNKNOWN, column("array").getArrayDataType());
  }

  @Test
  void structCarriesEmptyChildrenBecauseTheFacetHasNoNesting() {
    Column struct = column("struct<a:int>");

    assertEquals(ColumnDataType.STRUCT, struct.getDataType());
    assertTrue(struct.getChildren().isEmpty());
  }

  @Test
  void rawTypeIsKeptAsTheDisplayType() {
    assertEquals("decimal(10,2)", column("decimal(10,2)").getDataTypeDisplay());
  }

  @Test
  void missingTypeIsUnknown() {
    assertEquals(
        ColumnDataType.UNKNOWN,
        OpenLineageColumnMapper.toColumn(new SchemaField().withName("c")).getDataType());
  }

  @Test
  void everyMappedColumnPassesTableCreateValidation() {
    List<String> rawTypes =
        List.of(
            "string",
            "varchar",
            "varchar(255)",
            "char",
            "binary",
            "binary(8)",
            "array<int>",
            "array",
            "struct",
            "decimal(10,2)",
            "map<string,string>",
            "custom_type");
    List<SchemaField> fields =
        rawTypes.stream()
            .map(type -> new SchemaField().withName("col_" + rawTypes.indexOf(type)).withType(type))
            .toList();
    List<Column> columns =
        OpenLineageColumnMapper.toColumns(
            new DatasetFacets().withSchema(new SchemaFacet().withFields(fields)));

    assertEquals(rawTypes.size(), columns.size());
    assertDoesNotThrow(() -> DatabaseUtil.validateColumns(columns));
  }

  @Test
  void noSchemaFacetGivesNoColumns() {
    assertTrue(OpenLineageColumnMapper.toColumns(null).isEmpty());
    assertTrue(OpenLineageColumnMapper.toColumns(new DatasetFacets()).isEmpty());
  }

  private static Column column(String rawType) {
    return OpenLineageColumnMapper.toColumn(new SchemaField().withName("c").withType(rawType));
  }
}
