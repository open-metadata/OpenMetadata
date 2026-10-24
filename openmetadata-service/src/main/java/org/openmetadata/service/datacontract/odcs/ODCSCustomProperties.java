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
import java.util.Map;
import java.util.function.Consumer;

/**
 * ODCS 3.1.0 writes {@code customProperties} as a list of {@code {property, value}} entries.
 * OpenMetadata used to read, store and export it as a key/value mapping on servers, roles, schema
 * elements and quality rules, so documents OpenMetadata exported itself still carry the mapping.
 * Rewrites a mapping into the list, one entry per key, without losing any value.
 */
public final class ODCSCustomProperties {
  private static final String CUSTOM_PROPERTIES = "customProperties";
  private static final String PROPERTY = "property";
  private static final String VALUE = "value";
  private static final String SERVERS = "servers";
  private static final String ROLES = "roles";
  private static final String QUALITY = "quality";
  private static final String SCHEMA = "schema";
  private static final String PROPERTIES = "properties";
  private static final String ITEMS = "items";

  private ODCSCustomProperties() {}

  /** Rewrites the root, servers, roles, quality rules and schema elements at any depth. */
  public static void normalizeDocument(ObjectNode root) {
    toPropertyList(root);
    forEachObject(root.get(SERVERS), ODCSCustomProperties::toPropertyList);
    forEachObject(root.get(ROLES), ODCSCustomProperties::toPropertyList);
    forEachObject(root.get(QUALITY), ODCSCustomProperties::toPropertyList);
    forEachObject(root.get(SCHEMA), ODCSCustomProperties::normalizeSchemaElement);
  }

  /**
   * @return whether {@code holder} carried the mapping form, now rewritten into the list form
   */
  public static boolean toPropertyList(ObjectNode holder) {
    JsonNode customProperties = holder.get(CUSTOM_PROPERTIES);
    boolean isMapping = customProperties != null && customProperties.isObject();
    if (isMapping) {
      holder.set(CUSTOM_PROPERTIES, asPropertyList(customProperties));
    }
    return isMapping;
  }

  private static void normalizeSchemaElement(ObjectNode element) {
    toPropertyList(element);
    forEachObject(element.get(QUALITY), ODCSCustomProperties::toPropertyList);
    forEachObject(element.get(PROPERTIES), ODCSCustomProperties::normalizeSchemaElement);
    // The document is a raw JSON tree; an `items` that is not an object is left for the reader.
    if (element.get(ITEMS) instanceof ObjectNode items) {
      normalizeSchemaElement(items);
    }
  }

  private static ArrayNode asPropertyList(JsonNode mapping) {
    ArrayNode list = JsonNodeFactory.instance.arrayNode();
    for (Map.Entry<String, JsonNode> field : mapping.properties()) {
      ObjectNode entry = list.addObject();
      entry.put(PROPERTY, field.getKey());
      entry.set(VALUE, field.getValue());
    }
    return list;
  }

  private static void forEachObject(JsonNode array, Consumer<ObjectNode> action) {
    if (array != null && array.isArray()) {
      for (JsonNode node : array) {
        // The document is a raw JSON tree; entries that are not objects are left for the reader.
        if (node instanceof ObjectNode object) {
          action.accept(object);
        }
      }
    }
  }
}
