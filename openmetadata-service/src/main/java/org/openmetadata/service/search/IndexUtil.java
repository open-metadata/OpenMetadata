package org.openmetadata.service.search;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.elastic.ElasticSearchClientImpl;
import org.openmetadata.service.search.open.OpenSearchClientImpl;
import org.openmetadata.service.util.JsonUtils;

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

  public static final String OPEN_SEARCH_CLIENT = "OpenSearch";

  public static final Map<String, String> ENTITY_TYPE_TO_INDEX_MAP;

  EnumMap<ElasticSearchIndexDefinition.ElasticSearchIndexType, ElasticSearchIndexStatus> elasticSearchIndexes =
      new EnumMap<>(ElasticSearchIndexDefinition.ElasticSearchIndexType.class);
  private static final Map<ElasticSearchIndexDefinition.ElasticSearchIndexType, Set<String>>
      INDEX_TO_MAPPING_FIELDS_MAP = new EnumMap<>(ElasticSearchIndexDefinition.ElasticSearchIndexType.class);

  private final CollectionDAO dao;

  static {
    // Populate Entity Type to Index Map
    ENTITY_TYPE_TO_INDEX_MAP = new HashMap<>();
    for (ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType :
        ElasticSearchIndexDefinition.ElasticSearchIndexType.values()) {
      ENTITY_TYPE_TO_INDEX_MAP.put(elasticSearchIndexType.entityType, elasticSearchIndexType.indexName);
    }
  }

  public IndexUtil(CollectionDAO dao) {
    this.dao = dao;
    for (ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType :
        ElasticSearchIndexDefinition.ElasticSearchIndexType.values()) {
      elasticSearchIndexes.put(elasticSearchIndexType, ElasticSearchIndexStatus.NOT_CREATED);
    }
  }

  public enum ElasticSearchIndexStatus {
    CREATED,
    NOT_CREATED,
    FAILED
  }

  public void setIndexStatus(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType,
      ElasticSearchIndexStatus elasticSearchIndexStatus) {
    elasticSearchIndexes.put(indexType, elasticSearchIndexStatus);
  }

  public static SearchClient getSearchClient(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    SearchClient client;
    if (esConfig.getSearchType().equals(OPEN_SEARCH_CLIENT)) {
      client = new OpenSearchClientImpl(esConfig, dao);
    } else {
      client = new ElasticSearchClientImpl(esConfig, dao);
    }
    return client;
  }

  public static String getIndexMapping(
      ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang) throws IOException {
    InputStream in =
        ElasticSearchIndexDefinition.class.getResourceAsStream(
            String.format(elasticSearchIndexType.indexMappingFile, lang.toLowerCase()));
    assert in != null;
    return new String(in.readAllBytes());
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

  public String getContext(String type, String info) {
    return String.format("Failed While : %s %n Additional Info:  %s ", type, info);
  }

  public void updateElasticSearchFailureStatus(String failedFor, String failureMessage) {
    try {
      long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      String recordString =
          dao.entityExtensionTimeSeriesDao().getExtension(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
      EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
      long originalLastUpdate = lastRecord.getTimestamp();
      lastRecord.setStatus(EventPublisherJob.Status.ACTIVE_WITH_ERROR);
      lastRecord.setTimestamp(updateTime);
      lastRecord.setFailure(
          new Failure()
              .withSinkError(
                  new FailureDetails()
                      .withContext(failedFor)
                      .withLastFailedAt(updateTime)
                      .withLastFailedReason(failureMessage)));

      dao.entityExtensionTimeSeriesDao()
          .update(
              ELASTIC_SEARCH_ENTITY_FQN_STREAM,
              ELASTIC_SEARCH_EXTENSION,
              JsonUtils.pojoToJson(lastRecord),
              originalLastUpdate);
    } catch (Exception e) {
      LOG.error("Failed to Update Elastic Search Job Info");
    }
  }
}
