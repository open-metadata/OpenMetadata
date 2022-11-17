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

package org.openmetadata.service.util;

import static org.openmetadata.service.util.RestUtil.DATE_TIME_FORMAT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.fasterxml.jackson.datatype.jsr353.JSR353Module;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion.VersionFlag;
import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.TreeMap;
import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObject;
import javax.json.JsonPatch;
import javax.json.JsonReader;
import javax.json.JsonStructure;
import javax.json.JsonValue;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.annotations.ExposedField;
import org.openmetadata.annotations.IgnoreMaskedFieldAnnotationIntrospector;
import org.openmetadata.annotations.MaskedField;
import org.openmetadata.annotations.OnlyExposedFieldAnnotationIntrospector;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;

@Slf4j
public final class JsonUtils {
  public static final String FIELD_TYPE_ANNOTATION = "@om-field-type";
  public static final String ENTITY_TYPE_ANNOTATION = "@om-entity-type";
  public static final String JSON_FILE_EXTENSION = ".json";
  private static final ObjectMapper OBJECT_MAPPER;
  private static final ObjectMapper EXPOSED_OBJECT_MAPPER;
  private static final ObjectMapper MASKER_OBJECT_MAPPER;
  private static final JsonSchemaFactory schemaFactory = JsonSchemaFactory.getInstance(VersionFlag.V7);

  static {
    OBJECT_MAPPER = new ObjectMapper();
    // Ensure the date-time fields are serialized in ISO-8601 format
    OBJECT_MAPPER.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    OBJECT_MAPPER.setDateFormat(DATE_TIME_FORMAT);
    OBJECT_MAPPER.registerModule(new JSR353Module());
  }

  static {
    EXPOSED_OBJECT_MAPPER = OBJECT_MAPPER.copy();
    EXPOSED_OBJECT_MAPPER.setAnnotationIntrospector(new OnlyExposedFieldAnnotationIntrospector());
  }

  static {
    MASKER_OBJECT_MAPPER = OBJECT_MAPPER.copy();
    MASKER_OBJECT_MAPPER.setAnnotationIntrospector(new IgnoreMaskedFieldAnnotationIntrospector());
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
    @SuppressWarnings("unchecked")
    Map<String, Object> map = OBJECT_MAPPER.convertValue(o, Map.class);
    return map;
  }

  public static <T> T readValue(String json, Class<T> clz) throws IOException {
    if (json == null) {
      return null;
    }
    return OBJECT_MAPPER.readValue(json, clz);
  }

  public static <T> T readValue(String json, TypeReference<T> valueTypeRef) throws IOException {
    if (json == null) {
      return null;
    }
    return OBJECT_MAPPER.readValue(json, valueTypeRef);
  }

  /** Read an array of objects of type {@code T} from json */
  public static <T> List<T> readObjects(String json, Class<T> clz) throws IOException {
    if (json == null) {
      return Collections.emptyList();
    }
    TypeFactory typeFactory = OBJECT_MAPPER.getTypeFactory();
    return OBJECT_MAPPER.readValue(json, typeFactory.constructCollectionType(List.class, clz));
  }

  /** Read an object of type {@code T} from json */
  public static <T> List<T> readObjects(List<String> jsons, Class<T> clz) throws IOException {
    if (jsons == null) {
      return Collections.emptyList();
    }
    List<T> list = new ArrayList<>();
    for (String json : jsons) {
      list.add(readValue(json, clz));
    }
    return list;
  }

  public static <T> T convertValue(Object object, Class<T> clz) {
    if (object == null) {
      return null;
    }
    return OBJECT_MAPPER.convertValue(object, clz);
  }

  public static <T> T convertValue(Object object, TypeReference<T> toValueTypeRef) {
    if (object == null) {
      return null;
    }
    return OBJECT_MAPPER.convertValue(object, toValueTypeRef);
  }

