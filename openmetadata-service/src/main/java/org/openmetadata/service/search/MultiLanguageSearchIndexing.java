package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Translation;

/**
 * Utility class for handling multi-language search indexing.
 * This class provides methods to extract and prepare translations
 * for indexing in Elasticsearch/OpenSearch.
 */
@Slf4j
public class MultiLanguageSearchIndexing {

  private MultiLanguageSearchIndexing() {
    // Private constructor for utility class
  }

  /**
   * Adds translation fields to the search document.
   * Translations are indexed with language-specific field names to enable multi-language search.
   *
   * @param doc The document map to add translations to
   * @param entity The entity containing translations
   */
  public static void addTranslationsToDocument(Map<String, Object> doc, EntityInterface entity) {
    if (entity.getTranslations() == null || entity.getTranslations().getTranslations() == null) {
      LOG.debug(
          "Entity {} ({}) has no translations to index",
          entity.getId(),
          entity.getEntityReference().getType());
      return;
    }
    LOG.debug(
        "Entity {} ({}) has {} translations to index",
        entity.getId(),
        entity.getEntityReference().getType(),
        entity.getTranslations().getTranslations().size());

    Map<String, Object> translationsMap = new HashMap<>();

    // Process entity-level translations
    for (Translation translation : entity.getTranslations().getTranslations()) {
      if (translation.getLocale() == null) {
        continue;
      }

      Map<String, Object> localeTranslations = new HashMap<>();

      // Add entity display name and description translations
      if (translation.getDisplayName() != null) {
        localeTranslations.put("displayName", translation.getDisplayName());
      }
      if (translation.getDescription() != null) {
        localeTranslations.put("description", translation.getDescription());
      }

      if (!localeTranslations.isEmpty()) {
        translationsMap.put(translation.getLocale(), localeTranslations);
      }
    }

    // Add nested field translations if applicable
    addNestedFieldTranslations(translationsMap, entity);

    if (!translationsMap.isEmpty()) {
      doc.put("translations", translationsMap);
      // Add list of available locales for filtering
      doc.put("availableTranslationLocales", new ArrayList<>(translationsMap.keySet()));
    }
  }

  /**
   * Adds nested field translations (columns, message schema fields) to the translations map.
   *
   * @param translationsMap The map to add translations to
   * @param entity The entity containing nested fields
   */
  private static void addNestedFieldTranslations(
      Map<String, Object> translationsMap, EntityInterface entity) {

    // Handle columns for table-like entities
    if (entity instanceof org.openmetadata.schema.entity.data.Table table
        && table.getColumns() != null) {
      addColumnTranslations(translationsMap, table.getColumns(), "columns");
    } else if (entity instanceof org.openmetadata.schema.entity.data.Container container
        && container.getDataModel() != null
        && container.getDataModel().getColumns() != null) {
      addColumnTranslations(translationsMap, container.getDataModel().getColumns(), "columns");
    }

    // Handle message schema fields for topics
    if (entity instanceof org.openmetadata.schema.entity.data.Topic topic
        && topic.getMessageSchema() != null
        && topic.getMessageSchema().getSchemaFields() != null) {
      addMessageSchemaFieldTranslations(
          translationsMap, topic.getMessageSchema().getSchemaFields(), "messageSchemaFields");
    }
  }

  /**
   * Adds column translations to the translations map.
   *
   * @param translationsMap The map to add translations to
   * @param columns The list of columns with potential translations
   * @param fieldPrefix The prefix for the field names in the index
   */
  private static void addColumnTranslations(
      Map<String, Object> translationsMap, List<Column> columns, String fieldPrefix) {

    for (Column column : columns) {
      if (column.getTranslations() != null && column.getTranslations().getTranslations() != null) {
        for (Translation translation : column.getTranslations().getTranslations()) {
          if (translation.getLocale() == null) {
            continue;
          }

          Map<String, Object> localeTranslations =
              (Map<String, Object>)
                  translationsMap.computeIfAbsent(translation.getLocale(), k -> new HashMap<>());

          Map<String, Object> columnTranslations =
              (Map<String, Object>)
                  localeTranslations.computeIfAbsent(fieldPrefix, k -> new HashMap<>());

          Map<String, Object> columnData = new HashMap<>();
          if (translation.getDisplayName() != null) {
            columnData.put("displayName", translation.getDisplayName());
          }
          if (translation.getDescription() != null) {
            columnData.put("description", translation.getDescription());
          }

          if (!columnData.isEmpty()) {
            columnTranslations.put(column.getName(), columnData);
          }
        }
      }

      // Process nested columns recursively
      if (column.getChildren() != null) {
        addColumnTranslations(
            translationsMap,
            column.getChildren(),
            fieldPrefix + "." + column.getName() + ".children");
      }
    }
  }

