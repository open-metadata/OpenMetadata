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

package org.openmetadata.catalog.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.fasterxml.jackson.datatype.jsr353.JSR353Module;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObject;
import javax.json.JsonPatch;
import javax.json.JsonReader;
import javax.json.JsonStructure;
import javax.json.JsonValue;
import javax.ws.rs.core.MediaType;

public final class JsonUtils {
  public static final MediaType DEFAULT_MEDIA_TYPE = MediaType.APPLICATION_JSON_TYPE;
  private static final ObjectMapper OBJECT_MAPPER;

  static {
    OBJECT_MAPPER = new ObjectMapper();
    // Ensure the date-time fields are serialized in ISO-8601 format
    OBJECT_MAPPER.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    OBJECT_MAPPER.setDateFormat(RestUtil.DATE_TIME_FORMAT);
    OBJECT_MAPPER.registerModule(new JSR353Module());
  }

  private JsonUtils() {}

  public static String pojoToJson(Object o) throws JsonProcessingException {
    if (o == null) {
      return null;
    }
    return pojoToJson(o, false);
  }

  public static String pojoToJson(Object o, boolean prettyPrint) throws JsonProcessingException {
    return prettyPrint
        ? OBJECT_MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(o)
        : OBJECT_MAPPER.writeValueAsString(o);
  }

  public static JsonStructure getJsonStructure(Object o) {
    return OBJECT_MAPPER.convertValue(o, JsonStructure.class);
  }

  public static Map<String, Object> getMap(Object o) {
    return OBJECT_MAPPER.convertValue(o, Map.class);
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

  /** Applies the patch on original object and returns the updated object */
  public static <T> T applyPatch(T original, JsonPatch patch, Class<T> clz) {
    JsonStructure targetJson = JsonUtils.getJsonStructure(original);

    //
    // JsonPatch array operations are not handled correctly by johnzon libraries. Example, the following operation:
    // {"op":"replace","path":"/tags/0/tagFQN","value":"User.BankAccount"}
    // {"op":"replace","path":"/tags/0/labelType","value":"MANUAL"}
    // {"op":"remove","path":"/tags/1"}
    // {"op":"remove","path":"/tags/2"}
    // Removes second array element in a 3 array field /tags/1
    // Then it fails to remove 3rd array element /tags/2. Because the previous operation removed the second element and
    // now array of length 2 and there is no third element to remove. The patch operation fails with "array index not
    // found error".
    //
    // The same applies to add operation as well. Example, the following operation:
    // {"op":"add","path":"/tags/2"}
    // {"op":"add","path":"/tags/1"}
    // It will try to add element in index 2 before adding element in index 1 and the patch operation fails with
    // "contains no element for index 1" error.
    //
    // Reverse sorting the remove operations and sorting all the other operations including "add" by "path" fields
    // before applying the patch as a workaround.
    //
    JsonArray array = patch.toJsonArray();
    List<JsonObject> removeOperations = new ArrayList<>();
    List<JsonObject> otherOperations = new ArrayList<>();

    array.forEach(
        entry -> {
          JsonObject jsonObject = entry.asJsonObject();
          if (jsonObject.getString("op").equals("remove")) {
            removeOperations.add(jsonObject);
          } else {
            otherOperations.add(jsonObject);
          }
        });

    // sort the operations by path
    if (!otherOperations.isEmpty()) {
      otherOperations.sort(Comparator.comparing(jsonObject -> jsonObject.getString("path")));
    }
    if (!removeOperations.isEmpty()) {
      removeOperations.sort(Comparator.comparing(jsonObject -> jsonObject.getString("path")));
      // reverse sort only the remove operations
      Collections.reverse(removeOperations);
    }

    // Build new sorted patch
    JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
    otherOperations.forEach(arrayBuilder::add);
    removeOperations.forEach(arrayBuilder::add);
    JsonPatch sortedPatch = Json.createPatch(arrayBuilder.build());

    // Apply sortedPatch
    JsonValue patchedJson = sortedPatch.apply(targetJson);
    return OBJECT_MAPPER.convertValue(patchedJson, clz);
  }

  public static JsonPatch getJsonPatch(String v1, String v2) {
    JsonValue source = readJson(v1);
    JsonValue dest = readJson(v2);
    return Json.createDiff(source.asJsonObject(), dest.asJsonObject());
  }

  public static JsonValue readJson(String s) {
    try (JsonReader reader = Json.createReader(new StringReader(s))) {
      return reader.readValue();
    }
  }
}