  /** Applies the patch on original object and returns the updated object */
  public static JsonValue applyPatch(Object original, JsonPatch patch) {
    JsonStructure targetJson = JsonUtils.getJsonStructure(original);

    //
    // -----------------------------------------------------------
    // JSON patch modification 1 - Reorder the operations
    // -----------------------------------------------------------
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
    // ---------------------------------------------------------------------
    // JSON patch modification 2 - Ignore operations related to href patch
    // ---------------------------------------------------------------------
    // Another important modification to patch operation:
    // Ignore all the patch operations related to the href path as href path is read only and is auto generated
    // by removing those operations from patch operation array
    //
    JsonArray array = patch.toJsonArray();
    List<JsonObject> removeOperations = new ArrayList<>();
    List<JsonObject> otherOperations = new ArrayList<>();

    array.forEach(
        entry -> {
          JsonObject jsonObject = entry.asJsonObject();
          if (jsonObject.getString("path").endsWith("href")) {
            // Ignore patch operations related to href path
            return;
          }
          if (jsonObject.getString("op").equals("remove")) {
            removeOperations.add(jsonObject);
          } else {
            otherOperations.add(jsonObject);
          }
        });

    // sort the operations by path
    if (!otherOperations.isEmpty()) {
      ArrayList<String> paths = new ArrayList<>();
      for (JsonObject jsonObject : otherOperations) {
        paths.add(jsonObject.getString("path"));
      }
      for (String path : paths) {
        if (path.matches("^[a-zA-Z]*$")) {
          otherOperations.sort(Comparator.comparing(jsonObject -> jsonObject.getString("path")));
        } else if (path.matches(".*\\d.*")) {
          otherOperations.sort(
              Comparator.comparing(
                  jsonObject -> {
                    String pathValue = jsonObject.getString("path");
                    String tagIndex = pathValue.replaceAll("\\D", "");
                    return tagIndex.isEmpty() ? 0 : Integer.parseInt(tagIndex);
                  }));
        }
      }
    }
    if (!removeOperations.isEmpty()) {
      ArrayList<String> paths = new ArrayList<>();
      for (JsonObject jsonObject : removeOperations) {
        paths.add(jsonObject.getString("path"));
      }
      for (String path : paths) {
        if (path.matches("^[a-zA-Z]*$")) {
          removeOperations.sort(Comparator.comparing(jsonObject -> jsonObject.getString("path")));
          // reverse sort only the remove operations
          Collections.reverse(removeOperations);
        } else if (path.matches(".*\\d.*")) {
          removeOperations.sort(
              Comparator.comparing(
                  jsonObject -> {
                    String pathValue = jsonObject.getString("path");
                    String tagIndex = pathValue.replaceAll("\\D", "");
                    return tagIndex.isEmpty() ? 0 : Integer.parseInt(tagIndex);
                  }));
          // reverse sort only the remove operations
          Collections.reverse(removeOperations);
        }
      }
    }

    // Build new sorted patch
    JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
    otherOperations.forEach(arrayBuilder::add);
    removeOperations.forEach(arrayBuilder::add);
    JsonPatch sortedPatch = Json.createPatch(arrayBuilder.build());

    // Apply sortedPatch
    return sortedPatch.apply(targetJson);
  }

  public static <T> T applyPatch(T original, JsonPatch patch, Class<T> clz) {
    JsonValue value = applyPatch(original, patch);
    return OBJECT_MAPPER.convertValue(value, clz);
  }

  public static JsonPatch getJsonPatch(String v1, String v2) {
    JsonValue source = readJson(v1);
    JsonValue dest = readJson(v2);
    return Json.createDiff(source.asJsonObject(), dest.asJsonObject());
  }

  public static JsonPatch getJsonPatch(Object v1, Object v2) throws JsonProcessingException {
    JsonValue source = readJson(JsonUtils.pojoToJson(v1));
    JsonValue dest = readJson(JsonUtils.pojoToJson(v2));
    return Json.createDiff(source.asJsonObject(), dest.asJsonObject());
  }

  public static JsonValue readJson(String s) {
    try (JsonReader reader = Json.createReader(new StringReader(s))) {
      return reader.readValue();
    }
  }

  public static JsonSchema getJsonSchema(String schema) {
    return schemaFactory.getSchema(schema);
  }

  public static JsonNode valueToTree(Object object) {
    return OBJECT_MAPPER.valueToTree(object);
  }

  public static boolean hasAnnotation(JsonNode jsonNode, String annotation) {
    String comment = String.valueOf(jsonNode.get("$comment"));
    return comment != null && comment.contains(annotation);
  }

  /** Get all the fields types and entity types from OpenMetadata JSON schema definition files. */
  public static List<Type> getTypes() throws IOException {
    // Get Field Types
    List<Type> types = new ArrayList<>();
    List<String> jsonSchemas = EntityUtil.getJsonDataResources(".*json/schema/type/.*\\.json$");
    for (String jsonSchema : jsonSchemas) {
      try {
        types.addAll(JsonUtils.getFieldTypes(jsonSchema));
      } catch (Exception e) {
        LOG.warn("Failed to initialize the types from jsonSchema file {}", jsonSchema, e);
      }
    }

    // Get Entity Types
    jsonSchemas = EntityUtil.getJsonDataResources(".*json/schema/entity/.*\\.json$");
    for (String jsonSchema : jsonSchemas) {
      try {
        Type entityType = JsonUtils.getEntityType(jsonSchema);
        if (entityType != null) {
          types.add(entityType);
        }
      } catch (Exception e) {
        LOG.warn("Failed to initialize the types from jsonSchema file {}", jsonSchema, e);
      }
    }
    return types;
  }