  /**
   * Adds message schema field translations to the translations map.
   *
   * @param translationsMap The map to add translations to
   * @param fields The list of message schema fields with potential translations
   * @param fieldPrefix The prefix for the field names in the index
   */
  private static void addMessageSchemaFieldTranslations(
      Map<String, Object> translationsMap, List<Field> fields, String fieldPrefix) {

    for (Field field : fields) {
      if (field.getTranslations() != null && field.getTranslations().getTranslations() != null) {
        for (Translation translation : field.getTranslations().getTranslations()) {
          if (translation.getLocale() == null) {
            continue;
          }

          Map<String, Object> localeTranslations =
              (Map<String, Object>)
                  translationsMap.computeIfAbsent(translation.getLocale(), k -> new HashMap<>());

          Map<String, Object> fieldTranslations =
              (Map<String, Object>)
                  localeTranslations.computeIfAbsent(fieldPrefix, k -> new HashMap<>());

          Map<String, Object> fieldData = new HashMap<>();
          if (translation.getDisplayName() != null) {
            fieldData.put("displayName", translation.getDisplayName());
          }
          if (translation.getDescription() != null) {
            fieldData.put("description", translation.getDescription());
          }

          if (!fieldData.isEmpty()) {
            fieldTranslations.put(field.getName(), fieldData);
          }
        }
      }

      // Process nested fields recursively
      if (field.getChildren() != null) {
        addMessageSchemaFieldTranslations(
            translationsMap,
            field.getChildren(),
            fieldPrefix + "." + field.getName() + ".children");
      }
    }
  }

  /**
   * Generates searchable text content from all translations for fuzzy search.
   * This creates a concatenated string of all translated content to enable
   * searching across all languages simultaneously.
   *
   * @param entity The entity containing translations
   * @return A string containing all translated text for indexing
   */
  public static String generateMultiLanguageSearchText(EntityInterface entity) {
    if (entity.getTranslations() == null || entity.getTranslations().getTranslations() == null) {
      return "";
    }

    StringBuilder searchText = new StringBuilder();

    for (Translation translation : entity.getTranslations().getTranslations()) {
      if (translation.getDisplayName() != null) {
        searchText.append(translation.getDisplayName()).append(" ");
      }
      if (translation.getDescription() != null) {
        searchText.append(translation.getDescription()).append(" ");
      }
    }

    // Add nested field translations to search text
    appendNestedFieldSearchText(searchText, entity);

    return searchText.toString().trim();
  }

  /**
   * Appends nested field translations to the search text.
   *
   * @param searchText The StringBuilder to append to
   * @param entity The entity containing nested fields
   */
  private static void appendNestedFieldSearchText(
      StringBuilder searchText, EntityInterface entity) {
    // Handle columns for table-like entities
    if (entity instanceof org.openmetadata.schema.entity.data.Table table
        && table.getColumns() != null) {
      appendColumnSearchText(searchText, table.getColumns());
    } else if (entity instanceof org.openmetadata.schema.entity.data.Container container
        && container.getDataModel() != null
        && container.getDataModel().getColumns() != null) {
      appendColumnSearchText(searchText, container.getDataModel().getColumns());
    }

    // Handle message schema fields for topics
    if (entity instanceof org.openmetadata.schema.entity.data.Topic topic
        && topic.getMessageSchema() != null
        && topic.getMessageSchema().getSchemaFields() != null) {
      appendFieldSearchText(searchText, topic.getMessageSchema().getSchemaFields());
    }
  }

  /**
   * Appends column translations to the search text.
   *
   * @param searchText The StringBuilder to append to
   * @param columns The list of columns with translations
   */
  private static void appendColumnSearchText(StringBuilder searchText, List<Column> columns) {
    for (Column column : columns) {
      if (column.getTranslations() != null && column.getTranslations().getTranslations() != null) {
        for (Translation translation : column.getTranslations().getTranslations()) {
          if (translation.getDisplayName() != null) {
            searchText.append(translation.getDisplayName()).append(" ");
          }
          if (translation.getDescription() != null) {
            searchText.append(translation.getDescription()).append(" ");
          }
        }
      }

      // Process nested columns
      if (column.getChildren() != null) {
        appendColumnSearchText(searchText, column.getChildren());
      }
    }
  }

  /**
   * Appends field translations to the search text.
   *
   * @param searchText The StringBuilder to append to
   * @param fields The list of fields with translations
   */
  private static void appendFieldSearchText(StringBuilder searchText, List<Field> fields) {
    for (Field field : fields) {
      if (field.getTranslations() != null && field.getTranslations().getTranslations() != null) {
        for (Translation translation : field.getTranslations().getTranslations()) {
          if (translation.getDisplayName() != null) {
            searchText.append(translation.getDisplayName()).append(" ");
          }
          if (translation.getDescription() != null) {
            searchText.append(translation.getDescription()).append(" ");
          }
        }
      }

      // Process nested fields
      if (field.getChildren() != null) {
        appendFieldSearchText(searchText, field.getChildren());
      }
    }
  }

  /**
   * Extracts translations for a specific locale for highlighting in search results.
   *
   * @param entity The entity containing translations
   * @param locale The locale to extract translations for
   * @return A map containing the translations for the specified locale
   */
  public static Map<String, Object> getTranslationsForLocale(
      EntityInterface entity, String locale) {

    if (entity.getTranslations() == null
        || entity.getTranslations().getTranslations() == null
        || nullOrEmpty(locale)) {
      return new HashMap<>();
    }

    Map<String, Object> result = new HashMap<>();

    // Find translation for the specified locale
    for (Translation translation : entity.getTranslations().getTranslations()) {
      if (locale.equals(translation.getLocale())) {
        if (translation.getDisplayName() != null) {
          result.put("displayName", translation.getDisplayName());
        }
        if (translation.getDescription() != null) {
          result.put("description", translation.getDescription());
        }
        break;
      }
    }

    return result;
  }
}
