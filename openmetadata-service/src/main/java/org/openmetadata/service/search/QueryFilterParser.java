package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

/**
 * Parser for Elasticsearch query filters to extract field-value pairs.
 * Supports both JSON Query DSL and simple query strings.
 */
@Slf4j
public class QueryFilterParser {

  private static final ObjectMapper mapper = new ObjectMapper();
  private static final String NEGATED_FIELD_PREFIX = "!";
  private static final String EXISTS_SENTINEL = "__exists__";
  private static final String PREFIX_SENTINEL_PREFIX = "__prefix__:";
  private static final String RANGE_SENTINEL_PREFIX = "__range__:";

  public enum MatchType {
    EXACT,
    PARTIAL
  }

  public static final class FieldMatch {
    private MatchType matchType;
    private final List<String> values = new ArrayList<>();

    public MatchType getMatchType() {
      return matchType;
    }

    public List<String> getValues() {
      return Collections.unmodifiableList(values);
    }

    private void addValue(String value, MatchType newMatchType) {
      if (matchType == null) {
        matchType = newMatchType;
      } else if (matchType != newMatchType) {
        // Mixed match types on the same field should stay permissive.
        matchType = MatchType.PARTIAL;
      }
      values.add(value);
    }
  }

  private QueryFilterParser() {}

