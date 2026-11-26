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
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.function.Function;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;

/** Applies registered root properties through the same validation as native contract edits. */
public final class ODCSNativeCustomProperties {
  private static final ObjectMapper JSON = new ObjectMapper();
  private final Predicate<String> registered;
  private final Function<Object, Object> validator;

  public ODCSNativeCustomProperties(
      Predicate<String> registered, Function<Object, Object> validator) {
    this.registered = registered;
    this.validator = validator;
  }

  public void apply(DataContract contract, JsonNode source, ODCSImportIssues issues) {
    ObjectNode normalized = source.deepCopy();
    ODCSShapeNormalizer.normalize(normalized, ODCSImportIssues.discarding());
    ObjectNode values = JSON.createObjectNode();
    int index = 0;
    for (JsonNode property : normalized.path("customProperties")) {
      String name = property.path("property").asText();
      String path = "customProperties[" + index++ + "]";
      if (!property.path("property").isTextual() || !property.has("value")) {
        issues.warning(
            ODCSImportIssueCategory.DOCUMENT,
            "customProperties",
            path,
            "The custom property has no name or value; it is preserved without a native value.");
      } else if (!registered.test(name)) {
        issues.info(
            ODCSImportIssueCategory.DOCUMENT,
            "customProperties",
            path,
            "Custom property `"
                + name
                + "` is not registered on data contracts; it is preserved for export.");
      } else {
        ObjectNode single = JSON.createObjectNode();
        single.set(name, property.get("value"));
        try {
          JsonNode transformed = JSON.valueToTree(validator.apply(single));
          if (transformed != null && transformed.has(name)) values.set(name, transformed.get(name));
        } catch (IllegalArgumentException exception) {
          issues.warning(
              ODCSImportIssueCategory.DOCUMENT,
              "customProperties",
              path,
              "Custom property `"
                  + name
                  + "` is preserved without a native value: "
                  + exception.getMessage());
        }
      }
    }
    if (!values.isEmpty()) contract.setExtension(JSON.convertValue(values, Object.class));
    contract.setOdcsPreservedFields(
        ODCSPreservedFields.bindNativeCustomProperties(
            contract.getOdcsPreservedFields(), contract.getExtension()));
  }
}
