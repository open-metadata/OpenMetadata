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
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The value each field of a setting takes when the stored JSON leaves it out: the schema default
 * the generated class initializes it with.
 */
final class SchemaDefaults {
  private SchemaDefaults() {}

  /** Defaults for every object present in {@code shape}, nested objects included. */
  static JsonNode of(Class<?> valueClass, JsonNode shape) {
    Object defaults = JsonUtils.convertValueLenient(skeletonOf(shape), valueClass);
    return JsonUtils.valueToTree(defaults);
  }

  /** The objects of {@code shape} with their fields left out. */
  private static ObjectNode skeletonOf(JsonNode shape) {
    ObjectNode skeleton = JsonNodeFactory.instance.objectNode();
    if (shape instanceof ObjectNode objectShape) {
      objectShape
          .fields()
          .forEachRemaining(
              field -> {
                if (field.getValue().isObject()) {
                  skeleton.set(field.getKey(), skeletonOf(field.getValue()));
                }
              });
    }
    return skeleton;
  }
}
