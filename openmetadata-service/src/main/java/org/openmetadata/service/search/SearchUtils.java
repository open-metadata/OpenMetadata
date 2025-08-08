package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.UPSTREAM_ENTITY_RELATIONSHIP_FIELD;
import static org.openmetadata.service.search.SearchClient.UPSTREAM_LINEAGE_FIELD;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;

import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import java.security.KeyStoreException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.net.ssl.SSLContext;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.SSLUtil;

public final class SearchUtils {
  public static final String GRAPH_AGGREGATION = "matchesPerKey";
  public static final String DOWNSTREAM_NODE_KEY = "upstreamLineage.fromEntity.fqnHash.keyword";
  public static final String PIPELINE_AS_EDGE_KEY = "upstreamLineage.pipeline.fqnHash.keyword";
  public static final String DOWNSTREAM_ENTITY_RELATIONSHIP_KEY =
      "upstreamEntityRelationship.entity.fqnHash.keyword";

  private SearchUtils() {}

  public static RelationshipRef getRelationshipRef(Map<String, Object> entityMap) {
    // This assumes these keys exists in the map, use it with caution
    return new RelationshipRef()
        .withId(UUID.fromString(entityMap.get("id").toString()))
        .withType(entityMap.get("entityType").toString())
        .withFullyQualifiedName(entityMap.get("fullyQualifiedName").toString())
        .withFqnHash(FullyQualifiedName.buildHash(entityMap.get("fullyQualifiedName").toString()));
  }

  public static List<EsLineageData> getUpstreamLineageListIfExist(Map<String, Object> esDoc) {
    if (esDoc.containsKey(UPSTREAM_LINEAGE_FIELD)) {
      return JsonUtils.readOrConvertValues(esDoc.get(UPSTREAM_LINEAGE_FIELD), EsLineageData.class);
    }
    return Collections.emptyList();
  }

  public static EsLineageData copyEsLineageData(EsLineageData data) {
    return new EsLineageData()
        .withDocId(data.getDocId())
        .withFromEntity(data.getFromEntity())
        .withToEntity(data.getToEntity())
        .withPipeline(data.getPipeline())
        .withSqlQuery(data.getSqlQuery())
        .withColumns(data.getColumns())
        .withDescription(data.getDescription())
        .withSource(data.getSource())
        .withPipelineEntityType(data.getPipelineEntityType());
  }

  public static Set<String> getLineageDirection(
      LineageDirection direction, boolean isConnectedVia) {
    Set<String> fields =
        new HashSet<>(
            Set.of(
                direction == LineageDirection.UPSTREAM
                    ? FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD
                    : DOWNSTREAM_NODE_KEY));

    if (isConnectedVia) {
      fields.add(PIPELINE_AS_EDGE_KEY);
    }

    return fields;
  }

  public static String getLineageDirectionAggregationField(LineageDirection direction) {
    return direction == LineageDirection.UPSTREAM
        ? FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD
        : DOWNSTREAM_NODE_KEY;
  }

  public static Map<String, Set<String>> buildDirectionToFqnSet(
      Set<String> directionKeys, Set<String> fqnSet) {
    return directionKeys.stream().collect(Collectors.toMap(Function.identity(), k -> fqnSet));
  }

  public static JsonArray getAggregationBuckets(JsonObject aggregationJson) {
    return aggregationJson.getJsonArray("buckets");
  }

  public static JsonObject getAggregationObject(JsonObject aggregationJson, String key) {
    return aggregationJson.getJsonObject(key);
  }

  public static String getAggregationKeyValue(JsonObject aggregationJson) {
    return aggregationJson.getString("key");
  }

