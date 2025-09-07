package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

/**
 * Utility class for building multi-language search queries.
 * This class provides methods to create Elasticsearch/OpenSearch queries
 * that can search in the appropriate language based on user locale.
 */
@Slf4j
public class MultiLanguageSearchQueryBuilder {

  private static final String DEFAULT_LOCALE = "en";

  private MultiLanguageSearchQueryBuilder() {
    // Private constructor for utility class
  }

  /**
   * Enhances a search query with locale-aware field selection.
   * If locale is provided and not the default, searches in translation fields.
   * Otherwise, searches in the standard displayName and description fields.
   *
   * @param baseQuery The base search query
   * @param searchText The text to search for
   * @param locale The user's locale (optional)
   * @return The enhanced query with locale-aware search
   */
  public static Map<String, Object> enhanceQueryWithLocale(
      Map<String, Object> baseQuery, String searchText, String locale) {

    if (nullOrEmpty(searchText)) {
      return baseQuery;
    }

    // Get the bool query or create one if it doesn't exist
    Map<String, Object> boolQuery =
        (Map<String, Object>) baseQuery.computeIfAbsent("bool", k -> new HashMap<>());

    // Get the should clauses or create if they don't exist
    List<Map<String, Object>> shouldClauses =
        (List<Map<String, Object>>) boolQuery.computeIfAbsent("should", k -> new ArrayList<>());

    // Determine if we should use translations or default fields
    boolean useTranslations = shouldUseTranslations(locale);

    if (useTranslations) {
      // Search in locale-specific translation fields with high boost
      addTranslationQueries(shouldClauses, searchText, locale);

      // Also search in default fields with lower boost as fallback
      addDefaultFieldQueries(shouldClauses, searchText, 0.5);
    } else {
      // Search in default fields with normal boost
      addDefaultFieldQueries(shouldClauses, searchText, 1.0);
    }

    // Always add fuzzy search on all available content
    addFuzzySearchQueries(shouldClauses, searchText, locale);

    return baseQuery;
  }

  /**
   * Determines whether to use translation fields based on locale.
   *
   * @param locale The user's locale
   * @return true if translations should be used, false for default fields
   */
  private static boolean shouldUseTranslations(String locale) {
    return !nullOrEmpty(locale) && !DEFAULT_LOCALE.equals(locale);
  }

  /**
   * Adds queries for default displayName and description fields.
   *
   * @param shouldClauses The list of should clauses to add to
   * @param searchText The text to search for
   * @param boost The boost factor for these queries
   */
  private static void addDefaultFieldQueries(
      List<Map<String, Object>> shouldClauses, String searchText, double boost) {

    // Search in displayName
    shouldClauses.add(
        Map.of("match", Map.of("displayName", Map.of("query", searchText, "boost", 5.0 * boost))));

    // Search in displayName.keyword for exact matches
    shouldClauses.add(
        Map.of(
            "term",
            Map.of("displayName.keyword", Map.of("value", searchText, "boost", 10.0 * boost))));

    // Search in description
    shouldClauses.add(
        Map.of("match", Map.of("description", Map.of("query", searchText, "boost", 2.0 * boost))));

    // Search in name field as well
    shouldClauses.add(
        Map.of("match", Map.of("name", Map.of("query", searchText, "boost", 3.0 * boost))));
  }

  /**
   * Adds translation-specific query clauses for a given locale.
   *
   * @param shouldClauses The list of should clauses to add to
   * @param searchText The text to search for
   * @param locale The locale to search in
   */
  private static void addTranslationQueries(
      List<Map<String, Object>> shouldClauses, String searchText, String locale) {

    // Build locale fallback chain (e.g., es-MX -> es)
    List<String> localeChain = buildLocaleFallbackChain(locale);

    double boostMultiplier = 1.0;
    for (String searchLocale : localeChain) {
      if (DEFAULT_LOCALE.equals(searchLocale)) {
        continue; // Skip default locale, it's handled by default fields
      }

      // Search in locale-specific display name with decreasing boost for fallbacks
      shouldClauses.add(
          Map.of(
              "match",
              Map.of(
                  String.format("translations.%s.displayName", searchLocale),
                  Map.of("query", searchText, "boost", 5.0 * boostMultiplier))));

      // Search in locale-specific description
      shouldClauses.add(
          Map.of(
              "match",
              Map.of(
                  String.format("translations.%s.description", searchLocale),
                  Map.of("query", searchText, "boost", 2.0 * boostMultiplier))));

      // Search in locale-specific columns (for entities with columns)
      addNestedFieldQueries(shouldClauses, searchText, searchLocale, "columns", boostMultiplier);

      // Search in locale-specific message schema fields (for topics)
      addNestedFieldQueries(
          shouldClauses, searchText, searchLocale, "messageSchemaFields", boostMultiplier);

      // Reduce boost for fallback locales
      boostMultiplier *= 0.8;
    }
  }

