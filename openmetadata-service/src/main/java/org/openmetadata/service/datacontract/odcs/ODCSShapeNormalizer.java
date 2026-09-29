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
import java.util.function.Consumer;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;

/**
 * Rewrites the ways of writing a field that ODCS allows but OpenMetadata's model does not, into
 * the form the model reads, without losing anything: an {@code implementation} written as a
 * mapping (ODCS 3.1.0 allows a string or an object), a plain-text {@code description}, and a single
 * tag written as a string.
 */
final class ODCSShapeNormalizer {
  private static final String IMPLEMENTATION = "implementation";
  private static final String DESCRIPTION = "description";
  private static final String PURPOSE = "purpose";
  private static final String TAGS = "tags";
  private static final String SCHEMA = "schema";
  private static final String PROPERTIES = "properties";
  private static final String ITEMS = "items";
  private static final String QUALITY = "quality";

  private ODCSShapeNormalizer() {}

  static void normalize(ObjectNode root, ODCSImportIssues issues) {
    normalizeDescription(root, issues);
    wrapScalarTags(root);
    normalizeRules(root.get(QUALITY));
    forEachElement(root.get(SCHEMA), ODCSShapeNormalizer::normalizeSchemaElement);
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

  private static void normalizeSchemaElement(JsonNode element) {
    if (element instanceof ObjectNode object) {
      wrapScalarTags(object);
      normalizeRules(object.get(QUALITY));
      forEachElement(object.get(PROPERTIES), ODCSShapeNormalizer::normalizeSchemaElement);
      normalizeSchemaElement(object.get(ITEMS));
    }
  }

  private static void normalizeRules(JsonNode rules) {
    forEachElement(
        rules,
        rule -> {
          if (rule instanceof ObjectNode ruleObject) {
            stringifyImplementation(ruleObject);
          }
        });
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

  private static void forEachElement(JsonNode array, Consumer<JsonNode> action) {
    if (array != null && array.isArray()) {
      array.forEach(action);
    }
  }
}
