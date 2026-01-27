package org.openmetadata.service.util;

import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.lang.reflect.Method;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.applications.configuration.ApplicationConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerClientLoader;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.secrets.SecretsManagerFactory;

@Slf4j
public class OpenMetadataConnectionBuilderTest extends OpenMetadataApplicationTest {

  private static SecretsManagerConfiguration config;
  static final String CLUSTER_NAME = "test";

  @BeforeAll
  static void setUp() {
    config = new SecretsManagerConfiguration();
    config.setSecretsManager(SecretsManagerProvider.DB);
    SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME);
  }

  @Test
  void testOpenMetadataConnectionBuilder() {

    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        new OpenMetadataApplicationConfig();
    openMetadataApplicationConfig.setClusterName(CLUSTER_NAME);
    openMetadataApplicationConfig.setPipelineServiceClientConfiguration(
        new PipelineServiceClientConfiguration()
            .withMetadataApiEndpoint("http://localhost:8585/api")
            .withVerifySSL(VerifySSL.NO_SSL)
            .withSecretsManagerLoader(SecretsManagerClientLoader.ENV));

    String botName =
        "autoClassification-bot"; // Whichever bot other than the ingestion-bot, which is the
    // default
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, botName).build();

    // The OM Connection passes the right JWT based on the incoming bot
    DecodedJWT jwt = JWT.decode(openMetadataServerConnection.getSecurityConfig().getJwtToken());
    Assertions.assertEquals("autoclassification-bot", jwt.getClaim("sub").asString());
  }

  @Test
  void testGetBotFromPipeline_Metadata() throws Exception {
    IngestionPipeline pipeline = new IngestionPipeline().withPipelineType(PipelineType.METADATA);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals(Entity.INGESTION_BOT_NAME, botName);
  }

  @Test
  void testGetBotFromPipeline_DBT() throws Exception {
    IngestionPipeline pipeline = new IngestionPipeline().withPipelineType(PipelineType.DBT);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals(Entity.INGESTION_BOT_NAME, botName);
  }

  @Test
  void testGetBotFromPipeline_AutoClassification() throws Exception {
    IngestionPipeline pipeline =
        new IngestionPipeline().withPipelineType(PipelineType.AUTO_CLASSIFICATION);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("autoClassification-bot", botName);
  }

  @Test
  void testGetBotFromPipeline_Profiler() throws Exception {
    IngestionPipeline pipeline = new IngestionPipeline().withPipelineType(PipelineType.PROFILER);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("profiler-bot", botName);
  }

  @Test
  void testGetBotFromPipeline_Lineage() throws Exception {
    IngestionPipeline pipeline = new IngestionPipeline().withPipelineType(PipelineType.LINEAGE);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("lineage-bot", botName);
  }

  @Test
  void testGetBotFromPipeline_Usage() throws Exception {
    IngestionPipeline pipeline = new IngestionPipeline().withPipelineType(PipelineType.USAGE);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("usage-bot", botName);
  }

  @Test
  void testGetBotFromPipeline_TestSuite() throws Exception {
    IngestionPipeline pipeline = new IngestionPipeline().withPipelineType(PipelineType.TEST_SUITE);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("testsuite-bot", botName);
  }

  @Test
  void testGetBotFromPipeline_DataInsight() throws Exception {
    IngestionPipeline pipeline =
        new IngestionPipeline().withPipelineType(PipelineType.DATA_INSIGHT);
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("datainsight-bot", botName);
  }

  @Test
  void testGetBotFromPipeline_Application() throws Exception {
    ApplicationConfig appConfig = new ApplicationConfig();
    appConfig.setAdditionalProperty("type", "SearchIndexing");
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new ApplicationPipeline()
                            .withType(ApplicationPipeline.ApplicationConfigType.APPLICATION)
                            .withAppConfig(appConfig)));
    String botName = invokeBotFromPipeline(pipeline);
    Assertions.assertEquals("SearchIndexingApplicationBot", botName);
  }

  private String invokeBotFromPipeline(IngestionPipeline pipeline) throws Exception {
    OpenMetadataConnectionBuilder builder =
        new OpenMetadataConnectionBuilder(createTestConfig(), Entity.INGESTION_BOT_NAME);
    Method method =
        OpenMetadataConnectionBuilder.class.getDeclaredMethod(
            "getBotFromPipeline", IngestionPipeline.class);
    method.setAccessible(true);
    return (String) method.invoke(builder, pipeline);
  }

  private OpenMetadataApplicationConfig createTestConfig() {
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setClusterName(CLUSTER_NAME);
    config.setPipelineServiceClientConfiguration(
        new PipelineServiceClientConfiguration()
            .withMetadataApiEndpoint("http://localhost:8585/api")
            .withVerifySSL(VerifySSL.NO_SSL)
            .withSecretsManagerLoader(SecretsManagerClientLoader.ENV));
    return config;
  }
}
