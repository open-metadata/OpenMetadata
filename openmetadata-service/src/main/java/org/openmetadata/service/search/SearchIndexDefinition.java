package org.openmetadata.service.search;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.Entity;

@Slf4j
public class SearchIndexDefinition {
  public static final String ENTITY_REPORT_DATA = "entityReportData";
  public static final String WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA = "webAnalyticEntityViewReportData";
  public static final String WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA = "webAnalyticUserActivityReportData";
  final EnumMap<ElasticSearchIndexType, ElasticSearchIndexStatus> elasticSearchIndexes =
      new EnumMap<>(ElasticSearchIndexType.class);
  public static final Map<String, Object> ENTITY_TO_MAPPING_SCHEMA_MAP = new HashMap<>();

  private final SearchClient searchClient;

  public SearchIndexDefinition(SearchClient client) {
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
    CLASSIFICATION_SEARCH_INDEX(
        Entity.CLASSIFICATION, "classification_search_index", "/elasticsearch/%s/classification_index_mapping.json"),
    ENTITY_REPORT_DATA_INDEX(
        ENTITY_REPORT_DATA, "entity_report_data_index", "/elasticsearch/entity_report_data_index.json"),
    TEST_CASE_SEARCH_INDEX(
        Entity.TEST_CASE, "test_case_search_index", "/elasticsearch/%s/test_case_index_mapping.json"),

    TEST_SUITE_SEARCH_INDEX(
        Entity.TEST_SUITE, "test_suite_search_index", "/elasticsearch/%s/test_suite_index_mapping.json"),

    CHART_INDEX_SEARCH_INDEX(Entity.CHART, "chart_search_index", "/elasticsearch/%s/chart_index_mapping.json"),

    DASHBOARD_DATA_MODEL_SEARCH_INDEX(
        Entity.DASHBOARD_DATA_MODEL,
        "dashboard_data_model_search_index",
        "/elasticsearch/%s/dashboard_data_model_index_mapping.json"),

    DASHBOARD_SERVICE_SEARCH_INDEX(
        Entity.DASHBOARD_SERVICE,
        "dashboard_service_search_index",
        "/elasticsearch/%s/dashboard_service_index_mapping.json"),

    DATABASE_SEARCH_INDEX(Entity.DATABASE, "database_search_index", "/elasticsearch/%s/database_index_mapping.json"),

    DATABASE_SCHEMA_SEARCH_INDEX(
        Entity.DATABASE_SCHEMA, "database_schema_search_index", "/elasticsearch/%s/database_schema_index_mapping.json"),

    DATABASE_SERVICE_SEARCH_INDEX(
        Entity.DASHBOARD_SERVICE,
        "database_service_search_index",
        "/elasticsearch/%s/database_service_index_mapping.json"),

    MESSAGING_SERVICE_SEARCH_INDEX(
        Entity.MESSAGING_SERVICE,
        "messaging_service_search_index",
        "/elasticsearch/%s/messaging_service_index_mapping.json"),
    MLMODEL_SERVICE_SEARCH_INDEX(
        Entity.MLMODEL_SERVICE, "mlmodel_service_search_index", "/elasticsearch/%s/mlmodel_service_index_mapping.json"),

    PIPELINE_SERVICE_SEARCH_INDEX(
        Entity.PIPELINE_SERVICE,
        "pipeline_service_search_index",
        "/elasticsearch/%s/pipeline_service_index_mapping.json"),

    SEARCH_SERVICE_SEARCH_INDEX(
        Entity.SEARCH_SERVICE, "search_service_search_index", "/elasticsearch/%s/search_service_index_mapping.json"),

    SEARCH_INDEX_SEARCH(Entity.SEARCH_INDEX, "search_index", "/elasticsearch/%s/search_index_mapping.json"),
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
    if (searchClient != null) {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        searchClient.createIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
      }
    }
  }

  public void updateIndexes(ElasticSearchConfiguration esConfig) {
    if (searchClient != null) {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        searchClient.updateIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
      }
    }
  }

  public void dropIndexes() {
    if (searchClient != null) {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        searchClient.deleteIndex(elasticSearchIndexType);
      }
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
