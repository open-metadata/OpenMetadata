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

package org.openmetadata.service.migration.utils.v205;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class RemovedMetadataTest {

  private static final long SINCE = 1_000;
  private static final String BOT = "ingestion-bot";
  private static final String USER = "alice";
  private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

  @Test
  void restoresDescriptionABotBlankedInsideTheWindow() {
    List<JsonNode> history =
        List.of(version(1_500, BOT), version(500, USER).put("description", "curated"));

    ObjectNode target = current(history);
    assertEquals(1, new RemovedMetadata(history, target, SINCE).restoreFields());
    assertEquals("curated", target.get("description").asText());
  }

  @Test
  void restoresTheUserEditALaterBotRunBlankedAgain() {
    List<JsonNode> history =
        List.of(
            version(3_000, BOT),
            version(2_000, USER).put("description", "edited after the first wipe"),
            version(1_500, BOT),
            version(500, USER).put("description", "original"));

    ObjectNode target = current(history);
    new RemovedMetadata(history, target, SINCE).restoreFields();
    assertEquals("edited after the first wipe", target.get("description").asText());
  }

  @Test
  void leavesDescriptionsAUserClearedOrABotClearedBeforeTheWindow() {
    List<JsonNode> clearedByUser =
        List.of(version(1_500, USER), version(500, BOT).put("description", "d"));
    List<JsonNode> clearedBefore =
        List.of(version(900, BOT), version(500, USER).put("description", "d"));
    List<JsonNode> neverSet = List.of(version(1_500, BOT), version(500, USER));

    for (List<JsonNode> history : List.of(clearedByUser, clearedBefore, neverSet)) {
      ObjectNode target = current(history);
      assertEquals(0, new RemovedMetadata(history, target, SINCE).restoreFields());
      assertFalse(target.has("description"));
    }
  }

  @Test
  void neverOverwritesALiveValue() {
    List<JsonNode> history =
        List.of(
            version(1_500, BOT).put("displayName", "Now"),
            version(500, USER).put("displayName", "Before"));

    ObjectNode target = current(history);
    assertEquals(0, new RemovedMetadata(history, target, SINCE).restoreFields());
    assertEquals("Now", target.get("displayName").asText());
  }

  @Test
  void restoresNestedColumnDescriptionsByPath() {
    List<JsonNode> history =
        List.of(
            withColumns(version(1_500, BOT), column("id", ""), struct("addr", column("zip", ""))),
            withColumns(
                version(500, USER),
                column("id", "primary key"),
                struct("addr", column("zip", "postal code"))));

    ObjectNode target = current(history);
    assertEquals(2, new RemovedMetadata(history, target, SINCE).restoreFields());
    assertEquals("primary key", target.at("/columns/0/description").asText());
    assertEquals("postal code", target.at("/columns/1/children/0/description").asText());
  }

  @Test
  void leavesTheDescriptionOfAColumnTheSourceDroppedAndReAdded() {
    List<JsonNode> history =
        List.of(
            withColumns(version(2_000, BOT), column("id", "")),
            withColumns(version(1_500, BOT)),
            withColumns(version(500, USER), column("id", "primary key")));

    ObjectNode target = current(history);
    assertEquals(0, new RemovedMetadata(history, target, SINCE).restoreFields());
  }

  @Test
  void restoresRetentionPeriodOnlyWhenABotDeletionIsItsNewestChange() {
    List<JsonNode> deletedByBot =
        List.of(
            version(1_600, BOT),
            change(version(1_500, BOT), "fieldsDeleted", "retentionPeriod", "P30D", null));
    ObjectNode target = current(deletedByBot);
    assertEquals(1, new RemovedMetadata(deletedByBot, target, SINCE).restoreFields());
    assertEquals("P30D", target.get("retentionPeriod").asText());

    List<JsonNode> resetByUser = new ArrayList<>(deletedByBot);
    resetByUser.addFirst(
        change(version(1_700, USER), "fieldsAdded", "retentionPeriod", null, "P7D"));
    assertEquals(0, new RemovedMetadata(resetByUser, current(resetByUser), SINCE).restoreFields());
  }

  @Test
  void restoresTheNewestRemovedTagOfAClassificationTheEntityLostEntirely() {
    List<JsonNode> history =
        List.of(
            tagsDeleted(version(1_700, BOT), "tags", tag("Tier.Tier3")),
            tagsDeleted(version(1_600, USER), "tags", tag("Team.x")),
            tagsDeleted(
                version(1_500, BOT),
                "tags",
                tag("Tier.Tier2"),
                tag("Team.x"),
                tag("Glossary.term").put("labelType", "Derived")));

    ObjectNode target = withTags(current(history), tag("Source.tag"));
    assertEquals(1, new RemovedMetadata(history, target, SINCE).restoreTags());
    assertEquals(List.of("Source.tag", "Tier.Tier3"), tagFqns(target.get("tags")));
    assertFalse(target.at("/tags/1").has("appliedBy"), "server fills appliedBy itself");
  }

  @Test
  void leavesATagTheSourceReplacedWithinItsClassification() {
    List<JsonNode> history = List.of(tagsDeleted(version(1_500, BOT), "tags", tag("Tier.Tier2")));

    ObjectNode target = withTags(current(history), tag("Tier.Tier1"));
    assertEquals(0, new RemovedMetadata(history, target, SINCE).restoreTags());
  }

  @Test
  void restoresColumnTagsOnlyWhenTheColumnNameIsUnambiguous() {
    List<JsonNode> history =
        List.of(
            withColumns(
                tagsDeleted(
                    tagsDeleted(version(1_500, BOT), "columns.\"a.b\".tags", tag("PII.Sensitive")),
                    "columns.zip.tags",
                    tag("PII.Sensitive")),
                column("a.b", ""),
                struct("home", column("zip", "")),
                struct("work", column("zip", ""))));

    ObjectNode target = current(history);
    assertEquals(1, new RemovedMetadata(history, target, SINCE).restoreTags());
    assertEquals(List.of("PII.Sensitive"), tagFqns(target.at("/columns/0/tags")));
    assertEquals(List.of(), tagFqns(target.at("/columns/1/children/0/tags")));
  }

  @Test
  void reAddsRemovedConstraintsOnColumnsTheTableStillHas() {
    ObjectNode primaryKey = constraint("PRIMARY_KEY", "b", "a");
    ObjectNode onDroppedColumn = constraint("UNIQUE", "gone");
    ObjectNode duplicate = constraint("PRIMARY_KEY", "a", "b");
    List<JsonNode> history =
        List.of(
            withColumns(
                change(
                    version(1_500, BOT),
                    "fieldsDeleted",
                    "tableConstraints",
                    array(primaryKey, onDroppedColumn).toString(),
                    null),
                column("a", ""),
                column("b", "")),
            change(
                version(1_400, BOT),
                "fieldsDeleted",
                "tableConstraints",
                array(duplicate).toString(),
                null));

    ObjectNode target = current(history);
    assertEquals(1, new RemovedMetadata(history, target, SINCE).restoreConstraints());
    assertEquals(array(primaryKey), target.get("tableConstraints"));
  }

  @Test
  void leavesAConstraintAUserDeletedAfterABotRemovedIt() {
    String primaryKey = array(constraint("PRIMARY_KEY", "a")).toString();
    List<JsonNode> history =
        List.of(
            withColumns(
                change(version(1_700, USER), "fieldsDeleted", "tableConstraints", primaryKey, null),
                column("a", "")),
            change(version(1_600, BOT), "fieldsAdded", "tableConstraints", null, primaryKey),
            change(version(1_500, BOT), "fieldsDeleted", "tableConstraints", primaryKey, null));

    ObjectNode target = current(history);
    assertEquals(0, new RemovedMetadata(history, target, SINCE).restoreConstraints());
  }

  /**
   * usage-bot's daily lifeCycle PATCH restamps the current version with its own name while keeping
   * the changeDescription of whoever really wrote it; changeSummary still names that writer.
   */
  @Test
  void attributesARestampedVersionToTheWriterChangeSummaryNames() {
    List<JsonNode> blankedByDbt =
        List.of(
            restamped(
                withColumns(version(1_800, "usage-bot"), column("EMAIL", "")),
                "columns.EMAIL.description",
                BOT,
                1_600),
            withColumns(version(1_500, "usage-bot"), column("EMAIL", "curated")));
    ObjectNode target = current(blankedByDbt);
    assertEquals(1, new RemovedMetadata(blankedByDbt, target, SINCE).restoreFields());
    assertEquals("curated", target.at("/columns/0/description").asText());

    List<JsonNode> clearedByUser =
        List.of(
            restamped(
                withColumns(version(1_800, "usage-bot"), column("EMAIL", "")),
                "columns.EMAIL.description",
                USER,
                1_600),
            withColumns(version(1_500, BOT), column("EMAIL", "curated")));
    assertEquals(
        0, new RemovedMetadata(clearedByUser, current(clearedByUser), SINCE).restoreFields());
  }

  @Test
  void leavesTagsARestampedVersionRemovedSinceItsAuthorIsUnknown() {
    List<JsonNode> history =
        List.of(
            restamped(
                tagsDeleted(version(1_800, "usage-bot"), "tags", tag("Team.x")), "x", BOT, 0));

    assertEquals(0, new RemovedMetadata(history, current(history), SINCE).restoreTags());
  }

  private static ObjectNode version(long updatedAt, String updatedBy) {
    return JSON.objectNode().put("updatedAt", updatedAt).put("updatedBy", updatedBy);
  }

  private static ObjectNode restamped(
      ObjectNode version, String changeName, String changedBy, long changedAt) {
    version
        .withObjectProperty("changeDescription")
        .withObjectProperty("changeSummary")
        .putObject(changeName)
        .put("changedBy", changedBy)
        .put("changedAt", changedAt);
    ObjectNode incremental = version.putObject("incrementalChangeDescription");
    List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted").forEach(incremental::putArray);
    return version;
  }

  private static ObjectNode current(List<JsonNode> history) {
    return history.getFirst().deepCopy();
  }

  private static ObjectNode change(
      ObjectNode version, String kind, String name, String oldValue, String newValue) {
    ObjectNode change = JSON.objectNode().put("name", name);
    change.put("oldValue", oldValue);
    change.put("newValue", newValue);
    version.withObjectProperty("changeDescription").withArrayProperty(kind).add(change);
    return version;
  }

  private static ObjectNode tagsDeleted(ObjectNode version, String field, ObjectNode... tags) {
    return change(version, "fieldsDeleted", field, array(tags).toString(), null);
  }

  private static ObjectNode tag(String fqn) {
    return JSON.objectNode()
        .put("tagFQN", fqn)
        .put("source", "Classification")
        .put("labelType", "Automated")
        .put("state", "Confirmed")
        .put("appliedBy", "automatorapplicationbot");
  }

  private static ObjectNode withTags(ObjectNode node, ObjectNode... tags) {
    node.set("tags", array(tags));
    return node;
  }

  private static ObjectNode column(String name, String description) {
    return JSON.objectNode().put("name", name).put("description", description);
  }

  private static ObjectNode struct(String name, ObjectNode... children) {
    ObjectNode struct = JSON.objectNode().put("name", name);
    struct.set("children", array(children));
    return struct;
  }

  private static ObjectNode withColumns(ObjectNode version, ObjectNode... columns) {
    version.set("columns", array(columns));
    return version;
  }

  private static ObjectNode constraint(String type, String... columns) {
    ObjectNode constraint = JSON.objectNode().put("constraintType", type);
    ArrayNode names = constraint.putArray("columns");
    Arrays.stream(columns).forEach(names::add);
    return constraint;
  }

  private static ArrayNode array(JsonNode... nodes) {
    return JSON.arrayNode().addAll(Arrays.asList(nodes));
  }

  private static List<String> tagFqns(JsonNode tags) {
    List<String> fqns = new ArrayList<>();
    tags.forEach(tag -> fqns.add(tag.get("tagFQN").asText()));
    return fqns;
  }
}