  /**
   * Parses a query filter into clause-level field matches while preserving exact vs partial match
   * semantics.
   */
  public static List<Map<String, FieldMatch>> parseTypedFilterClauses(String queryFilter) {
    if (nullOrEmpty(queryFilter)) {
      return new ArrayList<>();
    }

    String trimmed = queryFilter.trim();
    if (!trimmed.startsWith("{")) {
      List<Map<String, FieldMatch>> clauses = new ArrayList<>();
      clauses.add(parseTypedQueryString(trimmed));

      return clauses;
    }

    List<Map<String, FieldMatch>> clauses = new ArrayList<>();
    try {
      JsonNode rootNode = mapper.readTree(trimmed);
      JsonNode queryNode = rootNode.has("query") ? rootNode.get("query") : rootNode;

      if (queryNode.has("bool")) {
        JsonNode boolNode = queryNode.get("bool");
        addTypedClausesFromNode(boolNode.get("must"), clauses, false);
        addTypedClausesFromNode(boolNode.get("filter"), clauses, false);
        addTypedClausesFromNode(boolNode.get("must_not"), clauses, true);
      }

      if (clauses.isEmpty()) {
        Map<String, FieldMatch> fieldValues = new HashMap<>();
        extractTypedTermsFromNode(queryNode, fieldValues);
        if (!fieldValues.isEmpty()) {
          clauses.add(fieldValues);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse JSON query filter clauses: {}", trimmed, e);
    }

    return clauses;
  }

  /**
   * Parses a query filter into separate clauses preserving AND semantics.
   * Each must clause becomes a separate map so multiple terms on the same field
   * (e.g., two tags.tagFQN terms) are evaluated independently.
   */
  public static List<Map<String, List<String>>> parseFilterClauses(String queryFilter) {
    if (nullOrEmpty(queryFilter)) {
      return new ArrayList<>();
    }
    String trimmed = queryFilter.trim();
    if (!trimmed.startsWith("{")) {
      List<Map<String, List<String>>> clauses = new ArrayList<>();
      clauses.add(parseQueryString(trimmed));
      return clauses;
    }

    List<Map<String, List<String>>> clauses = new ArrayList<>();
    try {
      JsonNode rootNode = mapper.readTree(trimmed);
      JsonNode queryNode = rootNode.has("query") ? rootNode.get("query") : rootNode;

      if (queryNode.has("bool")) {
        JsonNode boolNode = queryNode.get("bool");
        addClausesFromNode(boolNode.get("must"), clauses, false);
        addClausesFromNode(boolNode.get("filter"), clauses, false);
        addClausesFromNode(boolNode.get("must_not"), clauses, true);
      }

      if (clauses.isEmpty()) {
        Map<String, List<String>> fieldValues = new HashMap<>();
        extractTermsFromNode(queryNode, fieldValues);
        if (!fieldValues.isEmpty()) {
          clauses.add(fieldValues);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse JSON query filter clauses: {}", trimmed, e);
    }
    return clauses;
  }

  /**
   * Checks if entity matches filter using clause-based AND semantics.
   * Each clause is evaluated independently — entity must match ALL clauses.
   */
  public static boolean matchesFilterClauses(
      Map<String, Object> entityMap, List<Map<String, List<String>>> clauses) {
    if (entityMap == null || clauses == null || clauses.isEmpty()) {
      return false;
    }
    for (Map<String, List<String>> clause : clauses) {
      if (!matchesFilter(entityMap, clause)) {
        return false;
      }
    }
    return true;
  }

  public static boolean matchesTypedFilterClauses(
      Map<String, Object> entityMap, List<Map<String, FieldMatch>> clauses) {
    if (entityMap == null || clauses == null || clauses.isEmpty()) {
      return false;
    }

    for (Map<String, FieldMatch> clause : clauses) {
      if (!matchesTypedFilter(entityMap, clause)) {
        return false;
      }
    }

    return true;
  }

  public static Map<String, List<String>> parseFilter(String queryFilter) {
    if (nullOrEmpty(queryFilter)) {
      return new HashMap<>();
    }

    String trimmed = queryFilter.trim();

    // Check if it's JSON (starts with '{')
    if (trimmed.startsWith("{")) {
      return parseJsonFilter(trimmed);
    } else {
      return parseQueryString(trimmed);
    }
  }

  /**
   * Parses ES Query DSL JSON to extract field-value pairs.
   * Handles term, terms, match queries inside bool must/should clauses.
   */
  private static Map<String, List<String>> parseJsonFilter(String jsonFilter) {
    Map<String, List<String>> fieldValues = new HashMap<>();

    try {
      JsonNode rootNode = mapper.readTree(jsonFilter);

      // Handle {"query": {...}} wrapper
      JsonNode queryNode = rootNode.has("query") ? rootNode.get("query") : rootNode;

      // Extract terms from the query
      extractTermsFromNode(queryNode, fieldValues);

    } catch (Exception e) {
      LOG.warn("Failed to parse JSON query filter: {}", jsonFilter, e);
    }

    return fieldValues;
  }

  private static Map<String, FieldMatch> parseTypedQueryString(String queryString) {
    Map<String, FieldMatch> fieldValues = new HashMap<>();
    List<String> parts = tokenizeQueryString(queryString);

    for (String part : parts) {
      if (part.contains(":")) {
        String[] fieldValue = part.split(":", 2);
        if (fieldValue.length == 2) {
          addFieldValue(
              fieldValues,
              normalizeFieldName(fieldValue[0]),
              stripMatchingQuotes(fieldValue[1]),
              MatchType.PARTIAL);
        }
      }
    }

    return fieldValues;
  }

  /**
   * Recursively extracts field-value pairs from JSON query nodes.
   */
  private static void extractTermsFromNode(JsonNode node, Map<String, List<String>> fieldValues) {
    if (node == null) {
      return;
    }

    // Handle bool queries
    if (node.has("bool")) {
      JsonNode boolNode = node.get("bool");
      if (boolNode.has("must")) {
        extractFromArray(boolNode.get("must"), fieldValues);
      }
      if (boolNode.has("should")) {
        extractFromArray(boolNode.get("should"), fieldValues);
      }
      if (boolNode.has("filter")) {
        extractFromArray(boolNode.get("filter"), fieldValues);
      }
      if (boolNode.has("must_not")) {
        extractNegatedFromArray(boolNode.get("must_not"), fieldValues);
      }
    }

    // Handle term queries
    if (node.has("term")) {
      extractTermQuery(node.get("term"), fieldValues);
    }

    // Handle terms queries
    if (node.has("terms")) {
      extractTermsQuery(node.get("terms"), fieldValues);
    }

    // Handle match queries
    if (node.has("match")) {
      extractMatchQuery(node.get("match"), fieldValues);
    }

    // Handle wildcard queries
    if (node.has("wildcard")) {
      extractWildcardQuery(node.get("wildcard"), fieldValues);
    }

    if (node.has("prefix")) {
      extractPrefixQuery(node.get("prefix"), fieldValues);
    }

    if (node.has("exists")) {
      extractExistsQuery(node.get("exists"), fieldValues);
    }

    if (node.has("range")) {
      extractRangeQuery(node.get("range"), fieldValues);
    }
  }

  private static void extractTypedTermsFromNode(
      JsonNode node, Map<String, FieldMatch> fieldValues) {
    if (node == null) {
      return;
    }

    if (node.has("bool")) {
      JsonNode boolNode = node.get("bool");
      if (boolNode.has("must")) {
        extractTypedFromArray(boolNode.get("must"), fieldValues);
      }
      if (boolNode.has("should")) {
        extractTypedFromArray(boolNode.get("should"), fieldValues);
      }
      if (boolNode.has("filter")) {
        extractTypedFromArray(boolNode.get("filter"), fieldValues);
      }
      if (boolNode.has("must_not")) {
        extractTypedNegatedFromArray(boolNode.get("must_not"), fieldValues);
      }
    }

    if (node.has("term")) {
      extractTypedTermQuery(node.get("term"), fieldValues);
    }

    if (node.has("terms")) {
      extractTypedTermsQuery(node.get("terms"), fieldValues);
    }

    if (node.has("match")) {
      extractTypedMatchQuery(node.get("match"), fieldValues);
    }

    if (node.has("wildcard")) {
      extractTypedWildcardQuery(node.get("wildcard"), fieldValues);
    }

    if (node.has("prefix")) {
      extractTypedPrefixQuery(node.get("prefix"), fieldValues);
    }

    if (node.has("exists")) {
      extractTypedExistsQuery(node.get("exists"), fieldValues);
    }

    if (node.has("range")) {
      extractTypedRangeQuery(node.get("range"), fieldValues);
    }
  }

  /**
   * Extracts terms from array nodes (e.g., must, should clauses).
   */
  private static void extractFromArray(JsonNode arrayNode, Map<String, List<String>> fieldValues) {
    if (arrayNode.isArray()) {
      arrayNode.forEach(item -> extractTermsFromNode(item, fieldValues));
    } else {
      extractTermsFromNode(arrayNode, fieldValues);
    }
  }

  private static void extractTypedFromArray(
      JsonNode arrayNode, Map<String, FieldMatch> fieldValues) {
    if (arrayNode.isArray()) {
      arrayNode.forEach(item -> extractTypedTermsFromNode(item, fieldValues));
    } else {
      extractTypedTermsFromNode(arrayNode, fieldValues);
    }
  }

  private static void extractNegatedFromArray(
      JsonNode arrayNode, Map<String, List<String>> fieldValues) {
    if (arrayNode == null) {
      return;
    }

    if (arrayNode.isArray()) {
      arrayNode.forEach(item -> extractNegatedClause(item, fieldValues));
    } else {
      extractNegatedClause(arrayNode, fieldValues);
    }
  }

  private static void extractTypedNegatedFromArray(
      JsonNode arrayNode, Map<String, FieldMatch> fieldValues) {
    if (arrayNode == null) {
      return;
    }

    if (arrayNode.isArray()) {
      arrayNode.forEach(item -> extractTypedNegatedClause(item, fieldValues));
    } else {
      extractTypedNegatedClause(arrayNode, fieldValues);
    }
  }

  /**
   * Extracts field-value from term query: {"term": {"field": "value"}}.
   */
  private static void extractTermQuery(JsonNode termNode, Map<String, List<String>> fieldValues) {
    termNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              String value = entry.getValue().asText();
              fieldValues.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(value);
            });
  }

  private static void extractTypedTermQuery(
      JsonNode termNode, Map<String, FieldMatch> fieldValues) {
    termNode
        .fields()
        .forEachRemaining(
            entry ->
                addFieldValue(
                    fieldValues,
                    normalizeFieldName(entry.getKey()),
                    entry.getValue().asText(),
                    MatchType.EXACT));
  }

  /**
   * Extracts field-values from terms query: {"terms": {"field": ["value1", "value2"]}}.
   */
  private static void extractTermsQuery(JsonNode termsNode, Map<String, List<String>> fieldValues) {
    termsNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              JsonNode valuesNode = entry.getValue();
              if (valuesNode.isArray()) {
                valuesNode.forEach(
                    v ->
                        fieldValues
                            .computeIfAbsent(fieldName, k -> new ArrayList<>())
                            .add(v.asText()));
              }
            });
  }

