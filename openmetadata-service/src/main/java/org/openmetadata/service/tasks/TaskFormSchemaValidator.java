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

import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.utils.JsonUtils;

/** Validates persisted task payload schemas and payload instances against those schemas. */
public final class TaskFormSchemaValidator {

  private TaskFormSchemaValidator() {
    /* Utility class */
  }

  public static void validateFormSchema(Object formSchema) {
    Schema schema = buildSchema(formSchema);
    String rootType = JsonUtils.valueToTree(formSchema).path("type").asText();
    if (!"object".equals(rootType)) {
      throw new IllegalArgumentException("Task form schema root type must be 'object'");
    }
    // Compile once to ensure the schema itself is valid.
    if (schema == null) {
      throw new IllegalArgumentException("Invalid task form schema");
    }
  }

  public static void validatePayload(Object formSchema, Object payload) {
    Schema schema = buildSchema(formSchema);
    Object payloadToValidate = payload == null ? java.util.Collections.emptyMap() : payload;
    List<Error> errors = schema.validate(JsonUtils.valueToTree(payloadToValidate));
    if (!errors.isEmpty()) {
      throw new IllegalArgumentException(
          "Invalid task payload: "
              + errors.stream().map(Error::getMessage).collect(Collectors.joining("; ")));
    }
  }

  private static Schema buildSchema(Object formSchema) {
    if (formSchema == null) {
      throw new IllegalArgumentException("Task form schema is required");
    }

    try {
      return JsonUtils.getJsonSchema(JsonUtils.pojoToJson(formSchema));
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid task form schema: " + e.getMessage(), e);
    }
  }
}
