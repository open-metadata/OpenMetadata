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

package org.openmetadata.service.search;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.search.IndexUtil.ELASTIC_SEARCH_ENTITY_FQN_STREAM;
import static org.openmetadata.service.search.IndexUtil.ELASTIC_SEARCH_EXTENSION;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.FailureDetails;
import org.openmetadata.service.events.AbstractEventPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource.EventList;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SearchEventPublisher extends AbstractEventPublisher {
  private static SearchClient searchClient;
  private static CollectionDAO dao;

  public SearchEventPublisher(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    super(esConfig.getBatchSize());
    SearchEventPublisher.dao = dao;
    // needs Db connection
    registerElasticSearchJobs();
    searchClient = IndexUtil.getSearchClient(esConfig, dao);
    SearchIndexDefinition esIndexDefinition = new SearchIndexDefinition(searchClient);
    esIndexDefinition.createIndexes(esConfig);
  }

  @Override
  public void onStart() {
    LOG.info("ElasticSearch Publisher Started");
  }

  @Override
  public void publish(EventList events) throws EventPublisherException {
    // publishing search directly form Entity Repository
  }

  @Override
  public void onShutdown() {
    searchClient.close();
    LOG.info("Shutting down ElasticSearchEventPublisher");
  }

  public static void updateElasticSearchFailureStatus(
      EntityInterface entity, EventPublisherJob.Status status, String failureMessage) {
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
                      .withContext(entity.toString())
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
