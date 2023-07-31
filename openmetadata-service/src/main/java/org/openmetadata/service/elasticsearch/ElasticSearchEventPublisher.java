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

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.search.IndexUtil.ELASTIC_SEARCH_ENTITY_FQN_STREAM;
import static org.openmetadata.service.search.IndexUtil.ELASTIC_SEARCH_EXTENSION;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.index.engine.DocumentMissingException;
import org.elasticsearch.rest.RestStatus;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.EventPublisherJob.Status;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.AbstractEventPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource.EventList;
import org.openmetadata.service.search.IndexUtil;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ElasticSearchEventPublisher extends AbstractEventPublisher {
  private final SearchClient searchClient;
  private final CollectionDAO dao;

  public ElasticSearchEventPublisher(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    super(esConfig.getBatchSize());
    this.dao = dao;
    // needs Db connection
    registerElasticSearchJobs();
    this.searchClient = IndexUtil.getSearchClient(esConfig, dao);
    ElasticSearchIndexDefinition esIndexDefinition = new ElasticSearchIndexDefinition(searchClient);
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
            searchClient.updateEntity(event);
            break;
          case Entity.USER:
            searchClient.updateUser(event);
            break;
          case Entity.TEAM:
            searchClient.updateTeam(event);
            break;
          case Entity.GLOSSARY_TERM:
            searchClient.updateGlossaryTerm(event);
            break;
          case Entity.GLOSSARY:
            searchClient.updateGlossary(event);
            break;
          case Entity.DATABASE:
            searchClient.updateDatabase(event);
            break;
          case Entity.DATABASE_SCHEMA:
            searchClient.updateDatabaseSchema(event);
            break;
          case Entity.DASHBOARD_SERVICE:
            searchClient.updateDashboardService(event);
            break;
          case Entity.DATABASE_SERVICE:
            searchClient.updateDatabaseService(event);
            break;
          case Entity.MESSAGING_SERVICE:
            searchClient.updateMessagingService(event);
            break;
          case Entity.PIPELINE_SERVICE:
            searchClient.updatePipelineService(event);
            break;
          case Entity.MLMODEL_SERVICE:
            searchClient.updateMlModelService(event);
            break;
          case Entity.STORAGE_SERVICE:
            searchClient.updateStorageService(event);
            break;
          case Entity.TAG:
            searchClient.updateTag(event);
            break;
          case Entity.CLASSIFICATION:
            searchClient.updateClassification(event);
            break;
          case Entity.TEST_CASE:
            searchClient.updateTestCase(event);
            break;
          case Entity.TEST_SUITE:
            searchClient.updateTestSuite(event);
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
    searchClient.close();
    LOG.info("Shutting down ElasticSearchEventPublisher");
  }

  public void updateElasticSearchFailureStatus(String context, EventPublisherJob.Status status, String failureMessage) {
    try {
      long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      String recordString =
          dao.entityExtensionTimeSeriesDao()
              .getExtension(EntityUtil.hash(ELASTIC_SEARCH_ENTITY_FQN_STREAM), ELASTIC_SEARCH_EXTENSION);
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
              EntityUtil.hash(ELASTIC_SEARCH_ENTITY_FQN_STREAM),
              ELASTIC_SEARCH_EXTENSION,
              JsonUtils.pojoToJson(lastRecord),
              originalLastUpdate);
    } catch (Exception e) {
      LOG.error("Failed to Update Elastic Search Job Info");
    }
  }

  private void registerElasticSearchJobs() {
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
}
