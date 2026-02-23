package org.openmetadata.service.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Translation;
import org.openmetadata.schema.type.Translations;

@Slf4j
public final class TranslationUtil {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String DEFAULT_LOCALE = "en";

  private TranslationUtil() {}

  public static void applyTranslations(EntityInterface entity, String locale) {
    // Don't apply translations for null entity or null/empty locale
    if (entity == null || locale == null || locale.isEmpty()) {
      LOG.info(
          "Skipping translation: entity={}, locale={}",
          entity != null ? entity.getId() : "null",
          locale);
      return;
    }

    // For default locale (en), we don't need to apply translations - use original values
    if (locale.equals(DEFAULT_LOCALE)) {
      LOG.info(
          "Using original values for default locale: {} for entity: {}", locale, entity.getId());
      // Don't apply any translations for default locale
      return;
    }

    String normalizedLocale = normalizeLocale(locale);
    Translation translation = null;

    Translations translations = entity.getTranslations();
    if (translations != null
        && translations.getTranslations() != null
        && !translations.getTranslations().isEmpty()) {
      LOG.info(
          "Looking for translation - entity: {}, locale: {}, normalized: {}, available translations: {}",
          entity.getId(),
          locale,
          normalizedLocale,
          translations.getTranslations().stream().map(Translation::getLocale).toList());

      translation = findTranslation(translations.getTranslations(), normalizedLocale);
      if (translation == null && normalizedLocale.contains("-")) {
        String baseLocale = normalizedLocale.split("-")[0];
        translation = findTranslation(translations.getTranslations(), baseLocale);
      }
    }

    if (translation != null) {
      // Translation found - apply the translated values
      LOG.info(
          "Applying translation for entity: {}, locale: {}, displayName: {}, description: {}",
          entity.getId(),
          normalizedLocale,
          translation.getDisplayName(),
          translation.getDescription());

      // Only override if translation value is not null
      if (translation.getDisplayName() != null) {
        entity.setDisplayName(translation.getDisplayName());
      }
      if (translation.getDescription() != null) {
        entity.setDescription(translation.getDescription());
      }
    } else {
      // No translation found - set to empty strings to signal translation can be provided
      LOG.info(
          "No translation found for entity: {}, locale: {} - setting to empty strings",
          entity.getId(),
          normalizedLocale);
      entity.setDisplayName("");
      entity.setDescription("");
    }

    // Apply translations to nested fields based on entity type
    applyChildrenTranslations(entity, normalizedLocale);
  }

  /**
   * Apply translations to children entities (columns, fields, etc.)
   * This is a generic method that applies translations to nested entities
   * based on their type.
   */
  public static void applyChildrenTranslations(EntityInterface entity, String locale) {
    if (entity == null || locale == null || locale.equals(DEFAULT_LOCALE)) {
      return;
    }

    switch (entity) {
      case Table table -> applyTableTranslations(table, locale);
      case Topic topic -> applyTopicTranslations(topic, locale);
      case Container container -> applyContainerTranslations(container, locale);
      case DashboardDataModel dataModel -> applyDashboardDataModelTranslations(dataModel, locale);
      case SearchIndex searchIndex -> applySearchIndexTranslations(searchIndex, locale);
      default -> LOG.debug(
          "No children translations for entity type: {}", entity.getClass().getSimpleName());
    }
  }

  private static void applyTableTranslations(Table table, String locale) {
    if (table.getColumns() != null) {
      LOG.info(
          "Applying translations to {} columns for table {} with locale {}",
          table.getColumns().size(),
          table.getId(),
          locale);
      for (Column column : table.getColumns()) {
        applyColumnTranslation(column, locale);
      }
    }
  }

  private static void applyTopicTranslations(Topic topic, String locale) {
    if (topic.getMessageSchema() != null && topic.getMessageSchema().getSchemaFields() != null) {
      LOG.info(
          "Applying translations to {} fields for topic {} with locale {}",
          topic.getMessageSchema().getSchemaFields().size(),
          topic.getId(),
          locale);
      for (Field field : topic.getMessageSchema().getSchemaFields()) {
        applyFieldTranslation(field, locale);
      }
    }
  }

