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

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.rest.RestStatus;
import org.elasticsearch.script.Script;
import org.elasticsearch.script.ScriptType;
import org.elasticsearch.xcontent.XContentType;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.elasticsearch.ElasticSearchIndexDefinition.ElasticSearchIndexType;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
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
        UpdateRequest updateRequest = null;
        switch (entityType) {
          case Entity.TABLE:
            updateRequest = updateTable(event);
            break;
          case Entity.DASHBOARD:
            updateRequest = updateDashboard(event);
            break;
          case Entity.TOPIC:
            updateRequest = updateTopic(event);
            break;
          case Entity.PIPELINE:
            updateRequest = updatePipeline(event);
            break;
          case Entity.USER:
            updateRequest = updateUser(event);
            break;
          case Entity.TEAM:
            updateRequest = updateTeam(event);
            break;
          default:
            LOG.warn("Ignoring Entity Type {}", entityType);
        }
        if (updateRequest != null) {
          client.update(updateRequest, RequestOptions.DEFAULT);
        }
      } catch (ElasticsearchException e) {
        LOG.error("failed to update ES doc");
        LOG.debug(e.getMessage());
        if (e.status() == RestStatus.NOT_FOUND
            || e.status() == RestStatus.GATEWAY_TIMEOUT
            || e.status() == RestStatus.INTERNAL_SERVER_ERROR
            || e.status() == RestStatus.REQUEST_TIMEOUT) {
          LOG.error("Error in publishing to ElasticSearch");
          throw new ElasticSearchRetriableException(e.getMessage());
        } else {
          throw new EventPublisherException(e.getMessage());
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
    ESChangeDescription esChangeDescription =
        ESChangeDescription.builder()
            .updatedAt(event.getTimestamp())
            .updatedBy(event.getUserName())
            .fieldsAdded(changeDescription.getFieldsAdded())
            .fieldsUpdated(changeDescription.getFieldsUpdated())
            .fieldsDeleted(changeDescription.getFieldsDeleted())
            .build();
    Map<String, Object> esChangeDescriptionDoc = JsonUtils.getMap(esChangeDescription);
    fieldAddParams.put("change_description", esChangeDescriptionDoc);
    fieldAddParams.put("last_updated_timestamp", event.getTimestamp());
    scriptTxt.append("ctx._source.change_descriptions.add(params.change_description); ");
    scriptTxt.append("ctx._source.last_updated_timestamp=params.last_updated_timestamp;");
    for (FieldChange fieldChange : fieldsAdded) {
      if (fieldChange.getName().equalsIgnoreCase("followers")) {
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
      if (fieldChange.getName().equalsIgnoreCase("followers")) {
        @SuppressWarnings("unchecked")
        List<EntityReference> entityReferences = (List<EntityReference>) fieldChange.getOldValue();
        for (EntityReference follower : entityReferences) {
          fieldAddParams.put(fieldChange.getName(), follower.getId().toString());
        }
        scriptTxt.append("ctx._source.followers.removeAll(Collections.singleton(params.followers));");
      }
    }

    if (!scriptTxt.toString().isEmpty()) {
      Script script = new Script(ScriptType.INLINE, "painless", scriptTxt.toString(), fieldAddParams);
      UpdateRequest updateRequest = new UpdateRequest(esIndexType.indexName, entityId.toString());
      updateRequest.script(script);
      return updateRequest;
    } else {
      return null;
    }
  }

  private UpdateRequest updateTable(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TableESIndex tableESIndex = null;
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      Table table = (Table) event.getEntity();
      tableESIndex = TableESIndex.builder(table, event.getEventType()).build();
    }
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        String json = JsonUtils.pojoToJson(tableESIndex);
        updateRequest.doc(json, XContentType.JSON);
        updateRequest.docAsUpsert(true);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          scriptedUpsert(tableESIndex, updateRequest);
        }
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        break;
      case ENTITY_DELETED:
        break;
    }

    return updateRequest;
  }

  private UpdateRequest updateTopic(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TopicESIndex topicESIndex = null;
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      Topic topic;
      topic = (Topic) event.getEntity();
      topicESIndex = TopicESIndex.builder(topic, event.getEventType()).build();
    }
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        String json = JsonUtils.pojoToJson(topicESIndex);
        updateRequest.doc(json, XContentType.JSON);
        updateRequest.docAsUpsert(true);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          scriptedUpsert(topicESIndex, updateRequest);
        }
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        break;
      case ENTITY_DELETED:
        break;
    }
    return updateRequest;
  }

  private UpdateRequest updateDashboard(ChangeEvent event) throws IOException {
    DashboardESIndex dashboardESIndex = null;
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName, event.getEntityId().toString());
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      Dashboard dashboard = (Dashboard) event.getEntity();
      dashboardESIndex = DashboardESIndex.builder(dashboard, event.getEventType()).build();
    }
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        String json = JsonUtils.pojoToJson(dashboardESIndex);
        updateRequest.doc(json, XContentType.JSON);
        updateRequest.docAsUpsert(true);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          scriptedUpsert(dashboardESIndex, updateRequest);
        }
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        break;
      case ENTITY_DELETED:
        break;
    }
    return updateRequest;
  }

  private UpdateRequest updatePipeline(ChangeEvent event) throws IOException {
    PipelineESIndex pipelineESIndex = null;
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      Pipeline pipeline = (Pipeline) event.getEntity();
      pipelineESIndex = PipelineESIndex.builder(pipeline, event.getEventType()).build();
    }
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName, event.getEntityId().toString());
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        String json = JsonUtils.pojoToJson(pipelineESIndex);
        updateRequest.doc(json, XContentType.JSON);
        updateRequest.docAsUpsert(true);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyChangeEvent(event);
        } else {
          scriptedUpsert(pipelineESIndex, updateRequest);
        }
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        break;
      case ENTITY_DELETED:
        break;
    }

    return updateRequest;
  }

  private UpdateRequest updateUser(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.USER_SEARCH_INDEX.indexName, event.getEntityId().toString());
    UserESIndex userESIndex = null;
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      User user = (User) event.getEntity();
      userESIndex = UserESIndex.builder(user).build();
    }
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        String json = JsonUtils.pojoToJson(userESIndex);
        updateRequest.doc(json, XContentType.JSON);
        updateRequest.docAsUpsert(true);
        break;
      case ENTITY_UPDATED:
        scriptedUserUpsert(userESIndex, updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        break;
      case ENTITY_DELETED:
        break;
    }

    return updateRequest;
  }

  private UpdateRequest updateTeam(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(ElasticSearchIndexType.TEAM_SEARCH_INDEX.indexName, event.getEntityId().toString());
    TeamESIndex teamESIndex = null;
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      Team team = (Team) event.getEntity();
      teamESIndex = TeamESIndex.builder(team).build();
    }
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        String json = JsonUtils.pojoToJson(teamESIndex);
        updateRequest.doc(json, XContentType.JSON);
        updateRequest.docAsUpsert(true);
        break;
      case ENTITY_UPDATED:
        scriptedTeamUpsert(teamESIndex, updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        break;
      case ENTITY_DELETED:
        break;
    }

    return updateRequest;
  }

  private void scriptedUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt =
        "for (k in params.keySet()) {if (k == 'change_descriptions') "
            + "{ ctx._source.change_descriptions.addAll(params.change_descriptions) } "
            + "else { ctx._source.put(k, params.get(k)) }}";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, "painless", scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void scriptedUserUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt =
        "for (k in params.keySet()) {if (k == 'teams') "
            + "{ ctx._source.teams.addAll(params.teams) } "
            + "else if (k == 'roles') "
            + " { ctx._source.roles.addAll(params.roles) }"
            + "else { ctx._source.put(k, params.get(k)) }}";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, "painless", scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void scriptedTeamUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt =
        "for (k in params.keySet()) {if (k == 'users') "
            + "{ ctx._source.users.addAll(params.users) } "
            + "else if (k == 'owns') "
            + " { ctx._source.owns.addAll(params.owns) }"
            + "else { ctx._source.put(k, params.get(k)) }}";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, "painless", scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void softDeleteEntity(UpdateRequest updateRequest) {
    String scriptTxt = "ctx._source.deleted=true";
    Script script = new Script(ScriptType.INLINE, "painless", scriptTxt, new HashMap<>());
    updateRequest.script(script);
  }

  public void close() {
    try {
      this.client.close();
    } catch (Exception e) {
      LOG.error("Failed to close elastic search", e);
    }
  }
}
