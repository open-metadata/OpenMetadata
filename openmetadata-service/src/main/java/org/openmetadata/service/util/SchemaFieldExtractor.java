package org.openmetadata.service.util;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import jakarta.ws.rs.core.UriInfo;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.everit.json.schema.ArraySchema;
import org.everit.json.schema.BooleanSchema;
import org.everit.json.schema.NullSchema;
import org.everit.json.schema.NumberSchema;
import org.everit.json.schema.ObjectSchema;
import org.everit.json.schema.ReferenceSchema;
import org.everit.json.schema.Schema;
import org.everit.json.schema.StringSchema;
import org.everit.json.schema.loader.SchemaClient;
import org.everit.json.schema.loader.SchemaLoader;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.exception.SchemaProcessingException;
import org.openmetadata.service.jdbi3.TypeRepository;

@Slf4j
public class SchemaFieldExtractor {

  private static final String ENTITY_SCHEMA_DIRECTORY = "json/schema/entity/";
  private static final String DEFAULT_SCHEMA_SUBDIRECTORY = "data";
  private static final String ENTITY_TYPE_ANNOTATION = "@om-entity-type";
  private static final String JSON_FILE_EXTENSION = "json";
  private static final String JSON_FILE_SUFFIX = "." + JSON_FILE_EXTENSION;

  private static final Map<String, Map<String, FieldDefinition>> entityFieldsCache =
      new ConcurrentHashMap<>();

  /**
   * Entity type to the classpath location of its schema, populated by {@link #getAllEntityTypes()}.
   * Discovery and loading therefore read the same directory layout and cannot drift apart.
   */
  private static final Map<String, String> entityTypeToSchemaPath = new ConcurrentHashMap<>();

  /**
   * Entity types intentionally excluded from schema field extraction cache initialization. These
   * entities are not currently supported by the custom-property schema extractor flow.
   */
  private static final Set<String> EXCLUDED_ENTITY_TYPES =
      Set.of("promptTemplate", "agentExecution");

  public SchemaFieldExtractor() {
    initializeEntityFieldsCache();
  }

  private static void initializeEntityFieldsCache() {
    synchronized (entityFieldsCache) {
      if (!entityFieldsCache.isEmpty()) {
        return;
      }
      List<String> entityTypes = getAllEntityTypes();
      for (String entityType : entityTypes) {
        if (EXCLUDED_ENTITY_TYPES.contains(entityType)) {
          // Keep an empty cache entry to avoid null-handling branches downstream.
          entityFieldsCache.put(entityType, new LinkedHashMap<>());
          LOG.debug(
              "Skipping schema extraction cache initialization for entity type '{}'", entityType);
          continue;
        }
        try {
          String schemaPath = determineSchemaPath(entityType);
          String schemaUri = "classpath:///" + schemaPath;
          SchemaClient schemaClient = new CustomSchemaClient(schemaUri);

          // Load the main schema
          Schema mainSchema = loadMainSchema(schemaPath, entityType, schemaUri, schemaClient);

          // Extract fields from the schema
          Map<String, FieldDefinition> fieldTypesMap = new LinkedHashMap<>();
          Deque<Schema> processingStack = new ArrayDeque<>();
          Set<String> processedFields = new HashSet<>();
          extractFieldsFromSchema(mainSchema, "", fieldTypesMap, processingStack, processedFields);

          // Cache the fields for this entityType
          entityFieldsCache.put(entityType, fieldTypesMap);
        } catch (SchemaProcessingException e) {
          LOG.error("Error processing entity type '{}': {}", entityType, e.getMessage());
        }
      }
    }
  }

  public List<FieldDefinition> extractFields(Type typeEntity, String entityType) {
    Map<String, FieldDefinition> fieldTypesMap =
        new LinkedHashMap<>(
            entityFieldsCache.computeIfAbsent(entityType, ignored -> new LinkedHashMap<>()));
    addCustomProperties(typeEntity, fieldTypesMap);
    return convertMapToFieldList(fieldTypesMap);
  }

