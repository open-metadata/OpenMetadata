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
  Map<String, String> TYPE_TO_TASK =
      Map.of(
          PipelineType.METADATA.toString(),
          "ingestion_task",
          PipelineType.PROFILER.toString(),
          "profiler_task",
          PipelineType.AUTO_CLASSIFICATION.toString(),
          "auto_classification_task",
          PipelineType.LINEAGE.toString(),
          "lineage_task",
          PipelineType.DBT.toString(),
          "dbt_task",
          PipelineType.USAGE.toString(),
          "usage_task",
          PipelineType.TEST_SUITE.toString(),
          "test_suite_task",
          PipelineType.DATA_INSIGHT.toString(),
          "data_insight_task",
          PipelineType.APPLICATION.toString(),
          "application_task");

  URL validateServiceURL(String serviceURL);

  String getBasicAuthenticationHeader(String username, String password);

  Boolean validServerClientVersions(String clientVersion);

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

  /* Get the all last run logs of a deployed pipeline */
  Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline, String after);

  /* Get the all last run logs of a deployed pipeline */
  PipelineServiceClientResponse killIngestion(IngestionPipeline ingestionPipeline);

  String getPlatform();
}
