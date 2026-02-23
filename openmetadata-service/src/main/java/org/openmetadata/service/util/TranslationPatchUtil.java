package org.openmetadata.service.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Translation;
import org.openmetadata.schema.type.Translations;

@Slf4j
public final class TranslationPatchUtil {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String DEFAULT_LOCALE = "en";

  private TranslationPatchUtil() {}

  /**
   * Handle PATCH operations for displayName and description fields.
   *
   * When a PATCH updates displayName or description:
   * 1. If no locale specified or locale=en: Update the main fields
   * 2. If locale specified: Update the translation for that locale
   * 3. Optionally sync: Update main fields AND store old values as 'en' translation
   */
  public static JsonPatch handleTranslationPatch(
      JsonPatch patch, String locale, boolean syncToEnglish) {
    if (locale == null || locale.equals(DEFAULT_LOCALE)) {
      // Standard behavior - update main fields
      if (syncToEnglish) {
        // Also create/update 'en' translation with the new values
        return addEnglishTranslationToPatch(patch);
      }
      return patch;
    }

    // Convert patch operations on displayName/description to translation updates
    return convertToTranslationPatch(patch, locale);
  }

  /**
   * Convert PATCH operations on displayName/description to translation updates
   */
  private static JsonPatch convertToTranslationPatch(JsonPatch originalPatch, String locale) {
    List<JsonValue> newOperations = new ArrayList<>();
    Map<String, ObjectNode> columnTranslations = new HashMap<>();
    Map<String, ObjectNode> fieldTranslations = new HashMap<>();
    Map<String, ObjectNode> schemaFieldTranslations = new HashMap<>();

    // Note: We don't add an empty translations field here anymore.
    // The patchWithTranslations method ensures the entity has translations loaded.
    // If translations don't exist on the entity, the JSON Patch "add" operation
    // will create the path automatically when we add to /translations/translations/-

    // Build the translation object for this locale
    ObjectNode translationObj = OBJECT_MAPPER.createObjectNode();
    translationObj.put("locale", locale);

    // Process all operations to build the translation object
    for (JsonValue operation : originalPatch.toJsonArray()) {
      jakarta.json.JsonObject op = operation.asJsonObject();
      String opType = op.getString("op");
      String path = op.getString("path");

      if (path.equals("/displayName")) {
        if (op.containsKey("value") && !op.isNull("value")) {
          translationObj.put("displayName", op.getString("value"));
        }
      } else if (path.equals("/description")) {
        if (op.containsKey("value") && !op.isNull("value")) {
          translationObj.put("description", op.getString("value"));
        }
      } else if (path.matches("/columns/\\d+/(displayName|description)")) {
        // Handle column translations (for Table, Container, DashboardDataModel)
        String[] pathParts = path.split("/");
        int columnIndex = Integer.parseInt(pathParts[2]);
        String field = pathParts[3];

        String columnKey = "column_" + columnIndex;
        ObjectNode columnTranslation =
            columnTranslations.computeIfAbsent(
                columnKey,
                k -> {
                  ObjectNode node = OBJECT_MAPPER.createObjectNode();
                  node.put("locale", locale);
                  return node;
                });

        if (op.containsKey("value") && !op.isNull("value")) {
          columnTranslation.put(field, op.getString("value"));
        }
      } else if (path.matches("/messageSchema/schemaFields/\\d+/(displayName|description)")) {
        // Handle Topic message schema field translations
        String[] pathParts = path.split("/");
        int fieldIndex = Integer.parseInt(pathParts[3]);
        String field = pathParts[4];

        String fieldKey = "schemaField_" + fieldIndex;
        ObjectNode fieldTranslation =
            schemaFieldTranslations.computeIfAbsent(
                fieldKey,
                k -> {
                  ObjectNode node = OBJECT_MAPPER.createObjectNode();
                  node.put("locale", locale);
                  return node;
                });

        if (op.containsKey("value") && !op.isNull("value")) {
          fieldTranslation.put(field, op.getString("value"));
        }
      } else if (path.matches("/fields/\\d+/(displayName|description)")) {
        // Handle SearchIndex field translations
        String[] pathParts = path.split("/");
        int fieldIndex = Integer.parseInt(pathParts[2]);
        String field = pathParts[3];

        String fieldKey = "field_" + fieldIndex;
        ObjectNode fieldTranslation =
            fieldTranslations.computeIfAbsent(
                fieldKey,
                k -> {
                  ObjectNode node = OBJECT_MAPPER.createObjectNode();
                  node.put("locale", locale);
                  return node;
                });

        if (op.containsKey("value") && !op.isNull("value")) {
          fieldTranslation.put(field, op.getString("value"));
        }
      } else if (path.matches("/dataModel/columns/\\d+/(displayName|description)")) {
        // Handle Container data model column translations
        String[] pathParts = path.split("/");
        int columnIndex = Integer.parseInt(pathParts[3]);
        String field = pathParts[4];

        String columnKey = "dataModelColumn_" + columnIndex;
        ObjectNode columnTranslation =
            columnTranslations.computeIfAbsent(
                columnKey,
                k -> {
                  ObjectNode node = OBJECT_MAPPER.createObjectNode();
                  node.put("locale", locale);
                  return node;
                });

        if (op.containsKey("value") && !op.isNull("value")) {
          columnTranslation.put(field, op.getString("value"));
        }
      } else if (!path.startsWith("/translations")) {
        // Keep non-translation operations as-is
        newOperations.add(operation);
      }
    }

    // Add column translation operations
    for (Map.Entry<String, ObjectNode> entry : columnTranslations.entrySet()) {
      String columnKey = entry.getKey();
      ObjectNode columnTranslation = entry.getValue();

      String path;
      if (columnKey.startsWith("dataModelColumn_")) {
        int columnIndex = Integer.parseInt(columnKey.substring("dataModelColumn_".length()));
        path = "/dataModel/columns/" + columnIndex + "/translations/translations/-";
      } else {
        int columnIndex = Integer.parseInt(columnKey.substring("column_".length()));
        path = "/columns/" + columnIndex + "/translations/translations/-";
      }

      ObjectNode addColumnTranslationOp = OBJECT_MAPPER.createObjectNode();
      addColumnTranslationOp.put("op", "add");
      addColumnTranslationOp.put("path", path);
      addColumnTranslationOp.set("value", columnTranslation);

      newOperations.add(convertToJsonValue(addColumnTranslationOp));
    }

    // Add schema field translation operations for Topic
    for (Map.Entry<String, ObjectNode> entry : schemaFieldTranslations.entrySet()) {
      String fieldKey = entry.getKey();
      int fieldIndex = Integer.parseInt(fieldKey.substring("schemaField_".length()));
      ObjectNode fieldTranslation = entry.getValue();

      ObjectNode addFieldTranslationOp = OBJECT_MAPPER.createObjectNode();
      addFieldTranslationOp.put("op", "add");
      addFieldTranslationOp.put(
          "path", "/messageSchema/schemaFields/" + fieldIndex + "/translations/translations/-");
      addFieldTranslationOp.set("value", fieldTranslation);

      newOperations.add(convertToJsonValue(addFieldTranslationOp));
    }

    // Add field translation operations for SearchIndex
    for (Map.Entry<String, ObjectNode> entry : fieldTranslations.entrySet()) {
      String fieldKey = entry.getKey();
      int fieldIndex = Integer.parseInt(fieldKey.substring("field_".length()));
      ObjectNode fieldTranslation = entry.getValue();

      ObjectNode addFieldTranslationOp = OBJECT_MAPPER.createObjectNode();
      addFieldTranslationOp.put("op", "add");
      addFieldTranslationOp.put("path", "/fields/" + fieldIndex + "/translations/translations/-");
      addFieldTranslationOp.set("value", fieldTranslation);

      newOperations.add(convertToJsonValue(addFieldTranslationOp));
    }

    // Add or update the translation for this locale
    // This will either add to the translations array or replace an existing translation
    ObjectNode addTranslationOp = OBJECT_MAPPER.createObjectNode();
    addTranslationOp.put("op", "add");
    addTranslationOp.put("path", "/translations/translations/-"); // Append to translations array
    addTranslationOp.set("value", translationObj);
    newOperations.add(convertToJsonValue(addTranslationOp));

    LOG.info(
        "Created translation patch for locale: {}, translation object: {}", locale, translationObj);
    LOG.info("Final patch operations: {}", newOperations);

    return createJsonPatch(newOperations);
  }

