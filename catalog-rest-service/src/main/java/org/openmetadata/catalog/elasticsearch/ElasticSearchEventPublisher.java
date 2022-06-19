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

package org.openmetadata.catalog.elasticsearch;

import static org.openmetadata.catalog.Entity.FIELD_FOLLOWERS;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.engine.DocumentMissingException;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.TermQueryBuilder;
import org.elasticsearch.index.reindex.DeleteByQueryRequest;
import org.elasticsearch.rest.RestStatus;
import org.elasticsearch.script.Script;
import org.elasticsearch.script.ScriptType;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.elasticsearch.ElasticSearchIndexDefinition.ElasticSearchIndexType;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.ElasticSearchClientUtils;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class ElasticSearchEventPublisher extends AbstractEventPublisher {
  private final RestHighLevelClient client;
  private final ElasticSearchIndexDefinition esIndexDefinition;

  public ElasticSearchEventPublisher(ElasticSearchConfiguration esConfig) {
    super(esConfig.getBatchSize(), new ArrayList<>());
    this.client = ElasticSearchClientUtils.createElasticSearchClient(esConfig);
    esIndexDefinition = new ElasticSearchIndexDefinition(client);
    esIndexDefinition.createIndexes();
  }

  @Override
  public void onStart() {
    LOG.info("ElasticSearch Publisher Started");
  }

  @Override
  public void publish(ChangeEventList events) throws EventPublisherException {
    for (ChangeEvent event : events.getData()) {
      try {
        String entityType = event.getEntityType();
        switch (entityType) {
          case Entity.TABLE:
            updateTable(event);
            break;
          case Entity.DASHBOARD:
            updateDashboard(event);
            break;
          case Entity.TOPIC:
            updateTopic(event);
            break;
          case Entity.PIPELINE:
            updatePipeline(event);
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
          case Entity.MLMODEL:
            updateMlModel(event);
            break;
          default:
            LOG.warn("Ignoring Entity Type {}", entityType);
        }
      } catch (DocumentMissingException ex) {
        LOG.error("Missing Document", ex);
      } catch (ElasticsearchException e) {
        LOG.error("failed to update ES doc");
        LOG.debug(e.getMessage());
        if (e.status() == RestStatus.GATEWAY_TIMEOUT || e.status() == RestStatus.REQUEST_TIMEOUT) {
          LOG.error("Error in publishing to ElasticSearch");
          throw new ElasticSearchRetriableException(e.getMessage());
        } else {
          LOG.error(e.getMessage(), e);
        }
      } catch (IOException ie) {
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
    ElasticSearchIndexType esIndexType = esIndexDefinition.getIndexMappingByEntityType(entityType);
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

    if (!scriptTxt.toString().isEmpty()) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt.toString(), fieldAddParams);
      UpdateRequest updateRequest = new UpdateRequest(esIndexType.indexName, entityId.toString());
      updateRequest.script(script);
      return updateRequest;
    } else {
      return null;
    }
  }

  private void updateTable(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TableIndex tableIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        tableIndex = new TableIndex((Table) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(tableIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          tableIndex = new TableIndex((Table) event.getEntity());
          scriptedUpsert(tableIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateTopic(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TopicIndex topicIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        topicIndex = new TopicIndex((Topic) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(topicIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          topicIndex = new TopicIndex((Topic) event.getEntity());
          scriptedUpsert(topicIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateDashboard(ChangeEvent event) throws IOException {
    DashboardIndex dashboardIndex;
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName, event.getEntityId().toString());

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        dashboardIndex = new DashboardIndex((Dashboard) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(dashboardIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          dashboardIndex = new DashboardIndex((Dashboard) event.getEntity());
          scriptedUpsert(dashboardIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updatePipeline(ChangeEvent event) throws IOException {
    PipelineIndex pipelineIndex;
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName, event.getEntityId().toString());
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        pipelineIndex = new PipelineIndex((Pipeline) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(pipelineIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        pipelineIndex = new PipelineIndex((Pipeline) event.getEntity());
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          scriptedUpsert(pipelineIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName, event.getEntityId().toString());
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
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateGlossary(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      Glossary glossary = (Glossary) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      queryBuilder.must(new TermQueryBuilder("name", glossary.getName()));
      request.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateMlModel(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.MLMODEL_SEARCH_INDEX.indexName, event.getEntityId().toString());
    MlModelIndex mlModelIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        mlModelIndex = new MlModelIndex((MlModel) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(mlModelIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          mlModelIndex = new MlModelIndex((MlModel) event.getEntity());
          scriptedUpsert(mlModelIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(ElasticSearchIndexType.MLMODEL_SEARCH_INDEX.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  private void updateDatabase(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      Database database = (Database) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      queryBuilder.must(new TermQueryBuilder("database.name", database.getName()));
      queryBuilder.must(new TermQueryBuilder("service.name", database.getService()));
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
      queryBuilder.must(new TermQueryBuilder("database.name", databaseSchema.getDatabase().getName()));
      request.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateDatabaseService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      DatabaseService databaseService = (DatabaseService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(Entity.FIELD_SERVICE, databaseService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updatePipelineService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      PipelineService pipelineService = (PipelineService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder("service.name", pipelineService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateMessagingService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      MessagingService messagingService = (MessagingService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder("service.name", messagingService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  private void updateDashboardService(ChangeEvent event) throws IOException {
    if (event.getEventType() == EventType.ENTITY_DELETED) {
      DashboardService dashboardService = (DashboardService) event.getEntity();
      DeleteByQueryRequest request = new DeleteByQueryRequest(ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder("service.name", dashboardService.getName()));
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

  private void softDeleteEntity(UpdateRequest updateRequest) {
    String scriptTxt = "ctx._source.deleted=true";
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
    updateRequest.script(script);
  }

  private void updateElasticSearch(UpdateRequest updateRequest) throws IOException {
    if (updateRequest != null) {
      LOG.debug("Sending request to ElasticSearch");
      LOG.debug(updateRequest.toString());
      client.update(updateRequest, RequestOptions.DEFAULT);
    }
  }

  private void deleteEntityFromElasticSearch(DeleteRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug("Sending request to ElasticSearch");
      LOG.debug(deleteRequest.toString());
      deleteRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.WAIT_UNTIL);
      client.delete(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  private void deleteEntityFromElasticSearchByQuery(DeleteByQueryRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug("Sending request to ElasticSearch");
      LOG.debug(deleteRequest.toString());
      deleteRequest.setRefresh(true);
      client.deleteByQuery(deleteRequest, RequestOptions.DEFAULT);
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
