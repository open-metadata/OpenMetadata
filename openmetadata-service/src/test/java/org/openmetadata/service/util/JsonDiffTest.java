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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

class JsonDiffTest {
  private static final int WIDE_TABLE_COLUMNS = 20_000;
  private static final long RANDOM_EDITS_SEED = 6902L;
  private static final int RANDOM_EDIT_RUNS = 2_000;
  private static final int MAX_EDITS_PER_RUN = 5;
  private static final List<String> RANDOM_KEYS = List.of("name", "a/b", "c~d", "~1", "e f");
  private static final Set<String> WRITE_OPERATIONS = Set.of("add", "remove", "replace");
  private static final Comparator<JsonNode> NUMBERS_BY_VALUE =
      (left, right) -> {
        boolean bothNumbers = left.isNumber() && right.isNumber();
        boolean equal =
            bothNumbers
                ? left.decimalValue().compareTo(right.decimalValue()) == 0
                : left.equals(right);
        return equal ? 0 : 1;
      };

  @ParameterizedTest(name = "{0}")
  @MethodSource("tableEdits")
  void getJsonPatchRoundTripsTableEdits(String edit, Table original, Table updated) {
    JsonPatch patch = JsonUtils.getJsonPatch(original, updated);

    Table patched = JsonUtils.applyPatch(original, patch, Table.class);

    assertEquals(JsonUtils.pojoToJsonNode(updated), JsonUtils.pojoToJsonNode(patched), edit);
  }

  static Stream<Arguments> tableEdits() {
    Table original = tableWithColumns(5);
    original
        .getColumns()
        .getFirst()
        .setTags(List.of(classificationTag("PII.Sensitive"), classificationTag("Tier.Tier1")));

    Table describedColumn = JsonUtils.deepCopy(original, Table.class);
    describedColumn.getColumns().get(1).setDescription("edited");
    Table taggedColumn = JsonUtils.deepCopy(original, Table.class);
    taggedColumn.getColumns().get(2).setTags(List.of(classificationTag("PII.Sensitive")));
    Table insertedColumn = JsonUtils.deepCopy(original, Table.class);
    insertedColumn.getColumns().add(2, column("inserted"));
    Table removedColumn = JsonUtils.deepCopy(original, Table.class);
    removedColumn.getColumns().remove(1);
    Table movedColumn = JsonUtils.deepCopy(original, Table.class);
    movedColumn.getColumns().addLast(movedColumn.getColumns().removeFirst());
    Table reorderedTags = JsonUtils.deepCopy(original, Table.class);
    reorderedTags
        .getColumns()
        .getFirst()
        .setTags(List.of(classificationTag("Tier.Tier1"), classificationTag("PII.Sensitive")));

    return Stream.of(
        Arguments.of("column description edited", original, describedColumn),
        Arguments.of("tag added to a column", original, taggedColumn),
        Arguments.of("column inserted mid-list", original, insertedColumn),
        Arguments.of("column removed", original, removedColumn),
        Arguments.of("column moved to the end", original, movedColumn),
        Arguments.of("column tags reordered", original, reorderedTags));
  }

  /** Authorization of a generated patch reads its paths, so an in-place edit must keep them. */
  @Test
  void getJsonPatchDiffsAColumnEditedInPlaceToAReplaceOfThatField() {
    Table original = tableWithColumns(5);
    Table updated = JsonUtils.deepCopy(original, Table.class);
    updated.getColumns().get(3).setDescription("edited");

    JsonArray operations = JsonUtils.getJsonPatch(original, updated).toJsonArray();

    assertEquals(1, operations.size());
    assertEquals("replace", operations.getJsonObject(0).getString("op"));
    assertEquals("/columns/3/description", operations.getJsonObject(0).getString("path"));
  }