  /**
   * Adds queries for nested fields like columns or message schema fields.
   *
   * @param shouldClauses The list of should clauses to add to
   * @param searchText The text to search for
   * @param locale The locale to search in
   * @param fieldType The type of nested field (columns or messageSchemaFields)
   * @param boostMultiplier The boost multiplier for these queries
   */
  private static void addNestedFieldQueries(
      List<Map<String, Object>> shouldClauses,
      String searchText,
      String locale,
      String fieldType,
      double boostMultiplier) {

    // Search in nested field display names
    shouldClauses.add(
        Map.of(
            "match",
            Map.of(
                String.format("translations.%s.%s.*.displayName", locale, fieldType),
                Map.of("query", searchText, "boost", 2.0 * boostMultiplier))));

    // Search in nested field descriptions
    shouldClauses.add(
        Map.of(
            "match",
            Map.of(
                String.format("translations.%s.%s.*.description", locale, fieldType),
                Map.of("query", searchText, "boost", 1.0 * boostMultiplier))));
  }

  /**
   * Adds fuzzy search queries for better recall.
   *
   * @param shouldClauses The list of should clauses to add to
   * @param searchText The text to search for
   * @param locale The user's locale
   */
  private static void addFuzzySearchQueries(
      List<Map<String, Object>> shouldClauses, String searchText, String locale) {

    // Fuzzy search on concatenated translations text if available
    shouldClauses.add(
        Map.of(
            "match",
            Map.of(
                "translationsSearchText",
                Map.of("query", searchText, "fuzziness", "AUTO", "boost", 0.5))));

    // Fuzzy search on column names
    shouldClauses.add(
        Map.of(
            "match",
            Map.of(
                "columnNamesFuzzy",
                Map.of("query", searchText, "fuzziness", "AUTO", "boost", 0.3))));

    // Fuzzy search on field names (for topics)
    shouldClauses.add(
        Map.of(
            "match",
            Map.of(
                "fieldNamesFuzzy",
                Map.of("query", searchText, "fuzziness", "AUTO", "boost", 0.3))));
  }

  /**
   * Builds a language fallback chain for search.
   * For example: es-MX -> es -> en
   *
   * @param locale The requested locale
   * @return List of locales to try in order
   */
  public static List<String> buildLocaleFallbackChain(String locale) {
    List<String> chain = new ArrayList<>();

    if (nullOrEmpty(locale)) {
      chain.add(DEFAULT_LOCALE);
      return chain;
    }

    // Add the specific locale first
    chain.add(locale);

    // If locale has a region (e.g., es-MX), add the base language (es)
    if (locale.contains("-")) {
      String baseLanguage = locale.substring(0, locale.indexOf("-"));
      if (!chain.contains(baseLanguage)) {
        chain.add(baseLanguage);
      }
    }

    // Always fall back to default locale if not already in the chain
    if (!chain.contains(DEFAULT_LOCALE)) {
      chain.add(DEFAULT_LOCALE);
    }

    return chain;
  }

  /**
   * Creates a filter to find entities with translations in a specific locale.
   *
   * @param locale The locale to filter by
   * @return Filter query for entities with translations in the locale
   */
  public static Map<String, Object> createTranslationExistsFilter(String locale) {
    if (nullOrEmpty(locale) || DEFAULT_LOCALE.equals(locale)) {
      return null; // No filter needed for default locale
    }

    return Map.of("exists", Map.of("field", String.format("translations.%s", locale)));
  }

  /**
   * Creates aggregations for faceted search with translation support.
   *
   * @param locale The locale for translation aggregations
   * @return Map containing aggregation definitions
   */
  public static Map<String, Object> createTranslationAggregations(String locale) {
    Map<String, Object> aggregations = new HashMap<>();

    // Aggregation for available translation locales
    aggregations.put(
        "available_locales",
        Map.of("terms", Map.of("field", "availableTranslationLocales", "size", 50)));

    // Count of entities with translations in specific locale
    if (!nullOrEmpty(locale) && !DEFAULT_LOCALE.equals(locale)) {
      aggregations.put(
          "has_" + locale + "_translation",
          Map.of("filter", Map.of("exists", Map.of("field", "translations." + locale))));
    }

    return aggregations;
  }

  /**
   * Creates a highlight configuration for multi-language search results.
   *
   * @param locale The locale to prioritize in highlighting
   * @return Map containing highlight configuration
   */
  public static Map<String, Object> createHighlightConfig(String locale) {
    Map<String, Object> highlight = new HashMap<>();

    List<Map<String, Object>> fields = new ArrayList<>();

    boolean useTranslations = shouldUseTranslations(locale);

    if (useTranslations) {
      // Prioritize translation fields for highlighting
      List<String> localeChain = buildLocaleFallbackChain(locale);
      for (String searchLocale : localeChain) {
        if (!DEFAULT_LOCALE.equals(searchLocale)) {
          fields.add(Map.of("field", String.format("translations.%s.displayName", searchLocale)));
          fields.add(Map.of("field", String.format("translations.%s.description", searchLocale)));
        }
      }
    }

    // Always include default fields
    fields.add(Map.of("field", "displayName"));
    fields.add(Map.of("field", "description"));
    fields.add(Map.of("field", "name"));

    highlight.put("fields", fields);
    highlight.put("pre_tags", List.of("<mark>"));
    highlight.put("post_tags", List.of("</mark>"));
    highlight.put("fragment_size", 200);
    highlight.put("number_of_fragments", 3);

    return highlight;
  }
}
