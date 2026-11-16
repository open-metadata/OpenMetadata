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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;

/**
 * Turns OpenLineage schema-facet fields into columns that pass the same validation as a REST table
 * create. Sized types that arrive without a size fall back to their unsized family, arrays carry an
 * element type, and structs carry empty children because the facet does not describe nesting. The
 * raw type is kept as the display type, so nothing the producer sent is lost.
 */
final class OpenLineageColumnMapper {

  private static final Pattern TYPE_SIZE = Pattern.compile("\\(\\s*(\\d+)");
  private static final Pattern ARRAY_ELEMENT = Pattern.compile("^array\\s*<\\s*([a-z0-9_ ]+)");
  private static final Pattern WHITESPACE = Pattern.compile("\\s+");

  /** Spellings that Spark, Postgres and other producers emit for an OpenMetadata type. */
  private static final Map<String, ColumnDataType> PRODUCER_TYPE_ALIASES =
      Map.ofEntries(
          Map.entry("integer", ColumnDataType.INT),
          Map.entry("int2", ColumnDataType.SMALLINT),
          Map.entry("int4", ColumnDataType.INT),
          Map.entry("int8", ColumnDataType.BIGINT),
          Map.entry("short", ColumnDataType.SMALLINT),
          Map.entry("byte", ColumnDataType.TINYINT),
          Map.entry("long", ColumnDataType.BIGINT),
          Map.entry("real", ColumnDataType.FLOAT),
          Map.entry("float4", ColumnDataType.FLOAT),
          Map.entry("float8", ColumnDataType.DOUBLE),
          Map.entry("double precision", ColumnDataType.DOUBLE),
          Map.entry("bool", ColumnDataType.BOOLEAN),
          Map.entry("character varying", ColumnDataType.VARCHAR),
          Map.entry("character", ColumnDataType.CHAR),
          Map.entry("nvarchar", ColumnDataType.VARCHAR),
          Map.entry("varchar2", ColumnDataType.VARCHAR),
          Map.entry("nchar", ColumnDataType.CHAR),
          Map.entry("timestamp without time zone", ColumnDataType.TIMESTAMP),
          Map.entry("timestamp with time zone", ColumnDataType.TIMESTAMPZ),
          Map.entry("timestamptz", ColumnDataType.TIMESTAMPZ),
          Map.entry("timestamp_ntz", ColumnDataType.TIMESTAMP),
          Map.entry("timestamp_ltz", ColumnDataType.TIMESTAMPZ),
          Map.entry("timestamp_tz", ColumnDataType.TIMESTAMPZ),
          Map.entry("time without time zone", ColumnDataType.TIME),
          Map.entry("time with time zone", ColumnDataType.TIME),
          Map.entry("jsonb", ColumnDataType.JSON));

  private static final Map<String, ColumnDataType> TYPES_BY_NAME = buildTypesByName();

  private OpenLineageColumnMapper() {}

  static List<Column> toColumns(DatasetFacets facets) {
    SchemaFacet schema = facets != null ? facets.getSchema() : null;
    List<Column> columns = new ArrayList<>();
    if (schema != null && !nullOrEmpty(schema.getFields())) {
      schema.getFields().forEach(field -> columns.add(toColumn(field)));
    }
    return columns;
  }

  static Column toColumn(SchemaField field) {
    String rawType = field.getType() == null ? "" : field.getType().trim();
    Column column = new Column().withName(field.getName()).withDescription(field.getDescription());
    if (!rawType.isEmpty()) {
      column.setDataTypeDisplay(rawType);
    }
    applyDataType(column, rawType.toLowerCase(Locale.ROOT));
    return column;
  }

  static ColumnDataType toDataType(String lowerCaseType) {
    return TYPES_BY_NAME.getOrDefault(baseTypeName(lowerCaseType), ColumnDataType.UNKNOWN);
  }

  private static void applyDataType(Column column, String lowerCaseType) {
    ColumnDataType dataType = toDataType(lowerCaseType);
    Integer size = sizeOf(lowerCaseType);
    switch (dataType) {
      case CHAR, VARCHAR -> applySized(column, dataType, size, ColumnDataType.STRING);
      case BINARY, VARBINARY -> applySized(column, dataType, size, ColumnDataType.BYTES);
      case ARRAY -> column
          .withDataType(ColumnDataType.ARRAY)
          .withArrayDataType(arrayElementType(lowerCaseType));
      case STRUCT -> column.withDataType(ColumnDataType.STRUCT).withChildren(new ArrayList<>());
      default -> column.withDataType(dataType);
    }
  }

  private static void applySized(
      Column column, ColumnDataType sizedType, Integer size, ColumnDataType unsizedType) {
    if (size == null) {
      column.setDataType(unsizedType);
    } else {
      column.withDataType(sizedType).withDataLength(size);
    }
  }

  private static Integer sizeOf(String lowerCaseType) {
    Matcher matcher = TYPE_SIZE.matcher(lowerCaseType);
    return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
  }

  private static ColumnDataType arrayElementType(String lowerCaseType) {
    Matcher matcher = ARRAY_ELEMENT.matcher(lowerCaseType);
    return matcher.find() ? toDataType(matcher.group(1)) : ColumnDataType.UNKNOWN;
  }

  /** Drops type arguments such as {@code (255)} or {@code <string>} and normalizes spacing. */
  private static String baseTypeName(String lowerCaseType) {
    int argumentsStart = firstIndexOf(lowerCaseType, '(', '<');
    String base = argumentsStart < 0 ? lowerCaseType : lowerCaseType.substring(0, argumentsStart);
    return WHITESPACE.matcher(base.trim()).replaceAll(" ");
  }

  private static int firstIndexOf(String value, char first, char second) {
    int firstIndex = value.indexOf(first);
    int secondIndex = value.indexOf(second);
    return firstIndex < 0 || (secondIndex >= 0 && secondIndex < firstIndex)
        ? secondIndex
        : firstIndex;
  }

  /** Every OpenMetadata type answers to its own name, plus the producer aliases above. */
  private static Map<String, ColumnDataType> buildTypesByName() {
    Map<String, ColumnDataType> typesByName =
        Arrays.stream(ColumnDataType.values())
            .collect(
                Collectors.toMap(
                    type -> type.value().toLowerCase(Locale.ROOT),
                    type -> type,
                    (first, second) -> first,
                    HashMap::new));
    typesByName.putAll(PRODUCER_TYPE_ALIASES);
    return Map.copyOf(typesByName);
  }
}