  /** Cases are written with single quotes for readability; {@link #json} restores the JSON. */
  @ParameterizedTest(name = "{0}")
  @MethodSource("diffRules")
  void getJsonPatchFollowsTheDiffRules(String rule, String source, String target, String patch) {
    JsonPatch generated = JsonUtils.getJsonPatch(json(source), json(target));
    JsonNode patched =
        JsonUtils.applyPatch(JsonUtils.readTree(json(source)), generated, JsonNode.class);

    assertEquals(
        JsonUtils.readTree(json(patch)),
        JsonUtils.readTree(generated.toJsonArray().toString()),
        rule);
    assertTrue(JsonUtils.readTree(json(target)).equals(NUMBERS_BY_VALUE, patched), rule);
  }

  static Stream<Arguments> diffRules() {
    return Stream.of(
        Arguments.of("unchanged document", "{'a':[1,{'b':2}]}", "{'a':[1,{'b':2}]}", "[]"),
        Arguments.of(
            "edited field", "{'a':'x'}", "{'a':'y'}", "[{'op':'replace','path':'/a','value':'y'}]"),
        Arguments.of(
            "removed and added fields, explicit nulls included",
            "{'a':null,'b':1}",
            "{'b':1,'c':null}",
            "[{'op':'remove','path':'/a'},{'op':'add','path':'/c','value':null}]"),
        Arguments.of(
            "changed type replaces the value",
            "{'a':{'b':1}}",
            "{'a':[1]}",
            "[{'op':'replace','path':'/a','value':[1]}]"),
        Arguments.of("equal numbers of different types", "{'a':1}", "{'a':1.0}", "[]"),
        Arguments.of(
            "array grown at the end",
            "{'a':['x']}",
            "{'a':['x','y']}",
            "[{'op':'add','path':'/a/1','value':'y'}]"),
        Arguments.of(
            "array shrunk, surplus removed at one index",
            "{'a':['x','y','z']}",
            "{'a':['x']}",
            "[{'op':'remove','path':'/a/1'},{'op':'remove','path':'/a/1'}]"),
        Arguments.of(
            "array insert is one add",
            "{'a':['x','y','z']}",
            "{'a':['x','n','y','z']}",
            "[{'op':'add','path':'/a/1','value':'n'}]"),
        Arguments.of(
            "array removal is one remove",
            "{'a':['x','y','z']}",
            "{'a':['x','z']}",
            "[{'op':'remove','path':'/a/1'}]"),
        Arguments.of(
            "unmatched middle compared position by position",
            "{'a':['x','y','z']}",
            "{'a':['x','n','m','z']}",
            "[{'op':'replace','path':'/a/1','value':'n'},{'op':'add','path':'/a/2','value':'m'}]"),
        Arguments.of(
            "repeated values never trimmed twice",
            "{'a':['x','x']}",
            "{'a':['x']}",
            "[{'op':'remove','path':'/a/1'}]"),
        Arguments.of(
            "field names escaped in paths",
            "{'a/b':1,'c~d':1}",
            "{'a/b':2,'c~d':2}",
            "[{'op':'replace','path':'/a~1b','value':2},{'op':'replace','path':'/c~0d','value':2}]"),
        Arguments.of(
            "moved value is a remove and an add, never a move",
            "{'a':[1],'b':[]}",
            "{'a':[],'b':[1]}",
            "[{'op':'remove','path':'/a/0'},{'op':'add','path':'/b/0','value':1}]"),
        Arguments.of(
            "value equal to an unchanged one is added, never copied",
            "{'a':['u'],'b':[]}",
            "{'a':['u'],'b':['u']}",
            "[{'op':'add','path':'/b/0','value':'u'}]"),
        Arguments.of(
            "elements with the same name are paired, so an insert and a removal apart are two ops",
            "{'a':[{'name':'p','v':1},{'name':'q','v':2},{'name':'r','v':3},{'name':'s','v':4}]}",
            "{'a':[{'name':'p','v':1},{'name':'x','v':9},{'name':'q','v':2},{'name':'s','v':4}]}",
            "[{'op':'add','path':'/a/1','value':{'name':'x','v':9}},"
                + "{'op':'remove','path':'/a/3'}]"),
        Arguments.of(
            "element moved, paired by id, is a remove and an add",
            "{'a':[{'id':'1','v':1},{'id':'2','v':2},{'id':'3','v':3}]}",
            "{'a':[{'id':'2','v':2},{'id':'3','v':3},{'id':'1','v':1}]}",
            "[{'op':'remove','path':'/a/0'},{'op':'add','path':'/a/2','value':{'id':'1','v':1}}]"),
        Arguments.of(
            "strings are paired by value",
            "{'a':['p','q','r','s']}",
            "{'a':['q','r','s','p']}",
            "[{'op':'remove','path':'/a/0'},{'op':'add','path':'/a/3','value':'p'}]"),
        Arguments.of(
            "element renamed between paired ones stays a replace of its name",
            "{'a':[{'name':'p','v':1},{'name':'q','v':2},{'name':'r','v':3}]}",
            "{'a':[{'name':'x','v':0},{'name':'p','v':1},{'name':'q','v':2},{'name':'s','v':3}]}",
            "[{'op':'add','path':'/a/0','value':{'name':'x','v':0}},"
                + "{'op':'replace','path':'/a/3/name','value':'s'}]"),
        Arguments.of(
            "pairing by position is kept when pairing by identity is not shorter",
            "{'a':[{'name':'p'},{'name':'q'},{'name':'r'},{'name':'s'}]}",
            "{'a':[{'name':'p'},{'name':'x'},{'name':'q'},{'name':'s'}]}",
            "[{'op':'replace','path':'/a/1/name','value':'x'},"
                + "{'op':'replace','path':'/a/2/name','value':'q'}]"),
        Arguments.of(
            "names swapped in place stay two replaces, where pairing by name takes three ops",
            "{'a':[{'name':'p','v':1},{'name':'q','v':2}]}",
            "{'a':[{'name':'q','v':1},{'name':'p','v':2}]}",
            "[{'op':'replace','path':'/a/0/name','value':'q'},"
                + "{'op':'replace','path':'/a/1/name','value':'p'}]"),
        Arguments.of(
            "repeated names are compared position by position",
            "{'a':[{'name':'p','v':1},{'name':'p','v':2},{'name':'q','v':3}]}",
            "{'a':[{'name':'q','v':3},{'name':'p','v':1},{'name':'p','v':2}]}",
            "[{'op':'replace','path':'/a/0/name','value':'q'},"
                + "{'op':'replace','path':'/a/0/v','value':3},"
                + "{'op':'replace','path':'/a/1/v','value':1},"
                + "{'op':'replace','path':'/a/2/name','value':'p'},"
                + "{'op':'replace','path':'/a/2/v','value':2}]"),
        Arguments.of(
            "numbers are compared position by position",
            "{'a':[1,2,3]}",
            "{'a':[2,3,1]}",
            "[{'op':'replace','path':'/a/0','value':2},{'op':'replace','path':'/a/1','value':3},"
                + "{'op':'replace','path':'/a/2','value':1}]"));
  }

