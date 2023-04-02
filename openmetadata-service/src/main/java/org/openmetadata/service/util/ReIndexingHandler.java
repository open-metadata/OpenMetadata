/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.util;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Failure;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jobs.reindexing.ReindexingJob;

@Slf4j
public class ReIndexingHandler {
  public static final String REINDEXING_JOB_EXTENSION = "reindexing.eventPublisher";
  private static ReIndexingHandler INSTANCE;
  private static volatile boolean INITIALIZED = false;
  private static CollectionDAO dao;
  private static RestHighLevelClient client;
  private static ElasticSearchIndexDefinition esIndexDefinition;
  private static ExecutorService threadScheduler;
  private final Map<UUID, ReindexingJob> REINDEXING_JOB_MAP = new LinkedHashMap<>();
  private static BlockingQueue<Runnable> taskQueue;

  private ReIndexingHandler() {}

  public static ReIndexingHandler getInstance() {
    return INSTANCE;
  }

  public static void initialize(
      RestHighLevelClient restHighLevelClient,
      ElasticSearchIndexDefinition elasticSearchIndexDefinition,
      CollectionDAO daoObject) {
    if (!INITIALIZED) {
      client = restHighLevelClient;
      dao = daoObject;
      esIndexDefinition = elasticSearchIndexDefinition;
      taskQueue = new ArrayBlockingQueue<>(5);
      threadScheduler = new ThreadPoolExecutor(5, 5, 0L, TimeUnit.MILLISECONDS, taskQueue);
      INSTANCE = new ReIndexingHandler();
      INITIALIZED = true;
    } else {
      LOG.info("Reindexing Handler is already initialized");
    }
  }

  @SneakyThrows
  public EventPublisherJob createReindexingJob(String startedBy, CreateEventPublisherJob createReindexingJob) {
    // Remove jobs in case they are completed
    clearCompletedJobs();

    // Create new Task
    if (taskQueue.size() >= 5) {
      throw new RuntimeException("Cannot create new Reindexing Jobs. There are pending jobs.");
    }
    EventPublisherJob jobData = getReindexJob(startedBy, createReindexingJob);
    // Create Entry in the DB
    dao.entityExtensionTimeSeriesDao()
        .insert(
            jobData.getId().toString(), REINDEXING_JOB_EXTENSION, "eventPublisherJob", JsonUtils.pojoToJson(jobData));
    // Create Job
    ReindexingJob job = new ReindexingJob(dao, esIndexDefinition, client, jobData);
    threadScheduler.submit(job);
    REINDEXING_JOB_MAP.put(jobData.getId(), job);
    return jobData;
  }

  private void clearCompletedJobs() {
    REINDEXING_JOB_MAP
        .entrySet()
        .removeIf(
            (entry) ->
                entry.getValue().getJobData().getStatus() != EventPublisherJob.Status.STARTED
                    && entry.getValue().getJobData().getStatus() != EventPublisherJob.Status.RUNNING);
  }

  public EventPublisherJob getJob(UUID jobId) throws IOException {
    ReindexingJob job = REINDEXING_JOB_MAP.get(jobId);
    if (job == null) {
      String recordString = dao.entityExtensionTimeSeriesDao().getLatestByExtension(REINDEXING_JOB_EXTENSION);
      return JsonUtils.readValue(recordString, EventPublisherJob.class);
    }
    return REINDEXING_JOB_MAP.get(jobId).getJobData();
  }

  public EventPublisherJob getLatestJob() throws IOException {
    List<ReindexingJob> activeJobs = new ArrayList<>(REINDEXING_JOB_MAP.values());
    if (activeJobs.size() > 0) {
      return activeJobs.get(activeJobs.size() - 1).getJobData();
    } else {
      String recordString = dao.entityExtensionTimeSeriesDao().getLatestByExtension(REINDEXING_JOB_EXTENSION);
      return JsonUtils.readValue(recordString, EventPublisherJob.class);
    }
  }

  public List<EventPublisherJob> getAllJobs() throws IOException {
    List<EventPublisherJob> result = new ArrayList<>();
    List<ReindexingJob> activeJob = new ArrayList<>(REINDEXING_JOB_MAP.values());
    List<String> jobs = dao.entityExtensionTimeSeriesDao().getAllByExtension(REINDEXING_JOB_EXTENSION);
    result.addAll(JsonUtils.readObjects(jobs, EventPublisherJob.class));
    result.addAll(activeJob.stream().map(ReindexingJob::getJobData).collect(Collectors.toList()));
    return result;
  }

  private EventPublisherJob getReindexJob(String startedBy, CreateEventPublisherJob job) {
    long updateTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
    return new EventPublisherJob()
        .withId(UUID.randomUUID())
        .withName(job.getName())
        .withPublisherType(CreateEventPublisherJob.PublisherType.ELASTIC_SEARCH)
        .withRunMode(CreateEventPublisherJob.RunMode.BATCH)
        .withStartedBy(startedBy)
        .withStatus(EventPublisherJob.Status.STARTED)
        .withStats(new Stats())
        .withStartTime(updateTime)
        .withTimestamp(updateTime)
        .withEntities(job.getEntities())
        .withBatchSize(job.getBatchSize())
        .withFailure(new Failure())
        .withRecreateIndex(job.getRecreateIndex())
        .withSearchIndexMappingLanguage(job.getSearchIndexMappingLanguage());
  }
}
