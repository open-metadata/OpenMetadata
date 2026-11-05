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
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;

/**
 * Rewrites the ways of writing a field that ODCS allows or that an older OpenMetadata accepted,
 * into the form the model reads, without losing anything, recording each rewrite in the import
 * report: a plain-text {@code description}, a single tag written as a string, an {@code
 * implementation} written as a mapping (ODCS 3.1.0 allows a string or an object), a team written in
 * the deprecated ODCS v3.0.2 bare-array form instead of the v3.1.0 object, arrays of approvers from
 * legacy OpenMetadata exports instead of the scalar ODCS strings, and customProperties written in
 * the deprecated map form instead of the ODCS array form.
 */
public final class ODCSShapeNormalizer {
  private static final String IMPLEMENTATION = "implementation";
  private static final String DESCRIPTION = "description";
  private static final String PURPOSE = "purpose";
  private static final String TAGS = "tags";
  private static final String SCHEMA = "schema";
  private static final String PROPERTIES = "properties";
  private static final String ITEMS = "items";
  private static final String QUALITY = "quality";
  private static final String TEAM = "team";
  private static final String MEMBERS = "members";
  private static final String ROLES = "roles";
  private static final String SERVERS = "servers";
  private static final String CUSTOM_PROPERTIES = "customProperties";
  private static final String PROPERTY = "property";
  private static final String VALUE = "value";
  private static final String FIRST_LEVEL_APPROVERS = "firstLevelApprovers";
  private static final String SECOND_LEVEL_APPROVERS = "secondLevelApprovers";

  private ODCSShapeNormalizer() {}

  public static void normalize(ObjectNode root, ODCSImportIssues issues) {
    normalizeDescription(root, issues);
    wrapScalarTags(root);
    wrapBareArrayTeam(root, issues);
    joinArrayApprovers(root, issues);
    normalizeRules(root.get(QUALITY), QUALITY, issues);
    normalizeElements(root.get(SCHEMA), SCHEMA, issues);
    normalizeHolders(root.get(ROLES), ROLES, issues);
    normalizeHolders(root.get(SERVERS), SERVERS, issues);
  }

  /** Projects standard items into reader/baseline copies without changing the preserved source. */
  public static void projectArrayItemsForReader(ObjectNode root) {
    for (JsonNode element : root.path(SCHEMA)) {
      projectArrayItemProperties(element);
    }
  }

  private static void projectArrayItemProperties(JsonNode element) {
    if (element instanceof ObjectNode object) {
      JsonNode itemProperties = object.path(ITEMS).path(PROPERTIES);
      if ("array".equals(object.path("logicalType").asText()) && itemProperties.isArray()) {
        object.set(PROPERTIES, itemProperties.deepCopy());
      }
      for (JsonNode child : object.path(PROPERTIES)) {
        projectArrayItemProperties(child);
      }
    }
  }

  private static void normalizeDescription(ObjectNode root, ODCSImportIssues issues) {
    JsonNode description = root.get(DESCRIPTION);
    if (description != null && description.isTextual()) {
      ObjectNode structured = JsonNodeFactory.instance.objectNode();
      structured.set(PURPOSE, description);
      root.set(DESCRIPTION, structured);
      issues.info(
          ODCSImportIssueCategory.DOCUMENT,
          DESCRIPTION,
          DESCRIPTION,
          "The description is plain text; it is imported as the contract's purpose.");
    }
  }

  /** ODCS v3.0.2 wrote the team as a bare array of members; v3.1.0 wraps them in an object. */
  private static void wrapBareArrayTeam(ObjectNode root, ODCSImportIssues issues) {
    JsonNode team = root.get(TEAM);
    if (!(team instanceof ArrayNode members)) return;
    ObjectNode teamObject = root.objectNode();
    teamObject.set(MEMBERS, members);
    root.set(TEAM, teamObject);
    issues.info(
        ODCSImportIssueCategory.TEAM,
        TEAM,
        TEAM,
        "The team is written in the deprecated ODCS v3.0.2 bare-array form; it is imported as the v3.1.0 object form.");
  }

