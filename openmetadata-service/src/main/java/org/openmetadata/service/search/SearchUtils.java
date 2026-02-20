package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.UPSTREAM_ENTITY_RELATIONSHIP_FIELD;
import static org.openmetadata.service.search.SearchClient.UPSTREAM_LINEAGE_FIELD;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;

import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import java.security.KeyStoreException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import javax.net.ssl.SSLContext;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpHost;
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

@Slf4j
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

  /**
   * Builds an array of HttpHost objects from the ElasticSearch configuration. Supports single host
   * or comma-separated list of hosts with optional ports.
   *
   * @param esConfig the ElasticSearch configuration
   * @param searchType the type of search engine (for logging purposes, e.g., "OpenSearch" or
   *     "Elasticsearch")
   * @return array of HttpHost objects
   * @throws IllegalArgumentException if host configuration is missing or invalid
   */
  public static HttpHost[] buildHttpHosts(ElasticSearchConfiguration esConfig, String searchType) {
    List<HttpHost> hosts = new ArrayList<>();
    String scheme = esConfig.getScheme();
    int defaultPort = esConfig.getPort() != null ? esConfig.getPort() : 9200;

    if (StringUtils.isNotEmpty(esConfig.getHost())) {
      String hostConfig = esConfig.getHost();
      if (hostConfig.contains(",")) {
        for (String hostEntry : hostConfig.split(",")) {
          hostEntry = hostEntry.trim();
          HttpHost httpHost = parseHostEntry(hostEntry, defaultPort, scheme, searchType);
          hosts.add(httpHost);
        }
        LOG.info("Configured {} with {} hosts", searchType, hosts.size());
      } else {
        HttpHost httpHost = parseHostEntry(hostConfig, defaultPort, scheme, searchType);
        hosts.add(httpHost);
        LOG.info(
            "Configured {} with single host: {}:{}",
            searchType,
            httpHost.getHostName(),
            httpHost.getPort());
      }
    } else {
      throw new IllegalArgumentException(
          String.format("'host' must be provided in %s configuration", searchType));
    }

    return hosts.toArray(new HttpHost[0]);
  }

  /**
   * Builds an array of HC5 HttpHost objects from the ElasticSearch configuration. Supports single
   * host or comma-separated list of hosts with optional ports. This method is for use with Apache
   * HttpClient 5.x (HC5) transports required by Elasticsearch 9.x and OpenSearch 3.x.
   *
   * @param esConfig the ElasticSearch configuration
   * @param searchType the type of search engine (for logging purposes, e.g., "OpenSearch" or
   *     "Elasticsearch")
   * @return array of HC5 HttpHost objects
   * @throws IllegalArgumentException if host configuration is missing or invalid
   */
  public static org.apache.hc.core5.http.HttpHost[] buildHttpHostsForHc5(
      ElasticSearchConfiguration esConfig, String searchType) {
    List<org.apache.hc.core5.http.HttpHost> hosts = new ArrayList<>();
    String scheme = esConfig.getScheme();
    int defaultPort = esConfig.getPort() != null ? esConfig.getPort() : 9200;

    if (StringUtils.isNotEmpty(esConfig.getHost())) {
      String hostConfig = esConfig.getHost();
      if (hostConfig.contains(",")) {
        for (String hostEntry : hostConfig.split(",")) {
          hostEntry = hostEntry.trim();
          org.apache.hc.core5.http.HttpHost httpHost =
              parseHostEntryForHc5(hostEntry, defaultPort, scheme, searchType);
          hosts.add(httpHost);
        }
        LOG.info("Configured {} with {} hosts (HC5)", searchType, hosts.size());
      } else {
        org.apache.hc.core5.http.HttpHost httpHost =
            parseHostEntryForHc5(hostConfig, defaultPort, scheme, searchType);
        hosts.add(httpHost);
        LOG.info(
            "Configured {} with single host (HC5): {}:{}",
            searchType,
            httpHost.getHostName(),
            httpHost.getPort());
      }
    } else {
      throw new IllegalArgumentException(
          String.format("'host' must be provided in %s configuration", searchType));
    }

    return hosts.toArray(new org.apache.hc.core5.http.HttpHost[0]);
  }

  private static org.apache.hc.core5.http.HttpHost parseHostEntryForHc5(
      String hostEntry, int defaultPort, String scheme, String searchType) {
    String[] parts = hostEntry.split(":");
    String host = parts[0].trim();
    int port = defaultPort;

    if (parts.length > 1) {
      String portStr = parts[1].trim();
      try {
        port = Integer.parseInt(portStr);
      } catch (NumberFormatException e) {
        throw new IllegalArgumentException(
            String.format(
                "Invalid port '%s' for host '%s' in %s configuration. Port must be a valid integer.",
                portStr, host, searchType));
      }
    }

    return new org.apache.hc.core5.http.HttpHost(scheme, host, port);
  }

  private static HttpHost parseHostEntry(
      String hostEntry, int defaultPort, String scheme, String searchType) {
    String[] parts = hostEntry.split(":");
    String host = parts[0].trim();
    int port = defaultPort;

    if (parts.length > 1) {
      String portStr = parts[1].trim();
      try {
        port = Integer.parseInt(portStr);
      } catch (NumberFormatException e) {
        throw new IllegalArgumentException(
            String.format(
                "Invalid port '%s' for host '%s' in %s configuration. Port must be a valid integer.",
                portStr, host, searchType));
      }
    }

    return new HttpHost(host, port, scheme);
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
