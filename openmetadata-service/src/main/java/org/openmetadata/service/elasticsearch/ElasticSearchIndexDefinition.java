package org.openmetadata.service.elasticsearch;

import static org.openmetadata.service.resources.elasticsearch.BuildSearchIndexResource.ELASTIC_SEARCH_ENTITY_FQN_STREAM;
import static org.openmetadata.service.resources.elasticsearch.BuildSearchIndexResource.ELASTIC_SEARCH_EXTENSION;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.jackson.Jacksonized;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.client.indices.PutMappingRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.schema.settings.EventPublisherJob.Status;
import org.openmetadata.schema.settings.FailureDetails;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ElasticSearchIndexDefinition {
  private static final String REASON_TRACE = "Reason: [%s] , Trace : [%s]";
  public static final String ENTITY_REPORT_DATA = "entityReportData";
  public static final String WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA = "webAnalyticEntityViewReportData";
  public static final String WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA = "webAnalyticUserActivityReportData";
  private final CollectionDAO dao;
  final EnumMap<ElasticSearchIndexType, ElasticSearchIndexStatus> elasticSearchIndexes =
      new EnumMap<>(ElasticSearchIndexType.class);

  public static HashMap<String, String> ENTITY_TYPE_TO_INDEX_MAP = entityTypeToIndexMap();

  private final RestHighLevelClient client;

  public static HashMap<String, String> entityTypeToIndexMap() {
    ENTITY_TYPE_TO_INDEX_MAP = new HashMap<>();
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      ENTITY_TYPE_TO_INDEX_MAP.put(elasticSearchIndexType.entityType, elasticSearchIndexType.indexName);
    }
    return ENTITY_TYPE_TO_INDEX_MAP;
  }

  public ElasticSearchIndexDefinition(RestHighLevelClient client, CollectionDAO dao) {
    this.dao = dao;
    this.client = client;
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
    TAG_SEARCH_INDEX(Entity.TAG, "tag_search_index", "/elasticsearch/%s/tag_index_mapping.json"),
    ENTITY_REPORT_DATA_INDEX(
        ENTITY_REPORT_DATA, "entity_report_data_index", "/elasticsearch/entity_report_data_index.json"),
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
      createIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
    }
  }

  public void updateIndexes(ElasticSearchConfiguration esConfig) {
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      updateIndex(elasticSearchIndexType, esConfig.getSearchIndexMappingLanguage().value());
    }
  }

  public void dropIndexes() {
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      deleteIndex(elasticSearchIndexType);
    }
  }

  public boolean createIndex(ElasticSearchIndexType elasticSearchIndexType, String lang) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      if (!exists) {
        String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType, lang);
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.info("{} Created {}", elasticSearchIndexType.indexName, createIndexResponse.isAcknowledged());
      }
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.FAILED);
      updateElasticSearchFailureStatus(
          getContext("Creating Index", elasticSearchIndexType.indexName),
          String.format(REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to create Elastic Search indexes due to", e);
      return false;
    }
    return true;
  }

  private String getContext(String type, String info) {
    return String.format("Failed While : %s \n Additional Info:  %s ", type, info);
  }

  private void updateIndex(ElasticSearchIndexType elasticSearchIndexType, String lang) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType, lang);
      if (exists) {
        PutMappingRequest request = new PutMappingRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        AcknowledgedResponse putMappingResponse = client.indices().putMapping(request, RequestOptions.DEFAULT);
        LOG.info("{} Updated {}", elasticSearchIndexType.indexName, putMappingResponse.isAcknowledged());
      } else {
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.info("{} Created {}", elasticSearchIndexType.indexName, createIndexResponse.isAcknowledged());
      }
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.FAILED);
      updateElasticSearchFailureStatus(
          getContext("Updating Index", elasticSearchIndexType.indexName),
          String.format(REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to update Elastic Search indexes due to", e);
    }
  }

  public void deleteIndex(ElasticSearchIndexType elasticSearchIndexType) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      if (exists) {
        DeleteIndexRequest request = new DeleteIndexRequest(elasticSearchIndexType.indexName);
        AcknowledgedResponse deleteIndexResponse = client.indices().delete(request, RequestOptions.DEFAULT);
        LOG.info("{} Deleted {}", elasticSearchIndexType.indexName, deleteIndexResponse.isAcknowledged());
      }
    } catch (IOException e) {
      updateElasticSearchFailureStatus(
          getContext("Deleting Index", elasticSearchIndexType.indexName),
          String.format(REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to delete Elastic Search indexes due to", e);
    }
  }

  private void setIndexStatus(ElasticSearchIndexType indexType, ElasticSearchIndexStatus elasticSearchIndexStatus) {
    elasticSearchIndexes.put(indexType, elasticSearchIndexStatus);
  }

  public String getIndexMapping(ElasticSearchIndexType elasticSearchIndexType, String lang) throws IOException {
    InputStream in =
        ElasticSearchIndexDefinition.class.getResourceAsStream(
            String.format(elasticSearchIndexType.indexMappingFile, lang.toLowerCase()));
    assert in != null;
    return new String(in.readAllBytes());
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
    }
    throw new RuntimeException("Failed to find index doc for type " + type);
  }

  private void updateElasticSearchFailureStatus(String failedFor, String failureMessage) {
    try {
      long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      String recordString =
          dao.entityExtensionTimeSeriesDao().getExtension(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
      EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
      long originalLastUpdate = lastRecord.getTimestamp();
      lastRecord.setStatus(Status.ACTIVE_WITH_ERROR);
      lastRecord.setTimestamp(updateTime);
      lastRecord.setFailureDetails(
          new FailureDetails()
              .withContext(failedFor)
              .withLastFailedAt(updateTime)
              .withLastFailedReason(failureMessage));

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

@JsonInclude(JsonInclude.Include.NON_NULL)
@Jacksonized
@Getter
@Builder
class ElasticSearchSuggest {
  String input;
  Integer weight;
}

@Getter
@Builder
class FlattenColumn {
  String name;
  String description;
  List<TagLabel> tags;
}

class ParseTags {
  TagLabel tierTag;
  final List<TagLabel> tags;

  ParseTags(List<TagLabel> tags) {
    if (!tags.isEmpty()) {
      List<TagLabel> tagsList = new ArrayList<>(tags);
      for (TagLabel tag : tagsList) {
        String tier = tag.getTagFQN().split("\\.")[0];
        if (tier.equalsIgnoreCase("tier")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
      }
      this.tags = tagsList;
    } else {
      this.tags = tags;
    }
  }
}