  /**
   * When updating main fields, also update 'en' translation
   */
  private static JsonPatch addEnglishTranslationToPatch(JsonPatch originalPatch) {
    List<JsonValue> operations = new ArrayList<>();

    for (JsonValue operation : originalPatch.toJsonArray()) {
      operations.add(operation);

      jakarta.json.JsonObject op = operation.asJsonObject();
      String path = op.getString("path");

      // If updating displayName or description, also update en translation
      if ((path.equals("/displayName") || path.equals("/description"))
          && (op.getString("op").equals("replace") || op.getString("op").equals("add"))) {
        String field = path.substring(1);
        String translationPath = String.format("/translations/en/%s", field);

        ObjectNode translationOp = OBJECT_MAPPER.createObjectNode();
        translationOp.put("op", "add");
        translationOp.put("path", translationPath);
        translationOp.put("value", op.getString("value"));

        operations.add(convertToJsonValue(translationOp));
      }
    }

    return createJsonPatch(operations);
  }

  /**
   * Validate that translation patches don't conflict with main field updates
   */
  public static void validateTranslationPatch(
      EntityInterface entity, JsonPatch patch, String locale) {
    boolean hasMainFieldUpdate = false;
    boolean hasTranslationUpdate = false;

    for (JsonValue operation : patch.toJsonArray()) {
      jakarta.json.JsonObject op = operation.asJsonObject();
      String path = op.getString("path");

      if (path.equals("/displayName") || path.equals("/description")) {
        hasMainFieldUpdate = true;
      } else if (path.startsWith("/translations/")) {
        hasTranslationUpdate = true;
      }
    }

    if (hasMainFieldUpdate && hasTranslationUpdate) {
      throw new IllegalArgumentException(
          "Cannot update both main fields and translations in the same patch. "
              + "Use locale parameter to specify which to update.");
    }

    // Validate locale format in translation paths
    if (hasTranslationUpdate) {
      validateTranslationPaths(patch);
    }
  }

