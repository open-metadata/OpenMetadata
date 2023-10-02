package org.openmetadata.service.search;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.io.IOException;
import java.io.InputStream;
import java.security.KeyStoreException;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import javax.net.ssl.SSLContext;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClientImpl;
import org.openmetadata.service.search.opensearch.OpenSearchClientImpl;
import org.openmetadata.service.util.SSLUtil;

@Slf4j
public class IndexUtil {
  public static final String ELASTIC_SEARCH_EXTENSION = "service.eventPublisher";
  public static final String ELASTIC_SEARCH_ENTITY_FQN_STREAM = "eventPublisher:ElasticSearch:STREAM";
  public static final String MAPPINGS_KEY = "mappings";
  public static final String PROPERTIES_KEY = "properties";
  public static final String REASON_TRACE = "Reason: [%s] , Trace : [%s]";
  public static final String ENTITY_REPORT_DATA = "entityReportData";
  public static final String WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA = "webAnalyticEntityViewReportData";
  public static final String WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA = "webAnalyticUserActivityReportData";
  public static final String RAW_COST_ANALYSIS_REPORT_DATA = "rawCostAnalysisReportData";
  public static final String AGGREGATED_COST_ANALYSIS_REPORT_DATA = "AggregatedCostAnalysisReportData";
  public static final Map<String, String> ENTITY_TYPE_TO_INDEX_MAP;

  private static final Map<SearchIndexDefinition.ElasticSearchIndexType, Set<String>> INDEX_TO_MAPPING_FIELDS_MAP =
      new EnumMap<>(SearchIndexDefinition.ElasticSearchIndexType.class);

  static {
    // Populate Entity Type to Index Map
    ENTITY_TYPE_TO_INDEX_MAP = new HashMap<>();
    for (SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType :
        SearchIndexDefinition.ElasticSearchIndexType.values()) {
      ENTITY_TYPE_TO_INDEX_MAP.put(elasticSearchIndexType.entityType, elasticSearchIndexType.indexName);
    }
  }

  private IndexUtil() {
    /* Util Class */
  }

  public enum ElasticSearchIndexStatus {
    CREATED,
    NOT_CREATED,
    FAILED
  }

  public static SearchRepository getSearchClient(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    if (esConfig != null) {
      return esConfig.getSearchType().equals(SearchType.OPENSEARCH)
          ? new OpenSearchClientImpl(esConfig, dao)
          : new ElasticSearchClientImpl(esConfig, dao);
    }
    return null;
  }

  /**
   * This method is used lazily to populate ES Mapping fields and corresponding Entity Fields getting common fields in
   * between NOTE: This is not done as part of constructor since Resource Using this might start to get exception since
   * it utilizes EntityRepository.
   */
  @SneakyThrows
  public static void populateEsFieldsForIndexes(
      SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, IndexMappingLanguage lang) {
    if (!isDataInsightIndex(elasticSearchIndexType.entityType)) {
      String indexData = getIndexMapping(elasticSearchIndexType, lang.value());
      JSONObject object = new JSONObject(indexData).getJSONObject(MAPPINGS_KEY).getJSONObject(PROPERTIES_KEY);
      Set<String> keySet =
          Entity.getEntityRepository(elasticSearchIndexType.entityType).getCommonFields(object.keySet());
      INDEX_TO_MAPPING_FIELDS_MAP.put(elasticSearchIndexType, keySet);
    }
  }

  public static SearchIndexDefinition.ElasticSearchIndexType getIndexMappingByEntityType(String type) {
    if (type.equalsIgnoreCase(Entity.TABLE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.TABLE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DASHBOARD)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.CHART)) {
      return SearchIndexDefinition.ElasticSearchIndexType.CHART_INDEX_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DASHBOARD_DATA_MODEL)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DASHBOARD_DATA_MODEL_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DASHBOARD_SERVICE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.PIPELINE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.PIPELINE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.PIPELINE_SERVICE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TOPIC)) {
      return SearchIndexDefinition.ElasticSearchIndexType.TOPIC_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.MESSAGING_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.MESSAGING_SERVICE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.USER)) {
      return SearchIndexDefinition.ElasticSearchIndexType.USER_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TEAM)) {
      return SearchIndexDefinition.ElasticSearchIndexType.TEAM_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.GLOSSARY)) {
      return SearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.MLMODEL)) {
      return SearchIndexDefinition.ElasticSearchIndexType.MLMODEL_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.MLMODEL_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.MLMODEL_SERVICE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.GLOSSARY_TERM)) {
      return SearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TAG)) {
      return SearchIndexDefinition.ElasticSearchIndexType.TAG_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.CLASSIFICATION)) {
      return SearchIndexDefinition.ElasticSearchIndexType.CLASSIFICATION_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(ENTITY_REPORT_DATA)) {
      return SearchIndexDefinition.ElasticSearchIndexType.ENTITY_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA)) {
      return SearchIndexDefinition.ElasticSearchIndexType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)) {
      return SearchIndexDefinition.ElasticSearchIndexType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(RAW_COST_ANALYSIS_REPORT_DATA)) {
      return SearchIndexDefinition.ElasticSearchIndexType.RAW_COST_ANALYSIS_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(AGGREGATED_COST_ANALYSIS_REPORT_DATA)) {
      return SearchIndexDefinition.ElasticSearchIndexType.AGGREGATED_COST_ANALYSIS_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(Entity.CONTAINER)) {
      return SearchIndexDefinition.ElasticSearchIndexType.CONTAINER_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.QUERY)) {
      return SearchIndexDefinition.ElasticSearchIndexType.QUERY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TEST_CASE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.TEST_CASE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TEST_SUITE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.TEST_SUITE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DATABASE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DATABASE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DATABASE_SCHEMA)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DATABASE_SCHEMA_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DATABASE_SERVICE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.SEARCH_INDEX)) {
      return SearchIndexDefinition.ElasticSearchIndexType.SEARCH_ENTITY_INDEX_SEARCH;
    } else if (type.equalsIgnoreCase(Entity.SEARCH_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.SEARCH_SERVICE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DOMAIN)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DOMAIN_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.STORED_PROCEDURE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.STORED_PROCEDURE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DATA_PRODUCT)) {
      return SearchIndexDefinition.ElasticSearchIndexType.DATA_PRODUCTS_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.STORAGE_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.STORAGE_SERVICE_INDEX;
    } else if (type.equalsIgnoreCase(Entity.METADATA_SERVICE)) {
      return SearchIndexDefinition.ElasticSearchIndexType.METADATA_SERVICE_INDEX;
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

  public static String getIndexMapping(SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang)
      throws IOException {
    try (InputStream in =
        SearchIndexDefinition.class.getResourceAsStream(
            String.format(elasticSearchIndexType.indexMappingFile, lang.toLowerCase()))) {
      assert in != null;
      return new String(in.readAllBytes());
    }
  }

  public static String getContext(String type, String info) {
    return String.format("Failed While : %s %n Additional Info:  %s ", type, info);
  }

  public static SSLContext createElasticSearchSSLContext(ElasticSearchConfiguration elasticSearchConfiguration)
      throws KeyStoreException {
    return elasticSearchConfiguration.getScheme().equals("https")
        ? SSLUtil.createSSLContext(
            elasticSearchConfiguration.getTruststorePath(),
            elasticSearchConfiguration.getTruststorePassword(),
            "ElasticSearch")
        : null;
  }
}
