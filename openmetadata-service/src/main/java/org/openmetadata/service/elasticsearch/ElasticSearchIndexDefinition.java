package org.openmetadata.service.elasticsearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.io.IOException;
import java.io.InputStream;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;

@Slf4j
public class ElasticSearchIndexDefinition {
  private static final String MAPPINGS_KEY = "mappings";
  private static final String PROPERTIES_KEY = "properties";
  public static final String ENTITY_REPORT_DATA = "entityReportData";
  public static final String WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA = "webAnalyticEntityViewReportData";
  public static final String WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA = "webAnalyticUserActivityReportData";
  private final CollectionDAO dao;
  final EnumMap<ElasticSearchIndexType, ElasticSearchIndexStatus> elasticSearchIndexes =
      new EnumMap<>(ElasticSearchIndexType.class);
  public static final Map<String, Object> ENTITY_TO_MAPPING_SCHEMA_MAP = new HashMap<>();

  protected static final Map<String, String> ENTITY_TYPE_TO_INDEX_MAP;
  private static final Map<ElasticSearchIndexType, Set<String>> INDEX_TO_MAPPING_FIELDS_MAP =
      new EnumMap<>(ElasticSearchIndexType.class);

  private final SearchClient searchClient;

  static {
    // Populate Entity Type to Index Map
    ENTITY_TYPE_TO_INDEX_MAP = new HashMap<>();
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      ENTITY_TYPE_TO_INDEX_MAP.put(elasticSearchIndexType.entityType, elasticSearchIndexType.indexName);
    }
  }

  public ElasticSearchIndexDefinition(SearchClient client, CollectionDAO dao) {
    this.dao = dao;
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

  public static String getIndexMapping(ElasticSearchIndexType elasticSearchIndexType, String lang) throws IOException {
    try (InputStream in =
        ElasticSearchIndexDefinition.class.getResourceAsStream(
            String.format(elasticSearchIndexType.indexMappingFile, lang.toLowerCase()))) {
      assert in != null;
      return new String(in.readAllBytes());
    }
  }

  /**
   * This method is used lazily to populate ES Mapping fields and corresponding Entity Fields getting common fields in
   * between NOTE: This is not done as part of constructor since Resource Using this might start to get exception since
   * it utilizes EntityRepository.
   */
  @SneakyThrows
  private static void populateEsFieldsForIndexes(
      ElasticSearchIndexType elasticSearchIndexType, IndexMappingLanguage lang) {
    if (!isDataInsightIndex(elasticSearchIndexType.entityType)) {
      String indexData = getIndexMapping(elasticSearchIndexType, lang.value());
      JSONObject object = new JSONObject(indexData).getJSONObject(MAPPINGS_KEY).getJSONObject(PROPERTIES_KEY);
      Set<String> keySet =
          Entity.getEntityRepository(elasticSearchIndexType.entityType).getCommonFields(object.keySet());
      INDEX_TO_MAPPING_FIELDS_MAP.put(elasticSearchIndexType, keySet);
    }
  }

  public static ElasticSearchIndexType getIndexMappingByEntityType(String type) {
    if (type.equalsIgnoreCase(Entity.TABLE)) {
      return ElasticSearchIndexType.TABLE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DASHBOARD)) {
      return ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.PIPELINE)) {
      return ElasticSearchIndexType.PIPELINE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TOPIC)) {
      return ElasticSearchIndexType.TOPIC_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.USER)) {
      return ElasticSearchIndexType.USER_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TEAM)) {
      return ElasticSearchIndexType.TEAM_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.GLOSSARY)) {
      return ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.MLMODEL)) {
      return ElasticSearchIndexType.MLMODEL_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.GLOSSARY_TERM)) {
      return ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TAG)) {
      return ElasticSearchIndexType.TAG_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(ENTITY_REPORT_DATA)) {
      return ElasticSearchIndexType.ENTITY_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA)) {
      return ElasticSearchIndexType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)) {
      return ElasticSearchIndexType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(Entity.CONTAINER)) {
      return ElasticSearchIndexType.CONTAINER_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.QUERY)) {
      return ElasticSearchIndexType.QUERY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TEST_SUITE) || type.equalsIgnoreCase(Entity.TEST_CASE)) {
      return ElasticSearchIndexType.TEST_CASE_SEARCH_INDEX;
    }
    throw new EventPublisherException("Failed to find index doc for type " + type);
  }

  public static Set<String> getIndexFields(String entityType, IndexMappingLanguage lang) {
    Set<String> fields = INDEX_TO_MAPPING_FIELDS_MAP.get(getIndexMappingByEntityType(entityType));
    if (fields != null) {
      return fields;
    } else {
      populateEsFieldsForIndexes(getIndexMappingByEntityType(entityType), lang);
      fields = INDEX_TO_MAPPING_FIELDS_MAP.get(getIndexMappingByEntityType(entityType));
    }
    return fields;
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