  /** ODCS types each approvers field as one string; legacy OpenMetadata exports wrote an array. */
  private static void joinArrayApprovers(ObjectNode root, ODCSImportIssues issues) {
    forEachIndexed(
        root.get(ROLES),
        (index, roleNode) -> {
          if (!(roleNode instanceof ObjectNode role)) return;
          String rolePath = ODCSPaths.element(ROLES, index);
          joinArrayApprovers(role, FIRST_LEVEL_APPROVERS, rolePath, issues);
          joinArrayApprovers(role, SECOND_LEVEL_APPROVERS, rolePath, issues);
        });
  }

  private static void joinArrayApprovers(
      ObjectNode role, String field, String rolePath, ODCSImportIssues issues) {
    JsonNode approvers = role.get(field);
    if (!(approvers instanceof ArrayNode array)) return;
    List<String> values = new ArrayList<>();
    array.forEach(value -> values.add(value.asText()));
    role.set(field, TextNode.valueOf(String.join(",", values)));
    issues.info(
        ODCSImportIssueCategory.ROLES,
        field,
        ODCSPaths.child(rolePath, field),
        String.format(
            "`%s` is written in the deprecated array form; it is imported as the ODCS string form.",
            field));
  }

  private static void normalizeElements(JsonNode elements, String path, ODCSImportIssues issues) {
    forEachIndexed(
        elements,
        (index, element) -> normalizeElement(element, ODCSPaths.element(path, index), issues));
  }

  private static void normalizeElement(JsonNode element, String path, ODCSImportIssues issues) {
    if (!(element instanceof ObjectNode object)) return;
    wrapScalarTags(object);
    normalizeRules(object.get(QUALITY), ODCSPaths.child(path, QUALITY), issues);
    rewriteMapFormCustomProperties(object, path, issues);
    normalizeElements(object.get(PROPERTIES), ODCSPaths.child(path, PROPERTIES), issues);
    normalizeElement(object.get(ITEMS), ODCSPaths.child(path, ITEMS), issues);
  }

  private static void normalizeRules(JsonNode rules, String path, ODCSImportIssues issues) {
    forEachIndexed(
        rules,
        (index, rule) -> {
          if (!(rule instanceof ObjectNode object)) return;
          stringifyImplementation(object);
          rewriteMapFormCustomProperties(object, ODCSPaths.element(path, index), issues);
        });
  }

  private static void normalizeHolders(JsonNode holders, String path, ODCSImportIssues issues) {
    forEachIndexed(
        holders,
        (index, holder) -> {
          if (holder instanceof ObjectNode object) {
            rewriteMapFormCustomProperties(object, ODCSPaths.element(path, index), issues);
          }
        });
  }

  /**
   * ODCS defines customProperties as an array of {property, value} pairs; an older OpenMetadata
   * accepted a mapping. The mapping is rewritten, keeping every value verbatim.
   */
  private static void rewriteMapFormCustomProperties(
      ObjectNode holder, String path, ODCSImportIssues issues) {
    JsonNode customProperties = holder.get(CUSTOM_PROPERTIES);
    if (!(customProperties instanceof ObjectNode mapForm)) return;
    ArrayNode arrayForm = JsonNodeFactory.instance.arrayNode();
    for (Map.Entry<String, JsonNode> field : mapForm.properties()) {
      ObjectNode property = arrayForm.addObject();
      property.put(PROPERTY, field.getKey());
      property.set(VALUE, field.getValue());
    }
    holder.set(CUSTOM_PROPERTIES, arrayForm);
    issues.info(
        ODCSPaths.category(path),
        CUSTOM_PROPERTIES,
        ODCSPaths.child(path, CUSTOM_PROPERTIES),
        "customProperties is written in the deprecated map form; it is imported as the ODCS array form.");
  }

  private static void stringifyImplementation(ObjectNode rule) {
    JsonNode implementation = rule.get(IMPLEMENTATION);
    if (implementation != null && implementation.isContainerNode()) {
      rule.set(IMPLEMENTATION, TextNode.valueOf(implementation.toString()));
    }
  }

  private static void wrapScalarTags(ObjectNode node) {
    JsonNode tags = node.get(TAGS);
    if (tags != null && tags.isTextual()) {
      ArrayNode wrapped = JsonNodeFactory.instance.arrayNode();
      wrapped.add(tags);
      node.set(TAGS, wrapped);
    }
  }

  private static void forEachIndexed(JsonNode array, BiConsumer<Integer, JsonNode> action) {
    if (array != null && array.isArray()) {
      for (int index = 0; index < array.size(); index++) {
        action.accept(index, array.get(index));
      }
    }
  }
}
