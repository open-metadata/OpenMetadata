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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Set;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.utils.JsonUtils;

/** Reattaches original metadata after native version-specific conversion. */
public final class ODCSMetadataOverlay {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String CUSTOM_PROPERTIES = "customProperties";
  private static final String PROPERTY = "property";
  private static final String VALUE = "value";

  private ODCSMetadataOverlay() {}

  public static JsonNode apply(
      DataContract contract, JsonNode nativeDocument, Set<String> managedNames) {
    return apply(contract, nativeDocument, managedNames, contract.getOdcsPreservedFields());
  }

  static JsonNode applyVersioned(DataContract contract, JsonNode nativeDocument) {
    return apply(
        contract,
        nativeDocument,
        Set.of(),
        ODCSVersionMetadata.canonicalPayload(contract.getOdcsPreservedFields()));
  }

  private static JsonNode apply(
      DataContract contract, JsonNode nativeDocument, Set<String> managedNames, JsonNode payload) {
    JsonNode legacy = legacyMetadata(contract, nativeDocument);
    JsonNode restored = ODCSPreservedFields.restore(payload, legacy);
    Set<String> owned = new HashSet<>(managedNames);
    owned.addAll(ODCSPreservedFields.nativeCustomPropertyNames(contract.getOdcsPreservedFields()));
    return withNativeCustomProperties(restored, contract.getExtension(), owned);
  }

  private static JsonNode legacyMetadata(DataContract contract, JsonNode nativeDocument) {
    ObjectNode document = nativeDocument.deepCopy();
    if (contract.getOdcsPreservedFields() == null && contract.getOdcsElementExtensions() != null) {
      for (var extension : contract.getOdcsElementExtensions()) {
        JsonNode target =
            extension.getElement() == null || extension.getElement().isEmpty()
                ? document
                : findElement(document.path("schema"), extension.getElement());
        if (target == null) target = document;
        if (extension.getAuthoritativeDefinitions() != null
            && !extension.getAuthoritativeDefinitions().isEmpty()) {
          ((ObjectNode) target)
              .withArray("authoritativeDefinitions")
              .addAll((ArrayNode) JsonUtils.valueToTree(extension.getAuthoritativeDefinitions()));
        }
        if (target != document
            && extension.getTransformSourceObjects() != null
            && !extension.getTransformSourceObjects().isEmpty()) {
          ((ObjectNode) target)
              .set(
                  "transformSourceObjects",
                  JsonUtils.valueToTree(extension.getTransformSourceObjects()));
        }
      }
    }
    return document;
  }

  private static JsonNode findElement(JsonNode elements, String name) {
    for (JsonNode element : elements) {
      if (name.equals(element.path("name").asText())) return element;
      JsonNode found = findElement(element.path("properties"), name);
      if (found == null) found = findElement(element.path("items").path("properties"), name);
      if (found != null) return found;
    }
    return null;
  }

  public static JsonNode withNativeCustomProperties(JsonNode exported, Object extension) {
    return withNativeCustomProperties(exported, extension, Set.of());
  }

  public static JsonNode withNativeCustomProperties(
      JsonNode exported, Object extension, Set<String> nativePropertyNames) {
    ObjectNode document = exported.deepCopy();
    JsonNode supplied = JsonUtils.valueToTree(extension);
    JsonNode values = supplied != null && supplied.isObject() ? supplied : JSON.createObjectNode();
    if (!values.isEmpty()
        || (!nativePropertyNames.isEmpty() && document.path(CUSTOM_PROPERTIES).isArray())) {
      ArrayNode properties =
          mergeCustomProperties(document.path(CUSTOM_PROPERTIES), values, nativePropertyNames);
      if (properties.isEmpty()) {
        document.remove(CUSTOM_PROPERTIES);
      } else {
        document.set(CUSTOM_PROPERTIES, properties);
      }
    }
    return document;
  }

  private static ArrayNode mergeCustomProperties(
      JsonNode preserved, JsonNode nativeValues, Set<String> nativePropertyNames) {
    ArrayNode result = JSON.createArrayNode();
    Set<String> seen = new HashSet<>();
    if (preserved.isArray()) {
      for (JsonNode original : preserved) {
        if (!isRemovedNativeProperty(original, nativeValues, nativePropertyNames)) {
          result.add(mergeCustomProperty(original, nativeValues, seen));
        }
      }
    }
    nativeValues
        .fields()
        .forEachRemaining(
            field -> {
              if (!seen.contains(field.getKey())) {
                result
                    .addObject()
                    .put(PROPERTY, field.getKey())
                    .set(VALUE, field.getValue().deepCopy());
              }
            });
    return result;
  }

  private static boolean isRemovedNativeProperty(
      JsonNode original, JsonNode nativeValues, Set<String> nativePropertyNames) {
    String name = original.path(PROPERTY).asText();
    return nativePropertyNames.contains(name) && !nativeValues.has(name);
  }

  private static JsonNode mergeCustomProperty(
      JsonNode original, JsonNode nativeValues, Set<String> seen) {
    if (!(original instanceof ObjectNode)) {
      return original.deepCopy();
    }
    ObjectNode property = original.deepCopy();
    String name = property.path(PROPERTY).asText();
    if (nativeValues.has(name)) {
      property.set(VALUE, nativeValues.get(name).deepCopy());
    }
    seen.add(name);
    return property;
  }
}
