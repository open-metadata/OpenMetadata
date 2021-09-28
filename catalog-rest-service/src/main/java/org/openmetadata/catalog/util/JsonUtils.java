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

package org.openmetadata.catalog.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.fasterxml.jackson.databind.util.StdDateFormat;
import com.fasterxml.jackson.datatype.jsr353.JSR353Module;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObject;
import javax.json.JsonPatch;
import javax.json.JsonStructure;
import javax.json.JsonValue;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public final class JsonUtils {
  public static final MediaType DEFAULT_MEDIA_TYPE = MediaType.APPLICATION_JSON_TYPE;
  private static final Logger LOG = LoggerFactory.getLogger(JsonUtils.class);
  private static final ObjectMapper OBJECT_MAPPER;

  static {
    OBJECT_MAPPER = new ObjectMapper();
    // Ensure the date-time fields are serialized in ISO-8601 format
    OBJECT_MAPPER.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    OBJECT_MAPPER.setDateFormat(new StdDateFormat().withColonInTimeZone(true));
    OBJECT_MAPPER.registerModule(new JSR353Module());
  }

  private JsonUtils() {

  }
  
  public static <T> T getEntity(WebTarget target, Class<T> clazz) {
    return getEntity(target, DEFAULT_MEDIA_TYPE, clazz);
  }

  public static <T> T getEntity(WebTarget target, MediaType mediaType, Class<T> clazz) {
    try {
      String response = target.request(mediaType).get(String.class);
      JsonNode node = OBJECT_MAPPER.readTree(response);
      return OBJECT_MAPPER.treeToValue(node, clazz);
    } catch (Exception ex) {
      LOG.error("Error while Calling URI : {}", target.getUri());
      throw new RuntimeException(ex);
    }
  }

  public static String pojoToJson(Object o) throws JsonProcessingException {
    return pojoToJson(o, false);
  }

  public static String pojoToJson(Object o, boolean prettyPrint) throws JsonProcessingException {
    return prettyPrint ? OBJECT_MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(o) :
            OBJECT_MAPPER.writeValueAsString(o);
  }

  public static JsonStructure getJsonStructure(Object o) {
    return OBJECT_MAPPER.convertValue(o, JsonStructure.class);
  }

  public static <T> T readValue(String json, Class<T> clz) throws IOException {
    if (json == null) {
      return null;
    }
    return OBJECT_MAPPER.readValue(json, clz);
  }

  /** Read an array of objects of type {@code T} from json */
  public static <T> List<T> readObjects(String json, Class<T> clz) throws IOException {
    if (json == null) {
      return null;
    }
    TypeFactory typeFactory = OBJECT_MAPPER.getTypeFactory();
    return OBJECT_MAPPER.readValue(json, typeFactory.constructCollectionType(List.class, clz));
  }

  /** Read an object of type {@code T} from json */
  public static <T> List<T> readObjects(List<String> jsons, Class<T> clz) throws IOException {
    if (jsons == null) {
      return null;
    }
    List<T> list = new ArrayList<>();
    for (String json : jsons) {
      list.add(readValue(json, clz));
    }
    return list;
  }

  /**
   * Applies the patch on original object and returns the updated object
   */
  public static <T> T applyPatch(T original, JsonPatch patch, Class<T> clz) {
    JsonStructure targetJson = JsonUtils.getJsonStructure(original);

    //
    // JsonPatch array operations are not handled correctly by johnzon libraries. Example, the following operation:
    // {"op":"replace","path":"/tags/0/tagFQN","value":"User.BankAccount"}
    // {"op":"replace","path":"/tags/0/labelType","value":"MANUAL"}
    // {"op":"remove","path":"/tags/1"}
    // {"op":"remove","path":"/tags/2"}
    // Removes second array element in a 3 array field /tags/1
    // Then it fails to remove 3rd array element /tags/2. But the previous operation removed the second element and
    // now array of length 2 and there is no third element to remove. The patch operation fails with "array index not
    // found error".
    //
    // Reverse sorting the operations by "path" fields before applying the patch as a workaround.
    //
    JsonArray array = patch.toJsonArray();
    List<JsonObject> operations = new ArrayList<>();
    array.forEach(entry -> operations.add(entry.asJsonObject()));
    operations.sort(Comparator.comparing(jsonObject -> jsonObject.getString("path")));
    Collections.reverse(operations);

    // Build new sorted patch
    JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
    operations.forEach(o -> arrayBuilder.add(o));
    JsonPatch sortedPatch = Json.createPatch(arrayBuilder.build());

    // Apply sortedPatch
    JsonValue patchedJson = sortedPatch.apply(targetJson);
    return JsonUtils.convertValue(patchedJson, clz);
  }

  public static <T> T convertValue(JsonValue patched, Class<T> clz) {
    return OBJECT_MAPPER.convertValue(patched, clz);
  }
}