  /**
   * Returns the custom properties of every entity type, and nothing else. Unlike {@link
   * #extractFields} this is not an "every field of the entity" view, so {@link #entityFieldsCache}
   * must not seed the result — seeding it made the endpoint return the whole JSON schema of every
   * entity type even when no custom property was defined.
   */
  public Map<String, List<FieldDefinition>> extractAllCustomProperties(
      UriInfo uriInfo, TypeRepository repository) {
    Map<String, List<FieldDefinition>> entityTypeToFields = new HashMap<>();
    EntityUtil.Fields fieldsParam = new EntityUtil.Fields(Set.of("customProperties"));
    for (String entityType : entityFieldsCache.keySet()) {
      Type typeEntity = repository.getByName(uriInfo, entityType, fieldsParam, Include.ALL, false);
      Map<String, FieldDefinition> fieldTypesMap = new LinkedHashMap<>();
      addCustomProperties(typeEntity, fieldTypesMap);
      entityTypeToFields.put(entityType, convertMapToFieldList(fieldTypesMap));
    }

    return entityTypeToFields;
  }

  public static List<String> getAllEntityTypes() {
    List<String> entityTypes = new ArrayList<>();

    try (ScanResult scanResult =
        new ClassGraph().acceptPaths(ENTITY_SCHEMA_DIRECTORY).enableMemoryMapping().scan()) {

      for (Resource resource :
          schemasInStableOrder(scanResult.getResourcesWithExtension(JSON_FILE_EXTENSION))) {
        String entityType = registerEntitySchema(resource);
        if (entityType != null) {
          entityTypes.add(entityType);
        }
      }
    } catch (Exception e) {
      LOG.error("Error scanning schema directory: {}", e.getMessage());
    }

    return entityTypes;
  }

  /**
   * Records where an entity schema actually lives so that the loader never has to guess its
   * subdirectory. Returns the entity type, or null when the resource is not an entity schema.
   */
  private static String registerEntitySchema(Resource resource) {
    String entityType = null;
    try (InputStream is = resource.open()) {
      JSONObject jsonSchema = new JSONObject(new JSONTokener(is));
      if (isEntityType(jsonSchema)) {
        entityType = schemaNameOf(resource.getPath());
        recordSchemaPath(entityType, resource.getPath());
        LOG.debug("Found entity type: {} at {}", entityType, resource.getPath());
      }
    } catch (Exception e) {
      LOG.error("Error reading schema file {}: {}", resource.getPath(), e.getMessage());
    }
    return entityType;
  }

  /**
   * ClassGraph does not guarantee a stable order across scans, so schemas are visited by path and
   * the first one to claim an entity type keeps it. Two modules declaring the same entity type then
   * resolve to the same schema on every run rather than to whichever jar was scanned last.
   */
  private static List<Resource> schemasInStableOrder(List<Resource> resources) {
    return resources.stream().sorted(Comparator.comparing(Resource::getPath)).toList();
  }

  private static void recordSchemaPath(String entityType, String schemaPath) {
    String claimedPath = entityTypeToSchemaPath.putIfAbsent(entityType, schemaPath);
    if (claimedPath != null && !claimedPath.equals(schemaPath)) {
      LOG.warn(
          "Entity type '{}' is declared by both '{}' and '{}'. Using '{}'.",
          entityType,
          claimedPath,
          schemaPath,
          claimedPath);
    }
  }

  private static String schemaNameOf(String schemaPath) {
    String fileName = schemaPath.substring(schemaPath.lastIndexOf('/') + 1);
    return fileName.substring(0, fileName.length() - JSON_FILE_SUFFIX.length());
  }

  private static boolean isEntityType(JSONObject jsonSchema) {
    return ENTITY_TYPE_ANNOTATION.equals(jsonSchema.optString("$comment"));
  }

