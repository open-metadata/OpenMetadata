package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.resources.services.ingestionpipelines.PipelineBotRedeployScheduler.PENDING_REDEPLOY;

import java.time.Duration;
import java.util.List;
import java.util.NavigableSet;
import java.util.UUID;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.FreshReadScope;

/**
 * The markers live in an in-memory stand-in for entity_extension, so the tests assert on what is
 * left pending, and on the token of each pipeline the pipeline service was handed.
 */
class PipelineBotRedeploySchedulerTest {

  private static final List<String> BOTS =
      List.of(Entity.INGESTION_BOT_NAME, "usage-bot", "autoClassification-bot");

  private final NavigableSet<String> pending = new ConcurrentSkipListSet<>();
  private final AtomicInteger scans = new AtomicInteger();
  private final List<Boolean> readsFresh = new CopyOnWriteArrayList<>();
  private final List<IngestionPipeline> deployed = new CopyOnWriteArrayList<>();
  private final IngestionPipelineRepository pipelineRepository =
      mock(IngestionPipelineRepository.class);
  private final PipelineServiceClientInterface pipelineServiceClient =
      mock(PipelineServiceClientInterface.class);
  private final DatabaseService service =
      new DatabaseService().withId(UUID.randomUUID()).withName("autopilot_service");

  private MockedStatic<Entity> mockedEntity;
  private MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory;
  private MockedStatic<PipelineServiceClientFactory> mockedClientFactory;
  private PipelineBotRedeployScheduler scheduler;

