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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.function.Predicate;

/** Reads and edits JSON trees by JSON pointer, treating JSON null like an absent field. */
public final class JsonPointers {
  private static final char SEPARATOR = '/';

  private JsonPointers() {}

  public static JsonNode valueAt(JsonNode root, String pointer) {
    JsonNode node = root == null ? null : root.at(pointer);
    return node == null || node.isNull() ? MissingNode.getInstance() : node;
  }

  public static boolean isPresent(JsonNode root, String pointer) {
    return !valueAt(root, pointer).isMissingNode();
  }

  public static void setValue(ObjectNode root, String pointer, JsonNode value) {
    ensureParent(root, pointer).set(lastSegment(pointer), value);
  }

  public static void removeValue(ObjectNode root, String pointer) {
    if (root.at(parentOf(pointer)) instanceof ObjectNode parent) {
      parent.remove(lastSegment(pointer));
    }
  }

  public static String parentOf(String pointer) {
    return pointer.substring(0, pointer.lastIndexOf(SEPARATOR));
  }

  /** The pointers of every object that encloses {@code pointer}, outermost first. */
  public static List<String> ancestors(String pointer) {
    List<String> ancestors = new ArrayList<>();
    for (String parent = parentOf(pointer); !parent.isEmpty(); parent = parentOf(parent)) {
      ancestors.addFirst(parent);
    }
    return ancestors;
  }

  public static String child(String parentPointer, String key) {
    return parentPointer + SEPARATOR + key.replace("~", "~0").replace("/", "~1");
  }

  public static boolean isUnder(String pointer, String prefix) {
    return pointer.equals(prefix) || pointer.startsWith(prefix + SEPARATOR);
  }

  /**
   * Every value of {@code root} that is not an object, keyed by pointer. Objects accepted by
   * {@code isSingleValue} are kept whole instead of being descended into.
   */
  public static SortedMap<String, JsonNode> leaves(JsonNode root, Predicate<String> isSingleValue) {
    SortedMap<String, JsonNode> leaves = new TreeMap<>();
    if (root instanceof ObjectNode objectRoot) {
      collectLeaves(objectRoot, "", isSingleValue, leaves);
    }
    return leaves;
  }

  private static void collectLeaves(
      ObjectNode node, String pointer, Predicate<String> isSingleValue, Map<String, JsonNode> out) {
    node.fields()
        .forEachRemaining(
            field -> {
              String childPointer = child(pointer, field.getKey());
              JsonNode value = field.getValue();
              if (value instanceof ObjectNode objectValue && !isSingleValue.test(childPointer)) {
                collectLeaves(objectValue, childPointer, isSingleValue, out);
              } else if (!value.isNull()) {
                out.put(childPointer, value);
              }
            });
  }

  private static ObjectNode ensureParent(ObjectNode root, String pointer) {
    ObjectNode node = root;
    for (String ancestor : ancestors(pointer)) {
      String segment = lastSegment(ancestor);
      node = node.get(segment) instanceof ObjectNode existing ? existing : node.putObject(segment);
    }
    return node;
  }

  private static String lastSegment(String pointer) {
    return pointer
        .substring(pointer.lastIndexOf(SEPARATOR) + 1)
        .replace("~1", "/")
        .replace("~0", "~");
  }
}