  private static void applyContainerTranslations(Container container, String locale) {
    if (container.getDataModel() != null && container.getDataModel().getColumns() != null) {
      LOG.info(
          "Applying translations to {} columns for container {} with locale {}",
          container.getDataModel().getColumns().size(),
          container.getId(),
          locale);
      for (Column column : container.getDataModel().getColumns()) {
        applyColumnTranslation(column, locale);
      }
    }
  }

  private static void applyDashboardDataModelTranslations(
      DashboardDataModel dataModel, String locale) {
    if (dataModel.getColumns() != null) {
      LOG.info(
          "Applying translations to {} columns for dashboard data model {} with locale {}",
          dataModel.getColumns().size(),
          dataModel.getId(),
          locale);
      for (Column column : dataModel.getColumns()) {
        applyColumnTranslation(column, locale);
      }
    }
  }

  private static void applySearchIndexTranslations(SearchIndex searchIndex, String locale) {
    if (searchIndex.getFields() != null) {
      LOG.info(
          "Applying translations to {} fields for search index {} with locale {}",
          searchIndex.getFields().size(),
          searchIndex.getId(),
          locale);
      for (SearchIndexField field : searchIndex.getFields()) {
        applySearchIndexFieldTranslation(field, locale);
      }
    }
  }

  private static Translation findTranslation(List<Translation> translations, String locale) {
    if (translations == null) {
      return null;
    }
    return translations.stream().filter(t -> locale.equals(t.getLocale())).findFirst().orElse(null);
  }

  private static void applyColumnTranslation(Column column, String locale) {
    if (column == null || locale == null || locale.equals(DEFAULT_LOCALE)) {
      return;
    }

    LOG.info("Applying translation to column: {}, locale: {}", column.getName(), locale);

    Translation translation = null;
    Translations translations = column.getTranslations();

    if (translations != null
        && translations.getTranslations() != null
        && !translations.getTranslations().isEmpty()) {

      LOG.info(
          "Column {} has translations for locales: {}",
          column.getName(),
          translations.getTranslations().stream().map(Translation::getLocale).toList());

      translation = findTranslation(translations.getTranslations(), locale);
      if (translation == null && locale.contains("-")) {
        String baseLocale = locale.split("-")[0];
        translation = findTranslation(translations.getTranslations(), baseLocale);
      }
    } else {
      LOG.info("Column {} has no translations", column.getName());
    }

    if (translation != null) {
      // Apply translation to column
      LOG.info(
          "Applying translation to column {}: displayName={}, description={}",
          column.getName(),
          translation.getDisplayName(),
          translation.getDescription());
      column.setDisplayName(
          translation.getDisplayName() != null ? translation.getDisplayName() : "");
      column.setDescription(
          translation.getDescription() != null ? translation.getDescription() : "");
    } else {
      // No translation found - set fields to empty
      LOG.info(
          "No translation found for column {} and locale {} - setting to empty",
          column.getName(),
          locale);
      column.setDisplayName("");
      column.setDescription("");
    }

    // Recursively apply to nested columns if they exist
    if (column.getChildren() != null) {
      for (Column child : column.getChildren()) {
        applyColumnTranslation(child, locale);
      }
    }
  }

  private static void applyFieldTranslation(Field field, String locale) {
    if (field == null || locale == null || locale.equals(DEFAULT_LOCALE)) {
      return;
    }

    LOG.debug("Applying translation to field: {}, locale: {}", field.getName(), locale);

    Translation translation = null;
    Translations translations = field.getTranslations();

    if (translations != null
        && translations.getTranslations() != null
        && !translations.getTranslations().isEmpty()) {

      translation = findTranslation(translations.getTranslations(), locale);
      if (translation == null && locale.contains("-")) {
        String baseLocale = locale.split("-")[0];
        translation = findTranslation(translations.getTranslations(), baseLocale);
      }
    }

    if (translation != null) {
      field.setDisplayName(
          translation.getDisplayName() != null ? translation.getDisplayName() : "");
      field.setDescription(
          translation.getDescription() != null ? translation.getDescription() : "");
    } else {
      field.setDisplayName("");
      field.setDescription("");
    }

    // Recursively apply to nested fields
    if (field.getChildren() != null) {
      for (Field child : field.getChildren()) {
        applyFieldTranslation(child, locale);
      }
    }
  }

