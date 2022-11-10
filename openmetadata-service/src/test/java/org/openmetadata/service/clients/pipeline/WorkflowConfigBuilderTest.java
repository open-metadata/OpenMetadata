package org.openmetadata.service.clients.pipeline;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.resources.EntityResourceTest.MYSQL_REFERENCE;

import java.io.IOException;
import java.util.LinkedHashMap;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ComponentConfig;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.WorkflowConfig;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.clients.pipeline.WorkflowConfigBuilder;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class WorkflowConfigBuilderTest extends OpenMetadataApplicationTest {

  @BeforeAll
  void setup(TestInfo test) throws IOException {
    // We'll use some created database entities
    new DatabaseServiceResourceTest().setupDatabaseServices(test);
  }

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
    assertEquals(workflowConfig.getLoggerLevel(), LogLevels.INFO);
    assertEquals(
        workflowConfig.getOpenMetadataServerConfig(),
        ingestionPipeline.getOpenMetadataServerConnection());
  }

  @Test
  public void testBuildDefaultSource() throws IOException {
    IngestionPipeline ingestionPipeline = newMetadataIngestionPipeline();
    Source source = WorkflowConfigBuilder.buildDefaultSource(ingestionPipeline);
    assertEquals(source.getType(), "mysql"); // from MYSQL_REFERENCE
    assertEquals(source.getServiceName(), ingestionPipeline.getService().getName());
  }

  @Test
  public void testBuildMetadataWorkflowConfig() throws IOException {
    IngestionPipeline ingestionPipeline = newMetadataIngestionPipeline();
    OpenMetadataWorkflowConfig config =
        WorkflowConfigBuilder.buildMetadataWorkflowConfig(ingestionPipeline);
    String yamlConfig = WorkflowConfigBuilder.stringifiedOMWorkflowConfig(config);
    String expectedYamlConfig =
        "---\n"
            + "source:\n"
            + "  type: \"mysql\"\n"
            + "  serviceName: \"mysqlDB\"\n"
            + "  sourceConfig:\n"
            + "    config:\n"
            + "      type: \"DatabaseMetadata\"\n"
            + "      markDeletedTables: true\n"
            + "      markDeletedTablesFromFilterOnly: false\n"
            + "      includeTables: true\n"
            + "      includeViews: true\n"
            + "      includeTags: true\n"
            + "      useFqnForFiltering: false\n"
            + "      dbtConfigSource: {}\n"
            + "sink:\n"
            + "  type: \"metadata-rest\"\n"
            + "  config: {}\n"
            + "workflowConfig:\n"
            + "  loggerLevel: \"INFO\"\n"
            + "  openMetadataServerConfig:\n"
            + "    clusterName: \"clusterName\"\n"
            + "    type: \"OpenMetadata\"\n"
            + "    hostPort: \"http://openmetadata-server:8585/api\"\n"
            + "    authProvider: \"openmetadata\"\n"
            + "    verifySSL: \"no-ssl\"\n"
            + "    securityConfig:\n"
            + "      jwtToken: \"token\"\n"
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
            + "    supportsMetadataExtraction: true";
    assertEquals(yamlConfig, expectedYamlConfig);
  }

  IngestionPipeline newMetadataIngestionPipeline() {
    return new IngestionPipeline()
        .withName("testPipeline")
        .withPipelineType(PipelineType.METADATA)
        .withService(MYSQL_REFERENCE)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new DatabaseServiceMetadataPipeline()
                        .withDbtConfigSource(new LinkedHashMap<>())))
        .withOpenMetadataServerConnection(
            new OpenMetadataServerConnection()
                .withAuthProvider(OpenMetadataServerConnection.AuthProvider.OPENMETADATA)
                .withHostPort("http://openmetadata-server:8585/api")
                .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("token"))
                .withClusterName("clusterName"));
  }
}