  /**
   * Get all the fields types from the `definitions` section of a JSON schema file that are annotated with "$comment"
   * field set to "@om-field-type".
   */
  public static List<Type> getFieldTypes(String jsonSchemaFile) throws IOException {
    JsonNode node =
        OBJECT_MAPPER.readTree(
            Objects.requireNonNull(JsonUtils.class.getClassLoader().getResourceAsStream(jsonSchemaFile)));
    if (node.get("definitions") == null) {
      return Collections.emptyList();
    }

    String jsonNamespace = getSchemaName(jsonSchemaFile);

    List<Type> types = new ArrayList<>();
    Iterator<Entry<String, JsonNode>> definitions = node.get("definitions").fields();
    while (definitions != null && definitions.hasNext()) {
      Entry<String, JsonNode> entry = definitions.next();
      String typeName = entry.getKey();
      JsonNode value = entry.getValue();
      if (JsonUtils.hasAnnotation(value, JsonUtils.FIELD_TYPE_ANNOTATION)) {
        String description = String.valueOf(value.get("description"));
        Type type =
            new Type()
                .withName(typeName)
                .withCategory(Category.Field)
                .withFullyQualifiedName(typeName)
                .withNameSpace(jsonNamespace)
                .withDescription(description)
                .withDisplayName(entry.getKey())
                .withSchema(value.toPrettyString());
        types.add(type);
      }
    }
    return types;
  }

  /**
   * Get all the fields types from the `definitions` section of a JSON schema file that are annotated with "$comment"
   * field set to "@om-entity-type".
   */
  public static Type getEntityType(String jsonSchemaFile) throws IOException {
    JsonNode node =
        OBJECT_MAPPER.readTree(
            Objects.requireNonNull(JsonUtils.class.getClassLoader().getResourceAsStream(jsonSchemaFile)));
    if (!JsonUtils.hasAnnotation(node, JsonUtils.ENTITY_TYPE_ANNOTATION)) {
      return null;
    }

    String entityName = getSchemaName(jsonSchemaFile);
    String namespace = getSchemaGroup(jsonSchemaFile);

    String description = String.valueOf(node.get("description"));
    return new Type()
        .withName(entityName)
        .withCategory(Category.Entity)
        .withFullyQualifiedName(entityName)
        .withNameSpace(namespace)
        .withDescription(description)
        .withDisplayName(entityName)
        .withSchema(node.toPrettyString());
  }

  /** Given a json schema file name .../json/schema/entity/data/table.json - return table */
  private static String getSchemaName(String path) {
    String fileName = Paths.get(path).getFileName().toString();
    return fileName.replace(" ", "").replace(JSON_FILE_EXTENSION, "");
  }

  /** Given a json schema file name .../json/schema/entity/data/table.json - return data */
  private static String getSchemaGroup(String path) {
    return Paths.get(path).getParent().getFileName().toString();
  }

  /** Serialize object removing all the fields annotated with @{@link MaskedField} */
  public static String pojoToMaskedJson(Object entity) throws JsonProcessingException {
    return MASKER_OBJECT_MAPPER.writeValueAsString(entity);
  }

  /** Serialize object removing all the fields annotated with @{@link ExposedField} */
  public static <T> T toExposedEntity(Object entity, Class<T> clazz) throws IOException {
    String jsonString = EXPOSED_OBJECT_MAPPER.writeValueAsString(entity);
    return EXPOSED_OBJECT_MAPPER.readValue(jsonString, clazz);
  }

  public static ObjectNode getObjectNode(String key, JsonNode value) {
    ObjectNode objectNode = getObjectNode();
    return objectNode.set(key, value);
  }

  public static ObjectNode getObjectNode() {
    return OBJECT_MAPPER.createObjectNode();
  }

  public static JsonNode readTree(String extensionJson) throws JsonProcessingException {
    return OBJECT_MAPPER.readTree(extensionJson);
  }

  /** Compared the canonicalized JSON representation of two object to check if they are equals or not */
  public static boolean areEquals(Object obj1, Object obj2) throws JsonProcessingException {
    ObjectMapper mapper = JsonMapper.builder().nodeFactory(new SortedNodeFactory()).build();
    JsonNode obj1sorted = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION).readTree(pojoToJson(obj1));
    JsonNode obj2sorted = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION).readTree(pojoToJson(obj2));
    return OBJECT_MAPPER.writeValueAsString(obj1sorted).equals(OBJECT_MAPPER.writeValueAsString(obj2sorted));
  }

  static class SortedNodeFactory extends JsonNodeFactory {
    @Override
    public ObjectNode objectNode() {
      return new ObjectNode(this, new TreeMap<>());
    }
  }
}
