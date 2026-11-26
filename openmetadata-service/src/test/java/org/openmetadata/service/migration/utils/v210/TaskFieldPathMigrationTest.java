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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.migration.utils.v210.FieldPathFormat.FieldPath;

class TaskFieldPathMigrationTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DESCRIPTION = FieldPathFormat.DESCRIPTION;
  private static final String TAGS = FieldPathFormat.TAGS;
  private static final Map<String, List<String>> SEEDED_KEYS = Map.of();

  // Entities as 2.0 stores them.
  private static final JsonNode TABLE =
      json(
          "{'name':'orders','columns':[{'name':'amount'},{'name':'a.b'},"
              + "{'name':'profile','children':[{'name':'child'}]}]}");
  private static final JsonNode TOPIC =
      json("{'messageSchema':{'schemaFields':[{'name':'user_id'},{'name':'order.id'}]}}");

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
  void convert_onAnExistingTable(String legacy, String property, String expected) {
    assertEquals(expected, convert(legacy, "table", property, TABLE));
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
    assertEquals(expected, convert(legacy, "topic", DESCRIPTION, TOPIC));
  }

  @Test
  void convert_columnsOnAnApiEndpoint_findsTheSchemaThatHasTheField() {
    JsonNode endpoint =
        json(
            "{'requestSchema':{'schemaFields':[]},"
                + "'responseSchema':{'schemaFields':[{'name':'userId'}]}}");

    assertEquals(
        "responseSchema.schemaFields.userId.tags",
        convert("columns.userId.tags", "apiEndpoint", TAGS, endpoint));
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
      String legacy, String property, String expected) {
    assertEquals(expected, convert(legacy, "table", property, null));
  }

  @Test
  void convert_whenTheFieldIsGone_writesTheLikeliestReading() {
    assertEquals(
        "columns.missing.description",
        convert("columns::missing::description", "table", DESCRIPTION, TABLE));
  }

  @Test
  void convert_aPathThatNamesNoField_isLeftAlone() {
    assertTrue(TaskFieldPathMigration.convert("columns", "table", DESCRIPTION, TABLE).isEmpty());
  }

  @Test
  void convert_isIdempotent() {
    String once = convert("columns::\"profile.child\"::description", "table", DESCRIPTION, TABLE);

    assertEquals(once, convert(once, "table", DESCRIPTION, TABLE));
  }

  @Test
  void rewrite_writesTheFormatUnderTheTasksKeyAndDropsTheLegacyKey() {
    ObjectNode task =
        task("{'type':'DescriptionUpdate','payload':{'field':'columns.profile.child'}}");

    Optional<TaskFieldPathMigration.Rewrite> rewrite =
        TaskFieldPathMigration.rewrite(task, "table", TABLE, SEEDED_KEYS);

    assertTrue(rewrite.orElseThrow().changed());
    assertEquals(
        "columns.profile.child.description", task.path("payload").path("fieldPath").asText());
    assertFalse(task.path("payload").has("field"));
  }

  @Test
  void rewrite_aTaskAlreadyInTheFormat_isNotWritten() {
    ObjectNode task = task("{'type':'TagUpdate','payload':{'fieldPath':'columns.amount.tags'}}");

    assertFalse(
        TaskFieldPathMigration.rewrite(task, "table", TABLE, SEEDED_KEYS).orElseThrow().changed());
  }

  @Test
  void rewrite_aTaskThatChangesNoField_isSkipped() {
    ObjectNode task =
        task(
            "{'type':'Suggestion','payload':"
                + "{'suggestionType':'Owner','fieldPath':'owners','suggestedValue':'x'}}");

    assertTrue(TaskFieldPathMigration.rewrite(task, "table", TABLE, SEEDED_KEYS).isEmpty());
  }

  @Test
  void rewrite_aTagSuggestion_endsInTags() {
    ObjectNode task =
        task(
            "{'type':'Suggestion','payload':{'suggestionType':'Tag','fieldPath':'columns.amount'}}");

    TaskFieldPathMigration.rewrite(task, "table", TABLE, SEEDED_KEYS);

    assertEquals("columns.amount.tags", task.path("payload").path("fieldPath").asText());
  }

  @Test
  void rewrite_usesTheKeyTheFormSchemaNames() {
    ObjectNode task = task("{'type':'TagUpdate','payload':{'column':'columns.amount'}}");

    TaskFieldPathMigration.rewrite(
        task, "table", TABLE, Map.of("TagUpdate", List.of("column", "fieldPath")));

    assertEquals("columns.amount.tags", task.path("payload").path("column").asText());
    assertFalse(task.path("payload").has("fieldPath"));
  }

  static Stream<Arguments> formatRoundTrips() {
    return Stream.of(
        Arguments.of("columns", List.of("amount"), "columns.amount.tags"),
        Arguments.of("columns", List.of("profile", "child"), "columns.profile.child.tags"),
        Arguments.of("columns", List.of("a.b"), "columns.\"a.b\".tags"),
        Arguments.of("columns", List.of("say \"hi\""), "columns.\"say \"\"hi\"\"\".tags"),
        Arguments.of("dataModel.columns", List.of("total"), "dataModel.columns.total.tags"));
  }

  @ParameterizedTest
  @MethodSource("formatRoundTrips")
  void format_quotesNamesAndParsesBack(String container, List<String> names, String written) {
    FieldPath path = new FieldPath(container, names, TAGS);
    String entityType = "dataModel.columns".equals(container) ? "container" : "table";

    assertEquals(written, path.format());
    assertEquals(Optional.of(path), FieldPathFormat.parse(written, entityType));
  }

  @Test
  void parse_refusesWhatIsNotTheFormat() {
    assertTrue(FieldPathFormat.parse("columns.amount", "table").isEmpty());
    assertTrue(FieldPathFormat.parse("columns::amount::tags", "table").isEmpty());
    assertTrue(FieldPathFormat.parse("columns.\"a.b.tags", "table").isEmpty());
    assertTrue(FieldPathFormat.parse("fields.amount.tags", "table").isEmpty());
  }

  private static String convert(
      String legacy, String entityType, String property, JsonNode entity) {
    return TaskFieldPathMigration.convert(legacy, entityType, property, entity)
        .map(FieldPath::format)
        .orElseThrow();
  }

  private static ObjectNode task(String text) {
    return (ObjectNode) json(text);
  }

  private static JsonNode json(String text) {
    try {
      return MAPPER.readTree(text.replace('\'', '"'));
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException(e);
    }
  }
}
