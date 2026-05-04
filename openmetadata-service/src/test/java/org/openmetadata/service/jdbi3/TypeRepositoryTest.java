/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link TypeRepository}.
 *
 * <p>The schema-vs-Java consistency test guarantees that the regex enforced in Java stays in lock
 * step with the JSON Schema definition referenced by {@code customProperty.json}. If either side
 * is updated without the other, this test fails with a message pointing at both files.
 */
class TypeRepositoryTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String BASIC_SCHEMA_RESOURCE = "json/schema/type/basic.json";
  private static final String CUSTOM_PROPERTY_NAME_DEF = "customPropertyName";

  @Test
  void customPropertyNamePatternMatchesSchema() throws Exception {
    JsonNode schemaPattern = readDefinitionField(CUSTOM_PROPERTY_NAME_DEF, "pattern");
    assertNotNull(
        schemaPattern, "customPropertyName.pattern must exist in " + BASIC_SCHEMA_RESOURCE);

    assertEquals(
        schemaPattern.asText(),
        TypeRepository.CUSTOM_PROPERTY_NAME_PATTERN.pattern(),
        "JSON Schema pattern in basic.json#/definitions/"
            + CUSTOM_PROPERTY_NAME_DEF
            + " has drifted from TypeRepository.CUSTOM_PROPERTY_NAME_PATTERN. "
            + "Update both so the API and schema enforce the same rule.");
  }

  @Test
  void customPropertyNameMaxLengthMatchesSchema() throws Exception {
    JsonNode schemaMax = readDefinitionField(CUSTOM_PROPERTY_NAME_DEF, "maxLength");
    assertNotNull(schemaMax, "customPropertyName.maxLength must exist in " + BASIC_SCHEMA_RESOURCE);

    assertEquals(
        schemaMax.asInt(),
        TypeRepository.CUSTOM_PROPERTY_NAME_MAX_LENGTH,
        "JSON Schema maxLength has drifted from TypeRepository.CUSTOM_PROPERTY_NAME_MAX_LENGTH. "
            + "Update both.");
  }

  @Test
  void customPropertyNameDefinitionIsRequiredString() throws Exception {
    JsonNode definition = readDefinition(CUSTOM_PROPERTY_NAME_DEF);
    assertNotNull(definition, "customPropertyName must be defined in " + BASIC_SCHEMA_RESOURCE);
    assertEquals("string", definition.get("type").asText());
    assertTrue(
        definition.get("minLength").asInt() >= 1, "customPropertyName must have minLength >= 1");
  }

  private static JsonNode readDefinition(String definitionName) throws Exception {
    try (InputStream in =
        TypeRepositoryTest.class.getClassLoader().getResourceAsStream(BASIC_SCHEMA_RESOURCE)) {
      assertNotNull(in, "Could not load resource " + BASIC_SCHEMA_RESOURCE);
      JsonNode root = MAPPER.readTree(in);
      return root.path("definitions").get(definitionName);
    }
  }

  private static JsonNode readDefinitionField(String definitionName, String field)
      throws Exception {
    JsonNode definition = readDefinition(definitionName);
    return definition == null ? null : definition.get(field);
  }
}