  private static void extractTypedTermsQuery(
      JsonNode termsNode, Map<String, FieldMatch> fieldValues) {
    termsNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              JsonNode valuesNode = entry.getValue();
              if (valuesNode.isArray()) {
                valuesNode.forEach(
                    value ->
                        addFieldValue(fieldValues, fieldName, value.asText(), MatchType.EXACT));
              }
            });
  }

  /**
   * Extracts field-value from match query: {"match": {"field": "value"}}.
   */
  private static void extractMatchQuery(JsonNode matchNode, Map<String, List<String>> fieldValues) {
    matchNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              String value = entry.getValue().asText();
              fieldValues.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(value);
            });
  }

  private static void extractTypedMatchQuery(
      JsonNode matchNode, Map<String, FieldMatch> fieldValues) {
    matchNode
        .fields()
        .forEachRemaining(
            entry ->
                addFieldValue(
                    fieldValues,
                    normalizeFieldName(entry.getKey()),
                    entry.getValue().asText(),
                    MatchType.PARTIAL));
  }

  /**
   * Extracts field-value from wildcard query: {"wildcard": {"field": {"value": "*pattern*"}}}.
   * Converts wildcard pattern to simple search term by removing * characters.
   */
  private static void extractWildcardQuery(
      JsonNode wildcardNode, Map<String, List<String>> fieldValues) {
    wildcardNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              JsonNode valueNode = entry.getValue();
              String value;

              // Handle both {"field": "pattern"} and {"field": {"value": "pattern"}} formats
              if (valueNode.isObject() && valueNode.has("value")) {
                value = valueNode.get("value").asText();
              } else {
                value = valueNode.asText();
              }

              // Remove wildcard characters for simple contains matching
              value = value.replace("*", "").replace("?", "");

              if (!value.isEmpty()) {
                fieldValues.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(value);
              }
            });
  }

  private static void extractTypedWildcardQuery(
      JsonNode wildcardNode, Map<String, FieldMatch> fieldValues) {
    wildcardNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              JsonNode valueNode = entry.getValue();
              String value;

              if (valueNode.isObject() && valueNode.has("value")) {
                value = valueNode.get("value").asText();
              } else {
                value = valueNode.asText();
              }

              value = value.replace("*", "").replace("?", "");
              if (!value.isEmpty()) {
                addFieldValue(fieldValues, fieldName, value, MatchType.PARTIAL);
              }
            });
  }

  private static void extractPrefixQuery(
      JsonNode prefixNode, Map<String, List<String>> fieldValues) {
    prefixNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              JsonNode valueNode = entry.getValue();
              String value =
                  valueNode.isObject() && valueNode.has("value")
                      ? valueNode.get("value").asText()
                      : valueNode.asText();
              if (!value.isEmpty()) {
                fieldValues
                    .computeIfAbsent(fieldName, ignored -> new ArrayList<>())
                    .add(PREFIX_SENTINEL_PREFIX + value);
              }
            });
  }

  private static void extractTypedPrefixQuery(
      JsonNode prefixNode, Map<String, FieldMatch> fieldValues) {
    prefixNode
        .fields()
        .forEachRemaining(
            entry -> {
              String fieldName = normalizeFieldName(entry.getKey());
              JsonNode valueNode = entry.getValue();
              String value =
                  valueNode.isObject() && valueNode.has("value")
                      ? valueNode.get("value").asText()
                      : valueNode.asText();
              if (!value.isEmpty()) {
                addFieldValue(
                    fieldValues, fieldName, PREFIX_SENTINEL_PREFIX + value, MatchType.PARTIAL);
              }
            });
  }

  private static void extractExistsQuery(
      JsonNode existsNode, Map<String, List<String>> fieldValues) {
    if (existsNode.has("field")) {
      fieldValues
          .computeIfAbsent(
              normalizeFieldName(existsNode.get("field").asText()), ignored -> new ArrayList<>())
          .add(EXISTS_SENTINEL);
    }
  }

  private static void extractTypedExistsQuery(
      JsonNode existsNode, Map<String, FieldMatch> fieldValues) {
    if (existsNode.has("field")) {
      addFieldValue(
          fieldValues,
          normalizeFieldName(existsNode.get("field").asText()),
          EXISTS_SENTINEL,
          MatchType.EXACT);
    }
  }

  private static void extractRangeQuery(JsonNode rangeNode, Map<String, List<String>> fieldValues) {
    rangeNode
        .fields()
        .forEachRemaining(
            entry -> {
              String serializedRange = serializeRange(entry.getValue());
              if (!serializedRange.isEmpty()) {
                fieldValues
                    .computeIfAbsent(
                        normalizeFieldName(entry.getKey()), ignored -> new ArrayList<>())
                    .add(serializedRange);
              }
            });
  }

  private static void extractTypedRangeQuery(
      JsonNode rangeNode, Map<String, FieldMatch> fieldValues) {
    rangeNode
        .fields()
        .forEachRemaining(
            entry -> {
              String serializedRange = serializeRange(entry.getValue());
              if (!serializedRange.isEmpty()) {
                addFieldValue(
                    fieldValues,
                    normalizeFieldName(entry.getKey()),
                    serializedRange,
                    MatchType.EXACT);
              }
            });
  }

  /**
   * Parses simple query string format: "field:value" or "field.subfield:value".
   */
  private static Map<String, List<String>> parseQueryString(String queryString) {
    Map<String, List<String>> fieldValues = new HashMap<>();

    List<String> parts = tokenizeQueryString(queryString);

    for (String part : parts) {
      if (part.contains(":")) {
        String[] fieldValue = part.split(":", 2);
        if (fieldValue.length == 2) {
          String fieldName = normalizeFieldName(fieldValue[0]);
          String value = stripMatchingQuotes(fieldValue[1]);
          fieldValues.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(value);
        }
      }
    }

    return fieldValues;
  }

  /**
   * Normalizes field names by removing .keyword suffix and extracting base field.
   * Example: "owners.displayName.keyword" -> "owners.displayName"
   */
  private static String normalizeFieldName(String fieldName) {
    if (fieldName == null) {
      return "";
    }

    // Remove .keyword suffix
    if (fieldName.endsWith(".keyword")) {
      fieldName = fieldName.substring(0, fieldName.length() - ".keyword".length());
    }

    return fieldName;
  }

  /**
   * Checks if a node matches the parsed filter criteria.
   *
   * @param entityMap The entity document as a map
   * @param parsedFilter The parsed filter (field -> values)
   * @return true if the entity matches all filter criteria
   */
  public static boolean matchesFilter(
      Map<String, Object> entityMap, Map<String, List<String>> parsedFilter) {
    if (entityMap == null || parsedFilter == null || parsedFilter.isEmpty()) {
      return false;
    }

    // If filter contains name/displayName search, evaluate those with OR logic
    // and all other filters with AND logic
    if (hasNameSearch(parsedFilter)) {
      if (!matchesNameSearch(entityMap, parsedFilter)) {
        return false;
      }
    }

    // Check each non-name filter field (AND logic)
    for (Map.Entry<String, List<String>> entry : parsedFilter.entrySet()) {
      String fieldPath = entry.getKey();
      boolean negated = fieldPath.startsWith(NEGATED_FIELD_PREFIX);
      String actualFieldPath =
          negated ? fieldPath.substring(NEGATED_FIELD_PREFIX.length()) : fieldPath;

      // Skip name/displayName — already handled above with OR logic
      if (actualFieldPath.equals("name") || actualFieldPath.equals("displayName")) {
        continue;
      }

      List<String> requiredValues = entry.getValue();
      Object fieldValue = getNestedFieldValue(entityMap, actualFieldPath);

      boolean matches = matchesAnyValue(fieldValue, requiredValues);
      if (negated ? matches : !matches) {
        return false;
      }
    }

    return true;
  }

  public static boolean matchesFilter(Map<String, Object> entityMap, String queryFilter) {
    return matchesTypedFilterClauses(entityMap, parseTypedFilterClauses(queryFilter));
  }

  private static boolean matchesTypedFilter(
      Map<String, Object> entityMap, Map<String, FieldMatch> parsedFilter) {
    if (entityMap == null || parsedFilter == null || parsedFilter.isEmpty()) {
      return false;
    }

    boolean hasTypedNameSearch = hasTypedNameSearch(parsedFilter);
    if (hasTypedNameSearch && !matchesTypedNameSearch(entityMap, parsedFilter)) {
      return false;
    }

    for (Map.Entry<String, FieldMatch> entry : parsedFilter.entrySet()) {
      String fieldPath = entry.getKey();
      boolean negated = fieldPath.startsWith(NEGATED_FIELD_PREFIX);
      String actualFieldPath =
          negated ? fieldPath.substring(NEGATED_FIELD_PREFIX.length()) : fieldPath;
      if (hasTypedNameSearch
          && (actualFieldPath.equals("name") || actualFieldPath.equals("displayName"))) {
        continue;
      }

      Object fieldValue = getNestedFieldValue(entityMap, actualFieldPath);
      boolean matches =
          matchesAnyValue(
              fieldValue, entry.getValue().getValues(), entry.getValue().getMatchType());
      if (negated ? matches : !matches) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets nested field value from entity map using dot notation.
   * Example: "owners.displayName" -> entityMap.get("owners") -> extract displayName from each owner
   * Handles both single objects and arrays.
   */
  private static Object getNestedFieldValue(Map<String, Object> entityMap, String fieldPath) {
    String[] parts = fieldPath.split("\\.");
    Object current = entityMap;

    for (String part : parts) {
      if (current instanceof Map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) current;
        current = map.get(part);
      } else if (current instanceof List) {
        // Handle arrays - extract the field from each item
        @SuppressWarnings("unchecked")
        List<Object> list = (List<Object>) current;
        List<Object> extractedValues = new ArrayList<>();

        for (Object item : list) {
          if (item instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> itemMap = (Map<String, Object>) item;
            Object value = itemMap.get(part);
            if (value != null) {
              extractedValues.add(value);
            }
          }
        }

        // Return extracted values, or null if field not found in any list item
        current = extractedValues.isEmpty() ? null : extractedValues;
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Checks if a field value matches any of the required values.
   * Handles single values, arrays, and objects (e.g., owners, tags, domain).
   */
  private static boolean matchesAnyValue(Object fieldValue, List<String> requiredValues) {
    if (fieldValue == null || requiredValues == null || requiredValues.isEmpty()) {
      return false;
    }

    // If field value is a list (e.g., owners, tags)
    if (fieldValue instanceof List) {
      @SuppressWarnings("unchecked")
      List<Object> listValue = (List<Object>) fieldValue;
      for (Object item : listValue) {
        if (matchesSingleValue(item, requiredValues)) {
          return true;
        }
      }
      return false;
    }

    // Single value
    return matchesSingleValue(fieldValue, requiredValues);
  }

  private static boolean matchesAnyValue(
      Object fieldValue, List<String> requiredValues, MatchType matchType) {
    if (fieldValue == null || requiredValues == null || requiredValues.isEmpty()) {
      return false;
    }

    if (fieldValue instanceof List) {
      @SuppressWarnings("unchecked")
      List<Object> listValue = (List<Object>) fieldValue;
      for (Object item : listValue) {
        if (matchesSingleValue(item, requiredValues, matchType)) {
          return true;
        }
      }
      return false;
    }

    return matchesSingleValue(fieldValue, requiredValues, matchType);
  }

  /**
   * Checks if a single value matches any of the required values.
   * Uses case-insensitive substring matching to align with ES analyzed query behavior.
   */
  private static boolean matchesSingleValue(Object value, List<String> requiredValues) {
    if (value == null) {
      return false;
    }

    String valueStr;
    if (value instanceof Map) {
      @SuppressWarnings("unchecked")
      Map<String, Object> map = (Map<String, Object>) value;
      String displayName = (String) map.get("displayName");
      String name = (String) map.get("name");
      String tagFQN = (String) map.get("tagFQN");

      for (String required : requiredValues) {
        if (matchesRequiredValue(displayName, required, MatchType.PARTIAL)
            || matchesRequiredValue(name, required, MatchType.PARTIAL)
            || matchesRequiredValue(tagFQN, required, MatchType.PARTIAL)) {
          return true;
        }
      }
      return false;
    } else {
      valueStr = value.toString();
    }

    for (String required : requiredValues) {
      if (matchesRequiredValue(valueStr, required, MatchType.PARTIAL)) {
        return true;
      }
    }

    return false;
  }

  private static boolean matchesSingleValue(
      Object value, List<String> requiredValues, MatchType matchType) {
    if (value == null) {
      return false;
    }

    if (value instanceof Map) {
      @SuppressWarnings("unchecked")
      Map<String, Object> map = (Map<String, Object>) value;
      String displayName = (String) map.get("displayName");
      String name = (String) map.get("name");
      String tagFQN = (String) map.get("tagFQN");

      for (String required : requiredValues) {
        if (matchesRequiredValue(displayName, required, matchType)
            || matchesRequiredValue(name, required, matchType)
            || matchesRequiredValue(tagFQN, required, matchType)) {
          return true;
        }
      }
      return false;
    }

    String valueStr = value.toString();
    for (String required : requiredValues) {
      if (matchesRequiredValue(valueStr, required, matchType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if the filter contains a name/displayName search. Name searches have both name and
   * displayName with the same value (from wildcard query). Other filter keys may also be present.
   */
  private static boolean hasNameSearch(Map<String, List<String>> parsedFilter) {
    List<String> nameValues = parsedFilter.get("name");
    List<String> displayNameValues = parsedFilter.get("displayName");

    if (nameValues == null || displayNameValues == null) {
      return false;
    }

    // Check if both fields have the same values (indicates OR search)
    return nameValues.equals(displayNameValues);
  }

  private static boolean hasTypedNameSearch(Map<String, FieldMatch> parsedFilter) {
    FieldMatch nameValues = parsedFilter.get("name");
    FieldMatch displayNameValues = parsedFilter.get("displayName");

    if (nameValues == null || displayNameValues == null) {
      return false;
    }

    return nameValues.getMatchType() == displayNameValues.getMatchType()
        && nameValues.getValues().equals(displayNameValues.getValues());
  }

  /**
   * Matches entity against name search using OR logic.
   * Returns true if name OR displayName contains the search term.
   */
  private static boolean matchesNameSearch(
      Map<String, Object> entityMap, Map<String, List<String>> parsedFilter) {
    List<String> searchTerms = parsedFilter.get("name");
    if (searchTerms == null || searchTerms.isEmpty()) {
      return false;
    }

    Object nameValue = getNestedFieldValue(entityMap, "name");
    if (matchesAnyValue(nameValue, searchTerms)) {
      return true;
    }

    Object displayNameValue = getNestedFieldValue(entityMap, "displayName");
    if (matchesAnyValue(displayNameValue, searchTerms)) {
      return true;
    }

    return false;
  }

  private static boolean matchesTypedNameSearch(
      Map<String, Object> entityMap, Map<String, FieldMatch> parsedFilter) {
    FieldMatch searchTerms = parsedFilter.get("name");
    if (searchTerms == null || searchTerms.getValues().isEmpty()) {
      return false;
    }

    Object nameValue = getNestedFieldValue(entityMap, "name");
    if (matchesAnyValue(nameValue, searchTerms.getValues(), searchTerms.getMatchType())) {
      return true;
    }

    Object displayNameValue = getNestedFieldValue(entityMap, "displayName");
    return matchesAnyValue(displayNameValue, searchTerms.getValues(), searchTerms.getMatchType());
  }

  private static void addFieldValue(
      Map<String, FieldMatch> fieldValues, String fieldName, String value, MatchType matchType) {
    fieldValues.computeIfAbsent(fieldName, ignored -> new FieldMatch()).addValue(value, matchType);
  }

  private static boolean matchesString(String actual, String required, MatchType matchType) {
    if (actual == null || required == null) {
      return false;
    }

    String actualLower = actual.toLowerCase();
    String requiredLower = required.toLowerCase();

    return matchType == MatchType.EXACT
        ? actualLower.equals(requiredLower)
        : actualLower.contains(requiredLower);
  }

  private static boolean matchesRequiredValue(String actual, String required, MatchType matchType) {
    if (EXISTS_SENTINEL.equals(required)) {
      return actual != null;
    }

    if (required != null && required.startsWith(PREFIX_SENTINEL_PREFIX)) {
      if (actual == null) {
        return false;
      }
      return actual
          .toLowerCase()
          .startsWith(required.substring(PREFIX_SENTINEL_PREFIX.length()).toLowerCase());
    }

    if (required != null && required.startsWith(RANGE_SENTINEL_PREFIX)) {
      return matchesRange(actual, required.substring(RANGE_SENTINEL_PREFIX.length()));
    }

    return matchesString(actual, required, matchType);
  }

  private static boolean matchesRange(String actual, String serializedRange) {
    if (actual == null || serializedRange == null || serializedRange.isEmpty()) {
      return false;
    }

    for (String part : serializedRange.split(";")) {
      String[] operatorAndValue = part.split("=", 2);
      if (operatorAndValue.length != 2) {
        continue;
      }

      int comparison = compareRangeValues(actual, operatorAndValue[1]);
      switch (operatorAndValue[0]) {
        case "gt":
          if (!(comparison > 0)) {
            return false;
          }
          break;
        case "gte":
          if (!(comparison >= 0)) {
            return false;
          }
          break;
        case "lt":
          if (!(comparison < 0)) {
            return false;
          }
          break;
        case "lte":
          if (!(comparison <= 0)) {
            return false;
          }
          break;
        default:
          break;
      }
    }

    return true;
  }

  private static int compareRangeValues(String actual, String expected) {
    try {
      return Double.compare(Double.parseDouble(actual), Double.parseDouble(expected));
    } catch (NumberFormatException ignored) {
      return actual.compareToIgnoreCase(expected);
    }
  }

  private static String serializeRange(JsonNode rangeConfig) {
    if (rangeConfig == null || !rangeConfig.isObject()) {
      return "";
    }

    List<String> bounds = new ArrayList<>();
    for (String operator : List.of("gt", "gte", "lt", "lte")) {
      if (rangeConfig.has(operator)) {
        bounds.add(operator + "=" + rangeConfig.get(operator).asText());
      }
    }

    return bounds.isEmpty() ? "" : RANGE_SENTINEL_PREFIX + String.join(";", bounds);
  }

  private static List<String> tokenizeQueryString(String queryString) {
    List<String> tokens = new ArrayList<>();
    if (queryString == null) {
      return tokens;
    }

    StringBuilder current = new StringBuilder();
    boolean inQuotes = false;
    for (int index = 0; index < queryString.length(); index++) {
      char currentChar = queryString.charAt(index);
      if (currentChar == '"') {
        inQuotes = !inQuotes;
        current.append(currentChar);
        continue;
      }

      if (Character.isWhitespace(currentChar) && !inQuotes) {
        if (current.length() > 0) {
          tokens.add(current.toString());
          current.setLength(0);
        }
        continue;
      }

      current.append(currentChar);
    }

    if (current.length() > 0) {
      tokens.add(current.toString());
    }

    return tokens;
  }

  private static String stripMatchingQuotes(String value) {
    if (value == null || value.length() < 2) {
      return value;
    }

    return value.startsWith("\"") && value.endsWith("\"")
        ? value.substring(1, value.length() - 1)
        : value;
  }

  private static void addClausesFromNode(
      JsonNode node, List<Map<String, List<String>>> clauses, boolean negated) {
    if (node == null) {
      return;
    }

    if (node.isArray()) {
      node.forEach(item -> addClausesFromNode(item, clauses, negated));
      return;
    }

    Map<String, List<String>> clauseFields = new HashMap<>();
    extractTermsFromNode(node, clauseFields);
    if (!clauseFields.isEmpty()) {
      clauses.add(negated ? prefixNegatedFields(clauseFields) : clauseFields);
    }
  }

  private static void addTypedClausesFromNode(
      JsonNode node, List<Map<String, FieldMatch>> clauses, boolean negated) {
    if (node == null) {
      return;
    }

    if (node.isArray()) {
      node.forEach(item -> addTypedClausesFromNode(item, clauses, negated));
      return;
    }

    Map<String, FieldMatch> clauseFields = new HashMap<>();
    extractTypedTermsFromNode(node, clauseFields);
    if (!clauseFields.isEmpty()) {
      clauses.add(negated ? prefixNegatedFieldsTyped(clauseFields) : clauseFields);
    }
  }

  private static void extractNegatedClause(JsonNode node, Map<String, List<String>> fieldValues) {
    Map<String, List<String>> negatedFields = new HashMap<>();
    extractTermsFromNode(node, negatedFields);
    fieldValues.putAll(prefixNegatedFields(negatedFields));
  }

  private static void extractTypedNegatedClause(
      JsonNode node, Map<String, FieldMatch> fieldValues) {
    Map<String, FieldMatch> negatedFields = new HashMap<>();
    extractTypedTermsFromNode(node, negatedFields);
    fieldValues.putAll(prefixNegatedFieldsTyped(negatedFields));
  }

  private static Map<String, List<String>> prefixNegatedFields(Map<String, List<String>> fields) {
    Map<String, List<String>> prefixed = new HashMap<>();
    for (Map.Entry<String, List<String>> entry : fields.entrySet()) {
      prefixed.put(NEGATED_FIELD_PREFIX + entry.getKey(), entry.getValue());
    }
    return prefixed;
  }

  private static Map<String, FieldMatch> prefixNegatedFieldsTyped(Map<String, FieldMatch> fields) {
    Map<String, FieldMatch> prefixed = new HashMap<>();
    for (Map.Entry<String, FieldMatch> entry : fields.entrySet()) {
      prefixed.put(NEGATED_FIELD_PREFIX + entry.getKey(), entry.getValue());
    }
    return prefixed;
  }
}