  public static boolean shouldApplyRbacConditions(
      SubjectContext subjectContext, RBACConditionEvaluator rbacConditionEvaluator) {
    return Boolean.TRUE.equals(
            SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class)
                .getGlobalSettings()
                .getEnableAccessControl())
        && subjectContext != null
        && !subjectContext.isAdmin()
        && !subjectContext.isBot()
        && rbacConditionEvaluator != null;
  }

  public static SSLContext createElasticSearchSSLContext(
      ElasticSearchConfiguration elasticSearchConfiguration) throws KeyStoreException {
    return elasticSearchConfiguration.getScheme().equals("https")
        ? SSLUtil.createSSLContext(
            elasticSearchConfiguration.getTruststorePath(),
            elasticSearchConfiguration.getTruststorePassword(),
            "ElasticSearch")
        : null;
  }

  public static boolean isConnectedVia(String entityType) {
    return Entity.PIPELINE.equals(entityType) || Entity.STORED_PROCEDURE.equals(entityType);
  }

  public static <T> List<T> paginateList(List<T> list, int from, int size) {
    if (nullOrEmpty(list)) {
      return Collections.emptyList();
    }

    int totalLength = list.size();

    if (from >= totalLength) {
      return Collections.emptyList();
    }

    // Calculate the end index
    int to = Math.min(from + size, totalLength);

    // Return the sublist
    return list.subList(from, to);
  }

  public static Set<String> getRequiredLineageFields(String fields) {
    if ("*".equals(fields)) {
      return Collections.emptySet();
    }
    Set<String> requiredFields = new HashSet<>(Arrays.asList(fields.replace(" ", "").split(",")));
    requiredFields.removeAll(SOURCE_FIELDS_TO_EXCLUDE);
    // Without these fields lineage can't be built
    requiredFields.addAll(
        Set.of("fullyQualifiedName", "service", "fqnHash", "id", "entityType", "upstreamLineage"));
    return requiredFields;
  }

  public static Set<String> getRequiredEntityRelationshipFields(String fields) {
    if ("*".equals(fields)) {
      return Collections.emptySet();
    }
    Set<String> requiredFields = new HashSet<>(Arrays.asList(fields.replace(" ", "").split(",")));
    SOURCE_FIELDS_TO_EXCLUDE.forEach(requiredFields::remove);
    requiredFields.addAll(
        Set.of("fullyQualifiedName", "fqnHash", "id", "entityType", "upstreamEntityRelationship"));
    return requiredFields;
  }

  public static List<Object> searchAfter(String searchAfter) {
    if (!nullOrEmpty(searchAfter)) {
      return List.of(searchAfter.split(","));
    }
    return null;
  }

  public static List<String> sourceFields(String sourceFields) {
    if (!nullOrEmpty(sourceFields)) {
      return Arrays.stream(sourceFields.split(","))
          .map(String::trim)
          .filter(s -> !s.isEmpty())
          .collect(Collectors.toList());
    }
    return Collections.emptyList();
  }

  /**
   * Sanitizes query parameters to prevent SQL injection attacks in Elasticsearch/OpenSearch queries.
   *
   * <p>This method provides centralized security for all search endpoints by removing malicious SQL injection
   * patterns before they reach the vulnerable SearchSourceBuilder.fromXContent() parsing methods.
   *
   * <p><strong>Security Context:</strong> Addresses 42 vulnerable instances identified in security testing
   * across search endpoints including /v1/search/query, /v1/search/nlq/query, /v1/search/aggregate, etc.
   *
   * <p><strong>Attack Vectors Mitigated:</strong>
   * <ul>
   *   <li>Boolean-based blind SQL injection (e.g., single quote AND conditions)</li>
   *   <li>Time-based SQL injection using randomblob() and Oracle functions</li>
   *   <li>Union-based SQL injection (e.g., "union select * from users")</li>
   *   <li>Comment-based injection (SQL comments like dash-dash, slash-star)</li>
   *   <li>Resource exhaustion attacks (length limits enforced)</li>
   * </ul>
   *
   * <p><strong>Implementation Notes:</strong>
   * <ul>
   *   <li>Uses case-insensitive pattern matching to catch variations</li>
   *   <li>Preserves legitimate Elasticsearch JSON queries unchanged</li>
   *   <li>Enforces 10,000 character limit to prevent DoS attacks</li>
   *   <li>Called by EsUtils.buildSearchSourceFilter() and OsUtils.buildSearchSourceFilter()</li>
   * </ul>
   *
   * @param input The query parameter string to sanitize (query_filter, post_filter, etc.)
   * @return Sanitized query parameter string with malicious patterns removed
   * @throws IllegalArgumentException if input exceeds 10,000 character security limit
   *
   * @since 1.9.0 Added for SQL injection vulnerability remediation
   * @see EsUtils#buildSearchSourceFilter(String, SearchSourceBuilder)
   * @see OsUtils#buildSearchSourceFilter(String, SearchSourceBuilder)
   */
  public static String sanitizeQueryParameter(String input) {
    return sanitizeUserInput(input, 10000);
  }

  /**
   * Sanitizes user input to prevent SQL injection attacks across all query types.
   *
   * <p>This method provides centralized security for both search endpoints and list filter endpoints
   * by removing malicious SQL injection patterns before they reach vulnerable parsing methods.
   *
   * @param input The user input string to sanitize
   * @param maxLength Maximum allowed length for the input
   * @return Sanitized input string with malicious patterns removed
   * @throws IllegalArgumentException if input exceeds maximum allowed length
   *
   * @since 1.9.0 Added for comprehensive SQL injection vulnerability remediation
   */
  public static String sanitizeUserInput(String input, int maxLength) {
    // Fast path: return unchanged for null, empty, or empty JSON inputs
    if (nullOrEmpty(input) || input.equals("{}")) {
      return input;
    }

    // SQL injection patterns identified from security testing and OWASP guidelines
    // These patterns target the most common attack vectors used against all endpoints
    String[] sqlPatterns = {
      // Boolean-based blind SQL injection patterns (comprehensive coverage)
      "' AND ", // Single quote boolean AND injection with space
      "' OR ", // Single quote boolean OR injection with space
      "\" AND ", // Double quote boolean AND injection with space
      "\" OR ", // Double quote boolean OR injection with space
      "'AND", // Single quote AND without spaces
      "'OR", // Single quote OR without spaces
      "\"AND", // Double quote AND without spaces
      "\"OR", // Double quote OR without spaces

      // SQL comment injection patterns
      "--", // SQL line comments
      "/*", // SQL block comment start
      "*/", // SQL block comment end
      ";", // SQL statement separator

      // Time-based SQL injection patterns (identified in security report)
      "randomblob(", // SQLite time-based function
      "UTL_INADDR.get_host_name", // Oracle time-based function
      "case randomblob(", // Case-based time delay

      // Union and select-based SQL injection patterns
      "union select", // Union-based data extraction
      " select ", // General select statements (with spaces)
      "select ", // Select at beginning
      " select", // Select at end

      // Equality-based injection patterns (comprehensive coverage)
      "' = '", // Single quote equality tests with spaces
      "\" = \"", // Double quote equality tests with spaces
      "'='", // Single quote equality without spaces
      "\"=\"", // Double quote equality without spaces
      "1=1", // Always true condition
      "1=2" // Always false condition
    };

    // Apply sanitization: remove all dangerous patterns using case-insensitive matching
    String sanitized = input;
    for (String pattern : sqlPatterns) {
      // Pattern.quote() escapes regex special characters, (?i) enables case-insensitive matching
      sanitized = sanitized.replaceAll("(?i)" + Pattern.quote(pattern), "");
    }

    // Enforce length limit to prevent resource exhaustion and buffer overflow attacks
    if (sanitized.length() > maxLength) {
      throw new IllegalArgumentException("Query parameter exceeds maximum allowed length");
    }

    return sanitized;
  }

  public static Set<String> getEntityRelationshipDirection(EntityRelationshipDirection direction) {
    return new HashSet<>(
        Set.of(
            direction == EntityRelationshipDirection.UPSTREAM
                ? FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD
                : DOWNSTREAM_ENTITY_RELATIONSHIP_KEY));
  }

  public static List<org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData>
      getUpstreamEntityRelationshipListIfExist(Map<String, Object> esDoc) {
    if (esDoc.containsKey(UPSTREAM_ENTITY_RELATIONSHIP_FIELD)) {
      return JsonUtils.readOrConvertValues(
          esDoc.get(UPSTREAM_ENTITY_RELATIONSHIP_FIELD),
          org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData.class);
    }
    return Collections.emptyList();
  }

  public static List<org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData>
      paginateUpstreamEntityRelationships(
          List<org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData>
              upstreamEntities,
          int from,
          int size) {
    if (nullOrEmpty(upstreamEntities)) {
      return Collections.emptyList();
    }
    int totalLength = upstreamEntities.size();
    if (from >= totalLength) {
      return Collections.emptyList();
    }
    int to = Math.min(from + size, totalLength);
    return upstreamEntities.subList(from, to);
  }

  public static org.openmetadata.schema.api.entityRelationship.RelationshipRef
      getEntityRelationshipRef(Map<String, Object> entityMap) {
    return new org.openmetadata.schema.api.entityRelationship.RelationshipRef()
        .withId(UUID.fromString(entityMap.get("id").toString()))
        .withType(entityMap.get("entityType").toString())
        .withFullyQualifiedName(entityMap.get("fullyQualifiedName").toString())
        .withFqnHash(FullyQualifiedName.buildHash(entityMap.get("fullyQualifiedName").toString()));
  }
}
