/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class EntityFieldPathTest {

  // The cases the UI's TaskFieldPathUtils.test.ts reads too, so the two cannot drift apart.
  private static final JsonNode SHARED_CASES =
      JsonUtils.readTree(
          readString(
              Path.of(
                  "..",
                  "openmetadata-spec",
                  "src",
                  "test",
                  "resources",
                  "task-field-path-cases.json")));

  static Stream<Arguments> validPaths() {
    return StreamSupport.stream(SHARED_CASES.path("valid").spliterator(), false)
        .map(
            item ->
                Arguments.of(
                    item.path("entityType").asText(),
                    item.path("path").asText(),
                    item.path("container").asText(),
                    JsonUtils.convertValue(
                        item.path("names"), new TypeReference<List<String>>() {}),
                    FieldProperty.fromValue(item.path("property").asText()).orElseThrow()));
  }

  static Stream<Arguments> sharedInvalidPaths() {
    return StreamSupport.stream(SHARED_CASES.path("invalid").spliterator(), false)
        .map(item -> Arguments.of(item.path("entityType").asText(), item.path("path").asText()));
  }

  @ParameterizedTest
  @MethodSource("sharedInvalidPaths")
  void parse_refusesTheSharedInvalidPaths(String entityType, String text) {
    assertThrows(IllegalArgumentException.class, () -> EntityFieldPath.parse(text, entityType));
  }

  @Test
  void childKey_quotesANameOnlyWhenItHoldsADotOrAQuote() {
    assertEquals("columns.amount", EntityFieldPath.childKey("columns", "amount"));
    assertEquals("columns.\"order.id\"", EntityFieldPath.childKey("columns", "order.id"));
    assertEquals(
        "tasks.\"extract.load\".x", EntityFieldPath.childKey("tasks.\"extract.load\"", "x"));
  }

  private static String readString(Path path) {
    try {
      return Files.readString(path);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  @ParameterizedTest
  @MethodSource("validPaths")
  void parse_readsAndWritesBackTheSamePath(
      String entityType,
      String text,
      String container,
      List<String> names,
      FieldProperty property) {
    EntityFieldPath path = EntityFieldPath.parse(text, entityType);

    assertEquals(new EntityFieldPath(container, names, property), path);
    assertEquals(text, path.toString());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "entity",
        "columns.customer_id",
        "columns::customer_id::description",
        "columns::\"a.b\"::description",
        "columns.\"a.b\"",
        "columns[0].description",
        "columns.description",
        "columns.a.\"description\"",
        "messageSchema.user_id.description",
        "schemaFields.user_id.description",
        "charts.revenue.description",
        "columns..description"
      })
  void parse_refusesAnythingElse(String text) {
    assertThrows(IllegalArgumentException.class, () -> EntityFieldPath.parse(text, Entity.TABLE));
  }

  @ParameterizedTest
  @ValueSource(strings = {"columns.user_id.description", "messageSchema.user_id.description"})
  void parse_refusesAContainerTheEntityTypeDoesNotDeclare(String text) {
    assertThrows(IllegalArgumentException.class, () -> EntityFieldPath.parse(text, Entity.TOPIC));
  }

  @ParameterizedTest
  @ValueSource(strings = {"description", "tags"})
  void parse_entityLevelPathOnAnyEntityType(String text) {
    assertEquals(text, EntityFieldPath.parse(text, Entity.GLOSSARY_TERM).toString());
  }

  @ParameterizedTest
  @ValueSource(strings = {"columns.id.description", "charts.revenue.description"})
  void parse_refusesAFieldOfAnEntityTypeWithoutFields(String text) {
    assertThrows(
        IllegalArgumentException.class, () -> EntityFieldPath.parse(text, Entity.DASHBOARD));
  }
}