  /** NaN and infinities have no decimal value, so they must not reach a decimal comparison. */
  @Test
  void getJsonPatchComparesNonFiniteNumbers() {
    Map<String, Object> source = Map.of("nan", Double.NaN, "infinity", Double.POSITIVE_INFINITY);
    Map<String, Object> target = Map.of("nan", Double.NaN, "infinity", 1.5);

    JsonArray operations = JsonUtils.getJsonPatch(source, target).toJsonArray();

    assertEquals(1, operations.size());
    assertEquals("/infinity", operations.getJsonObject(0).getString("path"));
  }

  @Test
  void getJsonPatchRoundTripsRandomEdits() {
    Random random = new Random(RANDOM_EDITS_SEED);
    JsonNode original = JsonUtils.pojoToJsonNode(tableWithNestedFields());
    for (int run = 0; run < RANDOM_EDIT_RUNS; run++) {
      JsonNode updated = original.deepCopy();
      int edits = 1 + random.nextInt(MAX_EDITS_PER_RUN);
      for (int edit = 0; edit < edits; edit++) {
        applyRandomEdit(updated, random);
      }

      JsonArray operations = JsonUtils.getJsonPatch(original, updated).toJsonArray();
      String label = "run " + run;

      assertEquals(
          JsonUtils.readTree(updated.toString()),
          JsonUtils.applyPatch(original, Json.createPatch(operations), JsonNode.class),
          label);
      assertTrue(
          operations.size() <= positionalOperations(original, updated),
          label + " is longer than the position-by-position diff");
      operations.forEach(
          operation ->
              assertTrue(
                  WRITE_OPERATIONS.contains(operation.asJsonObject().getString("op")),
                  label + " reads from another path: " + operation));
    }
  }

