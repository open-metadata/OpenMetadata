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

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.Entity;

class EntityFieldPathTest {

  static Stream<Arguments> validPaths() {
    return Stream.of(
        Arguments.of(Entity.TABLE, "description", "", List.of(), FieldProperty.DESCRIPTION),
        Arguments.of(Entity.TABLE, "tags", "", List.of(), FieldProperty.TAGS),
        Arguments.of(
            Entity.TABLE,
            "columns.customer_id.description",
            "columns",
            List.of("customer_id"),
            FieldProperty.DESCRIPTION),
        Arguments.of(
            Entity.TABLE,
            "columns.profile.child.description",
            "columns",
            List.of("profile", "child"),
            FieldProperty.DESCRIPTION),
        Arguments.of(
            Entity.TABLE, "columns.\"a.b\".tags", "columns", List.of("a.b"), FieldProperty.TAGS),
        Arguments.of(
            Entity.TABLE,
            "columns.tags.description",
            "columns",
            List.of("tags"),
            FieldProperty.DESCRIPTION),
        Arguments.of(
            Entity.TOPIC,
            "messageSchema.schemaFields.\"order.id\".tags",
            "messageSchema.schemaFields",
            List.of("order.id"),
            FieldProperty.TAGS),
        Arguments.of(
            Entity.CONTAINER,
            "dataModel.columns.total.description",
            "dataModel.columns",
            List.of("total"),
            FieldProperty.DESCRIPTION),
        Arguments.of(
            Entity.API_ENDPOINT,
            "responseSchema.schemaFields.default.name.last_name.tags",
            "responseSchema.schemaFields",
            List.of("default", "name", "last_name"),
            FieldProperty.TAGS),
        Arguments.of(
            Entity.PIPELINE,
            "tasks.extract.description",
            "tasks",
            List.of("extract"),
            FieldProperty.DESCRIPTION),
        Arguments.of(
            Entity.MLMODEL,
            "mlFeatures.age.tags",
            "mlFeatures",
            List.of("age"),
            FieldProperty.TAGS),
        Arguments.of(
            Entity.SEARCH_INDEX,
            "fields.title.description",
            "fields",
            List.of("title"),
            FieldProperty.DESCRIPTION));
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
