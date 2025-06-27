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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.fasterxml.jackson.datatype.jsr353.JSR353Module;
import com.github.fge.jsonpatch.JsonPatchException;
import com.github.fge.jsonpatch.diff.JsonDiff;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion.VersionFlag;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import jakarta.json.JsonStructure;
import jakarta.json.JsonValue;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.io.File;
import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.annotations.ExposedField;
import org.openmetadata.annotations.IgnoreMaskedFieldAnnotationIntrospector;
import org.openmetadata.annotations.MaskedField;
import org.openmetadata.annotations.OnlyExposedFieldAnnotationIntrospector;
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
  private static final ObjectMapper OBJECT_MAPPER_LENIENT;
  private static final ObjectMapper EXPOSED_OBJECT_MAPPER;
  private static final ObjectMapper MASKER_OBJECT_MAPPER;
  private static final JsonSchemaFactory schemaFactory =
      JsonSchemaFactory.getInstance(VersionFlag.V7);
  private static final String FAILED_TO_PROCESS_JSON = "Failed to process JSON ";

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
            StreamReadConstraints.builder().maxStringLength(Integer.MAX_VALUE).build());
    // Ensure the date-time fields are serialized in ISO-8601 format
    OBJECT_MAPPER.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    OBJECT_MAPPER.setDateFormat(DATE_TIME_FORMAT);
    OBJECT_MAPPER.registerModule(new JSR353Module());

    // Lenient ObjectMapper to ignore unknown properties
    OBJECT_MAPPER_LENIENT = OBJECT_MAPPER.copy();
    OBJECT_MAPPER_LENIENT.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
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
      ObjectMapper objectMapperIgnoreNull = OBJECT_MAPPER.copy();
      objectMapperIgnoreNull.setSerializationInclusion(
          JsonInclude.Include.NON_NULL); // Ignore null values
      return objectMapperIgnoreNull.writeValueAsString(o);
    } catch (JsonProcessingException e) {
      throw new JsonParsingException(FAILED_TO_PROCESS_JSON, e);
    }
  }

  public static JsonStructure getJsonStructure(Object o) {
    try {
      // Convert object to JSON string using Jackson
      String jsonString = OBJECT_MAPPER.writeValueAsString(o);
      // Parse the JSON string using Jakarta JSON API to get a JsonStructure
      try (JsonReader reader = Json.createReader(new java.io.StringReader(jsonString))) {
        return reader.read();
      }
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

    // ---------------------------------------------------------------------
    // JSON patch modification 1 - Ignore operations related to href patch
    // ---------------------------------------------------------------------
    // Another important modification to patch operation:
    // Ignore all the patch operations related to the href path as href path is read only and is
    // auto generated by removing those operations from patch operation array
    JsonArray array = patch.toJsonArray();

    List<JsonObject> filteredPatchItems = new ArrayList<>();

    array.forEach(
        entry -> {
          JsonObject jsonObject = entry.asJsonObject();
          if (jsonObject.getString("path").endsWith("href")) {
            // Ignore patch operations related to href path
            return;
          }
          filteredPatchItems.add(jsonObject);
        });

    // Build new sorted patch
    JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
    filteredPatchItems.forEach(arrayBuilder::add);
    JsonPatch filteredPatch = Json.createPatch(arrayBuilder.build());

    // Apply sortedPatch
    try {
      return filteredPatch.apply(targetJson);
    } catch (Exception e) {
      LOG.debug("Failed to apply the json patch {}", filteredPatch);
      throw e;
    }
  }

  public static <T> T applyPatch(T original, JsonPatch patch, Class<T> clz) {
    JsonValue value = applyPatch(original, patch);
    // Convert Jakarta JSON JsonValue to Jackson JsonNode
    try {
      String jsonString = value.toString();
      JsonNode jsonNode = OBJECT_MAPPER.readTree(jsonString);
      return OBJECT_MAPPER.convertValue(jsonNode, clz);
    } catch (Exception e) {
      throw new RuntimeException("Failed to convert JsonValue to target class", e);
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
  public static List<Type> getTypes() {
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
        LOG.warn("Failed to initialize the types from jsonSchema file {}", jsonSchema, e);
      }
    }
    return types;
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

  @SneakyThrows
  public static <T> T deepCopy(T original, Class<T> clazz) {
    // Serialize the original object to JSON
    String json = pojoToJson(original);

    // Deserialize the JSON back into a new object of the specified class
    return OBJECT_MAPPER.readValue(json, clazz);
  }

  @SneakyThrows
  public static <T> List<T> deepCopyList(List<T> original, Class<T> clazz) {
    List<T> list = new ArrayList<>();
    for (T t : original) {
      // Serialize the original object to JSON
      String json = pojoToJson(t);
      // Deserialize the JSON back into a new object of the specified class
      list.add(OBJECT_MAPPER.readValue(json, clazz));
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
    ArrayList<String> resources = new ArrayList<>();
    String classPath = System.getProperty("java.class.path", ".");
    Set<String> classPathElements =
        Arrays.stream(classPath.split(File.pathSeparator))
            .filter(
                jarName ->
                    Stream.of("openmetadata", "collate").anyMatch(jarName.toLowerCase()::contains))
            .collect(Collectors.toSet());

    for (String element : classPathElements) {
      File file = new File(element);
      resources.addAll(
          file.isDirectory()
              ? getResourcesFromDirectory(file, pattern)
              : getResourcesFromJarFile(file, pattern));
    }
    return resources;
  }

  private static Collection<String> getResourcesFromDirectory(File file, Pattern pattern)
      throws IOException {
    final Path root = Path.of(file.getPath());
    try (Stream<Path> paths = Files.walk(Paths.get(file.getPath()))) {
      return paths
          .filter(Files::isRegularFile)
          .filter(path -> pattern.matcher(path.toString()).matches())
          .map(
              path -> {
                String relativePath = root.relativize(path).toString();
                LOG.debug("Adding directory file {}", relativePath);
                return relativePath;
              })
          .collect(Collectors.toSet());
    }
  }

  private static Collection<String> getResourcesFromJarFile(File file, Pattern pattern) {
    LOG.debug("Adding from file {}", file);
    ArrayList<String> retval = new ArrayList<>();
    try (ZipFile zf = new ZipFile(file)) {
      Enumeration<? extends ZipEntry> e = zf.entries();
      while (e.hasMoreElements()) {
        String fileName = e.nextElement().getName();
        if (pattern.matcher(fileName).matches()) {
          retval.add(fileName);
          LOG.debug("Adding file from jar {}", fileName);
        }
      }
    } catch (Exception ignored) {
      // Ignored exception
    }
    return retval;
  }
}
