/*
 *  Copyright 2024 Collate
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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import jakarta.validation.ConstraintViolationException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAccessor;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map.Entry;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.schema.type.customProperties.TableConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;

/**
 * Validates and transforms custom-property ("extension") values against the JSON schema and
 * type-specific rules registered for an entity type. Extracted from EntityRepository: these are pure
 * static validators with no entity-instance state, sitting next to their {@link EntityUtil}
 * custom-property-reference siblings.
 */
public final class CustomPropertyValidator {

  private CustomPropertyValidator() {}

  public static void validateExtension(Object extension, String entityTypeName) {
    if (extension == null) {
      return;
    }

    JsonNode jsonNode = JsonUtils.valueToTree(extension);
    Iterator<Entry<String, JsonNode>> customFields = jsonNode.fields();

    while (customFields.hasNext()) {
      Entry<String, JsonNode> entry = customFields.next();
      String fieldName = entry.getKey();
      JsonNode fieldValue = entry.getValue();

      // Validate that the custom property exists for this entity type
      Schema jsonSchema = TypeRegistry.instance().getSchema(entityTypeName, fieldName);
      if (jsonSchema == null) {
        throw new IllegalArgumentException(CatalogExceptionMessage.unknownCustomField(fieldName));
      }

      // Validate against JSON schema - this handles all validation including type-specific rules
      List<Error> validationMessages = jsonSchema.validate(fieldValue);
      if (!validationMessages.isEmpty()) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.jsonValidationError(fieldName, validationMessages.toString()));
      }
    }
  }

  public static Object validateAndTransformExtension(Object extension, String entityTypeName) {
    if (extension == null) {
      return null;
    }

    // Validate custom properties existence and schema compliance
    validateExtension(extension, entityTypeName);

    // Apply property type-specific transformations (date formatting, enum sorting, etc.)
    JsonNode extensionNode = JsonUtils.valueToTree(extension);
    if (!extensionNode.isObject()) {
      return null;
    }
    ObjectNode jsonNode = (ObjectNode) extensionNode;
    Iterator<Entry<String, JsonNode>> customFields = jsonNode.fields();

    while (customFields.hasNext()) {
      Entry<String, JsonNode> entry = customFields.next();
      String fieldName = entry.getKey();
      JsonNode fieldValue = entry.getValue();

      String customPropertyType = TypeRegistry.getCustomPropertyType(entityTypeName, fieldName);
      String propertyConfig = TypeRegistry.getCustomPropertyConfig(entityTypeName, fieldName);

      switch (customPropertyType) {
        case "date-cp", "dateTime-cp", "time-cp" -> {
          String formattedValue =
              getFormattedDateTimeField(
                  fieldValue.textValue(), customPropertyType, propertyConfig, fieldName);
          jsonNode.put(fieldName, formattedValue);
        }
        case "table-cp" -> validateTableType(fieldValue, propertyConfig, fieldName);
        case "enum" -> {
          validateEnumKeys(fieldName, fieldValue, propertyConfig);
          List<String> enumValues =
              StreamSupport.stream(fieldValue.spliterator(), false)
                  .map(JsonNode::asText)
                  .sorted()
                  .collect(Collectors.toList());
          jsonNode.set(fieldName, JsonUtils.valueToTree(enumValues));
        }
        case "hyperlink-cp" -> validateHyperlinkUrl(fieldValue, fieldName);
        case "entityReference" -> EntityUtil.validateCustomPropertyEntityReference(
            fieldValue, fieldName);
        case "entityReferenceList" -> EntityUtil.validateCustomPropertyEntityReferenceList(
            fieldValue, fieldName);
        default -> {}
      }
    }

    return JsonUtils.treeToValue(jsonNode, Object.class);
  }

  private static void validateHyperlinkUrl(JsonNode fieldValue, String fieldName) {
    if (fieldValue == null || fieldValue.isNull()) {
      return;
    }
    JsonNode urlNode = fieldValue.get("url");
    if (urlNode == null || urlNode.isNull() || urlNode.asText().isEmpty()) {
      return;
    }
    String url = urlNode.asText();
    try {
      java.net.URI uri = new java.net.URI(url);
      String scheme = uri.getScheme();
      if (scheme == null
          || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
        throw new IllegalArgumentException(
            String.format(
                "Invalid URL protocol for field '%s': URL must use http or https protocol",
                fieldName));
      }
    } catch (java.net.URISyntaxException e) {
      throw new IllegalArgumentException(
          String.format("Invalid URL format for field '%s': %s", fieldName, e.getMessage()));
    }
  }

  private static String getFormattedDateTimeField(
      String fieldValue, String customPropertyType, String propertyConfig, String fieldName) {
    DateTimeFormatter formatter;

    try {
      return switch (customPropertyType) {
        case "date-cp" -> {
          DateTimeFormatter inputFormatter =
              DateTimeFormatter.ofPattern(propertyConfig, Locale.ENGLISH);
          TemporalAccessor date = inputFormatter.parse(fieldValue);
          DateTimeFormatter outputFormatter =
              DateTimeFormatter.ofPattern(propertyConfig, Locale.ENGLISH);
          yield outputFormatter.format(date);
        }
        case "dateTime-cp" -> {
          formatter = DateTimeFormatter.ofPattern(propertyConfig);
          LocalDateTime dateTime = LocalDateTime.parse(fieldValue, formatter);
          yield dateTime.format(formatter);
        }
        case "time-cp" -> {
          formatter = DateTimeFormatter.ofPattern(propertyConfig);
          LocalTime time = LocalTime.parse(fieldValue, formatter);
          yield time.format(formatter);
        }
        default -> throw new IllegalArgumentException(
            "Unsupported customPropertyType: " + customPropertyType);
      };
    } catch (DateTimeParseException e) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.dateTimeValidationError(fieldName, propertyConfig));
    }
  }

  private static void validateTableType(
      JsonNode fieldValue, String propertyConfig, String fieldName) {
    TableConfig tableConfig =
        JsonUtils.convertValue(JsonUtils.readTree(propertyConfig), TableConfig.class);
    org.openmetadata.schema.type.customProperties.Table tableValue =
        JsonUtils.convertValue(
            JsonUtils.readTree(String.valueOf(fieldValue)),
            org.openmetadata.schema.type.customProperties.Table.class);
    Set<String> configColumns = tableConfig.getColumns();

    try {
      JsonUtils.validateJsonSchema(
          tableValue, org.openmetadata.schema.type.customProperties.Table.class);

      Set<String> fieldColumns = new HashSet<>();
      fieldValue.get("columns").forEach(column -> fieldColumns.add(column.asText()));

      Set<String> undefinedColumns = new HashSet<>(fieldColumns);
      undefinedColumns.removeAll(configColumns);
      if (!undefinedColumns.isEmpty()) {
        throw new IllegalArgumentException(
            "Expected columns: "
                + configColumns
                + ", but found undefined columns: "
                + undefinedColumns);
      }

      Set<String> rowFieldNames = new HashSet<>();
      fieldValue.get("rows").forEach(row -> row.fieldNames().forEachRemaining(rowFieldNames::add));

      undefinedColumns = new HashSet<>(rowFieldNames);
      undefinedColumns.removeAll(configColumns);
      if (!undefinedColumns.isEmpty()) {
        throw new IllegalArgumentException("Rows contain undefined columns: " + undefinedColumns);
      }
    } catch (ConstraintViolationException e) {
      String validationErrors =
          e.getConstraintViolations().stream()
              .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
              .collect(Collectors.joining(", "));

      throw new IllegalArgumentException(
          CatalogExceptionMessage.jsonValidationError(fieldName, validationErrors));
    }
  }

  public static void validateEnumKeys(
      String fieldName, JsonNode fieldValue, String propertyConfig) {
    JsonNode propertyConfigNode = JsonUtils.readTree(propertyConfig);
    EnumConfig config = JsonUtils.treeToValue(propertyConfigNode, EnumConfig.class);

    if (!config.getMultiSelect() && fieldValue.size() > 1) {
      throw new IllegalArgumentException(
          String.format("Only one value allowed for non-multiSelect %s property", fieldName));
    }
    Set<String> validValues = new HashSet<>(config.getValues());
    Set<String> fieldValues = new HashSet<>();
    fieldValue.forEach(value -> fieldValues.add(value.asText()));

    if (!validValues.containsAll(fieldValues)) {
      fieldValues.removeAll(validValues);
      throw new IllegalArgumentException(
          String.format("Values '%s' not supported for property %s", fieldValues, fieldName));
    }
  }
}
