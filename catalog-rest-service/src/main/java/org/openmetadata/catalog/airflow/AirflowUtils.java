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

package org.openmetadata.catalog.airflow;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.airflow.models.IngestionAirflowPipeline;
import org.openmetadata.catalog.airflow.models.IngestionTaskConfig;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionComponent;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionConfig;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionTask;
import org.openmetadata.catalog.api.operations.pipelines.PipelineConfig;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.ServiceConnection;
import org.openmetadata.catalog.operations.pipeline.AirflowConfig;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public final class AirflowUtils {

  // TODO: Use this to enrich the AirflowPipeline info with default sink and metadata-rest config

  private AirflowUtils() {}

  public static OpenMetadataIngestionComponent makeOpenMetadataDatasourceComponent(
      AirflowPipeline airflowPipeline, Boolean decrypt) throws IOException {

    DatabaseService databaseService = Entity.getEntity(airflowPipeline.getService(), Fields.EMPTY_FIELDS, Include.ALL);
    PipelineConfig pipelineConfig = airflowPipeline.getPipelineConfig();
    ServiceConnection connectionConfig =
        JsonUtils.convertValue(pipelineConfig.getConnectionConfig(), ServiceConnection.class);
    String ingestionType = databaseService.getServiceType().value().toLowerCase(Locale.ROOT);
    AirflowConfig airflowConfig = airflowPipeline.getAirflowConfig();

    return OpenMetadataIngestionComponent.builder().type(ingestionType).config(airflowConfig).build();
  }

  public static OpenMetadataIngestionComponent makeElasticSearchSinkComponent() {
    Map<String, Object> sinkConfig = new HashMap<>();
    return OpenMetadataIngestionComponent.builder().type("elasticsearch").config(sinkConfig).build();
  }

  public static OpenMetadataIngestionComponent makeOpenMetadataSinkComponent() {
    Map<String, Object> sinkConfig = new HashMap<>();
    return OpenMetadataIngestionComponent.builder().type("metadata-rest").config(sinkConfig).build();
  }

  public static OpenMetadataIngestionComponent makeOpenMetadataConfigComponent(
      AirflowConfiguration airflowConfiguration) {
    Map<String, Object> metadataConfig = new HashMap<>();
    metadataConfig.put("api_endpoint", airflowConfiguration.getMetadataApiEndpoint());
    metadataConfig.put("auth_provider_type", airflowConfiguration.getAuthProvider());
    metadataConfig.put("secret_key", airflowConfiguration.getSecretKey());
    return OpenMetadataIngestionComponent.builder().type("metadata-server").config(metadataConfig).build();
  }

  public static OpenMetadataIngestionConfig buildDatabaseIngestion(
      AirflowPipeline airflowPipeline, AirflowConfiguration airflowConfiguration, Boolean decrypt) throws IOException {
    return OpenMetadataIngestionConfig.builder()
        .source(makeOpenMetadataDatasourceComponent(airflowPipeline, decrypt))
        .sink(makeOpenMetadataSinkComponent())
        .metadataServer(makeOpenMetadataConfigComponent(airflowConfiguration))
        .build();
  }

  public static IngestionAirflowPipeline toIngestionPipeline(
      AirflowPipeline airflowPipeline, AirflowConfiguration airflowConfiguration, Boolean decrypt) throws IOException {
    // TODO: this might not be needed anymore, as we should be able to directly send an AirflowPipeline instance
    Map<String, Object> taskParams = new HashMap<>();
    taskParams.put("workflow_config", buildDatabaseIngestion(airflowPipeline, airflowConfiguration, decrypt));
    IngestionTaskConfig taskConfig = IngestionTaskConfig.builder().opKwargs(taskParams).build();
    OpenMetadataIngestionTask task =
        OpenMetadataIngestionTask.builder().name(airflowPipeline.getName()).config(taskConfig).build();
    List<OpenMetadataIngestionTask> taskList = new ArrayList<>();
    taskList.add(task);

    return IngestionAirflowPipeline.builder()
        .name(airflowPipeline.getName())
        .description(airflowPipeline.getDescription())
        .forceDeploy(airflowPipeline.getForceDeploy())
        .pauseWorkflow(airflowPipeline.getPausePipeline())
        .owner(airflowPipeline.getOwner().getName())
        .scheduleInterval(airflowPipeline.getScheduleInterval())
        .concurrency(airflowPipeline.getConcurrency())
        .startDate(airflowPipeline.getStartDate())
        .tasks(taskList)
        .build();
  }
}
