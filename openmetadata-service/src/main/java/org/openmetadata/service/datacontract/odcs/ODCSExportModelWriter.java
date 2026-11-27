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

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/** Serializes native mappings through the generated model for their exact target version. */
final class ODCSExportModelWriter {
  static final ObjectMapper JSON =
      new ObjectMapper()
          .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
          .setSerializationInclusion(JsonInclude.Include.NON_NULL)
          .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

  private ODCSExportModelWriter() {}

  static Class<?> model(String version) {
    String name =
        "org.openmetadata.schema.type.datacontract.odcs."
            + version.replace(".", "")
            + ".OdcsContract";
    try {
      return Class.forName(name);
    } catch (ClassNotFoundException exception) {
      throw new IllegalArgumentException(
          "Missing generated ODCS export model for " + version, exception);
    }
  }

  static ObjectNode write(JsonNode nativeDocument, Class<?> model) {
    return JSON.valueToTree(JSON.convertValue(nativeDocument, model));
  }

  static JsonNode schema(String version) {
    return requiredSchema("/odcs/" + version + "/schema.json");
  }

  static JsonNode requiredSchema(String path) {
    try (var stream = ODCSExportModelWriter.class.getResourceAsStream(path)) {
      if (stream == null) throw new IllegalArgumentException("Missing ODCS export schema: " + path);
      return JSON.readTree(stream);
    } catch (IOException exception) {
      throw new IllegalArgumentException("Cannot read ODCS export schema: " + path, exception);
    }
  }

  static Set<String> fields(JsonNode definition) {
    Set<String> fields = new HashSet<>();
    definition.path("properties").fieldNames().forEachRemaining(fields::add);
    return Set.copyOf(fields);
  }
}
