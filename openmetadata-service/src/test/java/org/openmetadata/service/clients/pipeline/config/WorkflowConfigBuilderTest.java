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

package org.openmetadata.service.clients.pipeline.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryLineagePipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.OpenMetadataAppConfig;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.metadataIngestion.WorkflowConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtPrefixConfig__2;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.service.clients.pipeline.config.types.WorkflowBuildException;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class WorkflowConfigBuilderTest extends WorkflowConfigTest {

  private static final String WORKFLOW_CONFIG =
      "workflowConfig:\n"
          + "  loggerLevel: \"DEBUG\"\n"
          + "  raiseOnError: true\n"
          + "  successThreshold: 90\n"
          + "  openMetadataServerConfig:\n"
          + "    clusterName: \"clusterName\"\n"
          + "    type: \"OpenMetadata\"\n"
          + "    hostPort: \"http://openmetadata-server:8585/api\"\n"
          + "    authProvider: \"openmetadata\"\n"
          + "    verifySSL: \"no-ssl\"\n"
          + "    securityConfig:\n"
          + "      jwtToken: \"token\"\n"
          + "    secretsManagerProvider: \"db\"\n"
          + "    secretsManagerLoader: \"noop\"\n"
          + "    apiVersion: \"v1\"\n"
          + "    includeTopics: true\n"
          + "    includeTables: true\n"
          + "    includeDashboards: true\n"
          + "    includePipelines: true\n"
          + "    includeMlModels: true\n"
          + "    includeUsers: true\n"
          + "    includeTeams: true\n"
          + "    includeGlossaryTerms: true\n"
          + "    includeTags: true\n"
          + "    includePolicy: true\n"
          + "    includeMessagingServices: true\n"
          + "    enableVersionValidation: true\n"
          + "    includeDatabaseServices: true\n"
          + "    includePipelineServices: true\n"
          + "    limitRecords: 1000\n"
          + "    forceEntityOverwriting: false\n"
          + "    storeServiceConnection: true\n"
          + "    supportsDataInsightExtraction: true\n"
          + "    supportsElasticSearchReindexingExtraction: true\n";

  @Test
  public void testDefaultSink() {
    Sink sink = WorkflowConfigBuilder.buildDefaultSink();
    assertEquals(sink.getType(), "metadata-rest");
    assertEquals(sink.getConfig(), new ComponentConfig());
  }

  @Test
  public void testBuildDefaultWorkflowConfig() {
    IngestionPipeline ingestionPipeline = newMetadataIngestionPipeline();

    WorkflowConfig workflowConfig =
        WorkflowConfigBuilder.buildDefaultWorkflowConfig(ingestionPipeline);
    assertEquals(workflowConfig.getLoggerLevel(), LogLevels.DEBUG);
    assertEquals(
        workflowConfig.getOpenMetadataServerConfig(),
        ingestionPipeline.getOpenMetadataServerConnection());
  }

  @Test
  public void testBuildDefaultSource() {
    IngestionPipeline ingestionPipeline = newMetadataIngestionPipeline();

    Source source = WorkflowConfigBuilder.buildDefaultSource(ingestionPipeline, MOCK_SERVICE);
    assertEquals(source.getType(), "mysql"); // from MYSQL_REFERENCE
    assertEquals(source.getServiceName(), ingestionPipeline.getService().getName());
  }

  @Test
  public void testBuildMetadataWorkflowConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline = newMetadataIngestionPipeline();

    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildOMWorkflowConfig(ingestionPipeline, MOCK_SERVICE);
    String yamlConfig = YAMLUtils.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"mysql\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"DatabaseMetadata\"\n"
            + "      markDeletedTables: true\n"
            + "      markDeletedStoredProcedures: true\n"
            + "      markDeletedSchemas: false\n"
            + "      markDeletedDatabases: false\n"
            + "      includeTables: true\n"
            + "      includeViews: true\n"
            + "      includeTags: true\n"
            + "      includeOwners: false\n"
            + "      includeStoredProcedures: true\n"
            + "      includeDDL: false\n"
            + "      overrideMetadata: false\n"
            + "      overrideLineage: false\n"
            + "      queryLogDuration: 1\n"
            + "      queryParsingTimeoutLimit: 300\n"
            + "      useFqnForFiltering: false\n"
            + "      threads: 1\n"
            + "sink:\n"
            + "  type: \"metadata-rest\"\n"
            + "  config: {}\n"
            + WORKFLOW_CONFIG
            + "ingestionPipelineFQN: \"mysqlDB.testPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }

  @Test
  public void testBuildLineageWorkflowConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline =
        newMetadataIngestionPipeline()
            .withPipelineType(PipelineType.LINEAGE)
            .withSourceConfig(
                new SourceConfig().withConfig(new DatabaseServiceQueryLineagePipeline()));

    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildOMWorkflowConfig(ingestionPipeline, MOCK_SERVICE);
    String yamlConfig = YAMLUtils.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"mysql-lineage\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"DatabaseLineage\"\n"
            + "      queryLogDuration: 1\n"
            + "      resultLimit: 1000\n"
            + "      parsingTimeoutLimit: 300\n"
            + "      overrideViewLineage: false\n"
            + "      processViewLineage: true\n"
            + "      processQueryLineage: true\n"
            + "      processStoredProcedureLineage: true\n"
            + "      threads: 1\n"
            + "      processCrossDatabaseLineage: false\n"
            + "      crossDatabaseServiceNames: []\n"
            + "      enableTempTableLineage: false\n"
            + "      incrementalLineageProcessing: true\n"
            + "sink:\n"
            + "  type: \"metadata-rest\"\n"
            + "  config: {}\n"
            + WORKFLOW_CONFIG
            + "ingestionPipelineFQN: \"mysqlDB.testPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }

  @Test
  public void testBuildUsageWorkflowConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline =
        newMetadataIngestionPipeline()
            .withPipelineType(PipelineType.USAGE)
            .withSourceConfig(
                new SourceConfig().withConfig(new DatabaseServiceQueryUsagePipeline()));

    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildOMWorkflowConfig(ingestionPipeline, MOCK_SERVICE);
    String yamlConfig = YAMLUtils.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"mysql-usage\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"DatabaseUsage\"\n"
            + "      queryLogDuration: 1\n"
            + "      stageFileLocation: \"/tmp/query_log\"\n"
            + "      resultLimit: 1000\n"
            + "      processQueryCostAnalysis: true\n"
            + "processor:\n"
            + "  type: \"query-parser\"\n"
            + "  config: {}\n"
            + "stage:\n"
            + "  type: \"table-usage\"\n"
            + "  config:\n"
            + "    filename: \"/tmp/query_log\"\n"
            + "bulkSink:\n"
            + "  type: \"metadata-usage\"\n"
            + "  config:\n"
            + "    filename: \"/tmp/query_log\"\n"
            + WORKFLOW_CONFIG
            + "ingestionPipelineFQN: \"mysqlDB.testPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }

  @Test
  public void testBuildDbtWorkflowConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline =
        newMetadataIngestionPipeline()
            .withPipelineType(PipelineType.DBT)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new DbtPipeline()
                            .withDbtConfigSource(
                                new DbtS3Config()
                                    .withDbtPrefixConfig(
                                        new DbtPrefixConfig__2()
                                            .withDbtObjectPrefix("prefix")
                                            .withDbtBucketName("bucket"))
                                    .withDbtSecurityConfig(
                                        new AWSCredentials().withAwsRegion("us-east-2")))));

    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildOMWorkflowConfig(ingestionPipeline, MOCK_SERVICE);
    String yamlConfig = YAMLUtils.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"dbt\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"DBT\"\n"
            + "      dbtConfigSource:\n"
            + "        dbtConfigType: \"s3\"\n"
            + "        dbtSecurityConfig:\n"
            + "          awsRegion: \"us-east-2\"\n"
            + "          assumeRoleSessionName: \"OpenMetadataSession\"\n"
            + "        dbtPrefixConfig:\n"
            + "          dbtBucketName: \"bucket\"\n"
            + "          dbtObjectPrefix: \"prefix\"\n"
            + "      searchAcrossDatabases: false\n"
            + "      dbtUpdateDescriptions: false\n"
            + "      dbtUpdateOwners: false\n"
            + "      includeTags: true\n"
            + "      overrideLineage: false\n"
            + "      dbtClassificationName: \"dbtTags\"\n"
            + "      parsingTimeoutLimit: 300\n"
            + "sink:\n"
            + "  type: \"metadata-rest\"\n"
            + "  config: {}\n"
            + WORKFLOW_CONFIG
            + "ingestionPipelineFQN: \"mysqlDB.testPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }

  @Test
  public void testBuildProfilerWorkflowConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline =
        newMetadataIngestionPipeline()
            .withPipelineType(PipelineType.PROFILER)
            .withSourceConfig(new SourceConfig().withConfig(new DatabaseServiceProfilerPipeline()));

    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildOMWorkflowConfig(ingestionPipeline, MOCK_SERVICE);
    String yamlConfig = YAMLUtils.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"mysql\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"Profiler\"\n"
            + "      includeViews: false\n"
            + "      useFqnForFiltering: false\n"
            + "      computeMetrics: true\n"
            + "      computeTableMetrics: true\n"
            + "      computeColumnMetrics: true\n"
            + "      useStatistics: false\n"
            + "      profileSampleType: \"PERCENTAGE\"\n"
            + "      randomizedSample: true\n"
            + "      threadCount: 5.0\n"
            + "      timeoutSeconds: 43200\n"
            + "processor:\n"
            + "  type: \"orm-profiler\"\n"
            + "  config: {}\n"
            + "sink:\n"
            + "  type: \"metadata-rest\"\n"
            + "  config: {}\n"
            + WORKFLOW_CONFIG
            + "ingestionPipelineFQN: \"mysqlDB.testPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }

  @Test
  public void testBuildTestSuiteWorkflowConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline =
        newMetadataIngestionPipeline()
            .withPipelineType(PipelineType.TEST_SUITE)
            .withSourceConfig(new SourceConfig().withConfig(new TestSuitePipeline()));

    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildOMWorkflowConfig(ingestionPipeline, MOCK_SERVICE);
    String yamlConfig = YAMLUtils.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"mysql\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"TestSuite\"\n"
            + "      profileSampleType: \"PERCENTAGE\"\n"
            + "processor:\n"
            + "  type: \"orm-test-runner\"\n"
            + "  config: {}\n"
            + "sink:\n"
            + "  type: \"metadata-rest\"\n"
            + "  config: {}\n"
            + WORKFLOW_CONFIG
            + "ingestionPipelineFQN: \"mysqlDB.testPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }

  @Test
  public void testBuildAppConfig() throws WorkflowBuildException {
    IngestionPipeline ingestionPipeline = newApplicationPipeline();

    OpenMetadataAppConfig config =
        WorkflowConfigBuilder.buildOMApplicationConfig(ingestionPipeline, Map.of());
    String yamlConfig = YAMLUtils.stringifiedOMAppConfig(config);
    String expectedYamlConfig =
        "---\n"
            + WORKFLOW_CONFIG
            + "sourcePythonClass: \"metadata.ingestion.path\"\n"
            + "appConfig:\n"
            + "  type: \"CollateAI\"\n"
            + "  patchIfEmpty: false\n"
            + "ingestionPipelineFQN: \"OpenMetadata.appPipeline\"\n"
            + "enableStreamableLogs: false\n";
    assertEquals(expectedYamlConfig, yamlConfig);
  }
}
