/*
 *  Copyright 2021 Collate
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

package org.openmetadata.sdk;

import jakarta.ws.rs.core.Response;
import java.net.URL;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;

/**
 * Client to make API calls to add, deleted, and deploy pipelines on a PipelineService, such as
 * Airflow. Core abstractions are as follows:
 *
 * <ul>
 *   <li>A PipelineService is a service such as AirFlow to which a pipeline can be deployed
 *   <li>A Pipeline is a workflow for performing certain tasks. Example - ingestion pipeline is a
 *       workflow that connects to a database service or other services and collect metadata.
 *   <li>Pipeline uses `Connection` to a service as dependency. A Pipeline might need to connection
 *       to database service to collect metadata, OpenMetadata to user metadata over APIs, etc.
 * </ul>
 */
public interface PipelineServiceClientInterface {
  String HEALTHY_STATUS = "healthy";
  String UNHEALTHY_STATUS = "unhealthy";
  String STATUS_KEY = "status";
  String APP_TRIGGER = "run_application";

  String DEPLOYMENT_ERROR = "DEPLOYMENT_ERROR";
  String TRIGGER_ERROR = "TRIGGER_ERROR";
  String LOGS_ERROR_KEY = "error";

  /**
   * Task key that metadata-style ingestion logs are returned under. Defined once because several
   * pipeline types deliberately share it and it doubles as {@link #DEFAULT_TASK_KEY}.
   */
  String INGESTION_TASK_KEY = "ingestion_task";

  /**
   * Task key used when a pipeline type has no dedicated entry in {@link #TYPE_TO_TASK}. Callers must
   * resolve through {@link #taskKeyOf(String)} rather than reading the map directly: a null task key
   * ends up as a null key in the JSON log response, which Jackson refuses to serialize and which
   * surfaces to the caller as an opaque 400 "Invalid request format".
   *
   * <p>Kept separate from {@link #INGESTION_TASK_KEY} even though the values coincide: this one is
   * fallback policy, and retargeting it must not silently change the response shape of the pipeline
   * types that map to {@code ingestion_task} as their real, UI-facing contract.
   */
  String DEFAULT_TASK_KEY = INGESTION_TASK_KEY;

  Map<String, String> TYPE_TO_TASK =
      Map.ofEntries(
          Map.entry(PipelineType.METADATA.toString(), INGESTION_TASK_KEY),
          Map.entry(PipelineType.PROFILER.toString(), "profiler_task"),
          Map.entry(PipelineType.AUTO_CLASSIFICATION.toString(), "auto_classification_task"),
          Map.entry(PipelineType.LINEAGE.toString(), "lineage_task"),
          Map.entry(PipelineType.DBT.toString(), "dbt_task"),
          Map.entry(PipelineType.USAGE.toString(), "usage_task"),
          Map.entry(PipelineType.TEST_SUITE.toString(), "test_suite_task"),
          Map.entry(PipelineType.DATA_INSIGHT.toString(), "data_insight_task"),
          Map.entry(PipelineType.ELASTIC_SEARCH_REINDEX.toString(), "elasticsearch_reindex_task"),
          Map.entry(PipelineType.APPLICATION.toString(), "application_task"),
          // The UI reads policy agent logs from `ingestion_task`
          // (see agentsDataMapper.ts PIPELINE_TYPE_TO_LOG_TASK_FIELD).
          Map.entry(PipelineType.POLICY_AGENT.toString(), INGESTION_TASK_KEY));

  /** Resolves the log task key for a pipeline type, falling back to {@link #DEFAULT_TASK_KEY}. */
  static String taskKeyOf(String pipelineType) {
    return TYPE_TO_TASK.getOrDefault(pipelineType, DEFAULT_TASK_KEY);
  }

  URL validateServiceURL(String serviceURL);

  String getBasicAuthenticationHeader(String username, String password);

  Boolean validServerClientVersions(String clientVersion, String serverVersion);

  Response getHostIp();

  /**
   * Check the pipeline service status with an exception backoff to make sure we don't raise any
   * false positives.
   */
  String getServiceStatusBackoff();

  /* Check the status of pipeline service to ensure it is healthy */
  PipelineServiceClientResponse getServiceStatus();

  List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline);

  /**
   * This workflow can be used to execute any necessary async automations from the pipeline service.
   * This will be the new Test Connection endpoint. The UI can create a new workflow and trigger it
   * in the server, and keep polling the results.
   */
  PipelineServiceClientResponse runAutomationsWorkflow(Workflow workflow);

  PipelineServiceClientResponse runApplicationFlow(App application);

  PipelineServiceClientResponse validateAppRegistration(AppMarketPlaceDefinition app);

  /* Deploy a pipeline to the pipeline service */
  PipelineServiceClientResponse deployPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service);

  /* Deploy run the pipeline at the pipeline service */
  PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service);

  /* Deploy run the pipeline at the pipeline service with ad-hoc custom configuration.
   * This might not be supported by some pipeline service clients.*/
  default PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline,
      ServiceEntityInterface service,
      Map<String, Object> config) {
    throw new UnsupportedOperationException(
        "This operation is not supported by this pipeline service");
  }

  /* Stop and delete a pipeline at the pipeline service */
  PipelineServiceClientResponse deletePipeline(IngestionPipeline ingestionPipeline);

  /* Get the status of a deployed pipeline */
  List<PipelineStatus> getQueuedPipelineStatusInternal(IngestionPipeline ingestionPipeline);

  /* Toggle the state of an Ingestion Pipeline as enabled/disabled */
  PipelineServiceClientResponse toggleIngestion(IngestionPipeline ingestionPipeline);

  /* Get the all last run logs of a deployed pipeline. Implementations use LOGS_ERROR_KEY when
   * logs cannot be retrieved so callers do not render the failure as pipeline output. */
  Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline, String after);

  /* Get logs for a specific pipeline run identified by runId.
   * When runId is null or blank, falls back to getLastIngestionLogs (latest run). */
  default Map<String, String> getIngestionLogs(
      IngestionPipeline ingestionPipeline, String after, String runId) {
    return getLastIngestionLogs(ingestionPipeline, after);
  }

  /* Get the all last run logs of a deployed pipeline */
  PipelineServiceClientResponse killIngestion(IngestionPipeline ingestionPipeline);

  /* Stop a specific run of a deployed pipeline identified by its run ID.
   * Default is a no-op: clients that do not support per-run stopping return success without
   * taking any action. The DB status is already marked STOPPED before this is called. */
  default PipelineServiceClientResponse killIngestionRun(
      IngestionPipeline ingestionPipeline, String runId) {
    return new PipelineServiceClientResponse().withCode(200).withPlatform(getPlatform());
  }

  /* Whether deployPipeline captures the bot credentials into an artifact that runPipeline does not
   * rebuild, so a caller has to re-deploy for a rotated token to reach an already deployed pipeline.
   * Airflow does: DagDeployer writes openMetadataServerConnection into the generated DAG config at
   * deploy time and runPipeline posts only the dag_id (issue #24806). Runners that rebuild the whole
   * run spec from the IngestionPipeline on every run carry the current token by construction, so the
   * default is false and re-deploying them to refresh a token is pure churn. */
  default boolean pinsCredentialsAtDeployTime() {
    return false;
  }

  String getPlatform();
}