  private static Schema loadMainSchema(
      String schemaPath, String entityType, String schemaUri, SchemaClient schemaClient)
      throws SchemaProcessingException {
    InputStream schemaInputStream =
        SchemaFieldExtractor.class.getClassLoader().getResourceAsStream(schemaPath);
    if (schemaInputStream == null) {
      LOG.error("Schema file not found at path: {}", schemaPath);
      throw new SchemaProcessingException(
          "Schema file not found for entity type: " + entityType,
          SchemaProcessingException.ErrorType.RESOURCE_NOT_FOUND);
    }

    JSONObject rawSchema = new JSONObject(new JSONTokener(schemaInputStream));
    SchemaLoader schemaLoader =
        SchemaLoader.builder()
            .schemaJson(rawSchema)
            .resolutionScope(schemaUri)
            .schemaClient(schemaClient)
            .build();

    try {
      Schema schema = schemaLoader.load().build();
      LOG.debug("Schema '{}' loaded successfully.", schemaPath);
      return schema;
    } catch (Exception e) {
      LOG.error("Error loading schema '{}': {}", schemaPath, e.getMessage());
      throw new SchemaProcessingException(
          "Error loading schema '" + schemaPath + "': " + e.getMessage(),
          SchemaProcessingException.ErrorType.OTHER);
    }
  }

