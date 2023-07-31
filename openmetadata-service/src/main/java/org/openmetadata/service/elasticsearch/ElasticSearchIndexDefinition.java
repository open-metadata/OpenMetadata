package org.openmetadata.service.elasticsearch;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;

@Slf4j
public class ElasticSearchIndexDefinition {
  public static final String ENTITY_REPORT_DATA = "entityReportData";
  public static final String WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA = "webAnalyticEntityViewReportData";
  public static final String WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA = "webAnalyticUserActivityReportData";
  final EnumMap<ElasticSearchIndexType, ElasticSearchIndexStatus> elasticSearchIndexes =
      new EnumMap<>(ElasticSearchIndexType.class);
  public static final Map<String, Object> ENTITY_TO_MAPPING_SCHEMA_MAP = new HashMap<>();

  private final SearchClient searchClient;

  public ElasticSearchIndexDefinition(SearchClient client) {
    this.searchClient = client;
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      elasticSearchIndexes.put(elasticSearchIndexType, ElasticSearchIndexStatus.NOT_CREATED);
    }
  }

  public enum ElasticSearchIndexStatus {
    CREATED,
    NOT_CREATED,
    FAILED
  }

  public enum ElasticSearchIndexType {
    TABLE_SEARCH_INDEX(Entity.TABLE, "table_search_index", "/elasticsearch/%s/table_index_mapping.json"),
    TOPIC_SEARCH_INDEX(Entity.TOPIC, "topic_search_index", "/elasticsearch/%s/topic_index_mapping.json"),
    DASHBOARD_SEARCH_INDEX(
        Entity.DASHBOARD, "dashboard_search_index", "/elasticsearch/%s/dashboard_index_mapping.json"),
    PIPELINE_SEARCH_INDEX(Entity.PIPELINE, "pipeline_search_index", "/elasticsearch/%s/pipeline_index_mapping.json"),
    USER_SEARCH_INDEX(Entity.USER, "user_search_index", "/elasticsearch/%s/user_index_mapping.json"),
    TEAM_SEARCH_INDEX(Entity.TEAM, "team_search_index", "/elasticsearch/%s/team_index_mapping.json"),
    GLOSSARY_SEARCH_INDEX(Entity.GLOSSARY, "glossary_search_index", "/elasticsearch/%s/glossary_index_mapping.json"),
    MLMODEL_SEARCH_INDEX(Entity.MLMODEL, "mlmodel_search_index", "/elasticsearch/%s/mlmodel_index_mapping.json"),
    CONTAINER_SEARCH_INDEX(
        Entity.CONTAINER, "container_search_index", "/elasticsearch/%s/container_index_mapping.json"),
    QUERY_SEARCH_INDEX(Entity.QUERY, "query_search_index", "/elasticsearch/%s/query_index_mapping.json"),
    TAG_SEARCH_INDEX(Entity.TAG, "tag_search_index", "/elasticsearch/%s/tag_index_mapping.json"),
    ENTITY_REPORT_DATA_INDEX(
        ENTITY_REPORT_DATA, "entity_report_data_index", "/elasticsearch/entity_report_data_index.json"),
    TEST_CASE_SEARCH_INDEX(
        Entity.TEST_CASE, "test_case_search_index", "/elasticsearch/%s/test_case_index_mapping.json"),
    WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX(
        Entity.WEB_ANALYTIC_EVENT,
        "web_analytic_entity_view_report_data_index",
        "/elasticsearch/web_analytic_entity_view_report_data_index.json"),
    WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX(
        WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
        "web_analytic_user_activity_report_data_index",
        "/elasticsearch/web_analytic_user_activity_report_data_index.json");

    public final String indexName;
    public final String indexMappingFile;
    public final String entityType;

    ElasticSearchIndexType(String entityType, String indexName, String indexMappingFile) {
      this.entityType = entityType;
      this.indexName = indexName;
      this.indexMappingFile = indexMappingFile;
    }
  }

  public void createIndexes(ElasticSearchConfiguration esConfig) {
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      searchClient.createIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
    }
  }

  public void updateIndexes(ElasticSearchConfiguration esConfig) {
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      searchClient.updateIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
    }
  }

  public void dropIndexes() {
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      searchClient.deleteIndex(elasticSearchIndexType);
    }
  }

  public static Map<String, Object> getIndexMappingSchema(Set<String> entities) {
    if (entities.contains("*")) {
      return ENTITY_TO_MAPPING_SCHEMA_MAP;
    }
    Map<String, Object> result = new HashMap<>();
    entities.forEach(entityType -> result.put(entityType, ENTITY_TO_MAPPING_SCHEMA_MAP.get(entityType)));
    return result;
  }
}
