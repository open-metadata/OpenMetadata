/*
 *  Copyright 2021 Collate
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

package org.openmetadata.common.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.ValidationMessage;
import com.networknt.schema.urn.URNFactory;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * This test provides examples of how to use: - JSON schema to validate the JSON payload - Generate JSON schema from
 * POJO
 */
public class JsonSchemaTest {
  private final UUID TEST_UUID = UUID.randomUUID();
  private final URI TEST_URI = URI.create("http://test.com");
  private URNFactory urnFactory;

  @BeforeEach
  public void setup() {
    urnFactory = JsonSchemaUtil.getUrnFactory();
  }

  private java.util.Set<com.networknt.schema.ValidationMessage> validate(InputStream in, String jsonPayload)
      throws IOException {
    System.out.println("Validating " + jsonPayload);
    Set<ValidationMessage> errors = JsonSchemaUtil.validate(in, jsonPayload, urnFactory);
    System.out.println("Errors " + errors);
    return errors;
  }

  /** Validate a conforming JSON payload using JSON schema */
  @Test
  public void validJson() throws IOException {
    // Valid jsonPayload
    InputStream in = JsonSchemaTest.class.getClassLoader().getResourceAsStream("json/entity/testEntity.json");
    Map<String, Object> objectTypeMap =
        Map.of(
            "ot1", "ot1",
            "ot2", "ot2");
    Map<String, Object> map =
        Map.of(
            "stringProperty", "property1",
            "uriProperty", TEST_URI,
            "uuidProperty", TEST_UUID,
            "objectTypeProperty", objectTypeMap);
    String jsonPayload = new ObjectMapper().writeValueAsString(map);
    assertEquals(0, validate(in, jsonPayload).size());
  }

  /** Validate a non-conforming JSON payload that is missing a required field using JSON schema */
  @Test
  public void missingField() throws IOException {
    InputStream in = JsonSchemaTest.class.getClassLoader().getResourceAsStream("json/entity/testEntity.json");
    // No mandatory field "stringProperty"
    Map<String, Object> objectTypeMap =
        Map.of(
            "ot1", "ot1",
            "ot2", "ot2");
    Map<String, Object> map =
        Map.of(
            // Missing stringProperty1
            "uriProperty", TEST_URI,
            "uuidProperty", TEST_UUID,
            "objectTypeProperty", objectTypeMap);
    String jsonPayload = new ObjectMapper().writeValueAsString(map);
    Set<ValidationMessage> errors = validate(in, jsonPayload);
    assertEquals(1, errors.size());
    assertTrue(errors.iterator().next().getMessage().contains("stringProperty: is missing"));
  }

  /** Validate a non-conforming JSON payload that is missing a required inner field using JSON schema */
  @Test
  public void missingInnerField() throws IOException {
    // No mandatory inner field "objectType.ot1"
    InputStream in = JsonSchemaTest.class.getClassLoader().getResourceAsStream("json/entity/testEntity.json");
    Map<String, Object> objectTypeMap =
        Map.of(
            // Missing inner field ot1
            "ot2", "ot2");
    Map<String, Object> map =
        Map.of(
            "stringProperty", "property1",
            "uriProperty", TEST_URI,
            "uuidProperty", TEST_UUID,
            "objectTypeProperty", objectTypeMap);
    String jsonPayload = new ObjectMapper().writeValueAsString(map);

    Set<ValidationMessage> errors = validate(in, jsonPayload);
    assertEquals(1, errors.size());
    assertTrue(errors.iterator().next().getMessage().contains("ot1: is missing"));
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  @JsonPropertyOrder({"name", "id", "connection"})

  /** Validate a non-conforming JSON payload that has invalid data */
  @Test
  public void invalidJsonData() throws IOException {
    // Invalid value that is not a URI
    InputStream in = JsonSchemaTest.class.getClassLoader().getResourceAsStream("json/entity/testEntity.json");
    Map<String, Object> objectTypeMap = Map.of("ot1", "ot2", "ot2", "ot2");
    Map<String, Object> map =
        Map.of(
            "stringProperty",
            "property1",
            "uriProperty",
            "invalidUri", // Invalid URI
            "uuidProperty",
            TEST_UUID,
            "objectTypeProperty",
            objectTypeMap);
    String jsonPayload = new ObjectMapper().writeValueAsString(map);

    Set<ValidationMessage> errors = validate(in, jsonPayload);
    assertEquals(1, errors.size());
    assertTrue(errors.iterator().next().getMessage().contains("uriProperty: does not match the uri pattern"));
  }

  /** Test POJO to JSON schema */
  @Test
  public void pojoToJsonSchema() throws IOException {
    // From POJO class generate json schema
    String jsonData = JsonSchemaUtil.jsonSchemaForClass(Pojo.class);
    ObjectMapper mapper = new ObjectMapper();
    Map<String, Object> jsonMap = mapper.readValue(jsonData, new TypeReference<>() {});
    System.out.println(jsonMap);
    assertEquals("http://json-schema.org/draft-07/schema#", jsonMap.get("$schema"));
    assertEquals("Pojo", jsonMap.get("title"));
    assertEquals("object", jsonMap.get("type"));

    // Check properties of the object
    Map<String, Object> propertiesMap = (Map<String, Object>) jsonMap.get("properties");
    assertEquals("{type=string, description=TODO}", propertiesMap.get("name").toString());
  }

  static class Pojo {
    @JsonProperty("name")
    @JsonPropertyDescription("TODO")
    private String name;

    @JsonProperty("id")
    @JsonPropertyDescription("Type used for UUID")
    private UUID id;
  }
}
