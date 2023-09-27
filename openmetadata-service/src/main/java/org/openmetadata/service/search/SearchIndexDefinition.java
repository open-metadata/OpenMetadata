package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchRepository.CLASSIFICATION_ALIAS;
import static org.openmetadata.service.search.SearchRepository.DASHBOARD_SERVICE_ALIAS;
import static org.openmetadata.service.search.SearchRepository.DATABASE_ALIAS;
import static org.openmetadata.service.search.SearchRepository.DATABASE_SCHEMA_ALIAS;
import static org.openmetadata.service.search.SearchRepository.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchRepository.MESSAGING_SERVICE_ALIAS;
import static org.openmetadata.service.search.SearchRepository.MLMODEL_SERVICE_ALIAS;
import static org.openmetadata.service.search.SearchRepository.PIPELINE_SERVICE_ALIAS;
import static org.openmetadata.service.search.SearchRepository.STORAGE_SERVICE_ALIAS;
import static org.openmetadata.service.search.SearchRepository.TEST_SUITE_ALIAS;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
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
  public static final Map<String, List<String>> ENTITY_TO_SEARCH_ALIAS_MAPPING = new HashMap<>();
  public static final Map<String, Object> ENTITY_TO_CHILDREN_MAPPING = new HashMap<>();

  private SearchRepository searchRepository;

  public SearchIndexDefinition(SearchRepository client) {
    this.searchRepository = client;
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      elasticSearchIndexes.put(elasticSearchIndexType, ElasticSearchIndexStatus.NOT_CREATED);
    }
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(
        Entity.TABLE, List.of(DATABASE_ALIAS, DATABASE_SCHEMA_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(
        Entity.STORED_PROCEDURE, List.of(DATABASE_ALIAS, DATABASE_SCHEMA_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.DATABASE, List.of(GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.DATABASE_SCHEMA, List.of(DATABASE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.TAG, List.of(CLASSIFICATION_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.DASHBOARD, List.of(DASHBOARD_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.CHART, List.of(DASHBOARD_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(
        Entity.DASHBOARD_DATA_MODEL, List.of(DASHBOARD_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.TOPIC, List.of(MESSAGING_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.PIPELINE, List.of(PIPELINE_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.MLMODEL, List.of(MLMODEL_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.CONTAINER, List.of(STORAGE_SERVICE_ALIAS, GLOBAL_SEARCH_ALIAS));
    ENTITY_TO_SEARCH_ALIAS_MAPPING.put(Entity.TEST_CASE, List.of(TEST_SUITE_ALIAS, GLOBAL_SEARCH_ALIAS));

    ENTITY_TO_CHILDREN_MAPPING.put(Entity.DATABASE, DATABASE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.DATABASE_SCHEMA, DATABASE_SCHEMA_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.CLASSIFICATION, CLASSIFICATION_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.DASHBOARD_SERVICE, DASHBOARD_SERVICE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.MESSAGING_SERVICE, MESSAGING_SERVICE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.PIPELINE_SERVICE, PIPELINE_SERVICE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.MLMODEL_SERVICE, MLMODEL_SERVICE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.STORAGE_SERVICE, STORAGE_SERVICE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.TEST_SUITE, TEST_SUITE_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.TAG, GLOBAL_SEARCH_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.GLOSSARY_TERM, GLOBAL_SEARCH_ALIAS);
    ENTITY_TO_CHILDREN_MAPPING.put(Entity.DOMAIN, GLOBAL_SEARCH_ALIAS);
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
    STORED_PROCEDURE_SEARCH_INDEX(
        Entity.STORED_PROCEDURE,
        "stored_procedure_search_index",
        "/elasticsearch/%s/stored_procedure_index_mapping.json"),
    DATA_PRODUCTS_SEARCH_INDEX(
        Entity.DATA_PRODUCT, "data_products_search_index", "/elasticsearch/%s/data_products_index_mapping.json"),

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

    SEARCH_ENTITY_INDEX_SEARCH(
        Entity.SEARCH_INDEX, "search_entity_index", "/elasticsearch/%s/search_entity_index_mapping.json"),
    STORAGE_SERVICE_INDEX(
        Entity.SEARCH_INDEX, "storage_service_search_index", "/elasticsearch/%s/storage_service_index_mapping.json"),

    METADATA_SERVICE_INDEX(
        Entity.METADATA_SERVICE,
        "metadata_service_search_index",
        "/elasticsearch/%s/metadata_service_index_mapping.json"),

    DOMAIN_SEARCH_INDEX(Entity.DOMAIN, "domain_search_index", "/elasticsearch/%s/domain_index_mapping.json"),
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
    if (searchRepository != null) {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        searchRepository.createIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
      }
    }
  }

  public void updateIndexes(ElasticSearchConfiguration esConfig) {
    if (searchRepository != null) {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        searchRepository.updateIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
      }
    }
  }

  public void dropIndexes() {
    if (searchRepository != null) {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        searchRepository.deleteIndex(elasticSearchIndexType);
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
