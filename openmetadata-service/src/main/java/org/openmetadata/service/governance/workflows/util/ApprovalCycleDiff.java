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
package org.openmetadata.service.governance.workflows.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ApprovalGate;
import org.openmetadata.service.governance.approval.MutationOps;
import org.openmetadata.service.governance.approval.MutationPlanner;
import org.openmetadata.service.util.FullyQualifiedName;

/** The reversible content of an approval cycle, with later edits outside review taking precedence. */
final class ApprovalCycleDiff {
  private static final Set<String> WORKFLOW_FIELDS =
      Set.of(
          Entity.FIELD_ENTITY_STATUS,
          Entity.FIELD_FULLY_QUALIFIED_NAME,
          Entity.FIELD_FOLLOWERS,
          Entity.FIELD_VOTES);

  private ApprovalCycleDiff() {}

  static Set<String> paths(ChangeDescription change) {
    return change == null
        ? Set.of()
        : Stream.of(change.getFieldsAdded(), change.getFieldsDeleted(), change.getFieldsUpdated())
            .flatMap(fields -> listOrEmpty(fields).stream())
            .map(FieldChange::getName)
            .filter(name -> !WORKFLOW_FIELDS.contains(rootOf(name)))
            .filter(name -> !ApprovalGate.BOOKKEEPING_FIELDS.contains(rootOf(name)))
            .collect(Collectors.toSet());
  }

  static ObjectNode contentOf(EntityInterface<?> snapshot) {
    return (ObjectNode) JsonUtils.valueToTree(snapshot);
  }

  static void undo(ObjectNode target, ObjectNode before, ObjectNode after, Set<String> paths) {
    // Rebase each inverse on the target we have now. If an intervening bot changed the same
    // value, the target wins. Named list items and object properties merge independently.
    paths.stream()
        .map(ApprovalCycleDiff::rootOf)
        .distinct()
        .forEach(
            field -> {
              JsonNode merged =
                  restoreField(before.path(field), after.path(field), target.path(field));
              if (merged.isNull() || merged.isMissingNode()) {
                target.remove(field);
              } else {
                target.set(field, merged);
              }
            });
  }

  private static JsonNode restoreField(JsonNode before, JsonNode after, JsonNode current) {
    JsonNode historical = before;
    if ((before.isNull() || before.isMissingNode()) && !after.equals(current)) {
      if (after.isObject()) {
        historical = JsonNodeFactory.instance.objectNode();
      } else if (after.isArray()) {
        historical = JsonNodeFactory.instance.arrayNode();
      }
    }
    JsonNode merged = MutationPlanner.threeWay(after, historical, current);
    return historical != before && merged.isEmpty() && (merged.isObject() || merged.isArray())
        ? before
        : merged;
  }

  static ChangeDescription describe(
      ObjectNode restored, ObjectNode current, Set<String> paths, double base) {
    ObjectNode before = JsonNodeFactory.instance.objectNode();
    ObjectNode after = JsonNodeFactory.instance.objectNode();
    JsonNode reviewBase = ApprovalGate.withoutDerivedTags(restored);
    JsonNode reviewTip = ApprovalGate.withoutDerivedTags(current);
    for (String path : paths) {
      String[] segments = FullyQualifiedName.split(path);
      before.set(path, at(reviewBase, segments, 0));
      after.set(path, at(reviewTip, segments, 0));
    }
    return MutationOps.toChangeDescription(
        MutationPlanner.plan(before, after, paths, Set.of()), base);
  }

  private static String rootOf(String path) {
    int separator = path.indexOf(Entity.SEPARATOR);
    return separator < 0 ? path : path.substring(0, separator);
  }

  private static JsonNode at(JsonNode node, String[] segments, int index) {
    JsonNode value = node;
    if (index < segments.length && !node.isMissingNode() && !node.isNull()) {
      String name = FullyQualifiedName.unquoteName(segments[index]);
      value =
          node.isArray()
              ? at(namedChild(node, name), segments, index + 1)
              : objectProperty(node, segments, index, name);
    }
    return value;
  }

  private static JsonNode objectProperty(JsonNode node, String[] segments, int index, String name) {
    String remaining =
        String.join(Entity.SEPARATOR, Arrays.copyOfRange(segments, index, segments.length));
    JsonNode value = node.path(remaining);
    if (value.isMissingNode()) {
      value =
          node.has(name)
              ? at(node.path(name), segments, index + 1)
              : at(node.path(Entity.FIELD_CHILDREN), segments, index);
    }
    return value;
  }

  private static JsonNode namedChild(JsonNode children, String name) {
    JsonNode found = JsonNodeFactory.instance.missingNode();
    for (JsonNode child : children) {
      if (name.equals(child.path(Entity.FIELD_NAME).asText())) {
        found = child;
        break;
      }
    }
    return found;
  }
}