  private static void validateTranslationPaths(JsonPatch patch) {
    for (JsonValue operation : patch.toJsonArray()) {
      jakarta.json.JsonObject op = operation.asJsonObject();
      String path = op.getString("path");

      if (path.startsWith("/translations/")) {
        String[] parts = path.split("/");
        if (parts.length < 4) {
          throw new IllegalArgumentException("Invalid translation path: " + path);
        }

        String locale = parts[2];
        String field = parts[3];

        // Validate locale format
        if (!locale.matches("^[a-z]{2}(-[A-Z]{2})?$")) {
          throw new IllegalArgumentException("Invalid locale format: " + locale);
        }

        // Validate field name
        if (!field.equals("displayName") && !field.equals("description")) {
          throw new IllegalArgumentException(
              "Only displayName and description can be translated. Invalid field: " + field);
        }
      }
    }
  }

  /**
   * Handle direct translation updates via dedicated endpoint
   */
  public static void updateTranslation(
      EntityInterface entity, String locale, String displayName, String description) {
    if (locale == null || locale.equals(DEFAULT_LOCALE)) {
      // Update main fields for default locale
      if (displayName != null) {
        entity.setDisplayName(displayName);
      }
      if (description != null) {
        entity.setDescription(description);
      }
    } else {
      // Update translation for specific locale
      Translations translations = entity.getTranslations();
      if (translations == null) {
        translations = new Translations();
        entity.setTranslations(translations);
      }

      if (translations.getTranslations() == null) {
        translations.setTranslations(new ArrayList<>());
      }

      // Find or create translation for this locale
      Translation translation =
          translations.getTranslations().stream()
              .filter(t -> locale.equals(t.getLocale()))
              .findFirst()
              .orElse(null);

      if (translation == null) {
        translation = new Translation();
        translation.setLocale(locale);
        translations.getTranslations().add(translation);
      }

      if (displayName != null) {
        if (displayName.isEmpty()) {
          translation.setDisplayName(null);
        } else {
          translation.setDisplayName(displayName);
        }
      }

      if (description != null) {
        if (description.isEmpty()) {
          translation.setDescription(null);
        } else {
          translation.setDescription(description);
        }
      }

      // Remove translation if both fields are null
      if (translation.getDisplayName() == null && translation.getDescription() == null) {
        translations.getTranslations().remove(translation);
      }
    }
  }

  /**
   * Merge translation changes during entity updates
   */
  public static void mergeTranslations(EntityInterface original, EntityInterface updated) {
    Translations originalTranslations = original.getTranslations();
    Translations updatedTranslations = updated.getTranslations();

    if (updatedTranslations == null || updatedTranslations.getTranslations() == null) {
      // No translation updates
      return;
    }

    if (originalTranslations == null) {
      // First time adding translations
      original.setTranslations(updatedTranslations);
      return;
    }

    if (originalTranslations.getTranslations() == null) {
      originalTranslations.setTranslations(new ArrayList<>());
    }

    // Merge translations
    for (Translation newTranslation : updatedTranslations.getTranslations()) {
      // Find existing translation for this locale
      Translation existingTranslation =
          originalTranslations.getTranslations().stream()
              .filter(t -> newTranslation.getLocale().equals(t.getLocale()))
              .findFirst()
              .orElse(null);

      if (existingTranslation != null) {
        // Update existing translation
        if (newTranslation.getDisplayName() != null) {
          existingTranslation.setDisplayName(newTranslation.getDisplayName());
        }
        if (newTranslation.getDescription() != null) {
          existingTranslation.setDescription(newTranslation.getDescription());
        }
        // Remove if both fields are null
        if (existingTranslation.getDisplayName() == null
            && existingTranslation.getDescription() == null) {
          originalTranslations.getTranslations().remove(existingTranslation);
        }
      } else {
        // Add new translation
        originalTranslations.getTranslations().add(newTranslation);
      }
    }
  }

  // Helper methods
  private static JsonValue convertToJsonValue(ObjectNode node) {
    try {
      // Convert Jackson ObjectNode to Jakarta JsonValue
      String jsonString = OBJECT_MAPPER.writeValueAsString(node);
      jakarta.json.JsonReader reader =
          jakarta.json.Json.createReader(new java.io.StringReader(jsonString));
      return reader.readValue();
    } catch (Exception e) {
      throw new RuntimeException("Failed to convert ObjectNode to JsonValue", e);
    }
  }

  private static JsonPatch createJsonPatch(List<JsonValue> operations) {
    // Create a JsonArray from the operations
    jakarta.json.JsonArrayBuilder arrayBuilder = jakarta.json.Json.createArrayBuilder();
    for (JsonValue operation : operations) {
      arrayBuilder.add(operation);
    }
    jakarta.json.JsonArray patchArray = arrayBuilder.build();

    // Create JsonPatch from the array
    return jakarta.json.Json.createPatch(patchArray);
  }
}
