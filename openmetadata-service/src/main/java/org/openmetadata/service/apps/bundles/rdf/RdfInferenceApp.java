/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.apps.bundles.rdf;

import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;

import java.time.Clock;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.applications.configuration.internal.RdfInferenceAppConfig;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceMaterializer;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository;
import org.openmetadata.service.rdf.inference.InferenceRuleService;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;

/** Quartz adapter for durable, Fuseki-side inference materialization. */
@Slf4j
public final class RdfInferenceApp extends AbstractNativeApplication {
  private final Stats stats = new Stats();
  private RdfInferenceAppConfig appConfig = new RdfInferenceAppConfig();
  private JobExecutionContext jobExecutionContext;

  public RdfInferenceApp(
      final CollectionDAO collectionDAO, final SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(final App app) {
    super.init(app);
    final RdfInferenceAppConfig configured =
        JsonUtils.convertValue(app.getAppConfiguration(), RdfInferenceAppConfig.class);
    appConfig = configured == null ? new RdfInferenceAppConfig() : configured;
  }

  @Override
  public void startApp(final JobExecutionContext context) {
    jobExecutionContext = context;
    initializeRun();
    try {
      completeRun(runConfiguredMaterialization());
    } catch (RuntimeException exception) {
      failRun(exception);
    }
  }

  private InferenceMaterializationResult runConfiguredMaterialization() {
    final RdfRepository repository = RdfRepository.getInstanceOrNull();
    final InferenceMaterializationResult result;
    if (repository == null
        || !Boolean.TRUE.equals(repository.getConfig().getMaterializedInferenceEnabled())) {
      final long now = System.currentTimeMillis();
      result = emptyResult(now);
    } else {
      result = createService().materialize(force(), appConfig.getRuleName());
    }
    return result;
  }

  private static InferenceMaterializationResult emptyResult(final long timestamp) {
    return new InferenceMaterializationResult()
        .withStartedAt(timestamp)
        .withCompletedAt(timestamp)
        .withSuccessfulRules(0)
        .withFailedRules(0)
        .withProcessedRules(List.of());
  }

  private InferenceRuleService createService() {
    final RdfRepository rdfRepository = RdfRepository.getInstance();
    final Clock clock = Clock.systemUTC();
    final InferenceRuleRepository ruleRepository =
        new InferenceRuleRepository(
            collectionDAO.rdfInferenceRuleDAO(), clock, rdfRepository.getBaseUri());
    return new InferenceRuleService(
        ruleRepository, new InferenceMaterializer(rdfRepository, ruleRepository, clock));
  }

  private void initializeRun() {
    stats.setJobStats(stepStats(0, 0, 0));
    jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, stats);
    updateRunRecord(AppRunRecord.Status.RUNNING, null);
  }

  private void completeRun(final InferenceMaterializationResult result) {
    final int totalRules = result.getSuccessfulRules() + result.getFailedRules();
    stats.setJobStats(stepStats(totalRules, result.getSuccessfulRules(), result.getFailedRules()));
    final AppRunRecord.Status status =
        result.getFailedRules() == 0 ? AppRunRecord.Status.COMPLETED : AppRunRecord.Status.FAILED;
    final String error =
        result.getFailedRules() == 0
            ? null
            : result.getFailedRules() + " inference rule materializations failed";
    updateRunRecord(status, error);
  }

  private void failRun(final RuntimeException exception) {
    LOG.error("RDF inference materialization app failed", exception);
    stats.setJobStats(stepStats(1, 0, 1));
    updateRunRecord(AppRunRecord.Status.FAILED, exception.getMessage());
  }

  private void updateRunRecord(final AppRunRecord.Status status, final String error) {
    final AppRunRecord appRecord = getJobRecord(jobExecutionContext).withStatus(status);
    if (error != null) {
      appRecord.setFailureContext(
          new FailureContext()
              .withFailure(
                  new IndexingError()
                      .withErrorSource(IndexingError.ErrorSource.JOB)
                      .withMessage(error)));
    }
    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
  }

  private boolean force() {
    return Boolean.TRUE.equals(appConfig.getForce());
  }

  private static StepStats stepStats(
      final int totalRecords, final int successRecords, final int failedRecords) {
    return new StepStats()
        .withTotalRecords(totalRecords)
        .withSuccessRecords(successRecords)
        .withFailedRecords(failedRecords);
  }
}