  private static void applySearchIndexFieldTranslation(SearchIndexField field, String locale) {
    if (field == null || locale == null || locale.equals(DEFAULT_LOCALE)) {
      return;
    }

    LOG.debug(
        "Applying translation to search index field: {}, locale: {}", field.getName(), locale);

    Translation translation = null;
    Translations translations = field.getTranslations();

    if (translations != null
        && translations.getTranslations() != null
        && !translations.getTranslations().isEmpty()) {

      translation = findTranslation(translations.getTranslations(), locale);
      if (translation == null && locale.contains("-")) {
        String baseLocale = locale.split("-")[0];
        translation = findTranslation(translations.getTranslations(), baseLocale);
      }
    }

    if (translation != null) {
      field.setDisplayName(
          translation.getDisplayName() != null ? translation.getDisplayName() : "");
      field.setDescription(
          translation.getDescription() != null ? translation.getDescription() : "");
    } else {
      field.setDisplayName("");
      field.setDescription("");
    }

    // Recursively apply to nested fields
    if (field.getChildren() != null) {
      for (SearchIndexField child : field.getChildren()) {
        applySearchIndexFieldTranslation(child, locale);
      }
    }
  }

  public static void applyTranslationsToList(
      Iterable<? extends EntityInterface> entities, String locale) {
    // Don't apply translations for null entities, null locale, or default locale (en)
    if (entities == null || locale == null || locale.isEmpty() || locale.equals(DEFAULT_LOCALE)) {
      return;
    }

    for (EntityInterface entity : entities) {
      applyTranslations(entity, locale);
    }
  }

  public static void updateTranslations(
      EntityInterface entity, String locale, String displayName, String description) {
    if (entity == null || locale == null || locale.equals(DEFAULT_LOCALE)) {
      return;
    }

    Translations translations = entity.getTranslations();
    if (translations == null) {
      translations = new Translations();
      entity.setTranslations(translations);
    }

    if (translations.getTranslations() == null) {
      translations.setTranslations(new java.util.ArrayList<>());
    }

    String normalizedLocale = normalizeLocale(locale);
    Translation translation = findTranslation(translations.getTranslations(), normalizedLocale);

    if (translation == null) {
      translation = new Translation();
      translation.setLocale(normalizedLocale);
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

  public static JsonNode getTranslationsForElasticsearch(EntityInterface entity) {
    if (entity == null
        || entity.getTranslations() == null
        || entity.getTranslations().getTranslations() == null
        || entity.getTranslations().getTranslations().isEmpty()) {
      return null;
    }

    ObjectNode translationsNode = OBJECT_MAPPER.createObjectNode();

    for (Translation translation : entity.getTranslations().getTranslations()) {
      if (translation.getLocale() == null) {
        continue;
      }

      ObjectNode localeNode = OBJECT_MAPPER.createObjectNode();

      if (translation.getDisplayName() != null) {
        localeNode.put("displayName", translation.getDisplayName());
      }

      if (translation.getDescription() != null) {
        localeNode.put("description", translation.getDescription());
      }

      if (localeNode.size() > 0) {
        translationsNode.set(translation.getLocale(), localeNode);
      }
    }

    return translationsNode.size() > 0 ? translationsNode : null;
  }

  private static String normalizeLocale(String locale) {
    if (locale == null || locale.isEmpty()) {
      return DEFAULT_LOCALE;
    }

    locale = locale.replace("_", "-").toLowerCase();

    if (locale.contains("-")) {
      String[] parts = locale.split("-");
      if (parts.length == 2) {
        return parts[0].toLowerCase() + "-" + parts[1].toUpperCase();
      }
    }

    return locale.toLowerCase();
  }

  public static String getLocaleFromRequest(String acceptLanguageHeader) {
    if (acceptLanguageHeader == null || acceptLanguageHeader.isEmpty()) {
      return DEFAULT_LOCALE;
    }

    try {
      Locale.LanguageRange.parse(acceptLanguageHeader);
      String[] locales = acceptLanguageHeader.split(",");
      if (locales.length > 0) {
        String primaryLocale = locales[0].split(";")[0].trim();
        return normalizeLocale(primaryLocale);
      }
    } catch (Exception e) {
      LOG.debug("Failed to parse Accept-Language header: {}", acceptLanguageHeader, e);
    }

    return DEFAULT_LOCALE;
  }
}
