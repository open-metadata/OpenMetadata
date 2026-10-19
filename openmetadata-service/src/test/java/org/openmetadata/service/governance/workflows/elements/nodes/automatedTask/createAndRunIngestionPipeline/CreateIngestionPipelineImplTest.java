package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.MessagingServiceAutoClassificationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceAutoClassificationPipeline;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline.CreateIngestionPipelineImpl.CreateIngestionPipelineResult;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

/**
 * The connection AutoPilot deploys is what every scheduled run of the agent authenticates with, so
 * these tests assert on the token in the deployed connection. Each bot gets its own token: a
 * silent fallback to ingestion-bot would otherwise pass for the agent's own bot.
 */
class CreateIngestionPipelineImplTest {

  private static final List<String> BOTS =
      List.of(
          Entity.INGESTION_BOT_NAME,
          "usage-bot",
          "lineage-bot",
          "profiler-bot",
          "autoClassification-bot");

  private final IngestionPipelineRepository pipelineRepository =
      mock(IngestionPipelineRepository.class);
  private final OpenMetadataApplicationConfig appConfig = createApplicationConfig();
  private final DatabaseService service = createDatabaseService();

  private MockedStatic<Entity> mockedEntity;
  private MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory;
  private CreateIngestionPipelineImpl createIngestionPipeline;

