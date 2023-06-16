/*
 *  Copyright 2021 Collate
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.elasticsearch;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.ELASTIC_SEARCH_ENTITY_FQN_STREAM;
import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.ELASTIC_SEARCH_EXTENSION;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.engine.DocumentMissingException;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.MatchQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.TermQueryBuilder;
import org.elasticsearch.index.query.WildcardQueryBuilder;
import org.elasticsearch.index.reindex.DeleteByQueryRequest;
import org.elasticsearch.index.reindex.UpdateByQueryRequest;
import org.elasticsearch.rest.RestStatus;
import org.elasticsearch.script.Script;
import org.elasticsearch.script.ScriptType;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.EventPublisherJob.Status;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.ElasticSearchIndexType;
import org.openmetadata.service.events.AbstractEventPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource.EventList;
import org.openmetadata.service.util.ElasticSearchClientUtils;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ElasticSearchEventPublisher extends AbstractEventPublisher {
  private static final String SENDING_REQUEST_TO_ELASTIC_SEARCH = "Sending request to ElasticSearch {}";
  private final RestHighLevelClient client;
  private final CollectionDAO dao;
  private static final String SERVICE_NAME = "service.name";
  private static final String DATABASE_NAME = "database.name";

  public ElasticSearchEventPublisher(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    super(esConfig.getBatchSize());
    this.dao = dao;
    // needs Db connection
    registerElasticSearchJobs();
    this.client = ElasticSearchClientUtils.createElasticSearchClient(esConfig);
    ElasticSearchIndexDefinition esIndexDefinition = new ElasticSearchIndexDefinition(client, dao);
    esIndexDefinition.createIndexes(esConfig);
  }

  @Override
  public void onStart() {
    LOG.info("ElasticSearch Publisher Started");
  }

  @Override
  public void publish(EventList events) throws EventPublisherException, JsonProcessingException {
    for (ChangeEvent event : events.getData()) {
      String entityType = event.getEntityType();
      String contextInfo =
          event.getEntity() != null ? String.format("Entity Info : %s", JsonUtils.pojoToJson(event.getEntity())) : null;
      try {
        switch (entityType) {
          case Entity.TABLE:
          case Entity.DASHBOARD:
          case Entity.TOPIC:
          case Entity.PIPELINE:
          case Entity.MLMODEL:
          case Entity.CONTAINER:
          case Entity.QUERY:
            updateEntity(event);
            break;
          case Entity.USER:
            updateUser(event);
            break;
          case Entity.TEAM:
            updateTeam(event);
            break;
          case Entity.GLOSSARY_TERM:
            updateGlossaryTerm(event);
            break;
          case Entity.GLOSSARY:
            updateGlossary(event);
            break;
          case Entity.DATABASE:
            updateDatabase(event);
            break;
          case Entity.DATABASE_SCHEMA:
            updateDatabaseSchema(event);
            break;
          case Entity.DASHBOARD_SERVICE:
            updateDashboardService(event);
            break;
          case Entity.DATABASE_SERVICE:
            updateDatabaseService(event);
            break;
          case Entity.MESSAGING_SERVICE:
            updateMessagingService(event);
            break;
          case Entity.PIPELINE_SERVICE:
            updatePipelineService(event);
            break;
          case Entity.MLMODEL_SERVICE:
            updateMlModelService(event);
            break;
          case Entity.STORAGE_SERVICE:
            updateStorageService(event);
            break;
          case Entity.TAG:
            updateTag(event);
            break;
          case Entity.CLASSIFICATION:
            updateClassification(event);
            break;
          case Entity.TEST_CASE:
            updateTestCase(event);
            break;
          case Entity.TEST_SUITE:
            updateTestSuite(event);
            break;
          default:
            LOG.warn("Ignoring Entity Type {}", entityType);
        }
      } catch (DocumentMissingException ex) {
        LOG.error("Missing Document", ex);
        updateElasticSearchFailureStatus(
            contextInfo,
            Status.ACTIVE_WITH_ERROR,
            String.format(
                "Missing Document while Updating ES. Reason[%s], Cause[%s], Stack [%s]",
                ex.getMessage(), ex.getCause(), ExceptionUtils.getStackTrace(ex)));
      } catch (ElasticsearchException e) {
        LOG.error("failed to update ES doc");
        LOG.debug(e.getMessage());
        if (e.status() == RestStatus.GATEWAY_TIMEOUT || e.status() == RestStatus.REQUEST_TIMEOUT) {
          LOG.error("Error in publishing to ElasticSearch");
          updateElasticSearchFailureStatus(
              contextInfo,
              Status.ACTIVE_WITH_ERROR,
              String.format(
                  "Timeout when updating ES request. Reason[%s], Cause[%s], Stack [%s]",
                  e.getMessage(), e.getCause(), ExceptionUtils.getStackTrace(e)));
          throw new ElasticSearchRetriableException(e.getMessage());
        } else {
          updateElasticSearchFailureStatus(
              contextInfo,
              Status.ACTIVE_WITH_ERROR,
              String.format(
                  "Failed while updating ES. Reason[%s], Cause[%s], Stack [%s]",
                  e.getMessage(), e.getCause(), ExceptionUtils.getStackTrace(e)));
          LOG.error(e.getMessage(), e);
        }
      } catch (IOException ie) {
        updateElasticSearchFailureStatus(
            contextInfo,
            Status.ACTIVE_WITH_ERROR,
            String.format(
                "Issue in updating ES request. Reason[%s], Cause[%s], Stack [%s]",
                ie.getMessage(), ie.getCause(), ExceptionUtils.getStackTrace(ie)));
        throw new EventPublisherException(ie.getMessage());
      }
    }
  }

  @Override
  public void onShutdown() {
    close();
    LOG.info("Shutting down ElasticSearchEventPublisher");
  }

  private UpdateRequest applyChangeEvent(ChangeEvent event) {
    String entityType = event.getEntityType();
    ElasticSearchIndexType esIndexType = ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    UUID entityId = event.getEntityId();
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

    if (!scriptTxt.toString().isEmpty()) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt.toString(), fieldAddParams);
      UpdateRequest updateRequest = new UpdateRequest(esIndexType.indexName, entityId.toString());
      updateRequest.script(script);
      return updateRequest;
    } else {
      return null;
    }
  }

  private void updateEntity(ChangeEvent event) throws IOException {
    String entityType = event.getEntityType();
    ElasticSearchIndexType indexType = ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, event.getEntityId().toString());
    ElasticSearchIndex index;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        index = ElasticSearchIndexFactory.buildIndex(entityType, event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(index.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          index = ElasticSearchIndexFactory.buildIndex(entityType, event.getEntity());
          scriptedUpsert(index.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest = new DeleteRequest(indexType.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateUser(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.USER_SEARCH_INDEX.indexName, event.getEntityId().toString());
    UserIndex userIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        userIndex = new UserIndex((User) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(userIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        userIndex = new UserIndex((User) event.getEntity());
        scriptedUserUpsert(userIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.USER_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateTeam(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TEAM_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TeamIndex teamIndex;
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        teamIndex = new TeamIndex((Team) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(teamIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        teamIndex = new TeamIndex((Team) event.getEntity());
        scriptedTeamUpsert(teamIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.TEAM_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateGlossaryTerm(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName, event.getEntityId().toString());
    GlossaryTermIndex glossaryTermIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        glossaryTermIndex = new GlossaryTermIndex((GlossaryTerm) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(glossaryTermIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        glossaryTermIndex = new GlossaryTermIndex((GlossaryTerm) event.getEntity());
        scriptedUpsert(glossaryTermIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName);
        new DeleteRequest(ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName, event.getEntityId().toString());
        GlossaryTerm glossaryTerm = (GlossaryTerm) event.getEntity();
        request.setQuery(
            QueryBuilders.boolQuery()
                .should(QueryBuilders.matchQuery("id", glossaryTerm.getId().toString()))
                .should(QueryBuilders.matchQuery("parent.id", glossaryTerm.getId().toString())));
        deleteEntityFromElasticSearchByQuery(request);
        break;
    }
  }

  private void updateGlossary(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      Glossary glossary = (Glossary) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName);
      request.setQuery(
          QueryBuilders.boolQuery().should(QueryBuilders.matchQuery("glossary.id", glossary.getId().toString())));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateTestSuite(ChangeEvent event) throws IOException {
    ElasticSearchIndexType indexType = ElasticSearchIndexDefinition.getIndexMappingByEntityType(Entity.TEST_CASE);
    TestSuite testSuite = (TestSuite) event.getEntity();
    UUID testSuiteId = testSuite.getId();

    if (event.getEventType() == ENTITY_DELETED) {
      if (testSuite.getExecutable()) {
        DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexType.indexName);
        deleteByQueryRequest.setQuery(new MatchQueryBuilder("testSuite.id", testSuiteId.toString()));
        deleteEntityFromElasticSearchByQuery(deleteByQueryRequest);
      } else {
        UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexType.indexName);
        updateByQueryRequest.setQuery(new MatchQueryBuilder("testSuite.id", testSuiteId.toString()));
        String scriptTxt =
            "for (int i = 0; i < ctx._source.testSuite.length; i++) { if (ctx._source.testSuite[i].id == '%s') { ctx._source.testSuite.remove(i) }}";
        Script script =
            new Script(
                ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, String.format(scriptTxt, testSuiteId), new HashMap<>());
        updateByQueryRequest.setScript(script);
        updateElasticSearchByQuery(updateByQueryRequest);
      }
    }
  }

  private void updateTestCase(ChangeEvent event) throws IOException {
    ElasticSearchIndexType indexType = ElasticSearchIndexDefinition.getIndexMappingByEntityType(Entity.TEST_CASE);
    // creating a new test case will return a TestCase entity while bulk adding test cases will return
    // the logical test suite entity with the newly added test cases
    EntityInterface entityInterface = (EntityInterface) event.getEntity();
    if (entityInterface instanceof TestCase) {
      processTestCase((TestCase) entityInterface, event, indexType);
    } else {
      addTestCaseFromLogicalTestSuite((TestSuite) entityInterface, event, indexType);
    }
  }

  private void addTestCaseFromLogicalTestSuite(TestSuite testSuite, ChangeEvent event, ElasticSearchIndexType indexType)
      throws IOException {
    // Process creation of test cases (linked to a logical test suite) by adding reference to existing test cases
    List<EntityReference> testCaseReferences = testSuite.getTests();
    TestSuite testSuiteReference =
        new TestSuite()
            .withId(testSuite.getId())
            .withName(testSuite.getName())
            .withDisplayName(testSuite.getDisplayName())
            .withDescription(testSuite.getDescription())
            .withFullyQualifiedName(testSuite.getFullyQualifiedName())
            .withDeleted(testSuite.getDeleted())
            .withHref(testSuite.getHref())
            .withExecutable(testSuite.getExecutable());
    Map<String, Object> testSuiteDoc = JsonUtils.getMap(testSuiteReference);
    if (event.getEventType() == ENTITY_UPDATED) {
      for (EntityReference testcaseReference : testCaseReferences) {
        UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, testcaseReference.getId().toString());
        String scripText = "ctx._source.testSuite.add(params)";
        Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scripText, testSuiteDoc);
        updateRequest.script(script);
        updateElasticSearch(updateRequest);
      }
    }
  }

  private void processTestCase(TestCase testCase, ChangeEvent event, ElasticSearchIndexType indexType)
      throws IOException {
    // Process creation of test cases (linked to an executable test suite
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, testCase.getId().toString());
    TestCaseIndex testCaseIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        testCaseIndex = new TestCaseIndex((TestCase) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(testCaseIndex.buildESDocForCreate()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        testCaseIndex = new TestCaseIndex((TestCase) event.getEntity());
        scriptedUpsert(testCaseIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        EntityReference testSuiteReference = ((TestCase) event.getEntity()).getTestSuite();
        TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, testSuiteReference.getId(), "", Include.ALL);
        if (testSuite.getExecutable()) {
          // Delete the test case from the index if deleted from an executable test suite
          DeleteRequest deleteRequest = new DeleteRequest(indexType.indexName, event.getEntityId().toString());
          deleteEntityFromElasticSearch(deleteRequest);
        } else {
          // for non-executable test suites, simply remove the testSuite from the testCase and update the index
          scriptedDeleteTestCase(updateRequest, testSuite.getId());
          updateElasticSearch(updateRequest);
        }
        break;
    }
  }

  private void updateTag(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TAG_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TagIndex tagIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        tagIndex = new TagIndex((Tag) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(tagIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          tagIndex = new TagIndex((Tag) event.getEntity());
          scriptedUpsert(tagIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.TAG_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);

        String[] indexes =
            new String[] {
              ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName,
              ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName,
              ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName,
              ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName,
              ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName,
              ElasticSearchIndexType.MLMODEL_SEARCH_INDEX.indexName
            };
        BulkRequest request = new BulkRequest();
        SearchRequest searchRequest;
        SearchResponse response;
        int batchSize = 50;
        int totalHits;
        int currentHits = 0;

        do {
          searchRequest =
              searchRequest(indexes, "tags.tagFQN", event.getEntityFullyQualifiedName(), batchSize, currentHits);
          response = client.search(searchRequest, RequestOptions.DEFAULT);
          totalHits = (int) response.getHits().getTotalHits().value;
          for (SearchHit hit : response.getHits()) {
            Map<String, Object> sourceAsMap = hit.getSourceAsMap();
            List<TagLabel> listTags = (List<TagLabel>) sourceAsMap.get("tags");
            Script script = generateTagScript(listTags);
            if (!script.toString().isEmpty()) {
              request.add(
                  updateRequests(sourceAsMap.get("entityType").toString(), sourceAsMap.get("id").toString(), script));
            }
          }
          currentHits += response.getHits().getHits().length;
        } while (currentHits < totalHits);
        if (request.numberOfActions() > 0) {
          client.bulk(request, RequestOptions.DEFAULT);
        }
    }
  }

  private SearchRequest searchRequest(String[] indexes, String field, String value, int batchSize, int from) {
    SearchRequest searchRequest = new SearchRequest(indexes);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(QueryBuilders.matchQuery(field, value));
    searchSourceBuilder.from(from);
    searchSourceBuilder.size(batchSize);
    searchSourceBuilder.timeout(new TimeValue(60, TimeUnit.SECONDS));
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private Script generateTagScript(List<TagLabel> listTags) {
    StringBuilder scriptTxt = new StringBuilder();
    Map<String, Object> fieldRemoveParams = new HashMap<>();
    fieldRemoveParams.put("tags", listTags);
    scriptTxt.append("ctx._source.tags=params.tags;");
    scriptTxt.append("ctx._source.tags.removeAll(params.tags);");
    fieldRemoveParams.put("tags", listTags);
    return new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt.toString(), fieldRemoveParams);
  }

  private UpdateRequest updateRequests(String entityType, String entityId, Script script) {
    return new UpdateRequest(ElasticSearchIndexDefinition.ENTITY_TYPE_TO_INDEX_MAP.get(entityType), entityId)
        .script(script);
  }

  private void updateDatabase(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      Database database = (Database) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      queryBuilder.must(new TermQueryBuilder(DATABASE_NAME, database.getName()));
      queryBuilder.must(new TermQueryBuilder(SERVICE_NAME, database.getService().getName()));
      request.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateDatabaseSchema(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      DatabaseSchema databaseSchema = (DatabaseSchema) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      queryBuilder.must(new TermQueryBuilder("databaseSchema.name", databaseSchema.getName()));
      queryBuilder.must(new TermQueryBuilder(DATABASE_NAME, databaseSchema.getDatabase().getName()));
      request.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateDatabaseService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      DatabaseService databaseService = (DatabaseService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(SERVICE_NAME, databaseService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updatePipelineService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      PipelineService pipelineService = (PipelineService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(SERVICE_NAME, pipelineService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateMlModelService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      MlModelService mlModelService = (MlModelService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.MLMODEL_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(SERVICE_NAME, mlModelService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateStorageService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      StorageService storageService = (StorageService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.CONTAINER_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(SERVICE_NAME, storageService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateMessagingService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      MessagingService messagingService = (MessagingService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(SERVICE_NAME, messagingService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateDashboardService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      DashboardService dashboardService = (DashboardService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(SERVICE_NAME, dashboardService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateClassification(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      Classification classification = (Classification) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TAG_SEARCH_INDEX.indexName);
      String fqnMatch = classification.getName() + ".*";
      request.setQuery(new WildcardQueryBuilder("fullyQualifiedName", fqnMatch));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void scriptedUpsert(Object doc, UpdateRequest updateRequest) {
    String scriptTxt = "for (k in params.keySet()) { ctx._source.put(k, params.get(k)) }";
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, JsonUtils.getMap(doc));
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
    updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
  }

  private void scriptedUserUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt = "for (k in params.keySet()) {ctx._source.put(k, params.get(k)) }";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void scriptedTeamUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt = "for (k in params.keySet()) { ctx._source.put(k, params.get(k)) }";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void scriptedDeleteTestCase(UpdateRequest updateRequest, UUID testSuiteId) {
    // Remove logical test suite from test case `testSuite` field
    String scriptTxt =
        "for (int i = 0; i < ctx._source.testSuite.length; i++) { if (ctx._source.testSuite[i].id == '%s') { ctx._source.testSuite.remove(i) }}";
    scriptTxt = String.format(scriptTxt, testSuiteId);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
    updateRequest.script(script);
  }

  private void softDeleteEntity(UpdateRequest updateRequest) {
    String scriptTxt = "ctx._source.deleted=true";
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
    updateRequest.script(script);
  }

  private void updateElasticSearch(UpdateRequest updateRequest) throws IOException {
    if (updateRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      client.update(updateRequest, RequestOptions.DEFAULT);
    }
  }

  private void updateElasticSearchByQuery(UpdateByQueryRequest updateByQueryRequest) throws IOException {
    if (updateByQueryRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateByQueryRequest);
      client.updateByQuery(updateByQueryRequest, RequestOptions.DEFAULT);
    }
  }

  private void deleteEntityFromElasticSearch(DeleteRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      deleteRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.WAIT_UNTIL);
      client.delete(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  private void deleteEntityFromElasticSearchByQuery(DeleteByQueryRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      deleteRequest.setRefresh(true);
      client.deleteByQuery(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  public void registerElasticSearchJobs() {
    try {
      dao.entityExtensionTimeSeriesDao().delete(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
      long startTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      FailureDetails failureDetails = new FailureDetails().withLastFailedAt(0L);
      EventPublisherJob streamJob =
          new EventPublisherJob()
              .withId(UUID.randomUUID())
              .withName("Elastic Search Stream")
              .withPublisherType(CreateEventPublisherJob.PublisherType.ELASTIC_SEARCH)
              .withRunMode(CreateEventPublisherJob.RunMode.STREAM)
              .withStatus(EventPublisherJob.Status.ACTIVE)
              .withTimestamp(startTime)
              .withStartedBy(ADMIN_USER_NAME)
              .withStartTime(startTime)
              .withFailure(new Failure().withSinkError(failureDetails));
      dao.entityExtensionTimeSeriesDao()
          .insert(
              ELASTIC_SEARCH_ENTITY_FQN_STREAM,
              ELASTIC_SEARCH_EXTENSION,
              "eventPublisherJob",
              JsonUtils.pojoToJson(streamJob));
    } catch (Exception e) {
      LOG.error("Failed to register Elastic Search Job");
    }
  }

  public void updateElasticSearchFailureStatus(String context, EventPublisherJob.Status status, String failureMessage) {
    try {
      long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      String recordString =
          dao.entityExtensionTimeSeriesDao().getExtension(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
      EventPublisherJob lastRecord = JsonUtils.readValue(recordString, EventPublisherJob.class);
      long originalLastUpdate = lastRecord.getTimestamp();
      lastRecord.setStatus(status);
      lastRecord.setTimestamp(updateTime);
      lastRecord.setFailure(
          new Failure()
              .withSinkError(
                  new FailureDetails()
                      .withContext(context)
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

  public void close() {
    try {
      this.client.close();
    } catch (Exception e) {
      LOG.error("Failed to close elastic search", e);
    }
  }
}