  private static void extractFieldsFromSchema(
      Schema schema,
      String parentPath,
      Map<String, FieldDefinition> fieldTypesMap,
      Deque<Schema> processingStack,
      Set<String> processedFields) {
    if (processingStack.contains(schema)) {
      LOG.debug(
          "Detected cyclic reference at path '{}'. Skipping further processing of this schema.",
          parentPath);
      return;
    }

    processingStack.push(schema);
    try {
      if (schema instanceof ObjectSchema objectSchema) {
        for (Map.Entry<String, Schema> propertyEntry :
            objectSchema.getPropertySchemas().entrySet()) {
          String fieldName = propertyEntry.getKey();
          Schema fieldSchema = propertyEntry.getValue();
          String fullFieldName = parentPath.isEmpty() ? fieldName : parentPath + "." + fieldName;

          if (processedFields.contains(fullFieldName)) {
            LOG.debug(
                "Field '{}' has already been processed. Skipping to prevent duplication.",
                fullFieldName);
            continue;
          }

          LOG.debug("Processing field '{}'", fullFieldName);

          if (fieldSchema instanceof ReferenceSchema referenceSchema) {
            handleReferenceSchema(
                referenceSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
          } else if (fieldSchema instanceof ArraySchema arraySchema) {
            handleArraySchema(
                arraySchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
          } else {
            String fieldType = mapSchemaTypeToSimpleType(fieldSchema);
            fieldTypesMap.putIfAbsent(
                fullFieldName, FieldDefinition.of(fullFieldName, fullFieldName, fieldType, null));
            processedFields.add(fullFieldName);
            LOG.debug("Added field '{}', Type: '{}'", fullFieldName, fieldType);
            // Recursively process nested objects or arrays
            if (fieldSchema instanceof ObjectSchema || fieldSchema instanceof ArraySchema) {
              extractFieldsFromSchema(
                  fieldSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
            }
          }
        }
      } else if (schema instanceof ArraySchema arraySchema) {
        handleArraySchema(arraySchema, parentPath, fieldTypesMap, processingStack, processedFields);
      } else {
        String fieldType = mapSchemaTypeToSimpleType(schema);
        fieldTypesMap.putIfAbsent(
            parentPath, FieldDefinition.of(parentPath, parentPath, fieldType, null));
        LOG.debug("Added field '{}', Type: '{}'", parentPath, fieldType);
      }
    } finally {
      processingStack.pop();
    }
  }

  private static void handleReferenceSchema(
      ReferenceSchema referenceSchema,
      String fullFieldName,
      Map<String, FieldDefinition> fieldTypesMap,
      Deque<Schema> processingStack,
      Set<String> processedFields) {

    String refUri = referenceSchema.getReferenceValue();
    String referenceType = determineReferenceType(refUri);

    if (referenceType != null) {
      fieldTypesMap.putIfAbsent(
          fullFieldName, FieldDefinition.of(fullFieldName, fullFieldName, referenceType, null));
      processedFields.add(fullFieldName);
      LOG.debug("Added field '{}', Type: '{}'", fullFieldName, referenceType);
      if (referenceType.startsWith("array<") && referenceType.endsWith(">")) {
        Schema itemSchema =
            referenceSchema.getReferredSchema() instanceof ArraySchema
                ? ((ArraySchema) referenceSchema.getReferredSchema()).getAllItemSchema()
                : referenceSchema.getReferredSchema();
        extractFieldsFromSchema(
            itemSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
      } else if (!isPrimitiveType(referenceType)) {
        Schema referredSchema = referenceSchema.getReferredSchema();
        extractFieldsFromSchema(
            referredSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
      }
    } else {
      fieldTypesMap.putIfAbsent(
          fullFieldName, FieldDefinition.of(fullFieldName, fullFieldName, "object", null));
      processedFields.add(fullFieldName);
      LOG.debug("Added field '{}', Type: 'object'", fullFieldName);
      extractFieldsFromSchema(
          referenceSchema.getReferredSchema(),
          fullFieldName,
          fieldTypesMap,
          processingStack,
          processedFields);
    }
  }

  private static void handleArraySchema(
      ArraySchema arraySchema,
      String fullFieldName,
      Map<String, FieldDefinition> fieldTypesMap,
      Deque<Schema> processingStack,
      Set<String> processedFields) {

    Schema itemsSchema = arraySchema.getAllItemSchema();

    if (itemsSchema instanceof ReferenceSchema itemsReferenceSchema) {
      String itemsRefUri = itemsReferenceSchema.getReferenceValue();
      String itemsReferenceType = determineReferenceType(itemsRefUri);

      if (itemsReferenceType != null) {
        String arrayFieldType = "array<" + itemsReferenceType + ">";
        fieldTypesMap.putIfAbsent(
            fullFieldName, FieldDefinition.of(fullFieldName, fullFieldName, arrayFieldType, null));
        processedFields.add(fullFieldName);
        LOG.debug("Added field '{}', Type: '{}'", fullFieldName, arrayFieldType);
        Schema referredItemsSchema = itemsReferenceSchema.getReferredSchema();
        extractFieldsFromSchema(
            referredItemsSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
        return;
      }
    }
    String arrayType = mapSchemaTypeToSimpleType(itemsSchema);
    fieldTypesMap.putIfAbsent(
        fullFieldName,
        FieldDefinition.of(fullFieldName, fullFieldName, "array<" + arrayType + ">", null));
    processedFields.add(fullFieldName);
    LOG.debug("Added field '{}', Type: 'array<{}>'", fullFieldName, arrayType);

    if (itemsSchema instanceof ObjectSchema || itemsSchema instanceof ArraySchema) {
      extractFieldsFromSchema(
          itemsSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
    }
  }

  private void addCustomProperties(Type typeEntity, Map<String, FieldDefinition> fieldTypesMap) {
    if (typeEntity == null || typeEntity.getCustomProperties() == null) {
      return;
    }

    for (CustomProperty customProperty : typeEntity.getCustomProperties()) {
      String propertyName = customProperty.getName();
      String propertyType = resolveCustomPropertyType(customProperty.getPropertyType().getName());
      FieldDefinition fieldDef =
          FieldDefinition.of(
              propertyName,
              customProperty.getDisplayName(),
              propertyType,
              customProperty.getCustomPropertyConfig());
      fieldTypesMap.putIfAbsent(propertyName, fieldDef);
      LOG.debug("Added custom property '{}', Type: '{}'", propertyName, propertyType);
    }
  }

  private String resolveCustomPropertyType(String propertyType) {
    String resolvedType = propertyType;
    if (isEntityReferenceList(propertyType)) {
      resolvedType = "array<entityReference>";
    } else if (isEntityReference(propertyType)) {
      resolvedType = "entityReference";
    }
    return resolvedType;
  }

  private List<FieldDefinition> convertMapToFieldList(Map<String, FieldDefinition> fieldTypesMap) {
    List<FieldDefinition> fieldsList = new ArrayList<>();
    for (Map.Entry<String, FieldDefinition> entry : fieldTypesMap.entrySet()) {
      FieldDefinition fieldDef = entry.getValue();
      fieldsList.add(
          FieldDefinition.of(
              fieldDef.getName(),
              fieldDef.getDisplayName(),
              fieldDef.getType(),
              fieldDef.getCustomPropertyConfig()));
    }
    return fieldsList;
  }

  private boolean isEntityReferenceList(String propertyType) {
    return "entityReferenceList".equalsIgnoreCase(propertyType);
  }

  private boolean isEntityReference(String propertyType) {
    return "entityReference".equalsIgnoreCase(propertyType);
  }

  private Schema resolveSchemaByType(String typeName, String schemaUri, SchemaClient schemaClient) {
    String referencePath = determineReferencePath(typeName);
    try {
      return loadSchema(referencePath, schemaUri, schemaClient);
    } catch (SchemaProcessingException e) {
      LOG.error("Failed to load schema for type '{}': {}", typeName, e.getMessage());
      return null;
    }
  }

  private Schema loadSchema(String schemaPath, String schemaUri, SchemaClient schemaClient)
      throws SchemaProcessingException {
    InputStream schemaInputStream = getClass().getClassLoader().getResourceAsStream(schemaPath);
    if (schemaInputStream == null) {
      LOG.error("Schema file not found at path: {}", schemaPath);
      throw new SchemaProcessingException(
          "Schema file not found for path: " + schemaPath,
          SchemaProcessingException.ErrorType.RESOURCE_NOT_FOUND);
    }

    JSONObject rawSchema = new JSONObject(new JSONTokener(schemaInputStream));
    SchemaLoader schemaLoader =
        SchemaLoader.builder()
            .schemaJson(rawSchema)
            .resolutionScope(schemaUri) // Base URI for resolving $ref
            .schemaClient(schemaClient)
            .build();

    try {
      Schema schema = schemaLoader.load().build();
      LOG.debug("Schema '{}' loaded successfully.", schemaPath);
      return schema;
    } catch (Exception e) {
      LOG.error("Error loading schema '{}': {}", schemaPath, e.getMessage());
      throw new SchemaProcessingException(
          "Error loading schema '" + schemaPath + "': " + e.getMessage(),
          SchemaProcessingException.ErrorType.OTHER);
    }
  }

  private static String determineReferenceType(String refUri) {
    // Handle internal schema references first (e.g., #/definitions/column,
    // #/definitions/tableConstraint, etc.)
    if (refUri.startsWith("#/definitions/")) {
      String definitionName = refUri.substring("#/definitions/".length());
      LOG.debug("Found internal schema reference: {}", definitionName);
      // Return the definition name as the type - this preserves the actual type name
      return definitionName;
    }

    // Pattern to extract the definition name if present from external files
    Pattern definitionPattern = Pattern.compile("^(?:.*/)?basic\\.json#/definitions/([\\w-]+)$");
    Matcher matcher = definitionPattern.matcher(refUri);
    if (matcher.find()) {
      String definition = matcher.group(1);
      return switch (definition) {
        case "duration" -> "duration";
        case "markdown" -> "markdown";
        case "timestamp" -> "timestamp";
        case "integer" -> "integer";
        case "number" -> "number";
        case "string" -> "string";
        case "uuid" -> "uuid";
        case "email" -> "email";
        case "href" -> "href";
        case "timeInterval" -> "timeInterval";
        case "date" -> "date";
        case "impersonatedBy" -> "impersonatedBy";
        case "dateTime" -> "dateTime";
        case "time" -> "time";
        case "date-cp" -> "date-cp";
        case "dateTime-cp" -> "dateTime-cp";
        case "time-cp" -> "time-cp";
        case "enum" -> "enum";
        case "enumWithDescriptions" -> "enumWithDescriptions";
        case "timezone" -> "timezone";
        case "entityLink" -> "entityLink";
        case "entityName" -> "entityName";
        case "testCaseEntityName" -> "testCaseEntityName";
        case "fullyQualifiedEntityName" -> "fullyQualifiedEntityName";
        case "sqlQuery" -> "sqlQuery";
        case "sqlFunction" -> "sqlFunction";
        case "expression" -> "expression";
        case "jsonSchema" -> "jsonSchema";
        case "entityExtension" -> "entityExtension";
        case "providerType" -> "providerType";
        case "componentConfig" -> "componentConfig";
        case "semanticsRule" -> "semanticsRule";
        case "status" -> "status";
        case "sourceUrl" -> "sourceUrl";
        case "style" -> "style";
        default -> {
          LOG.warn("Unrecognized definition '{}' in refUri '{}'", definition, refUri);
          yield "object";
        }
      };
    }

    // Existing file-based mappings
    if (refUri.matches(".*basic\\.json$")) {
      return "uuid";
    }
    if (refUri.matches(".*entityReference\\.json(?:#.*)?$")) {
      return "entityReference";
    }
    if (refUri.matches(".*entityReferenceList\\.json(?:#.*)?$")) {
      return "array<entityReference>";
    }
    if (refUri.matches(".*tagLabel\\.json(?:#.*)?$")) {
      return "tagLabel";
    }
    if (refUri.matches(".*fullyQualifiedEntityName\\.json(?:#.*)?$")) {
      return "fullyQualifiedEntityName";
    }
    if (refUri.matches(".*entityVersion\\.json(?:#.*)?$")) {
      return "entityVersion";
    }
    if (refUri.matches(".*markdown\\.json(?:#.*)?$")) {
      return "markdown";
    }
    if (refUri.matches(".*timestamp\\.json(?:#.*)?$")) {
      return "timestamp";
    }
    if (refUri.matches(".*href\\.json(?:#.*)?$")) {
      return "href";
    }
    if (refUri.matches(".*duration\\.json(?:#.*)?$")) {
      return "duration";
    }
    return null;
  }

  private static String mapSchemaTypeToSimpleType(Schema schema) {
    if (schema == null) {
      LOG.debug("Mapping type: null -> 'object'");
      return "object";
    }
    if (schema instanceof StringSchema) {
      LOG.debug("Mapping schema instance '{}' to 'string'", schema.getClass().getSimpleName());
      return "string";
    } else if (schema instanceof NumberSchema numberSchema) {
      if (numberSchema.requiresInteger()) {
        LOG.debug("Mapping schema instance '{}' to 'integer'", schema.getClass().getSimpleName());
        return "integer";
      } else {
        LOG.debug("Mapping schema instance '{}' to 'number'", schema.getClass().getSimpleName());
        return "number";
      }
    } else if (schema instanceof BooleanSchema) {
      LOG.debug("Mapping schema instance '{}' to 'boolean'", schema.getClass().getSimpleName());
      return "boolean";
    } else if (schema instanceof ObjectSchema) {
      LOG.debug("Mapping schema instance '{}' to 'object'", schema.getClass().getSimpleName());
      return "object";
    } else if (schema instanceof ArraySchema) {
      LOG.debug("Mapping schema instance '{}' to 'array'", schema.getClass().getSimpleName());
      return "array";
    } else if (schema instanceof NullSchema) {
      LOG.debug("Mapping schema instance '{}' to 'null'", schema.getClass().getSimpleName());
      return "null";
    } else {
      LOG.debug(
          "Mapping unknown schema instance '{}' to 'string'", schema.getClass().getSimpleName());
      return "string";
    }
  }

  private static boolean isPrimitiveType(String type) {
    return type.equals("string")
        || type.equals("integer")
        || type.equals("number")
        || type.equals("boolean")
        || type.equals("uuid")
        || // Treat 'uuid' as a primitive type
        type.equals("timestamp")
        || type.equals("href")
        || type.equals("duration")
        || type.equals("date")
        || type.equals("dateTime")
        || type.equals("time")
        || type.equals("date-cp")
        || type.equals("dateTime-cp")
        || type.equals("time-cp")
        || type.equals("enum")
        || type.equals("enumWithDescriptions")
        || type.equals("timezone")
        || type.equals("entityLink")
        || type.equals("entityName")
        || type.equals("testCaseEntityName")
        || type.equals("fullyQualifiedEntityName")
        || type.equals("sqlQuery")
        || type.equals("sqlFunction")
        || type.equals("expression")
        || type.equals("jsonSchema")
        || type.equals("entityExtension")
        || type.equals("providerType")
        || type.equals("componentConfig")
        || type.equals("status")
        || type.equals("sourceUrl")
        || type.equals("style");
  }

  private String determineReferencePath(String typeName) {
    String baseSchemaDirectory = "json/schema/type/";
    String schemaFileName = typeName + ".json";
    return baseSchemaDirectory + schemaFileName;
  }

  /**
   * Resolves the schema path recorded while scanning {@value #ENTITY_SCHEMA_DIRECTORY}. Entity types
   * the scan never discovered (schemas without the {@value #ENTITY_TYPE_ANNOTATION} annotation, still
   * reachable through the {@code /fields/{entityType}} endpoint) keep the historical
   * {@value #DEFAULT_SCHEMA_SUBDIRECTORY} subdirectory assumption.
   */
  private static String determineSchemaPath(String entityType) {
    String discoveredPath = discoveredSchemaPaths().get(entityType);
    return discoveredPath != null
        ? discoveredPath
        : ENTITY_SCHEMA_DIRECTORY
            + DEFAULT_SCHEMA_SUBDIRECTORY
            + "/"
            + entityType
            + JSON_FILE_SUFFIX;
  }

  private static Map<String, String> discoveredSchemaPaths() {
    if (entityTypeToSchemaPath.isEmpty()) {
      getAllEntityTypes();
    }
    return entityTypeToSchemaPath;
  }

  @Slf4j
  private static class CustomSchemaClient implements SchemaClient {
    private final String baseUri;

    public CustomSchemaClient(String baseUri) {
      this.baseUri = baseUri;
    }

    @Override
    public InputStream get(String url) {
      LOG.debug("SchemaClient: Resolving URL '{}' against base URI '{}'", url, baseUri);
      String resourcePath = mapUrlToResourcePath(url);
      LOG.debug("SchemaClient: Loading resource from path '{}'", resourcePath);
      InputStream is = getClass().getClassLoader().getResourceAsStream(resourcePath);
      if (is == null) {
        LOG.error("Resource not found: {}", resourcePath);
        throw new RuntimeException("Resource not found: " + resourcePath);
      }
      return is;
    }

    private String mapUrlToResourcePath(String url) {
      if (url.startsWith("https://open-metadata.org/schema/")) {
        String relativePath = url.substring("https://open-metadata.org/schema/".length());
        return "json/schema/" + relativePath;
      } else {
        throw new RuntimeException("Unsupported URL: " + url);
      }
    }
  }

  @lombok.Getter
  @lombok.Setter
  public static class FieldDefinition {
    private String name;
    private String displayName;
    private String type;
    private Object customPropertyConfig;

    public FieldDefinition(String name, String type, Object customPropertyConfig) {
      this.name = name;
      this.displayName = name;
      this.type = type;
      this.customPropertyConfig = customPropertyConfig;
    }

    public FieldDefinition(
        String name, String displayName, String type, Object customPropertyConfig) {
      this.name = name;
      this.displayName = displayName;
      this.type = type;
      this.customPropertyConfig = customPropertyConfig;
    }

    public static FieldDefinition of(
        String name, String displayName, String type, Object customPropertyConfig) {
      return new FieldDefinition(name, displayName, type, customPropertyConfig);
    }
  }
}
