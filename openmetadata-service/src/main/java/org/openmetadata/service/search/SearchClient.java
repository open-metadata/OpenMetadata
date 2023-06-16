package org.openmetadata.service.search;

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.exception.CatalogExceptionMessage.NOT_IMPLEMENTED_METHOD;
import static org.openmetadata.service.search.IndexUtil.ELASTIC_SEARCH_ENTITY_FQN_STREAM;
import static org.openmetadata.service.search.IndexUtil.ELASTIC_SEARCH_EXTENSION;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.io.InputStream;
import java.text.ParseException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.ElasticSearchIndexType;
import org.openmetadata.service.elasticsearch.ElasticSearchRequest;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;
import org.opensearch.action.bulk.BulkRequest;
import org.opensearch.action.bulk.BulkResponse;
import org.opensearch.action.update.UpdateRequest;
import org.opensearch.client.RequestOptions;

public interface SearchClient {
  boolean createIndex(ElasticSearchIndexType elasticSearchIndexType, String lang);

  void updateIndex(ElasticSearchIndexType elasticSearchIndexType, String lang);

  void deleteIndex(ElasticSearchIndexType elasticSearchIndexType);

  Response search(ElasticSearchRequest request) throws IOException;

  Response aggregate(String index, String fieldName) throws IOException;

  Response suggest(ElasticSearchRequest request) throws IOException;

  ElasticSearchConfiguration.SearchType getSearchType();

