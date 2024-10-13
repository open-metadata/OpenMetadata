package org.openmetadata.service.util;

import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.openmetadata.sdk.exception.SchemaProcessingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SchemaFieldExtractor {
  private static final Logger LOG = LoggerFactory.getLogger(SchemaFieldExtractor.class);

  private final Type typeEntity;
  private final String entityType;
  private final String schemaPath;
  private final String schemaUri;
  private final SchemaClient schemaClient;

  public SchemaFieldExtractor(Type typeEntity, String entityType) {
    this.typeEntity = typeEntity;
    this.entityType = entityType;
    this.schemaPath = determineSchemaPath(entityType);
    this.schemaUri = "classpath:///" + schemaPath;
    this.schemaClient = new CustomSchemaClient(schemaUri);
  }

  public List<FieldDefinition> extractFields() throws SchemaProcessingException {
    Map<String, String> fieldTypesMap = new LinkedHashMap<>();
    Deque<Schema> processingStack = new ArrayDeque<>();
    Set<String> processedFields = new HashSet<>();

    InputStream schemaInputStream = getClass().getClassLoader().getResourceAsStream(schemaPath);
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
            .resolutionScope(schemaUri) // Base URI for resolving $ref
            .schemaClient(schemaClient)
            .build();

    try {
      Schema schema = schemaLoader.load().build();
      extractFieldsFromSchema(schema, "", fieldTypesMap, processingStack, processedFields);
    } catch (RuntimeException e) {
      Throwable cause = e.getCause();
      if (cause instanceof SchemaProcessingException schemaException) {
        LOG.error("Schema processing error: {}", schemaException.getMessage());
        throw schemaException;
      } else {
        LOG.error("Unexpected error during schema processing: {}", e.getMessage());
        throw new SchemaProcessingException(
            "Unexpected error during schema processing: " + e.getMessage(),
            SchemaProcessingException.ErrorType.OTHER);
      }
    }

    List<FieldDefinition> fieldsList = new ArrayList<>();
    for (Map.Entry<String, String> entry : fieldTypesMap.entrySet()) {
      fieldsList.add(new FieldDefinition(entry.getKey(), entry.getValue()));
    }

    if (typeEntity != null && typeEntity.getCustomProperties() != null) {
      for (CustomProperty customProperty : typeEntity.getCustomProperties()) {
        String propertyName = customProperty.getName();
        String propertyType = customProperty.getPropertyType().getName();
        fieldsList.add(new FieldDefinition(propertyName, propertyType));
      }
    }

    return fieldsList;
  }

  private void extractFieldsFromSchema(
      Schema schema,
      String parentPath,
      Map<String, String> fieldTypesMap,
      Deque<Schema> processingStack,
      Set<String> processedFields) {
    if (processingStack.contains(schema)) {
      LOG.debug(
          "Detected cyclic reference at path '{}'. Skipping further processing of this schema.",
          parentPath);
      return;
    }

    processingStack.push(schema);
    if (schema instanceof ObjectSchema objectSchema) {
      for (Map.Entry<String, Schema> propertyEntry : objectSchema.getPropertySchemas().entrySet()) {
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
          String refUri = referenceSchema.getReferenceValue();
          String referenceType = determineReferenceType(refUri);

          if (referenceType != null) {
            Schema referredSchema = referenceSchema.getReferredSchema();
            String fieldType = referenceType;
            fieldTypesMap.putIfAbsent(fullFieldName, fieldType);
            processedFields.add(fullFieldName);
            LOG.debug("Added field '{}', Type: '{}'", fullFieldName, fieldType);

            if (referenceType.startsWith("array<") && referenceType.endsWith(">")) {
              String itemType =
                  referenceType.substring("array<".length(), referenceType.length() - 1);
              Schema itemSchema =
                  referredSchema instanceof ArraySchema
                      ? ((ArraySchema) referredSchema).getAllItemSchema()
                      : referredSchema;
              extractFieldsFromSchema(
                  itemSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
            } else {
              extractFieldsFromSchema(
                  referredSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
            }

            continue;
          }
        }

        if (fieldSchema instanceof ArraySchema arraySchema) {
          Schema itemsSchema = arraySchema.getAllItemSchema();

          if (itemsSchema instanceof ReferenceSchema itemsReferenceSchema) {
            String itemsRefUri = itemsReferenceSchema.getReferenceValue();
            String itemsReferenceType = determineReferenceType(itemsRefUri);

            if (itemsReferenceType != null) {
              String arrayFieldType = "array<" + itemsReferenceType + ">";
              fieldTypesMap.putIfAbsent(fullFieldName, arrayFieldType);
              processedFields.add(fullFieldName);
              LOG.debug("Added field '{}', Type: '{}'", fullFieldName, arrayFieldType);
              Schema referredItemsSchema = itemsReferenceSchema.getReferredSchema();
              extractFieldsFromSchema(
                  referredItemsSchema,
                  fullFieldName,
                  fieldTypesMap,
                  processingStack,
                  processedFields);
              continue;
            }
          }
          String arrayType = mapSchemaTypeToSimpleType(itemsSchema);
          fieldTypesMap.putIfAbsent(fullFieldName, "array<" + arrayType + ">");
          processedFields.add(fullFieldName);
          LOG.debug("Added field '{}', Type: '{}'", fullFieldName, "array<" + arrayType + ">");

          extractFieldsFromSchema(
              itemsSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
          continue; // Skip further processing for this field
        }

        String fieldType = mapSchemaTypeToSimpleType(fieldSchema);
        fieldTypesMap.putIfAbsent(fullFieldName, fieldType);
        processedFields.add(fullFieldName);
        LOG.debug("Added field '{}', Type: '{}'", fullFieldName, fieldType);

        if (fieldSchema instanceof ObjectSchema || fieldSchema instanceof ArraySchema) {
          extractFieldsFromSchema(
              fieldSchema, fullFieldName, fieldTypesMap, processingStack, processedFields);
        }
      }
    } else if (schema instanceof ArraySchema arraySchema) {
      Schema itemsSchema = arraySchema.getAllItemSchema();
      if (itemsSchema instanceof ReferenceSchema itemsReferenceSchema) {
        String itemsRefUri = itemsReferenceSchema.getReferenceValue();
        String itemsReferenceType = determineReferenceType(itemsRefUri);

        if (itemsReferenceType != null) {
          String arrayFieldType = "array<" + itemsReferenceType + ">";
          fieldTypesMap.putIfAbsent(parentPath, arrayFieldType);
          processedFields.add(parentPath);
          LOG.debug("Added field '{}', Type: '{}'", parentPath, arrayFieldType);

          Schema referredItemsSchema = itemsReferenceSchema.getReferredSchema();
          extractFieldsFromSchema(
              referredItemsSchema, parentPath, fieldTypesMap, processingStack, processedFields);
          return;
        }
      }

      String arrayType = mapSchemaTypeToSimpleType(itemsSchema);
      fieldTypesMap.putIfAbsent(parentPath, "array<" + arrayType + ">");
      processedFields.add(parentPath);
      LOG.debug("Added field '{}', Type: '{}'", parentPath, "array<" + arrayType + ">");
      extractFieldsFromSchema(
          itemsSchema, parentPath, fieldTypesMap, processingStack, processedFields);
    } else {
      String fieldType = mapSchemaTypeToSimpleType(schema);
      fieldTypesMap.putIfAbsent(parentPath, fieldType);
      LOG.debug("Added field '{}', Type: '{}'", parentPath, fieldType);
    }
    processingStack.pop();
  }

  private String determineReferenceType(String refUri) {
    if (refUri.matches(".*entityReference\\.json(?:#.*)?$")) {
      return "entityReference";
    }
    if (refUri.matches(".*entityReferenceList\\.json(?:#.*)?$")) {
      return "entityReference";
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
    return null;
  }

  private String mapSchemaTypeToSimpleType(Schema schema) {
    if (schema == null) {
      return "object";
    }
    if (schema instanceof StringSchema) {
      return "string";
    } else if (schema instanceof NumberSchema numberSchema) {
      if (numberSchema.requiresInteger()) {
        return "integer";
      } else {
        return "number";
      }
    } else if (schema instanceof BooleanSchema) {
      return "boolean";
    } else if (schema instanceof ObjectSchema) {
      return "object";
    } else if (schema instanceof ArraySchema) {
      return "array";
    } else if (schema instanceof NullSchema) {
      return "null";
    } else {
      // Default case for other schema types
      return "string";
    }
  }

  private String determineSchemaPath(String entityType) {
    String subdirectory = getEntitySubdirectory(entityType);
    return "json/schema/entity/" + subdirectory + "/" + entityType + ".json";
  }

  private String getEntitySubdirectory(String entityType) {
    Map<String, String> entityTypeToSubdirectory =
        Map.of(
            "dashboard", "data",
            "table", "data",
            "pipeline", "services");
    return entityTypeToSubdirectory.getOrDefault(entityType, "data");
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
    private String type;

    public FieldDefinition(String name, String type) {
      this.name = name;
      this.type = type;
    }
  }
}