  /** Guards against an array diff whose cost grows faster than the table, as an LCS diff's does. */
  @ParameterizedTest(name = "{0}")
  @MethodSource("wideTableEdits")
  void getJsonPatchDiffsAWideTableQuickly(String edit, Consumer<List<Column>> change, int ops) {
    Table original = tableWithColumns(WIDE_TABLE_COLUMNS);
    Table updated = JsonUtils.deepCopy(original, Table.class);
    change.accept(updated.getColumns());

    JsonPatch patch =
        assertTimeoutPreemptively(
            Duration.ofSeconds(5), () -> JsonUtils.getJsonPatch(original, updated));

    assertEquals(ops, patch.toJsonArray().size(), edit);
  }

  static Stream<Arguments> wideTableEdits() {
    Consumer<List<Column>> oneDescribed =
        columns -> columns.get(WIDE_TABLE_COLUMNS / 2).setDescription("edited");
    Consumer<List<Column>> allDescribed =
        columns -> columns.forEach(column -> column.setDescription("edited"));
    Consumer<List<Column>> allTagged =
        columns ->
            columns.forEach(column -> column.setTags(List.of(classificationTag("PII.Sensitive"))));
    Consumer<List<Column>> prepended = columns -> columns.addFirst(column("prepended"));
    Consumer<List<Column>> firstRemoved = List::removeFirst;
    Consumer<List<Column>> insertedAndRemovedApart =
        columns -> {
          columns.add(100, column("inserted"));
          columns.remove(WIDE_TABLE_COLUMNS - 1_000);
        };
    Consumer<List<Column>> firstMovedToEnd = columns -> columns.addLast(columns.removeFirst());
    return Stream.of(
        Arguments.of("one column described", oneDescribed, 1),
        Arguments.of("every column described", allDescribed, WIDE_TABLE_COLUMNS),
        Arguments.of("every column tagged", allTagged, WIDE_TABLE_COLUMNS),
        Arguments.of("column prepended", prepended, 1),
        Arguments.of("first column removed", firstRemoved, 1),
        Arguments.of("column inserted and another removed apart", insertedAndRemovedApart, 2),
        Arguments.of("first column moved to the end", firstMovedToEnd, 2),
        // One column stays paired; position by position would take 2 * WIDE_TABLE_COLUMNS.
        Arguments.of(
            "every column reversed", (Consumer<List<Column>>) Collections::reverse, 39_998));
  }

