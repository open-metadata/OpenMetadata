/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TaskFormSchemaValidatorTest {

  @Test
  void validateFormSchemaRejectsNonObjectRoot() {
    Map<String, Object> schema = new LinkedHashMap<>();
    schema.put("type", "array");

    assertThrows(
        IllegalArgumentException.class, () -> TaskFormSchemaValidator.validateFormSchema(schema));
  }

  @Test
  void validatePayloadRejectsMissingRequiredField() {
    Map<String, Object> schema = new LinkedHashMap<>();
    schema.put("type", "object");
    schema.put("required", java.util.List.of("reviewNotes"));
    schema.put(
        "properties",
        Map.of("reviewNotes", Map.of("type", "string"), "approved", Map.of("type", "boolean")));

    assertThrows(
        IllegalArgumentException.class,
        () -> TaskFormSchemaValidator.validatePayload(schema, Map.of("approved", true)));
  }

  @Test
  void validatePayloadAllowsCustomAdditionalPropertiesWhenSchemaAllowsIt() {
    Map<String, Object> schema = new LinkedHashMap<>();
    schema.put("type", "object");
    schema.put("additionalProperties", true);
    schema.put("properties", Map.of("approved", Map.of("type", "boolean")));

    assertDoesNotThrow(
        () ->
            TaskFormSchemaValidator.validatePayload(
                schema, Map.of("approved", true, "customReason", "admin override")));
  }

  @Test
  void validatePayloadTreatsNullAsEmptyObject() {
    Map<String, Object> schema = new LinkedHashMap<>();
    schema.put("type", "object");
    schema.put("additionalProperties", true);
    schema.put("properties", Map.of("approved", Map.of("type", "boolean")));

    assertDoesNotThrow(() -> TaskFormSchemaValidator.validatePayload(schema, null));
  }
}