  @BeforeEach
  void setUp() {
    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    for (String bot : BOTS) {
      when(botRepository.getByName(isNull(), eq(bot), any())).thenReturn(botWithUser(bot));
      when(userRepository.getByName(isNull(), eq(bot), any())).thenReturn(jwtBotUser(bot));
    }

    SecretsManager secretsManager = mock(SecretsManager.class);
    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.IN_MEMORY);
    when(secretsManager.encryptOpenMetadataConnection(any(), eq(false)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(pipelineRepository);
    mockedEntity
        .when(() -> Entity.getEntityTypeFromObject(service))
        .thenReturn(Entity.DATABASE_SERVICE);
    mockedSecretsManagerFactory = mockStatic(SecretsManagerFactory.class);
    mockedSecretsManagerFactory
        .when(SecretsManagerFactory::getSecretsManager)
        .thenReturn(secretsManager);

    when(pipelineRepository.getOpenMetadataApplicationConfig()).thenReturn(appConfig);
    when(pipelineRepository.create(isNull(), any(IngestionPipeline.class)))
        .thenAnswer(invocation -> invocation.getArgument(1));
    when(pipelineRepository.deployIngestionPipeline(any(), any()))
        .thenReturn(new PipelineServiceClientResponse().withCode(200));

    createIngestionPipeline =
        new CreateIngestionPipelineImpl(new IngestionPipelineMapper(appConfig));
  }

  @AfterEach
  void tearDown() {
    mockedSecretsManagerFactory.close();
    mockedEntity.close();
  }

  @ParameterizedTest
  @CsvSource({
    "USAGE, usage-bot",
    "LINEAGE, lineage-bot",
    "PROFILER, profiler-bot",
    "AUTO_CLASSIFICATION, autoClassification-bot",
    "METADATA, ingestion-bot"
  })
  void newAgentIsDeployedAsTheBotOfItsType(PipelineType pipelineType, String expectedBot) {
    when(pipelineRepository.listAllByParentFqn(anyString())).thenReturn(List.of());

    assertTrue(createIngestionPipeline.execute(service, pipelineType, true).isSuccessful());

    assertEquals(tokenOf(expectedBot), deployedToken());
  }

  @Test
  void rerunningAutoPilotRedeploysAnExistingAgentAsItsOwnBot() {
    IngestionPipeline existing =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName("existing-agent")
            .withDisplayName("AutoClassification Agent")
            .withPipelineType(PipelineType.AUTO_CLASSIFICATION)
            .withSourceConfig(new SourceConfig().withConfig(Map.of("type", "AutoClassification")))
            .withOpenMetadataServerConnection(connectionFor(Entity.INGESTION_BOT_NAME));
    when(pipelineRepository.listAllByParentFqn(anyString()))
        .thenReturn(List.of(JsonUtils.pojoToJson(existing)));

    assertTrue(
        createIngestionPipeline
            .execute(service, PipelineType.AUTO_CLASSIFICATION, true)
            .isSuccessful());

    assertEquals(tokenOf("autoClassification-bot"), deployedToken());
  }

  @Test
  void typeTheServiceDoesNotSupportGetsNoAgent() {
    DatabaseService metadataOnly =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("metadata_only")
            .withConnection(
                new DatabaseConnection().withConfig(Map.of("supportsMetadataExtraction", true)));
    stubEntityType(metadataOnly, Entity.DATABASE_SERVICE);

    CreateIngestionPipelineResult result =
        createIngestionPipeline.execute(metadataOnly, PipelineType.USAGE, true);

    assertTrue(result.isSuccessful());
    assertNull(result.getIngestionPipelineId());
    verify(pipelineRepository, never()).create(any(), any());
  }

  @Test
  void failedDeployIsReportedAndTheAgentIsNotMarkedDeployed() {
    when(pipelineRepository.listAllByParentFqn(anyString())).thenReturn(List.of());
    when(pipelineRepository.deployIngestionPipeline(any(), any()))
        .thenReturn(new PipelineServiceClientResponse().withCode(500));

    assertFalse(
        createIngestionPipeline.execute(service, PipelineType.PROFILER, true).isSuccessful());

    assertNotEquals(Boolean.TRUE, deployedPipeline(service).getDeployed());
  }

  @Test
  void messagingServiceGetsAnAutoClassificationAgentButNoProfilerAgent() {
    MessagingService messaging =
        new MessagingService()
            .withId(UUID.randomUUID())
            .withName("kafka")
            .withConnection(
                new MessagingConnection()
                    .withConfig(
                        Map.of(
                            "supportsProfiler",
                            true,
                            "topicFilterPattern",
                            Map.of("includes", List.of("orders.*")))));
    stubEntityType(messaging, Entity.MESSAGING_SERVICE);
    when(pipelineRepository.listAllByParentFqn(anyString())).thenReturn(List.of());

    assertNull(
        createIngestionPipeline
            .execute(messaging, PipelineType.PROFILER, true)
            .getIngestionPipelineId());
    createIngestionPipeline.execute(messaging, PipelineType.AUTO_CLASSIFICATION, true);

    IngestionPipeline agent = deployedPipeline(messaging);
    assertEquals(tokenOf("autoClassification-bot"), connectionToken(agent));
    MessagingServiceAutoClassificationPipeline sourceConfig =
        assertInstanceOf(
            MessagingServiceAutoClassificationPipeline.class, agent.getSourceConfig().getConfig());
    assertEquals(List.of("orders.*"), sourceConfig.getTopicFilterPattern().getIncludes());
  }

  @Test
  void storageServiceGetsAnAutoClassificationAgentAndRejectsOtherTypes() {
    StorageService storage =
        new StorageService()
            .withId(UUID.randomUUID())
            .withName("s3")
            .withConnection(
                new StorageConnection()
                    .withConfig(
                        Map.of("supportsProfiler", true, "supportsLineageExtraction", true)));
    stubEntityType(storage, Entity.STORAGE_SERVICE);
    when(pipelineRepository.listAllByParentFqn(anyString())).thenReturn(List.of());

    createIngestionPipeline.execute(storage, PipelineType.AUTO_CLASSIFICATION, true);

    assertInstanceOf(
        StorageServiceAutoClassificationPipeline.class,
        deployedPipeline(storage).getSourceConfig().getConfig());
    assertThrows(
        IllegalArgumentException.class,
        () -> createIngestionPipeline.execute(storage, PipelineType.LINEAGE, false));
  }

  @Test
  void otherServicesGetOnlyAMetadataAgent() {
    DashboardService dashboard =
        new DashboardService()
            .withId(UUID.randomUUID())
            .withName("looker")
            .withConnection(
                new DashboardConnection()
                    .withConfig(
                        Map.of(
                            "supportsMetadataExtraction", true, "supportsUsageExtraction", true)));
    stubEntityType(dashboard, Entity.DASHBOARD_SERVICE);
    when(pipelineRepository.listAllByParentFqn(anyString())).thenReturn(List.of());

    createIngestionPipeline.execute(dashboard, PipelineType.METADATA, true);
    IngestionPipeline usage =
        pipelineCreatedFor(
            () -> createIngestionPipeline.execute(dashboard, PipelineType.USAGE, false));

    assertInstanceOf(
        DashboardServiceMetadataPipeline.class,
        deployedPipeline(dashboard).getSourceConfig().getConfig());
    assertNull(usage.getSourceConfig().getConfig());
  }

  private IngestionPipeline pipelineCreatedFor(Runnable execute) {
    ArgumentCaptor<IngestionPipeline> created = ArgumentCaptor.forClass(IngestionPipeline.class);
    execute.run();
    verify(pipelineRepository, atLeastOnce()).create(isNull(), created.capture());
    return created.getValue();
  }

  private void stubEntityType(ServiceEntityInterface otherService, String entityType) {
    mockedEntity.when(() -> Entity.getEntityTypeFromObject(otherService)).thenReturn(entityType);
  }

  private IngestionPipeline deployedPipeline(ServiceEntityInterface deployedService) {
    ArgumentCaptor<IngestionPipeline> deployed = ArgumentCaptor.forClass(IngestionPipeline.class);
    verify(pipelineRepository).deployIngestionPipeline(deployed.capture(), eq(deployedService));
    return deployed.getValue();
  }

  private static String connectionToken(IngestionPipeline pipeline) {
    return pipeline.getOpenMetadataServerConnection().getSecurityConfig().getJwtToken();
  }

  private String deployedToken() {
    return connectionToken(deployedPipeline(service));
  }

  private static String tokenOf(String bot) {
    return "%s-token".formatted(bot);
  }

  private static OpenMetadataConnection connectionFor(String bot) {
    return new OpenMetadataConnection()
        .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken(tokenOf(bot)));
  }

  private static Bot botWithUser(String bot) {
    return new Bot().withName(bot).withBotUser(new EntityReference().withFullyQualifiedName(bot));
  }

  private static User jwtBotUser(String bot) {
    return new User()
        .withName(bot)
        .withFullyQualifiedName(bot)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken(tokenOf(bot))));
  }

  private static DatabaseService createDatabaseService() {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName("autopilot_service")
        .withFullyQualifiedName("autopilot_service")
        .withConnection(
            new DatabaseConnection()
                .withConfig(
                    Map.of(
                        "supportsMetadataExtraction", true,
                        "supportsUsageExtraction", true,
                        "supportsLineageExtraction", true,
                        "supportsProfiler", true)));
  }

  private static OpenMetadataApplicationConfig createApplicationConfig() {
    PipelineServiceClientConfiguration pipelineConfig = new PipelineServiceClientConfiguration();
    pipelineConfig.setMetadataApiEndpoint("http://localhost:8585/api");
    pipelineConfig.setVerifySSL(VerifySSL.NO_SSL);

    OpenMetadataApplicationConfig appConfig = new OpenMetadataApplicationConfig();
    appConfig.setPipelineServiceClientConfiguration(pipelineConfig);
    return appConfig;
  }
}