  private static Table tableWithColumns(int count) {
    List<Column> columns = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      columns.add(column("column_" + i));
    }
    return new Table().withId(UUID.randomUUID()).withName("wide_table").withColumns(columns);
  }

  private static Column column(String name) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.VARCHAR)
        .withDescription("about " + name)
        .withTags(List.of());
  }

  private static Table tableWithNestedFields() {
    Table table = tableWithColumns(4);
    table
        .getColumns()
        .getFirst()
        .withDataType(ColumnDataType.STRUCT)
        .withChildren(new ArrayList<>(List.of(column("nested_a"), column("nested_b"))))
        .setTags(List.of(classificationTag("PII.Sensitive")));
    return table.withExtension(Map.of("a/b", 1, "c~d", List.of("x", "y")));
  }

  private static void applyRandomEdit(JsonNode document, Random random) {
    List<JsonNode> containers = new ArrayList<>();
    collectContainers(document, containers);
    JsonNode container = containers.get(random.nextInt(containers.size()));
    if (container instanceof ObjectNode object) {
      editObject(object, random);
    } else {
      editArray((ArrayNode) container, random);
    }
  }

  private static void collectContainers(JsonNode node, List<JsonNode> containers) {
    if (node.isContainerNode()) {
      containers.add(node);
      node.forEach(child -> collectContainers(child, containers));
    }
  }

  private static void editObject(ObjectNode object, Random random) {
    List<String> fields = new ArrayList<>();
    object.fieldNames().forEachRemaining(fields::add);
    boolean removes = !fields.isEmpty() && random.nextBoolean();
    if (removes) {
      object.remove(fields.get(random.nextInt(fields.size())));
    } else {
      object.set(RANDOM_KEYS.get(random.nextInt(RANDOM_KEYS.size())), randomValue(random));
    }
  }

  private static void editArray(ArrayNode array, Random random) {
    int choice = random.nextInt(4);
    boolean canEditInPlace = !array.isEmpty() && choice > 0;
    if (!canEditInPlace) {
      array.insert(random.nextInt(array.size() + 1), randomValue(random));
    } else if (choice == 1) {
      array.remove(random.nextInt(array.size()));
    } else if (choice == 2) {
      array.set(random.nextInt(array.size()), randomValue(random));
    } else {
      JsonNode moved = array.remove(random.nextInt(array.size()));
      array.insert(random.nextInt(array.size() + 1), moved);
    }
  }

  /**
   * Counts the operations of a diff that skips the elements two arrays share at both ends and pairs
   * the rest by position, which pairing elements by identity must never exceed.
   */
  private static int positionalOperations(JsonNode source, JsonNode target) {
    int operations = 1;
    if (source.equals(NUMBERS_BY_VALUE, target)) {
      operations = 0;
    } else if (source.isObject() && target.isObject()) {
      operations = positionalObjectOperations(source, target);
    } else if (source.isArray() && target.isArray()) {
      operations = positionalArrayOperations(source, target);
    }
    return operations;
  }

  private static int positionalObjectOperations(JsonNode source, JsonNode target) {
    int operations = 0;
    for (Map.Entry<String, JsonNode> field : source.properties()) {
      JsonNode targetValue = target.get(field.getKey());
      operations += targetValue == null ? 1 : positionalOperations(field.getValue(), targetValue);
    }
    for (Map.Entry<String, JsonNode> field : target.properties()) {
      operations += source.has(field.getKey()) ? 0 : 1;
    }
    return operations;
  }

  private static int positionalArrayOperations(JsonNode source, JsonNode target) {
    int shared = Math.min(source.size(), target.size());
    int prefix = 0;
    while (prefix < shared && source.get(prefix).equals(NUMBERS_BY_VALUE, target.get(prefix))) {
      prefix++;
    }
    int suffix = 0;
    while (suffix < shared - prefix
        && source
            .get(source.size() - 1 - suffix)
            .equals(NUMBERS_BY_VALUE, target.get(target.size() - 1 - suffix))) {
      suffix++;
    }
    int operations = Math.abs(source.size() - target.size());
    for (int index = prefix; index < shared - suffix; index++) {
      operations += positionalOperations(source.get(index), target.get(index));
    }
    return operations;
  }

  private static JsonNode randomValue(Random random) {
    List<JsonNode> values =
        List.of(
            JsonNodeFactory.instance.textNode("text " + random.nextInt(3)),
            JsonNodeFactory.instance.numberNode(random.nextInt(3)),
            JsonNodeFactory.instance.booleanNode(random.nextBoolean()),
            JsonNodeFactory.instance.nullNode(),
            JsonNodeFactory.instance.objectNode().put("k", random.nextInt(3)),
            JsonNodeFactory.instance.arrayNode().add(random.nextInt(3)));
    return values.get(random.nextInt(values.size()));
  }

  private static String json(String singleQuoted) {
    return singleQuoted.replace('\'', '"');
  }

  private static TagLabel classificationTag(String tagFQN) {
    return new TagLabel()
        .withTagFQN(tagFQN)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
