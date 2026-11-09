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

package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/** Restores reader omissions without overwriting edits or resurrecting deleted quality rules. */
final class ODCSQualityMetadata {
  private static final String SOURCE = "source";
  private static final String APPLIED = "applied";
  private static final Set<String> OPERATORS = operators();

  private ODCSQualityMetadata() {}

  static ObjectNode capture(JsonNode source, JsonNode applied) {
    ObjectNode result = ODCSExportModelWriter.JSON.createObjectNode();
    result.set(SOURCE, source.deepCopy());
    result.set(APPLIED, applied.deepCopy());
    return result;
  }

  static boolean isCapture(JsonNode value) {
    return value.isObject() && value.has(SOURCE) && value.has(APPLIED);
  }

  static ArrayNode restore(JsonNode saved, JsonNode current) {
    JsonNode source = saved.path(SOURCE);
    JsonNode applied = saved.path(APPLIED);
    ArrayNode result = ODCSExportModelWriter.JSON.createArrayNode();
    Set<Integer> used = new HashSet<>();
    Set<Integer> originals = new HashSet<>();
    for (JsonNode rule : current) {
      int baseline = find(applied, rule, used);
      if (baseline >= 0) used.add(baseline);
      int original = baseline < 0 ? -1 : find(source, applied.get(baseline), originals);
      if (original >= 0) originals.add(original);
      result.add(
          original < 0
              ? rule.deepCopy()
              : restoreObject(source.get(original), applied.get(baseline), rule, true));
    }
    Set<Integer> matched = new HashSet<>();
    for (JsonNode rule : source) {
      int baseline = find(applied, rule, matched);
      if (baseline >= 0) matched.add(baseline);
      else if (find(current, rule, Set.of()) < 0) result.add(rule.deepCopy());
    }
    return result;
  }

  private static ObjectNode restoreObject(
      JsonNode source, JsonNode applied, JsonNode current, boolean qualityRule) {
    ObjectNode result = current.deepCopy();
    source
        .fields()
        .forEachRemaining(
            field -> {
              String key = field.getKey();
              JsonNode before = applied.path(key);
              JsonNode after = current.path(key);
              if (qualityRule && operatorReplaced(key, applied, current)) return;
              if (equivalent(before, after)) result.set(key, field.getValue().deepCopy());
              else if (field.getValue().isObject() && before.isObject() && after.isObject())
                result.set(key, restoreObject(field.getValue(), before, after, false));
            });
    if (qualityRule && OPERATORS.stream().anyMatch(source::has)) {
      for (String operator : OPERATORS)
        if (!source.has(operator)
            && applied.has(operator)
            && equivalent(applied.path(operator), current.path(operator))) result.remove(operator);
    }
    return result;
  }

  private static Set<String> operators() {
    Set<String> result = new HashSet<>();
    for (JsonNode option :
        ODCSExportModelWriter.schema(ODCSExportService.DEFAULT_VERSION)
            .at("/$defs/DataQualityOperators/oneOf"))
      option.path("required").forEach(field -> result.add(field.asText()));
    return Set.copyOf(result);
  }

  private static boolean operatorReplaced(String key, JsonNode applied, JsonNode current) {
    if (!OPERATORS.contains(key)) return false;
    // The published schema makes these alternatives exclusive, including operators the reader lost.
    return OPERATORS.stream()
        .anyMatch(
            operator ->
                !operator.equals(key)
                    && current.has(operator)
                    && !equivalent(applied.path(operator), current.path(operator)));
  }

  static boolean isProjection(JsonNode source, JsonNode applied) {
    if (source.isObject() && applied.isObject()) {
      for (var fields = source.fields(); fields.hasNext(); ) {
        var field = fields.next();
        if (!isProjection(field.getValue(), applied.path(field.getKey()))) return false;
      }
      return true;
    }
    if (source.isArray() && applied.isArray() && source.size() == applied.size()) {
      for (int index = 0; index < source.size(); index++)
        if (!isProjection(source.get(index), applied.get(index))) return false;
      return true;
    }
    return equivalent(source, applied);
  }

  private static boolean equivalent(JsonNode left, JsonNode right) {
    if (nonFinite(left) || nonFinite(right)) return left.asText().equals(right.asText());
    return left.isNumber() && right.isNumber()
        ? left.decimalValue().compareTo(right.decimalValue()) == 0
        : left.equals(right);
  }

  private static boolean nonFinite(JsonNode value) {
    return (value.isDouble() || value.isFloat()) && !Double.isFinite(value.doubleValue());
  }

  private static int find(JsonNode candidates, JsonNode rule, Set<Integer> used) {
    for (int index = 0; candidates.isArray() && index < candidates.size(); index++)
      if (!used.contains(index) && sameIdentity(rule, candidates.get(index))) return index;
    return -1;
  }

  private static boolean sameIdentity(JsonNode left, JsonNode right) {
    for (String key : new String[] {"id", "name"}) {
      if (left.hasNonNull(key) && right.hasNonNull(key))
        return left.get(key).equals(right.get(key));
    }
    if (left.has("query") && right.has("query"))
      return left.path("query").equals(right.path("query"));
    // Anonymous declarations have no stable identifier; match shared content, never their position.
    boolean sharedContent = false;
    for (var fields = left.fields(); fields.hasNext(); ) {
      var field = fields.next();
      if (!right.has(field.getKey())) continue;
      if (!sameReaderValue(field.getValue(), right.get(field.getKey()))) return false;
      if (!"type".equals(field.getKey())) sharedContent = true;
    }
    return sharedContent;
  }

  private static boolean sameReaderValue(JsonNode left, JsonNode right) {
    if (left == null || right == null) return left == right;
    if (equivalent(left, right)) return true;
    if (left.isNumber() && right.isNumber())
      return Double.compare(left.doubleValue(), right.doubleValue()) == 0;
    if (left.isArray() && right.isArray() && left.size() == right.size()) {
      for (int index = 0; index < left.size(); index++)
        if (!sameReaderValue(left.get(index), right.get(index))) return false;
      return true;
    }
    if (left.isObject() && right.isObject()) {
      for (var fields = left.fields(); fields.hasNext(); ) {
        var field = fields.next();
        if (right.has(field.getKey())
            && !sameReaderValue(field.getValue(), right.get(field.getKey()))) return false;
      }
      return true;
    }
    try {
      if (left.isTextual() && right.isContainerNode())
        return sameReaderValue(ODCSExportModelWriter.JSON.readTree(left.textValue()), right);
      if (left.isContainerNode() && right.isTextual())
        return sameReaderValue(left, ODCSExportModelWriter.JSON.readTree(right.textValue()));
      if (left.isTextual() && right.isNumber() || left.isNumber() && right.isTextual())
        return Double.compare(Double.parseDouble(left.asText()), Double.parseDouble(right.asText()))
            == 0;
      return false;
    } catch (IOException | NumberFormatException exception) {
      return false;
    }
  }
}