  @BeforeEach
  void setUp() {
    BotRepository botRepository = botRepositoryWithTokens();
    UserRepository userRepository = userRepositoryWithTokens();
    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(pipelineRepository);
    mockedEntity
        .when(() -> Entity.getEntity(any(EntityReference.class), eq("ingestionRunner"), any()))
        .thenReturn(service);

    SecretsManager secretsManager = mock(SecretsManager.class);
    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.IN_MEMORY);
    when(secretsManager.encryptOpenMetadataConnection(any(), eq(false)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    mockedSecretsManagerFactory = mockStatic(SecretsManagerFactory.class);
    mockedSecretsManagerFactory
        .when(SecretsManagerFactory::getSecretsManager)
        .thenReturn(secretsManager);

    mockedClientFactory = mockStatic(PipelineServiceClientFactory.class);
    mockedClientFactory
        .when(PipelineServiceClientFactory::getPipelineServiceClient)
        .thenReturn(pipelineServiceClient);
    when(pipelineServiceClient.getServiceStatus()).thenReturn(response(200));
    when(pipelineRepository.deployIngestionPipeline(any(), eq(service)))
        .thenAnswer(
            invocation -> {
              deployed.add(invocation.getArgument(0));
              return response(200);
            });

    scheduler = new PipelineBotRedeployScheduler(markerTable(), createApplicationConfig(true));
  }

  @AfterEach
  void tearDown() {
    mockedClientFactory.close();
    mockedSecretsManagerFactory.close();
    mockedEntity.close();
  }

  @Test
  void markedAgentIsRedeployedAsItsOwnBotAndUnmarked() {
    IngestionPipeline agent = markedAgent(PipelineType.AUTO_CLASSIFICATION);

    assertFalse(scheduler.redeployPending());

    assertEquals(List.of("autoClassification-bot-token"), deployedTokens());
    assertFalse(pending.contains(agent.getId().toString()));
  }

  // The scan thread outlives every scan; a read served from its cache would deploy a pipeline as
  // it was at an earlier failed scan, over any edit made since.
  @Test
  void scanReadsEachPipelineFreshFromTheDatabase() {
    markedAgent(PipelineType.USAGE);

    scheduler.redeployPending();

    assertEquals(List.of(true), readsFresh);
    assertFalse(FreshReadScope.isActive());
  }

  @Test
  void failedDeployKeepsTheAgentMarked() {
    IngestionPipeline agent = markedAgent(PipelineType.USAGE);
    when(pipelineRepository.deployIngestionPipeline(any(), eq(service))).thenReturn(response(500));

    assertTrue(scheduler.redeployPending());

    assertTrue(pending.contains(agent.getId().toString()));
  }

  @Test
  void unreachablePipelineServiceDeploysNothingAndKeepsTheMarker() {
    IngestionPipeline agent = markedAgent(PipelineType.USAGE);
    when(pipelineServiceClient.getServiceStatus()).thenReturn(response(503));

    assertTrue(scheduler.redeployPending());

    assertTrue(deployed.isEmpty());
    assertTrue(pending.contains(agent.getId().toString()));
  }

  @Test
  void agentDeletedSinceTheUpgradeIsUnmarked() {
    UUID deletedAgent = UUID.randomUUID();
    pending.add(deletedAgent.toString());
    when(pipelineRepository.get(isNull(), eq(deletedAgent), any(), eq(Include.ALL), eq(false)))
        .thenThrow(EntityNotFoundException.byMessage("gone"));

    assertFalse(scheduler.redeployPending());

    assertTrue(deployed.isEmpty());
  }

  @Test
  void agentThatCannotBeDeployedDoesNotStrandTheOthers() {
    UUID brokenAgent = UUID.randomUUID();
    pending.add(brokenAgent.toString());
    when(pipelineRepository.get(isNull(), eq(brokenAgent), any(), eq(Include.ALL), eq(false)))
        .thenThrow(new IllegalStateException("broken service relationship"));
    IngestionPipeline agent = markedAgent(PipelineType.USAGE);

    assertTrue(scheduler.redeployPending());

    assertEquals(List.of("usage-bot-token"), deployedTokens());
    assertEquals(List.of(brokenAgent.toString()), List.copyOf(pending));
    assertFalse(pending.contains(agent.getId().toString()));
  }

  // The scan runs on the scheduler's own thread, which the static mocks do not reach, so these
  // two tests only watch how often the marker table is scanned.
  @Test
  void startedSchedulerStopsScanningOnceNothingIsPending() {
    PipelineBotRedeployScheduler started =
        new PipelineBotRedeployScheduler(
            markerTable(), createApplicationConfig(true), Duration.ZERO, Duration.ofMillis(20));

    started.start();
    try {
      await().atMost(Duration.ofSeconds(10)).until(() -> scans.get() > 0);
      int scansAfterTheFirstRun = scans.get();
      await()
          .during(Duration.ofMillis(300))
          .atMost(Duration.ofSeconds(2))
          .until(() -> scans.get() == scansAfterTheFirstRun);
    } finally {
      started.stop();
    }
  }

  @Test
  void schedulerDoesNotScanWhenThePipelineServiceIsDisabled() {
    PipelineBotRedeployScheduler disabled =
        new PipelineBotRedeployScheduler(
            markerTable(), createApplicationConfig(false), Duration.ZERO, Duration.ofMillis(20));

    disabled.start();
    try {
      await()
          .during(Duration.ofMillis(300))
          .atMost(Duration.ofSeconds(2))
          .until(() -> scans.get() == 0);
    } finally {
      disabled.stop();
    }
  }

  private IngestionPipeline markedAgent(PipelineType pipelineType) {
    IngestionPipeline agent =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName("agent")
            .withFullyQualifiedName("autopilot_service.agent")
            .withPipelineType(pipelineType)
            .withService(service.getEntityReference());
    when(pipelineRepository.get(isNull(), eq(agent.getId()), any(), eq(Include.ALL), eq(false)))
        .thenAnswer(
            invocation -> {
              readsFresh.add(FreshReadScope.isActive());
              return agent;
            });
    pending.add(agent.getId().toString());
    return agent;
  }

  private List<String> deployedTokens() {
    return deployed.stream()
        .map(pipeline -> pipeline.getOpenMetadataServerConnection().getSecurityConfig())
        .map(securityConfig -> securityConfig.getJwtToken())
        .toList();
  }

  private EntityExtensionDAO markerTable() {
    EntityExtensionDAO extensionDAO = mock(EntityExtensionDAO.class);
    when(extensionDAO.listExtensionIds(eq(PENDING_REDEPLOY), anyString(), anyInt()))
        .thenAnswer(
            invocation -> {
              scans.incrementAndGet();
              String after = invocation.getArgument(1);
              int limit = invocation.getArgument(2);
              return pending.tailSet(after, false).stream().limit(limit).toList();
            });
    doAnswer(
            invocation -> {
              pending.remove(invocation.getArgument(0).toString());
              return null;
            })
        .when(extensionDAO)
        .delete(any(UUID.class), eq(PENDING_REDEPLOY));
    return extensionDAO;
  }

  private static BotRepository botRepositoryWithTokens() {
    BotRepository botRepository = mock(BotRepository.class);
    for (String bot : BOTS) {
      when(botRepository.getByName(isNull(), eq(bot), any()))
          .thenReturn(
              new Bot()
                  .withName(bot)
                  .withBotUser(new EntityReference().withFullyQualifiedName(bot)));
    }
    return botRepository;
  }

  private static UserRepository userRepositoryWithTokens() {
    UserRepository userRepository = mock(UserRepository.class);
    for (String bot : BOTS) {
      when(userRepository.getByName(isNull(), eq(bot), any()))
          .thenReturn(
              new User()
                  .withName(bot)
                  .withAuthenticationMechanism(
                      new AuthenticationMechanism()
                          .withAuthType(AuthenticationMechanism.AuthType.JWT)
                          .withConfig(
                              new JWTAuthMechanism().withJWTToken("%s-token".formatted(bot)))));
    }
    return userRepository;
  }

  private static PipelineServiceClientResponse response(int code) {
    return new PipelineServiceClientResponse()
        .withCode(code)
        .withReason("status %d".formatted(code));
  }

  private static OpenMetadataApplicationConfig createApplicationConfig(boolean enabled) {
    PipelineServiceClientConfiguration pipelineConfig = new PipelineServiceClientConfiguration();
    pipelineConfig.setEnabled(enabled);
    pipelineConfig.setMetadataApiEndpoint("http://localhost:8585/api");
    pipelineConfig.setVerifySSL(VerifySSL.NO_SSL);
    OpenMetadataApplicationConfig appConfig = new OpenMetadataApplicationConfig();
    appConfig.setPipelineServiceClientConfiguration(pipelineConfig);
    return appConfig;
  }
}