  default UpdateRequest applyOSChangeEvent(ChangeEvent event) {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default org.elasticsearch.action.update.UpdateRequest applyESChangeEvent(ChangeEvent event) {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void updateElasticSearch(UpdateRequest updateRequest) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void updateElasticSearch(org.elasticsearch.action.update.UpdateRequest updateRequest) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void updateSearchForEntityCreated(ElasticSearchIndexType indexType, String entityType, ChangeEvent event)
      throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void updateSearchForEntityUpdated(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType, String entityType, ChangeEvent event)
      throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void updateESSearch(UpdateRequest updateRequest) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default void updateOSElasticSearch(org.elasticsearch.action.update.UpdateRequest updateRequest) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  void updateEntity(ChangeEvent event) throws IOException;

  void updateUser(ChangeEvent event) throws IOException;

  void updateTeam(ChangeEvent event) throws IOException;

  void updateGlossaryTerm(ChangeEvent event) throws IOException;

  void updateGlossary(ChangeEvent event) throws IOException;

  void updateTag(ChangeEvent event) throws IOException;

  void updateDatabase(ChangeEvent event) throws IOException;

  void updateDatabaseSchema(ChangeEvent event) throws IOException;

  void updateDatabaseService(ChangeEvent event) throws IOException;

  void updatePipelineService(ChangeEvent event) throws IOException;

  void updateMlModelService(ChangeEvent event) throws IOException;

  void updateStorageService(ChangeEvent event) throws IOException;

  void updateMessagingService(ChangeEvent event) throws IOException;

  void updateDashboardService(ChangeEvent event) throws IOException;

  void updateClassification(ChangeEvent event) throws IOException;

  default void updateTestCase(ChangeEvent event) throws IOException {
    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(Entity.TEST_CASE);
    // creating a new test case will return a TestCase entity while bulk adding test cases will return
    // the logical test suite entity with the newly added test cases
    EntityInterface entityInterface = (EntityInterface) event.getEntity();
    if (entityInterface instanceof TestCase) {
      processTestCase((TestCase) entityInterface, event, indexType);
    } else {
      addTestCaseFromLogicalTestSuite((TestSuite) entityInterface, event, indexType);
    }
  }

  void updateTestSuite(ChangeEvent event) throws IOException;

  void processTestCase(TestCase testCase, ChangeEvent event, ElasticSearchIndexType indexType) throws IOException;

  void addTestCaseFromLogicalTestSuite(TestSuite testSuite, ChangeEvent event, ElasticSearchIndexType indexType)
      throws IOException;

  void close();

  default BulkResponse bulk(BulkRequest data, RequestOptions options) throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default org.elasticsearch.action.bulk.BulkResponse bulk(
      org.elasticsearch.action.bulk.BulkRequest data, org.elasticsearch.client.RequestOptions options)
      throws IOException {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default int getSuccessFromBulkResponse(BulkResponse response) {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  default int getSuccessFromBulkResponse(org.elasticsearch.action.bulk.BulkResponse response) {
    throw new CustomExceptionMessage(Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_METHOD);
  }

  TreeMap<Long, List<Object>> getSortedDate(
      String team,
      Long scheduleTime,
      Long currentTime,
      DataInsightChartResult.DataInsightChartType chartType,
      String indexName)
      throws IOException, ParseException;

  Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      String dataReportIndex)
      throws IOException, ParseException;

  default void getScriptWithParams(ChangeEvent event, String script, Map<String, Object> fieldParams) {
    ChangeDescription changeDescription = event.getChangeDescription();

    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    StringBuilder scriptTxt = new StringBuilder();
    Map<String, Object> fieldAddParams = new HashMap<>();
    fieldAddParams.put("updatedAt", event.getTimestamp());
    scriptTxt.append("ctx._source.updatedAt=params.updatedAt;");
    for (FieldChange fieldChange : fieldsAdded) {
      if (fieldChange.getName().equalsIgnoreCase(FIELD_FOLLOWERS)) {
        @SuppressWarnings("unchecked")
        List<EntityReference> entityReferences = (List<EntityReference>) fieldChange.getNewValue();
        List<String> newFollowers = new ArrayList<>();
        for (EntityReference follower : entityReferences) {
          newFollowers.add(follower.getId().toString());
        }
        fieldAddParams.put(fieldChange.getName(), newFollowers);
        scriptTxt.append("ctx._source.followers.addAll(params.followers);");
      }
    }

    for (FieldChange fieldChange : changeDescription.getFieldsDeleted()) {
      if (fieldChange.getName().equalsIgnoreCase(FIELD_FOLLOWERS)) {
        @SuppressWarnings("unchecked")
        List<EntityReference> entityReferences = (List<EntityReference>) fieldChange.getOldValue();
        for (EntityReference follower : entityReferences) {
          fieldAddParams.put(fieldChange.getName(), follower.getId().toString());
        }
        scriptTxt.append("ctx._source.followers.removeAll(Collections.singleton(params.followers));");
      }
    }

    for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
      if (fieldChange.getName().equalsIgnoreCase(FIELD_USAGE_SUMMARY)) {
        UsageDetails usageSummary = (UsageDetails) fieldChange.getNewValue();
        fieldAddParams.put(fieldChange.getName(), JsonUtils.getMap(usageSummary));
        scriptTxt.append("ctx._source.usageSummary = params.usageSummary;");
      }
      if (event.getEntityType().equals(QUERY) && fieldChange.getName().equalsIgnoreCase("queryUsedIn")) {
        fieldAddParams.put(
            fieldChange.getName(),
            JsonUtils.convertValue(
                fieldChange.getNewValue(), new TypeReference<List<LinkedHashMap<String, String>>>() {}));
        scriptTxt.append("ctx._source.queryUsedIn = params.queryUsedIn;");
      }
      if (fieldChange.getName().equalsIgnoreCase("votes")) {
        Map<String, Object> doc = JsonUtils.getMap(event.getEntity());
        fieldAddParams.put(fieldChange.getName(), doc.get("votes"));
        scriptTxt.append("ctx._source.votes = params.votes;");
      }
    }

    // Set to the Output variables
    script = scriptTxt.toString();
    fieldParams = fieldAddParams;
  }

  default String getIndexMapping(
      ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang) throws IOException {
    InputStream in =
        ElasticSearchIndexDefinition.class.getResourceAsStream(
            String.format(elasticSearchIndexType.indexMappingFile, lang.toLowerCase()));
    assert in != null;
    return new String(in.readAllBytes());
  }

  CollectionDAO getDao();

  @SneakyThrows
  default void updateElasticSearchFailureStatus(String failedFor, String failureMessage) {
    long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
    String recordString =
        getDao()
            .entityExtensionTimeSeriesDao()
            .getExtension(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
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

    getDao()
        .entityExtensionTimeSeriesDao()
        .update(
            ELASTIC_SEARCH_ENTITY_FQN_STREAM,
            ELASTIC_SEARCH_EXTENSION,
            JsonUtils.pojoToJson(lastRecord),
            originalLastUpdate);
  }
}
