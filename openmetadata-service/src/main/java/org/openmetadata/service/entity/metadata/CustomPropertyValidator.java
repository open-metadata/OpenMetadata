package org.openmetadata.service.entity.metadata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAccessor;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map.Entry;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.schema.type.customProperties.Table;
import org.openmetadata.schema.type.customProperties.TableConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.util.EntityUtil;

public final class CustomPropertyValidator {
  private static final CustomPropertyValidator SHARED =
      new CustomPropertyValidator(
          (type, field) -> TypeRegistry.instance().getSchema(type, field),
          (type, field) ->
              new CustomPropertyValidator.Definition(
                  TypeRegistry.getCustomPropertyType(type, field),
                  TypeRegistry.getCustomPropertyConfig(type, field)),
          EntityUtil::validateCustomPropertyEntityReference,
          EntityUtil::validateCustomPropertyEntityReferenceList);

  public static CustomPropertyValidator shared() {
    return SHARED;
  }

  private static final String DATE = "date-cp";
  private static final String DATE_TIME = "dateTime-cp";
  private static final String TIME = "time-cp";
  private static final String TABLE = "table-cp";
  private static final String ENUM = "enum";
  private static final String HYPERLINK = "hyperlink-cp";
  private static final String REFERENCE = "entityReference";
  private static final String REFERENCE_LIST = "entityReferenceList";

  public record Definition(String type, String config) {}

  private final BiFunction<String, String, Schema> schemas;
  private final BiFunction<String, String, Definition> definitions;
  private final BiConsumer<JsonNode, String> referenceValidator;
  private final BiConsumer<JsonNode, String> referenceListValidator;

  public CustomPropertyValidator(
      final BiFunction<String, String, Schema> schemas,
      final BiFunction<String, String, Definition> definitions,
      final BiConsumer<JsonNode, String> referenceValidator,
      final BiConsumer<JsonNode, String> referenceListValidator) {
    this.schemas = schemas;
    this.definitions = definitions;
    this.referenceValidator = referenceValidator;
    this.referenceListValidator = referenceListValidator;
  }

  public void validate(final Object extension, final String entityTypeName) {
    if (extension != null) {
      validateFields(JsonUtils.valueToTree(extension), entityTypeName);
    }
  }

  public Object validateAndTransform(final Object extension, final String entityTypeName) {
    if (extension == null) {
      return null;
    }
    final JsonNode snapshot = JsonUtils.valueToTree(extension);
    validateFields(snapshot, entityTypeName);
    if (!(snapshot instanceof ObjectNode fields)) {
      return null;
    }
    fields.fields().forEachRemaining(entry -> transformField(fields, entry, entityTypeName));
    return JsonUtils.treeToValue(fields, Object.class);
  }

  private void validateFields(final JsonNode fields, final String entityType) {
    fields.fields().forEachRemaining(entry -> validateField(entry, entityType));
  }

  private void validateField(final Entry<String, JsonNode> field, final String entityType) {
    final Schema schema = schemas.apply(entityType, field.getKey());
    if (schema == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.unknownCustomField(field.getKey()));
    }
    final List<Error> errors = schema.validate(field.getValue());
    if (!errors.isEmpty()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.jsonValidationError(field.getKey(), errors.toString()));
    }
  }

  private void transformField(
      final ObjectNode fields, final Entry<String, JsonNode> entry, final String entityType) {
    final Definition property = definitions.apply(entityType, entry.getKey());
    fields.set(entry.getKey(), transformValue(entry.getKey(), entry.getValue(), property));
  }

  private JsonNode transformValue(
      final String field, final JsonNode value, final Definition property) {
    return switch (property.type()) {
      case DATE, DATE_TIME, TIME -> JsonUtils.valueToTree(
          getFormattedDateTimeField(value.textValue(), property.type(), property.config(), field));
      case ENUM -> sortEnum(field, value, property.config());
      default -> validateValue(field, value, property);
    };
  }

  private JsonNode validateValue(
      final String field, final JsonNode value, final Definition property) {
    switch (property.type()) {
      case TABLE -> validateTableType(value, property.config(), field);
      case HYPERLINK -> validateHyperlinkUrl(value, field);
      case REFERENCE -> referenceValidator.accept(value, field);
      case REFERENCE_LIST -> referenceListValidator.accept(value, field);
      default -> {}
    }
    return value;
  }

  private JsonNode sortEnum(final String field, final JsonNode value, final String config) {
    validateEnumKeys(field, value, config);
    return JsonUtils.valueToTree(
        StreamSupport.stream(value.spliterator(), false).map(JsonNode::asText).sorted().toList());
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
      URI uri = new URI(url);
      String scheme = uri.getScheme();
      if (scheme == null
          || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
        throw new IllegalArgumentException(
            String.format(
                "Invalid URL protocol for field '%s': URL must use http or https protocol",
                fieldName));
      }
    } catch (URISyntaxException e) {
      throw new IllegalArgumentException(
          String.format("Invalid URL format for field '%s': %s", fieldName, e.getMessage()));
    }
  }

  private static String getFormattedDateTimeField(
      String fieldValue, String customPropertyType, String propertyConfig, String fieldName) {
    DateTimeFormatter formatter;

    try {
      return switch (customPropertyType) {
        case DATE -> {
          DateTimeFormatter inputFormatter =
              DateTimeFormatter.ofPattern(propertyConfig, Locale.ENGLISH);
          TemporalAccessor date = inputFormatter.parse(fieldValue);
          yield inputFormatter.format(date);
        }
        case DATE_TIME -> {
          formatter = DateTimeFormatter.ofPattern(propertyConfig);
          LocalDateTime dateTime = LocalDateTime.parse(fieldValue, formatter);
          yield dateTime.format(formatter);
        }
        case TIME -> {
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
    Table tableValue =
        JsonUtils.convertValue(JsonUtils.readTree(String.valueOf(fieldValue)), Table.class);
    Set<String> configColumns = tableConfig.getColumns();

    try {
      JsonUtils.validateJsonSchema(tableValue, Table.class);

      validateTableColumns(fieldValue, configColumns);
      validateTableRows(fieldValue, configColumns);
    } catch (ConstraintViolationException e) {
      String validationErrors =
          e.getConstraintViolations().stream()
              .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
              .collect(Collectors.joining(", "));

      throw new IllegalArgumentException(
          CatalogExceptionMessage.jsonValidationError(fieldName, validationErrors));
    }
  }

  private static void validateTableColumns(final JsonNode value, final Set<String> configColumns) {
    final Set<String> fieldColumns = new HashSet<>();
    value.get("columns").forEach(column -> fieldColumns.add(column.asText()));
    final Set<String> undefinedColumns = new HashSet<>(fieldColumns);
    undefinedColumns.removeAll(configColumns);
    if (!undefinedColumns.isEmpty()) {
      throw new IllegalArgumentException(
          "Expected columns: "
              + configColumns
              + ", but found undefined columns: "
              + undefinedColumns);
    }
  }

  private static void validateTableRows(final JsonNode value, final Set<String> configColumns) {
    final Set<String> fieldNames = new HashSet<>();
    value.get("rows").forEach(row -> row.fieldNames().forEachRemaining(fieldNames::add));
    final Set<String> undefinedColumns = new HashSet<>(fieldNames);
    undefinedColumns.removeAll(configColumns);
    if (!undefinedColumns.isEmpty()) {
      throw new IllegalArgumentException("Rows contain undefined columns: " + undefinedColumns);
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
