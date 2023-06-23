package org.openmetadata.service.search;

import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.getIndexMapping;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

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
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.elasticSearch.ElasticSearchClientImpl;
import org.openmetadata.service.search.openSearch.OpenSearchClientImpl;
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
  public static final Map<String, String> ENTITY_TYPE_TO_INDEX_MAP;

  private static final Map<ElasticSearchIndexDefinition.ElasticSearchIndexType, Set<String>>
      INDEX_TO_MAPPING_FIELDS_MAP = new EnumMap<>(ElasticSearchIndexDefinition.ElasticSearchIndexType.class);

  static {
    // Populate Entity Type to Index Map
    ENTITY_TYPE_TO_INDEX_MAP = new HashMap<>();
    for (ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType :
        ElasticSearchIndexDefinition.ElasticSearchIndexType.values()) {
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

  public static SearchClient getSearchClient(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    SearchClient client;
    if (esConfig.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPEN_SEARCH)) {
      client = new OpenSearchClientImpl(esConfig, dao);
    } else {
      client = new ElasticSearchClientImpl(esConfig, dao);
    }
    return client;
  }

  /**
   * This method is used lazily to populate ES Mapping fields and corresponding Entity Fields getting common fields in
   * between NOTE: This is not done as part of constructor since Resource Using this might start to get exception since
   * it utilizes EntityRepository.
   */
  @SneakyThrows
  public static void populateEsFieldsForIndexes(
      ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, IndexMappingLanguage lang) {
    if (!isDataInsightIndex(elasticSearchIndexType.entityType)) {
      String indexData = getIndexMapping(elasticSearchIndexType, lang.value());
      JSONObject object = new JSONObject(indexData).getJSONObject(MAPPINGS_KEY).getJSONObject(PROPERTIES_KEY);
      Set<String> keySet =
          Entity.getEntityRepository(elasticSearchIndexType.entityType).getCommonFields(object.keySet());
      INDEX_TO_MAPPING_FIELDS_MAP.put(elasticSearchIndexType, keySet);
    }
  }

  public static ElasticSearchIndexDefinition.ElasticSearchIndexType getIndexMappingByEntityType(String type) {
    if (type.equalsIgnoreCase(Entity.TABLE)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.TABLE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DASHBOARD)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.PIPELINE)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.PIPELINE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TOPIC)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.TOPIC_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.USER)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.USER_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TEAM)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.TEAM_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.GLOSSARY)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.MLMODEL)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.MLMODEL_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.GLOSSARY_TERM)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TAG)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.TAG_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(ENTITY_REPORT_DATA)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.ENTITY_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX;
    } else if (type.equalsIgnoreCase(Entity.CONTAINER)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.CONTAINER_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.QUERY)) {
      return ElasticSearchIndexDefinition.ElasticSearchIndexType.QUERY_SEARCH_INDEX;
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

  public static String getContext(String type, String info) {
    return String.format("Failed While : %s %n Additional Info:  %s ", type, info);
  }

  public static SSLContext createElasticSearchSSLContext(ElasticSearchConfiguration elasticSearchConfiguration)
      throws KeyStoreException {

    if (elasticSearchConfiguration.getScheme().equals("https")) {
      return SSLUtil.createSSLContext(
          elasticSearchConfiguration.getTruststorePath(),
          elasticSearchConfiguration.getTruststorePassword(),
          "ElasticSearch");
    }
    return null;
  }
}
