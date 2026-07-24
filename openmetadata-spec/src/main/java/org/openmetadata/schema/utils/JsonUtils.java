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

package org.openmetadata.schema.utils;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.fasterxml.jackson.databind.util.TokenBuffer;
import com.fasterxml.jackson.datatype.jsonp.JSONPModule;
import com.fasterxml.jackson.datatype.jsr353.JSR353Module;
import com.fasterxml.jackson.module.blackbird.BlackbirdModule;
import com.github.fge.jsonpatch.JsonPatchException;
import com.github.fge.jsonpatch.diff.JsonDiff;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import jakarta.json.*;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.annotations.ExposedField;
import org.openmetadata.annotations.IgnoreMaskedFieldAnnotationIntrospector;
import org.openmetadata.annotations.MaskedField;
import org.openmetadata.annotations.OnlyExposedFieldAnnotationIntrospector;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.exception.JsonParsingException;

@Slf4j
public final class JsonUtils {
  public static final DateFormat DATE_TIME_FORMAT;
  public static final String FIELD_TYPE_ANNOTATION = "@om-field-type";
  public static final String ENTITY_TYPE_ANNOTATION = "@om-entity-type";
  public static final String JSON_FILE_EXTENSION = ".json";
  private static final ObjectMapper OBJECT_MAPPER;
  private static final ObjectMapper JSONP_MAPPER;
  private static final ObjectMapper OBJECT_MAPPER_LENIENT;
  private static final ObjectMapper OBJECT_MAPPER_IGNORE_NULL;
  private static final ObjectMapper EXPOSED_OBJECT_MAPPER;
  private static final ObjectMapper MASKER_OBJECT_MAPPER;
  private static final SchemaRegistry schemaFactory =
      SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_7);
  private static final String FAILED_TO_PROCESS_JSON = "Failed to process JSON ";
  private static final List<String> READ_ONLY_PATCH_ROOT_FIELDS =
      List.of(
          "/changeDescription",
          "/incrementalChangeDescription",
          "/testCaseResultSummary",
          "/summary");

  static {
    // Quoted "Z" to indicate UTC, no timezone offset
    DATE_TIME_FORMAT = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'");
    DATE_TIME_FORMAT.setTimeZone(TimeZone.getTimeZone("UTC"));
  }

  static {
    OBJECT_MAPPER = new ObjectMapper();
    OBJECT_MAPPER
        .getFactory()
        .setStreamReadConstraints(
            StreamReadConstraints.builder()
                .maxStringLength(50 * 1024 * 1024) // ~50M chars max per single JSON string token
                .build());
    // Ensure the date-time fields are serialized in ISO-8601 format
    OBJECT_MAPPER.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    OBJECT_MAPPER.setDateFormat(DATE_TIME_FORMAT);
    OBJECT_MAPPER.registerModule(new JSR353Module());
    // Java 21 optimized introspection/accessors for faster convertValue/read/write paths.
    OBJECT_MAPPER.registerModule(new BlackbirdModule());

    // Accept any Date field with or without fractional seconds. Python clients serialize
    // datetimes with microsecond=0 as "…ssZ" (no fractional), which the strict global
    // SimpleDateFormat("…SSSSSS'Z'") rejects. Registering the lenient deserializer for all
    // java.util.Date fields keeps deserialization tolerant while serialization stays on the
    // microsecond format above.
    OBJECT_MAPPER.registerModule(lenientDateModule());

    JSONP_MAPPER = OBJECT_MAPPER.copy().registerModule(new JSONPModule());

    // Lenient ObjectMapper to ignore unknown properties
    OBJECT_MAPPER_LENIENT = OBJECT_MAPPER.copy();
    OBJECT_MAPPER_LENIENT.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    OBJECT_MAPPER_IGNORE_NULL = OBJECT_MAPPER.copy();
    OBJECT_MAPPER_IGNORE_NULL.setSerializationInclusion(JsonInclude.Include.NON_NULL);
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

  public static String pojoToJson(Object o) {
    if (o == null) {
      return null;
    }
    return pojoToJson(o, false);
  }

  public static String pojoToJson(Object o, boolean prettyPrint) {
    try {
      return prettyPrint
          ? OBJECT_MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(o)
          : OBJECT_MAPPER.writeValueAsString(o);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static String pojoToJsonIgnoreNull(Object o) {
    if (o == null) {
      return null;
    }
    try {
      return OBJECT_MAPPER_IGNORE_NULL.writeValueAsString(o);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static JsonStructure getJsonStructure(Object o) {
    try {
      JsonValue value = JSONP_MAPPER.convertValue(o, JsonValue.class);
      if (value instanceof JsonStructure structure) {
        return structure;
      }
      throw new IllegalArgumentException("Expected a JSON object or array");
    } catch (Exception e) {
      throw new RuntimeException("Failed to convert object to JsonStructure", e);
    }
  }

  public static Map<String, Object> getMap(Object o) {
    @SuppressWarnings("unchecked")
    Map<String, Object> map = OBJECT_MAPPER.convertValue(o, Map.class);
    return map;
  }

  public static <T> T readOrConvertValue(Object obj, Class<T> clz) {
    return obj instanceof String str ? readValue(str, clz) : convertValue(obj, clz);
  }

  public static <T> T readOrConvertValueLenient(Object obj, Class<T> clz) {
    return obj instanceof String str ? readValueLenient(str, clz) : convertValueLenient(obj, clz);
  }

  public static <T> List<T> readOrConvertValues(Object obj, Class<T> clz) {
    if (obj instanceof String str) {
      return readObjects(str, clz);
    } else {
      return convertObjects(obj, clz);
    }
  }

  public static <T> T readValue(String json, String clazzName) {
    try {
      return (T) readValue(json, Class.forName(clazzName));
    } catch (ClassNotFoundException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static <T> Optional<T> readJsonAtPath(String json, String path, Class<T> clazz) {
    try {
      DocumentContext documentContext = JsonPath.parse(json);
      return Optional.ofNullable(documentContext.read(path, clazz));
    } catch (Exception e) {
      LOG.error("Failed to read value at path {}", path, e);
      return Optional.empty();
    }
  }

  public static <T> T readValue(String json, Class<T> clz) {
    if (json == null) {
      return null;
    }
    try {
      return OBJECT_MAPPER.readValue(json, clz);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static <T> T readValueLenient(String json, Class<T> clz) {
    if (json == null) {
      return null;
    }
    try {
      return OBJECT_MAPPER_LENIENT.readValue(json, clz);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static <T> T readValue(String json, TypeReference<T> valueTypeRef) {
    if (json == null) {
      return null;
    }
    try {
      return OBJECT_MAPPER.readValue(json, valueTypeRef);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  /** Convert an array of objects of type {@code T} from json */
  public static <T> List<T> convertObjects(Object json, Class<T> clz) {
    if (json == null) {
      return Collections.emptyList();
    }
    TypeFactory typeFactory = OBJECT_MAPPER.getTypeFactory();
    return OBJECT_MAPPER.convertValue(json, typeFactory.constructCollectionType(List.class, clz));
  }

  /** Read an array of objects of type {@code T} from json */
  public static <T> List<T> readObjects(String json, Class<T> clz) {
    if (json == null) {
      return Collections.emptyList();
    }
    TypeFactory typeFactory = OBJECT_MAPPER.getTypeFactory();
    try {
      return OBJECT_MAPPER.readValue(json, typeFactory.constructCollectionType(List.class, clz));
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  /** Read an object of type {@code T} from json */
  public static <T> List<T> readObjects(List<String> jsons, Class<T> clz) {
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
    return object == null ? null : OBJECT_MAPPER.convertValue(object, clz);
  }

  public static <T> T convertValueLenient(Object object, Class<T> clz) {
    return object == null ? null : OBJECT_MAPPER_LENIENT.convertValue(object, clz);
  }

  public static <T> T convertValue(Object object, TypeReference<T> toValueTypeRef) {
    return object == null ? null : OBJECT_MAPPER.convertValue(object, toValueTypeRef);
  }

  /** Applies the patch on original object and returns the updated object */
  public static JsonValue applyPatch(Object original, JsonPatch patch) {
    JsonStructure targetJson = JsonUtils.getJsonStructure(original);
    JsonStructure currentJson = targetJson;

    // ---------------------------------------------------------------------
    // JSON patch modification - Ignore operations related to read-only fields
    // ---------------------------------------------------------------------
    // Ignore all the patch operations related to read-only auto-generated fields:
    // - href: auto-generated resource URLs
    // - changeDescription: auto-generated change tracking
    // - incrementalChangeDescription: auto-generated incremental change tracking
    JsonArray array = patch.toJsonArray();

    for (JsonValue entry : array) {
      JsonObject jsonObject = entry.asJsonObject();
      String path = jsonObject.getString("path", null);
      if (path == null) {
        continue;
      }

      validateJsonPointer(path, "path");

      // Skip operations on read-only auto-generated fields
      if (isReadOnlyPatchPath(path)) {
        continue;
      }

      // For copy/move operations, also check the 'from' field if present
      if (jsonObject.containsKey("from")) {
        String from = jsonObject.getString("from", null);
        if (from != null) {
          validateJsonPointer(from, "from");
        }
        if (isReadOnlyPatchPath(from)) {
          continue;
        }
      }

      // UI sometimes sends "replace" for optional fields that are absent in the persisted object.
      // RFC-6902 "replace" requires the path to exist, while "add" supports this transition.
      // Convert only when parent exists and target path is missing.
      JsonObject operation =
          shouldConvertReplaceToAdd(currentJson, jsonObject)
              ? withOp(jsonObject, "add")
              : jsonObject;

      // Apply incrementally so each operation can reason about the materialized state from
      // preceding operations in the same patch document.
      JsonArrayBuilder singleOp = Json.createArrayBuilder();
      singleOp.add(operation);
      JsonPatch singlePatch = Json.createPatch(singleOp.build());
      currentJson = singlePatch.apply(currentJson);
    }
    return currentJson;
  }

  private static void validateJsonPointer(String pointer, String fieldName) {
    if (!pointer.isEmpty() && pointer.charAt(0) != '/') {
      throw new IllegalArgumentException(
          String.format(
              "Invalid JSON Patch '%s' value '%s' - non-empty JSON Pointer must begin with '/' (RFC 6901)",
              fieldName, pointer));
    }
  }

  private static boolean isReadOnlyPatchPath(String path) {
    if (path == null || path.isBlank()) {
      return false;
    }
    if (path.endsWith("href")) {
      return true;
    }
    return READ_ONLY_PATCH_ROOT_FIELDS.stream()
        .anyMatch(root -> path.equals(root) || path.startsWith(root + "/"));
  }

  private static boolean shouldConvertReplaceToAdd(JsonStructure targetJson, JsonObject patchItem) {
    if (!"replace".equals(patchItem.getString("op", null))) {
      return false;
    }
    String path = patchItem.getString("path", null);
    if (path == null || path.isBlank() || "/".equals(path)) {
      return false;
    }
    if (jsonPointerExists(targetJson, path)) {
      return false;
    }
    String parentPath = path.substring(0, path.lastIndexOf('/'));
    if (parentPath.isEmpty()) {
      // Top-level field (e.g., /displayName) — the root object always exists
      return true;
    }
    return jsonPointerExists(targetJson, parentPath);
  }

  private static boolean jsonPointerExists(JsonStructure targetJson, String path) {
    try {
      JsonPointer pointer = Json.createPointer(path);
      pointer.getValue(targetJson);
      return true;
    } catch (Exception ex) {
      return false;
    }
  }

  private static JsonObject withOp(JsonObject patchItem, String op) {
    JsonObjectBuilder builder = Json.createObjectBuilder();
    for (Entry<String, JsonValue> entry : patchItem.entrySet()) {
      builder.add(entry.getKey(), entry.getValue());
    }
    builder.add("op", op);
    return builder.build();
  }

  public static <T> T applyPatch(T original, JsonPatch patch, Class<T> clz) {
    JsonValue value = applyPatch(original, patch);
    try {
      return OBJECT_MAPPER.readValue(value.toString(), clz);
    } catch (Exception e) {
      throw new RuntimeException(
          "Failed to convert JsonValue to " + clz.getSimpleName() + ": " + e.getMessage(), e);
    }
  }

  public static JsonPatch getJsonPatch(String v1, String v2) {
    JsonNode source = readTree(v1);
    JsonNode dest = readTree(v2);
    JsonNode patchNode = JsonDiff.asJson(source, dest);
    return Json.createPatch(Json.createReader(new StringReader(patchNode.toString())).readArray());
  }

  public static JsonPatch getJsonPatch(Object v1, Object v2) {
    JsonNode source = valueToTree(v1);
    JsonNode dest = valueToTree(v2);
    JsonNode patchNode = JsonDiff.asJson(source, dest);
    return Json.createPatch(Json.createReader(new StringReader(patchNode.toString())).readArray());
  }

  public static Set<String> extractPatchedFields(JsonPatch patch) {
    Set<String> fields = new HashSet<>();
    JsonArray array = patch.toJsonArray();
    for (JsonValue entry : array) {
      JsonObject op = entry.asJsonObject();
      addTopLevelField(fields, op.getString("path", null));
      if (op.containsKey("from")) {
        addTopLevelField(fields, op.getString("from", null));
      }
    }
    return fields;
  }

  private static void addTopLevelField(Set<String> fields, String path) {
    if (path == null || path.isEmpty() || path.equals("/")) return;
    String stripped = path.startsWith("/") ? path.substring(1) : path;
    int slash = stripped.indexOf('/');
    fields.add(slash > 0 ? stripped.substring(0, slash) : stripped);
  }

  private static JsonNode applyJsonPatch(JsonPatch patch, JsonNode targetNode)
      throws JsonPatchException, IOException {
    // Convert jakarta.json.JsonPatch to com.github.fge.jsonpatch.JsonPatch
    String patchString = patch.toString();
    JsonNode patchNode;
    try {
      patchNode = OBJECT_MAPPER.readTree(patchString);
    } catch (JsonProcessingException e) {
      LOG.error("Failed to parse JsonPatch string: {}", patchString, e);
      throw new RuntimeException("Invalid JsonPatch format", e);
    }
    com.github.fge.jsonpatch.JsonPatch jacksonPatch =
        com.github.fge.jsonpatch.JsonPatch.fromJson(patchNode);
    return jacksonPatch.apply(targetNode);
  }

  public static <T extends EntityInterface> T applyJsonPatch(
      T original, JsonPatch patch, Class<T> clz) {
    try {
      // Convert original entity to JsonNode
      JsonNode originalNode = OBJECT_MAPPER.valueToTree(original);

      // Apply the JSON Patch
      JsonNode patchedNode = applyJsonPatch(patch, originalNode);

      // Deserialize the patched JsonNode back to the entity class
      return OBJECT_MAPPER.treeToValue(patchedNode, clz);
    } catch (JsonPatchException | JsonProcessingException e) {
      LOG.error("Failed to apply JSON Patch: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to apply JSON Patch", e);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  public static JsonValue readJson(String s) {
    try (JsonReader reader = Json.createReader(new StringReader(s))) {
      return reader.readValue();
    }
  }

  public static Schema getJsonSchema(String schema) {
    // SchemaRegistry compiles schemas against shared dialect/metaschema caches that are not safe
    // under concurrent compilation; serialize compilation to avoid transient failures.
    synchronized (schemaFactory) {
      return schemaFactory.getSchema(schema);
    }
  }

  public static JsonNode valueToTree(Object object) {
    return OBJECT_MAPPER.valueToTree(object);
  }

  public static boolean hasAnnotation(JsonNode jsonNode, String annotation) {
    String comment = String.valueOf(jsonNode.get("$comment"));
    return comment != null && comment.contains(annotation);
  }

  /** Get all the fields types and entity types from OpenMetadata JSON schema definition files. */
  public static List<Type> getTypes() {
    return getTypes(ignored -> {});
  }

  public static List<Type> getTypes(Consumer<String> loadFailureHandler) {
    // Get Field Types
    List<Type> types = new ArrayList<>();
    List<String> jsonSchemas;
    try {
      jsonSchemas = getJsonDataResources(Pattern.compile(".*json/schema/type/.*\\.json$"));
    } catch (IOException e) {
      throw new JsonParsingException("Failed to read JSON resources at .*json/schema/type", e);
    }
    for (String jsonSchema : jsonSchemas) {
      try {
        types.addAll(JsonUtils.getFieldTypes(jsonSchema));
      } catch (Exception e) {
        loadFailureHandler.accept(jsonSchema);
        LOG.warn("Failed to initialize the types from jsonSchema file {}", jsonSchema, e);
      }
    }

    // Get Entity Types
    try {
      jsonSchemas = getJsonDataResources(Pattern.compile(".*json/schema/entity/.*\\.json$"));
    } catch (IOException e) {
      throw new JsonParsingException("Failed to read JSON resources at .*json/schema/entity", e);
    }
    for (String jsonSchema : jsonSchemas) {
      try {
        Type entityType = JsonUtils.getEntityType(jsonSchema);
        if (entityType != null) {
          types.add(entityType);
        }
      } catch (Exception e) {
        loadFailureHandler.accept(jsonSchema);
        LOG.warn("Failed to initialize the types from jsonSchema file {}", jsonSchema, e);
      }
    }
    return types;
  }

  public static List<String> getTypeNames(String jsonSchemaFile, byte[] jsonSchema) {
    boolean fieldTypeSchema = jsonSchemaFile.contains("json/schema/type/");
    boolean entityTypeSchema = jsonSchemaFile.contains("json/schema/entity/");
    if (!fieldTypeSchema && !entityTypeSchema) {
      return Collections.emptyList();
    }

    String annotation = fieldTypeSchema ? FIELD_TYPE_ANNOTATION : ENTITY_TYPE_ANNOTATION;
    if (!new String(jsonSchema, StandardCharsets.UTF_8).contains(annotation)) {
      return Collections.emptyList();
    }

    JsonNode node;
    try {
      node = OBJECT_MAPPER.readTree(jsonSchema);
    } catch (IOException e) {
      throw new JsonParsingException("Failed to read jsonSchemaFile " + jsonSchemaFile, e);
    }
    if (fieldTypeSchema) {
      return getFieldTypeNames(node);
    }
    String entityTypeName = getEntityTypeName(jsonSchemaFile, node);
    return entityTypeName == null ? Collections.emptyList() : List.of(entityTypeName);
  }

  /**
   * Get all the fields types from the `definitions` section of a JSON schema file that are annotated with "$comment"
   * field set to "@om-field-type".
   */
  public static List<Type> getFieldTypes(String jsonSchemaFile) {
    JsonNode node;
    try {
      node =
          OBJECT_MAPPER.readTree(
              Objects.requireNonNull(
                  JsonUtils.class.getClassLoader().getResourceAsStream(jsonSchemaFile)));
    } catch (IOException e) {
      throw new JsonParsingException("Failed to read jsonSchemaFile " + jsonSchemaFile, e);
    }
    if (node.get("definitions") == null) {
      return Collections.emptyList();
    }

    String jsonNamespace = getSchemaName(jsonSchemaFile);

    List<Type> types = new ArrayList<>();
    for (String typeName : getFieldTypeNames(node)) {
      JsonNode value = node.get("definitions").get(typeName);
      String description = String.valueOf(value.get("description"));
      Type type =
          new Type()
              .withName(typeName)
              .withCategory(Category.Field)
              .withFullyQualifiedName(typeName)
              .withNameSpace(jsonNamespace)
              .withDescription(description)
              .withDisplayName(typeName)
              .withSchema(value.toPrettyString());
      types.add(type);
    }
    return types;
  }

  /**
   * Get all the fields types from the `definitions` section of a JSON schema file that are annotated with "$comment"
   * field set to "@om-entity-type".
   */
  public static Type getEntityType(String jsonSchemaFile) {
    JsonNode node;
    try {
      node =
          OBJECT_MAPPER.readTree(
              Objects.requireNonNull(
                  JsonUtils.class.getClassLoader().getResourceAsStream(jsonSchemaFile)));
    } catch (IOException e) {
      throw new JsonParsingException("Failed to read jsonSchemaFile " + jsonSchemaFile, e);
    }
    String entityName = getEntityTypeName(jsonSchemaFile, node);
    if (entityName == null) {
      return null;
    }

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

  private static List<String> getFieldTypeNames(JsonNode node) {
    JsonNode definitionsNode = node.get("definitions");
    if (definitionsNode == null) {
      return Collections.emptyList();
    }
    List<String> typeNames = new ArrayList<>();
    Iterator<Entry<String, JsonNode>> definitions = definitionsNode.fields();
    while (definitions.hasNext()) {
      Entry<String, JsonNode> entry = definitions.next();
      if (JsonUtils.hasAnnotation(entry.getValue(), JsonUtils.FIELD_TYPE_ANNOTATION)) {
        typeNames.add(entry.getKey());
      }
    }
    return typeNames;
  }

  private static String getEntityTypeName(String jsonSchemaFile, JsonNode node) {
    return JsonUtils.hasAnnotation(node, JsonUtils.ENTITY_TYPE_ANNOTATION)
        ? getSchemaName(jsonSchemaFile)
        : null;
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
  public static String pojoToMaskedJson(Object entity) {
    try {
      return MASKER_OBJECT_MAPPER.writeValueAsString(entity);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  /** Serialize object removing all the fields annotated with @{@link ExposedField} */
  public static <T> T toExposedEntity(Object entity, Class<T> clazz) {
    String jsonString;
    try {
      jsonString = EXPOSED_OBJECT_MAPPER.writeValueAsString(entity);
      return EXPOSED_OBJECT_MAPPER.readValue(jsonString, clazz);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static ObjectNode getObjectNode(String key, JsonNode value) {
    ObjectNode objectNode = getObjectNode();
    return objectNode.set(key, value);
  }

  public static ObjectNode getObjectNode() {
    return OBJECT_MAPPER.createObjectNode();
  }

  public static JsonNode readTree(String extensionJson) {
    try {
      return OBJECT_MAPPER.readTree(extensionJson);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static <T> T treeToValue(JsonNode jsonNode, Class<T> classType) {
    try {
      return OBJECT_MAPPER.treeToValue(jsonNode, classType);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  /** Compared the canonicalized JSON representation of two object to check if they are equals or not */
  public static boolean areEquals(Object obj1, Object obj2) {
    try {
      ObjectMapper mapper = JsonMapper.builder().nodeFactory(new SortedNodeFactory()).build();
      JsonNode obj1sorted =
          mapper
              .reader()
              .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
              .readTree(pojoToJson(obj1));
      JsonNode obj2sorted =
          mapper
              .reader()
              .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
              .readTree(pojoToJson(obj2));
      return OBJECT_MAPPER
          .writeValueAsString(obj1sorted)
          .equals(OBJECT_MAPPER.writeValueAsString(obj2sorted));
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static <T> T deepCopy(Object original, Class<T> clazz) {
    return readFromTokenBuffer(toTokenBuffer(original), clazz);
  }

  public static TokenBuffer toTokenBuffer(Object value) {
    try {
      TokenBuffer tokenBuffer = new TokenBuffer(OBJECT_MAPPER, false);
      OBJECT_MAPPER.writeValue(tokenBuffer, value);
      return tokenBuffer;
    } catch (IOException e) {
      throw new RuntimeException("Failed to create JSON token buffer", e);
    }
  }

  public static <T> T readFromTokenBuffer(TokenBuffer tokenBuffer, Class<T> clazz) {
    try (JsonParser parser = tokenBuffer.asParser()) {
      return OBJECT_MAPPER.readValue(parser, clazz);
    } catch (IOException e) {
      throw new RuntimeException("Failed to read JSON token buffer", e);
    }
  }

  public static void overwriteFromTokenBuffer(Object target, TokenBuffer tokenBuffer) {
    try (JsonParser parser = tokenBuffer.asParser()) {
      OBJECT_MAPPER.readerForUpdating(target).readValue(parser);
    } catch (IOException e) {
      throw new RuntimeException("Failed to restore object from JSON token buffer", e);
    }
  }

  public static <T> List<T> deepCopyList(List<T> original, Class<T> clazz) {
    List<T> list = new ArrayList<>(original.size());
    for (T t : original) {
      list.add(deepCopy(t, clazz));
    }
    return list;
  }

  public static ObjectMapper getObjectMapper() {
    return OBJECT_MAPPER;
  }

  static class SortedNodeFactory extends JsonNodeFactory {
    @Override
    public ObjectNode objectNode() {
      return new ObjectNode(this, new TreeMap<>());
    }
  }

  public static <T> T extractValue(String jsonResponse, String... keys) {
    JsonNode jsonNode = JsonUtils.readTree(jsonResponse);
    for (String key : keys) {
      jsonNode = jsonNode.path(key);
    }
    if (jsonNode.isMissingNode() || jsonNode.isNull()) {
      return null;
    }
    try {
      return JsonUtils.treeToValue(jsonNode, (Class<T>) getValueClass(jsonNode));
    } catch (Exception e) {
      return null;
    }
  }

  public static <T> T extractValue(JsonNode jsonNode, String... keys) {
    // Traverse the JSON structure using keys
    for (String key : keys) {
      jsonNode = jsonNode.path(key);
    }

    // Extract the final value
    return JsonUtils.treeToValue(jsonNode, (Class<T>) getValueClass(jsonNode));
  }

  /**
   * Validates the JSON structure against a Java class schema. This method is specifically
   * designed to handle and validate complex JSON data that includes nested JSON objects,
   * addressing limitations of earlier validation methods which did not support nested structures.
   *
   **/
  public static <T> void validateJsonSchema(Object fromValue, Class<T> toValueType) {
    // Convert JSON to Java object
    T convertedValue = OBJECT_MAPPER.convertValue(fromValue, toValueType);

    try (ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory()) {
      Validator validator = validatorFactory.getValidator();

      Set<ConstraintViolation<T>> violations = validator.validate(convertedValue);
      if (!violations.isEmpty()) {
        String detailedErrors =
            violations.stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .collect(Collectors.joining(", "));
        throw new ConstraintViolationException(FAILED_TO_PROCESS_JSON + detailedErrors, violations);
      }
    }
  }

  public static boolean isValidJson(Object obj) {
    if (!(obj instanceof String json)) return false;
    JsonReader reader = Json.createReader(new StringReader(json));
    try {
      reader.readValue();
    } catch (JsonException e) {
      return false;
    }
    return true;
  }

  private static Class<?> getValueClass(JsonNode jsonNode) {
    return switch (jsonNode.getNodeType()) {
      case ARRAY, OBJECT -> JsonNode.class; // Adjust as needed for your use case
      case BINARY -> byte[].class;
      case BOOLEAN -> Boolean.class;
      case NUMBER -> Number.class;
      case STRING -> String.class;
      case MISSING, NULL, POJO -> Object.class;
    };
  }

  public static JsonNode pojoToJsonNode(Object obj) {
    try {
      return OBJECT_MAPPER.valueToTree(obj);
    } catch (Exception e) {
      LOG.error("Failed to convert POJO to JsonNode", e);
      throw new RuntimeException("POJO to JsonNode conversion failed", e);
    }
  }

  @SuppressWarnings("unused")
  public static Map<String, Object> getMapFromJson(String json) {
    return (Map<String, Object>) (JsonUtils.readValue(json, Map.class));
  }

  @SuppressWarnings("unused")
  public static <T> T convertObjectWithFilteredFields(
      Object input, Set<String> fields, Class<T> clazz) {
    Map<String, Object> inputMap = JsonUtils.getMap(input);
    Map<String, Object> result = new HashMap<>();
    for (String field : fields) {
      if (inputMap.containsKey(field)) {
        result.put(field, inputMap.get(field));
      }
    }
    return JsonUtils.convertValue(result, clazz);
  }

  public static JsonPatch convertFgeToJavax(com.github.fge.jsonpatch.JsonPatch fgeJsonPatch) {
    String jsonString = fgeJsonPatch.toString();

    try (JsonReader reader = Json.createReader(new StringReader(jsonString))) {
      JsonArray patchArray = reader.readArray();
      return Json.createPatch(patchArray);
    }
  }

  public static List<String> getJsonDataResources(Pattern pattern) throws IOException {
    return CommonUtil.getResources(pattern);
  }

  /**
   * Jackson module that deserializes every {@link Date} field leniently, accepting ISO-8601 with
   * or without fractional seconds as well as epoch milliseconds. Register it on any ObjectMapper
   * that parses OpenMetadata request bodies so the strict {@link #DATE_TIME_FORMAT} (used for
   * serialization) does not reject inputs lacking microseconds.
   */
  public static SimpleModule lenientDateModule() {
    SimpleModule module = new SimpleModule("OpenMetadataLenientDateModule");
    module.addDeserializer(Date.class, new LenientIsoDateDeserializer());
    return module;
  }

  /**
   * Tolerant Date deserializer. The global ObjectMapper serializes with {@code
   * SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'")}, which strictly requires a 6-digit
   * fractional. Python's {@code datetime.isoformat()} drops the fractional entirely when {@code
   * microsecond == 0}, producing {@code "2026-04-24T10:27:06Z"} that the strict format rejects.
   *
   * <p>This deserializer delegates everything to Jackson's normal path ({@link
   * DeserializationContext#parseDate}, which uses the same global format) so all forms that
   * worked before — JSON numbers, numeric strings, the SDF "…SSSSSSZ" form — keep working. The
   * only addition is: if the value is the bare-second form, pad the fractional with {@code
   * .000000} so the global format accepts it.
   */
  public static final class LenientIsoDateDeserializer extends JsonDeserializer<Date> {
    @Override
    public Date deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
      com.fasterxml.jackson.core.JsonToken t = p.currentToken();
      if (t == com.fasterxml.jackson.core.JsonToken.VALUE_NUMBER_INT
          || t == com.fasterxml.jackson.core.JsonToken.VALUE_NUMBER_FLOAT) {
        return new Date(p.getLongValue());
      }
      if (t == com.fasterxml.jackson.core.JsonToken.VALUE_NULL) {
        return null;
      }
      String value = p.getValueAsString();
      if (value == null) {
        return null;
      }
      String trimmed = value.trim();
      if (trimmed.isEmpty()) {
        return null;
      }
      if (looksLikeEpochMillis(trimmed)) {
        try {
          return new Date(Long.parseLong(trimmed));
        } catch (NumberFormatException ignored) {
          // fall through to date parsing
        }
      }
      String normalized = padBareSecondIso(trimmed);
      try {
        return ctxt.parseDate(normalized);
      } catch (IllegalArgumentException e) {
        return (Date)
            ctxt.handleWeirdStringValue(
                Date.class, value, "Expected ISO-8601 date-time: %s", e.getMessage());
      }
    }

    private static boolean looksLikeEpochMillis(String s) {
      // Epoch-ms for any modern date is 13 digits; 10 digits covers ≥ year 2001.
      // Reject shorter all-digit strings (e.g. compact "YYYYMMDD") to avoid
      // misinterpreting them as epoch-ms. Upper bound matches Long.MAX_VALUE width.
      int start = !s.isEmpty() && s.charAt(0) == '-' ? 1 : 0;
      int digits = s.length() - start;
      if (digits < 10 || digits > 19) {
        return false;
      }
      for (int i = start; i < s.length(); i++) {
        if (!Character.isDigit(s.charAt(i))) {
          return false;
        }
      }
      return true;
    }

    /**
     * If {@code value} matches the bare-second ISO form {@code "yyyy-MM-ddTHH:mm:ssZ"}, pad
     * the fractional with six zeros so the global SimpleDateFormat ({@code "…SSSSSS'Z'"})
     * accepts it. Otherwise return the input unchanged.
     */
    private static String padBareSecondIso(String value) {
      if (value.length() != 20 || !value.endsWith("Z")) {
        return value;
      }
      if (value.charAt(10) != 'T' || value.charAt(13) != ':' || value.charAt(16) != ':') {
        return value;
      }
      return value.substring(0, 19) + ".000000Z";
    }
  }
}
