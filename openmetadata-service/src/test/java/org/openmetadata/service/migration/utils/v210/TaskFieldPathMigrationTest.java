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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityFieldPath;
import org.openmetadata.service.util.FieldProperty;

class TaskFieldPathMigrationTest {

  private static final FieldProperty DESCRIPTION = FieldProperty.DESCRIPTION;
  private static final FieldProperty TAGS = FieldProperty.TAGS;

  static Stream<Arguments> tablePaths() {
    return Stream.of(
        // Entity level, every way it was written.
        Arguments.of(null, DESCRIPTION, "description"),
        Arguments.of("", TAGS, "tags"),
        Arguments.of("entity", DESCRIPTION, "description"),
        Arguments.of("tags", TAGS, "tags"),
        // Already in the format: unchanged.
        Arguments.of("columns.amount.description", DESCRIPTION, "columns.amount.description"),
        Arguments.of("columns.profile.child.tags", TAGS, "columns.profile.child.tags"),
        // UI description tasks: container::"name"::property, the name quoted as one blob.
        Arguments.of(
            "columns::\"profile.child\"::description",
            DESCRIPTION,
            "columns.profile.child.description"),
        Arguments.of("columns::amount::description", DESCRIPTION, "columns.amount.description"),
        Arguments.of("columns::\"a.b\"::description", DESCRIPTION, "columns.\"a.b\".description"),
        // UI tag tasks: dotted, no property.
        Arguments.of("columns.\"profile.child\"", TAGS, "columns.profile.child.tags"),
        Arguments.of("columns.amount", TAGS, "columns.amount.tags"),
        Arguments.of("columns::amount", TAGS, "columns.amount.tags"),
        // The 2.0.0 upgrade: no property, nested child (#36615).
        Arguments.of("columns.profile.child", DESCRIPTION, "columns.profile.child.description"),
        // An unquoted name with a dot reads as the format but names the dotted column.
        Arguments.of("columns.a.b.description", DESCRIPTION, "columns.\"a.b\".description"),
        // A bare leaf reached the nested field when exactly one had that name.
        Arguments.of(
            "columns::child::description", DESCRIPTION, "columns.profile.child.description"));
  }

  @ParameterizedTest
  @MethodSource("tablePaths")
  void convert_onAnExistingTable(String legacy, FieldProperty property, String expected) {
    assertEquals(expected, convert(legacy, Entity.TABLE, property, table()));
  }

  static Stream<Arguments> topicPaths() {
    return Stream.of(
        Arguments.of(
            "messageSchema::user_id::description",
            "messageSchema.schemaFields.user_id.description"),
        Arguments.of(
            "messageSchema.\"order.id\"", "messageSchema.schemaFields.\"order.id\".description"),
        Arguments.of(
            "messageSchema.schemaFields.user_id", "messageSchema.schemaFields.user_id.description"),
        // The AI agent wrote "columns" for every entity type.
        Arguments.of(
            "columns.user_id.description", "messageSchema.schemaFields.user_id.description"));
  }

  @ParameterizedTest
  @MethodSource("topicPaths")
  void convert_onAnExistingTopic(String legacy, String expected) {
    assertEquals(expected, convert(legacy, Entity.TOPIC, DESCRIPTION, topic()));
  }

  @Test
  void convert_columnsOnAnApiEndpoint_findsTheSchemaThatHasTheField() {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withRequestSchema(new APISchema().withSchemaFields(List.of()))
            .withResponseSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("userId"))));

    assertEquals(
        "responseSchema.schemaFields.userId.tags",
        convert("columns.userId.tags", Entity.API_ENDPOINT, TAGS, endpoint));
  }

  static Stream<Arguments> pathsOnAGoneEntity() {
    return Stream.of(
        Arguments.of("columns.profile.child", DESCRIPTION, "columns.profile.child.description"),
        Arguments.of(
            "columns::\"profile.child\"::description",
            DESCRIPTION,
            "columns.\"profile.child\".description"),
        Arguments.of("columns.amount.tags", TAGS, "columns.amount.tags"),
        Arguments.of("columns.\"a.b\"", TAGS, "columns.\"a.b\".tags"));
  }

  @ParameterizedTest
  @MethodSource("pathsOnAGoneEntity")
  void convert_whenTheEntityIsGone_writesTheLikeliestReading(
      String legacy, FieldProperty property, String expected) {
    assertEquals(expected, convert(legacy, Entity.TABLE, property, null));
  }

  @Test
  void convert_whenTheFieldIsGone_writesTheLikeliestReading() {
    assertEquals(
        "columns.missing.description",
        convert("columns::missing::description", Entity.TABLE, DESCRIPTION, table()));
  }

  @Test
  void convert_aPathThatNamesNoField_isLeftAlone() {
    assertTrue(
        TaskFieldPathMigration.convert("columns", Entity.TABLE, DESCRIPTION, table()).isEmpty());
  }

  @Test
  void convert_isIdempotent() {
    String once =
        convert("columns::\"profile.child\"::description", Entity.TABLE, DESCRIPTION, table());

    assertEquals(once, convert(once, Entity.TABLE, DESCRIPTION, table()));
  }

  @Test
  void rewrite_writesTheFormatUnderTheTasksKeyAndDropsTheLegacyKey() {
    ObjectNode json =
        taskJson(TaskEntityType.DescriptionUpdate, Map.of("field", "columns.profile.child"));

    Optional<TaskFieldPathMigration.Rewrite> rewrite =
        TaskFieldPathMigration.rewrite(json, about -> table());

    assertTrue(rewrite.orElseThrow().changed());
    assertEquals(
        "columns.profile.child.description", json.path("payload").path("fieldPath").asText());
    assertFalse(json.path("payload").has("field"));
  }

  @Test
  void rewrite_aTaskAlreadyInTheFormat_isNotWritten() {
    ObjectNode json =
        taskJson(TaskEntityType.TagUpdate, Map.of("fieldPath", "columns.amount.tags"));

    assertFalse(TaskFieldPathMigration.rewrite(json, about -> table()).orElseThrow().changed());
  }

  @Test
  void rewrite_aTaskThatChangesNoField_isSkipped() {
    ObjectNode json =
        taskJson(
            TaskEntityType.Suggestion,
            Map.of("suggestionType", "Owner", "fieldPath", "owners", "suggestedValue", "x"));

    assertTrue(TaskFieldPathMigration.rewrite(json, about -> table()).isEmpty());
  }

  private static String convert(
      String legacy, String entityType, FieldProperty property, EntityInterface<?> entity) {
    return TaskFieldPathMigration.convert(legacy, entityType, property, entity)
        .map(EntityFieldPath::toString)
        .orElseThrow();
  }

  private static ObjectNode taskJson(TaskEntityType type, Map<String, Object> payload) {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(type)
            .withAbout(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE))
            .withPayload(payload);
    return (ObjectNode) JsonUtils.valueToTree(task);
  }

  private static Table table() {
    Column child = new Column().withName("child");
    return new Table()
        .withName("orders")
        .withColumns(
            List.of(
                new Column().withName("amount"),
                new Column().withName("a.b"),
                new Column().withName("profile").withChildren(List.of(child))));
  }

  private static Topic topic() {
    return new Topic()
        .withMessageSchema(
            new MessageSchema()
                .withSchemaFields(
                    List.of(new Field().withName("user_id"), new Field().withName("order.id"))));
  }
}
