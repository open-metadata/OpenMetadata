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

import static org.openmetadata.catalog.Entity.DATABASE_SERVICE;
import static org.openmetadata.catalog.Entity.helper;
import static org.openmetadata.catalog.fernet.Fernet.decryptIfTokenized;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.openmetadata.catalog.airflow.models.IngestionAirflowPipeline;
import org.openmetadata.catalog.airflow.models.IngestionTaskConfig;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionComponent;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionConfig;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionTask;
import org.openmetadata.catalog.api.operations.pipelines.PipelineConfig;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.operations.pipelines.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.operations.pipelines.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.catalog.type.DatabaseConnection;
import org.openmetadata.catalog.util.JsonUtils;

public final class AirflowUtils {

  public static final String INGESTION_HOST_PORT = "host_port";
  public static final String INGESTION_USERNAME = "username";
  public static final String INGESTION_PASSWORD = "password";
  public static final String INGESTION_DATABASE = "database";
  public static final String INGESTION_SERVICE_NAME = "service_name";
  public static final String INGESTION_SAMPLE_QUERY = "query";
  public static final String INGESTION_INCLUDE_VIEWS = "include_views";
  public static final String INGESTION_GENERATE_SAMPLE_DATA = "generate_sample_data";
  public static final String INGESTION_ENABLE_DATA_PROFILER = "data_profiler_enabled";
  public static final String INGESTION_TABLE_FILTER_PATTERN = "table_filter_pattern";
  public static final String INGESTION_SCHEMA_FILTER_PATTERN = "schema_filter_pattern";
  public static final String INGESTION_DBT_MANIFEST_FILE_PATH = "dbt_manifest_file";
  public static final String INGESTION_DBT_CATALOG_FILE_PATH = "dbt_catalog_file";
  public static final String INGESTION_MARK_DELETED_TABLES = "mark_deleted_tables_as_deleted";
  public static final String INGESTION_USAGE_DURATION = "duration";
  public static final String INGESTION_OPTIONS = "options";
  public static final String INGESTION_CONNECTION_ARGS = "connect_args";
  public static final String INGESTION_USAGE_STAGE_FILE_PATH = "filename";
  public static final String INGESTION_STATUS = "status";

  private AirflowUtils() {}

  public static OpenMetadataIngestionComponent makeOpenMetadataDatasourceComponent(
      AirflowPipeline airflowPipeline, Boolean decrypt) throws IOException, ParseException {
    DatabaseService databaseService = helper(airflowPipeline).findEntity("service", DATABASE_SERVICE);
    DatabaseConnection databaseConnection = databaseService.getDatabaseConnection();
    PipelineConfig pipelineConfig = airflowPipeline.getPipelineConfig();
    Map<String, Object> dbConfig = new HashMap<>();
    dbConfig.put(INGESTION_HOST_PORT, databaseConnection.getHostPort());
    dbConfig.put(INGESTION_USERNAME, databaseConnection.getUsername());
    String password = decrypt ? decryptIfTokenized(databaseConnection.getPassword()) : databaseConnection.getPassword();
    dbConfig.put(INGESTION_PASSWORD, password);
    dbConfig.put(INGESTION_DATABASE, databaseConnection.getDatabase());
    dbConfig.put(INGESTION_SERVICE_NAME, databaseService.getName());
    if (databaseConnection.getConnectionOptions() != null
        && !databaseConnection.getConnectionOptions().getAdditionalProperties().isEmpty()) {
      dbConfig.put(INGESTION_OPTIONS, databaseConnection.getConnectionOptions().getAdditionalProperties());
    }
    if (databaseConnection.getConnectionArguments() != null
        && !databaseConnection.getConnectionArguments().getAdditionalProperties().isEmpty()) {
      dbConfig.put(INGESTION_CONNECTION_ARGS, databaseConnection.getConnectionArguments().getAdditionalProperties());
    }
    String ingestionType = databaseService.getServiceType().value().toLowerCase(Locale.ROOT);
    if (pipelineConfig.getSchema().equals(PipelineConfig.Schema.DATABASE_SERVICE_METADATA_PIPELINE)) {
      DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
          JsonUtils.convertValue(pipelineConfig.getConfig(), DatabaseServiceMetadataPipeline.class);
      dbConfig.put(INGESTION_SAMPLE_QUERY, databaseServiceMetadataPipeline.getSampleDataQuery());
      dbConfig.put(INGESTION_ENABLE_DATA_PROFILER, databaseServiceMetadataPipeline.getEnableDataProfiler());
      dbConfig.put(INGESTION_GENERATE_SAMPLE_DATA, databaseServiceMetadataPipeline.getGenerateSampleData());
      dbConfig.put(INGESTION_INCLUDE_VIEWS, databaseServiceMetadataPipeline.getIncludeViews());
      if (databaseServiceMetadataPipeline.getSchemaFilterPattern() != null) {
        dbConfig.put(INGESTION_SCHEMA_FILTER_PATTERN, databaseServiceMetadataPipeline.getSchemaFilterPattern());
      }
      if (databaseServiceMetadataPipeline.getTableFilterPattern() != null) {
        dbConfig.put(INGESTION_TABLE_FILTER_PATTERN, databaseServiceMetadataPipeline.getTableFilterPattern());
      }
      dbConfig.put(INGESTION_MARK_DELETED_TABLES, databaseServiceMetadataPipeline.getMarkDeletedTables());
      dbConfig.put(INGESTION_DBT_CATALOG_FILE_PATH, databaseServiceMetadataPipeline.getDbtCatalogFilePath());
      dbConfig.put(INGESTION_DBT_MANIFEST_FILE_PATH, databaseServiceMetadataPipeline.getDbtManifestFilePath());
    } else if (pipelineConfig.getSchema().equals(PipelineConfig.Schema.DATABASE_SERVICE_QUERY_USAGE_PIPELINE)) {
      DatabaseServiceQueryUsagePipeline queryUsage =
          JsonUtils.convertValue(pipelineConfig.getConfig(), DatabaseServiceQueryUsagePipeline.class);
      dbConfig.put(INGESTION_USAGE_DURATION, queryUsage.getQueryLogDuration());
      ingestionType += "-usage";
    }
    return OpenMetadataIngestionComponent.builder().type(ingestionType).config(dbConfig).build();
  }

  public static OpenMetadataIngestionComponent makeElasticSearchSinkComponent() {
    Map<String, Object> sinkConfig = new HashMap<>();
    return OpenMetadataIngestionComponent.builder().type("elasticsearch").config(sinkConfig).build();
  }

  public static OpenMetadataIngestionComponent makeOpenMetadataSinkComponent(AirflowPipeline airflowPipeline) {
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
      AirflowPipeline airflowPipeline, AirflowConfiguration airflowConfiguration, Boolean decrypt)
      throws IOException, ParseException {
    return OpenMetadataIngestionConfig.builder()
        .source(makeOpenMetadataDatasourceComponent(airflowPipeline, decrypt))
        .sink(makeOpenMetadataSinkComponent(airflowPipeline))
        .metadataServer(makeOpenMetadataConfigComponent(airflowConfiguration))
        .build();
  }

  public static IngestionAirflowPipeline toIngestionPipeline(
      AirflowPipeline airflowPipeline, AirflowConfiguration airflowConfiguration, Boolean decrypt)
      throws IOException, ParseException {
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
