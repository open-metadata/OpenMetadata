package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchClient.UPSTREAM_LINEAGE_FIELD;

import java.security.KeyStoreException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.net.ssl.SSLContext;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.SSLUtil;

public final class SearchUtils {

  private SearchUtils() {}

  public static RelationshipRef getRelationshipRef(Map<String, Object> entityMap) {
    // This assumes these keys exists in the map, use it with caution
    return new RelationshipRef()
        .withId(UUID.fromString(entityMap.get("id").toString()))
        .withType(entityMap.get("entityType").toString())
        .withFullyQualifiedName(entityMap.get("fullyQualifiedName").toString())
        .withFqnHash(FullyQualifiedName.buildHash(entityMap.get("fullyQualifiedName").toString()));
  }

  public static List<EsLineageData> getUpstreamLineageIfExist(Map<String, Object> esDoc) {
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

  public static String getLineageDirection(LineageDirection direction, String entityType) {
    boolean notPipelineOrStoredProcedure =
        Boolean.FALSE.equals(entityType.equals(Entity.PIPELINE))
            && Boolean.FALSE.equals(entityType.equals(Entity.STORED_PROCEDURE));
    if (LineageDirection.UPSTREAM.equals(direction)) {
      if (notPipelineOrStoredProcedure) {
        return "fullyQualifiedName";
      } else {
        return "upstreamLineage.pipeline.fullyQualifiedName";
      }
    } else {
      if (notPipelineOrStoredProcedure) {
        return "upstreamLineage.fromEntity.fullyQualifiedName";
      } else {
        return "upstreamLineage.pipeline.fullyQualifiedName";
      }
    }
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
}
