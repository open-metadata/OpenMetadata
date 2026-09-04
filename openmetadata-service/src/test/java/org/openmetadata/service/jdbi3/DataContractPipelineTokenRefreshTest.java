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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.secrets.SecretsManagerClientLoader;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

/**
 * Issue #24806: the Airflow DAG config file written at deploy time pins the bot JWT, so a data
 * contract whose DQ pipeline was deployed once keeps running with that token forever. These tests
 * assert on the payload that reaches {@link PipelineServiceClientInterface} - the only place the
 * token ever leaves the server - rather than on interactions between repositories.
 */
class DataContractPipelineTokenRefreshTest {

  private static final String TEST_SUITE_BOT_NAME = "testsuite-bot";
  private static final String STALE_TOKEN = "stale-jwt-token";
  private static final String ROTATED_TOKEN = "rotated-jwt-token";
  private static final String PIPELINE_FIELDS = "*";
  private static final String TEST_SUITE_FIELDS = "tests,pipelines";

  private final List<String> deployedTokens = new ArrayList<>();
  private final List<String> triggeredTokens = new ArrayList<>();

  private BotRepository botRepository;
  private UserRepository userRepository;
  private SecretsManager secretsManager;
  private PipelineServiceClientInterface pipelineServiceClient;
  private OpenMetadataApplicationConfig applicationConfig;
  private DataContractRepository dataContractRepository;
  private IngestionPipelineRepository ingestionPipelineRepository;
  private String currentBotToken;

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
    applicationConfig = createApplicationConfig();
    pipelineServiceClient = mock(PipelineServiceClientInterface.class);
    when(pipelineServiceClient.pinsCredentialsAtDeployTime()).thenReturn(true);
    ingestionPipelineRepository = new IngestionPipelineRepository(applicationConfig);
    ingestionPipelineRepository.setPipelineServiceClient(pipelineServiceClient);
    dataContractRepository = new DataContractRepository(applicationConfig);
    dataContractRepository.setPipelineServiceClient(pipelineServiceClient);
    recordTokensReachingThePipelineService();
    stubBotLookupWithRotatableToken();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  @DisplayName("validate re-deploys an already deployed DAG so it picks up the rotated bot token")
  void validateRefreshesTheDeployedDagWithTheCurrentBotToken() {
    IngestionPipeline pipeline = testSuitePipeline(true);
    TestSuite testSuite = testSuiteWith(pipeline);
    DataContract dataContract = dataContractFor(testSuite);

    validateTwiceRotatingTheBotTokenInBetween(testSuite, pipeline, dataContract);

    assertEquals(List.of(STALE_TOKEN, ROTATED_TOKEN), deployedTokens);
  }

  @Test
  @DisplayName("validate still triggers the DAG run after refreshing the deployment")
  void validateStillTriggersThePipelineRun() {
    IngestionPipeline pipeline = testSuitePipeline(true);
    TestSuite testSuite = testSuiteWith(pipeline);
    DataContract dataContract = dataContractFor(testSuite);

    validateTwiceRotatingTheBotTokenInBetween(testSuite, pipeline, dataContract);

    assertEquals(List.of(STALE_TOKEN, ROTATED_TOKEN), triggeredTokens);
  }

  @Test
  @DisplayName("an unreachable pipeline service still lets an already deployed DAG run")
  void refreshFailureOnAnAlreadyDeployedDagStillTriggersTheRun() {
    IngestionPipeline pipeline = testSuitePipeline(true);
    TestSuite testSuite = testSuiteWith(pipeline);
    DataContract dataContract = dataContractFor(testSuite);
    rejectDeployments();

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory =
            mockStatic(SecretsManagerFactory.class)) {
      stubStaticLookups(mockedEntity, mockedSecretsManagerFactory, testSuite, pipeline);
      currentBotToken = ROTATED_TOKEN;
      dataContractRepository.deployAndTriggerDQValidation(dataContract);
    }

    assertEquals(List.of(ROTATED_TOKEN), triggeredTokens);
  }

  @Test
  @DisplayName("an unreachable pipeline service fails a validation with nothing deployed yet")
  void refreshFailureOnANeverDeployedDagAbortsTheValidation() {
    IngestionPipeline pipeline = testSuitePipeline(false);
    TestSuite testSuite = testSuiteWith(pipeline);
    DataContract dataContract = dataContractFor(testSuite);
    rejectDeployments();

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory =
            mockStatic(SecretsManagerFactory.class)) {
      stubStaticLookups(mockedEntity, mockedSecretsManagerFactory, testSuite, pipeline);
      currentBotToken = ROTATED_TOKEN;
      assertThrows(
          PipelineServiceClientException.class,
          () -> dataContractRepository.deployAndTriggerDQValidation(dataContract));
    }

    assertEquals(List.of(), triggeredTokens);
  }

  @Test
  @DisplayName("a runner that does not pin the token at deploy time is not re-deployed")
  void validateDoesNotRedeployARunnerThatRebuildsTheTokenOnEveryRun() {
    when(pipelineServiceClient.pinsCredentialsAtDeployTime()).thenReturn(false);
    IngestionPipeline pipeline = testSuitePipeline(true);
    TestSuite testSuite = testSuiteWith(pipeline);
    DataContract dataContract = dataContractFor(testSuite);

    validateTwiceRotatingTheBotTokenInBetween(testSuite, pipeline, dataContract);

    assertEquals(List.of(), deployedTokens);
    assertEquals(List.of(STALE_TOKEN, ROTATED_TOKEN), triggeredTokens);
  }

  /**
   * The gate must skip only the refresh of an already deployed pipeline, never the first deploy. A
   * successful first deploy cannot be asserted here because it goes on to createOrUpdate, which
   * needs a real JDBI handle, so this pins the deploy attempt through the failure path instead:
   * reaching the client at all is what proves the gate let it through.
   */
  @Test
  @DisplayName("a runner that does not pin the token still deploys when nothing is deployed yet")
  void validateStillDeploysANeverDeployedPipelineOnANonPinningRunner() {
    when(pipelineServiceClient.pinsCredentialsAtDeployTime()).thenReturn(false);
    IngestionPipeline pipeline = testSuitePipeline(false);
    TestSuite testSuite = testSuiteWith(pipeline);
    DataContract dataContract = dataContractFor(testSuite);
    rejectDeployments();

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory =
            mockStatic(SecretsManagerFactory.class)) {
      stubStaticLookups(mockedEntity, mockedSecretsManagerFactory, testSuite, pipeline);
      currentBotToken = ROTATED_TOKEN;
      assertThrows(
          PipelineServiceClientException.class,
          () -> dataContractRepository.deployAndTriggerDQValidation(dataContract));
    }

    assertEquals(List.of(), triggeredTokens);
  }

  private void validateTwiceRotatingTheBotTokenInBetween(
      TestSuite testSuite, IngestionPipeline pipeline, DataContract dataContract) {
    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory =
            mockStatic(SecretsManagerFactory.class)) {
      stubStaticLookups(mockedEntity, mockedSecretsManagerFactory, testSuite, pipeline);

      currentBotToken = STALE_TOKEN;
      dataContractRepository.deployAndTriggerDQValidation(dataContract);

      currentBotToken = ROTATED_TOKEN;
      dataContractRepository.deployAndTriggerDQValidation(dataContract);
    }
  }

  private void stubStaticLookups(
      MockedStatic<Entity> mockedEntity,
      MockedStatic<SecretsManagerFactory> mockedSecretsManagerFactory,
      TestSuite testSuite,
      IngestionPipeline pipeline) {
    mockedEntity
        .when(
            () -> Entity.getEntity(referenceTo(testSuite), TEST_SUITE_FIELDS, Include.NON_DELETED))
        .thenReturn(testSuite);
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    testSuite.getPipelines().getFirst(), PIPELINE_FIELDS, Include.NON_DELETED))
        .thenReturn(pipeline);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(ingestionPipelineRepository);
    mockedSecretsManagerFactory
        .when(SecretsManagerFactory::getSecretsManager)
        .thenReturn(secretsManager);
  }

  private void recordTokensReachingThePipelineService() {
    when(pipelineServiceClient.deployPipeline(any(IngestionPipeline.class), any()))
        .thenAnswer(
            invocation -> {
              deployedTokens.add(jwtTokenOf(invocation.getArgument(0)));
              return new PipelineServiceClientResponse()
                  .withCode(Response.Status.OK.getStatusCode());
            });
    when(pipelineServiceClient.runPipeline(any(IngestionPipeline.class), any()))
        .thenAnswer(
            invocation -> {
              triggeredTokens.add(jwtTokenOf(invocation.getArgument(0)));
              return new PipelineServiceClientResponse()
                  .withCode(Response.Status.OK.getStatusCode());
            });
  }

  private void rejectDeployments() {
    when(pipelineServiceClient.deployPipeline(any(IngestionPipeline.class), any()))
        .thenThrow(new PipelineServiceClientException("airflow is unreachable"));
  }

  private void stubBotLookupWithRotatableToken() {
    botRepository = mock(BotRepository.class);
    userRepository = mock(UserRepository.class);
    secretsManager = mock(SecretsManager.class);
    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.DB);
    when(secretsManager.encryptOpenMetadataConnection(any(OpenMetadataConnection.class), eq(false)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(botRepository.getByName(isNull(), eq(TEST_SUITE_BOT_NAME), any()))
        .thenReturn(
            new Bot()
                .withName(TEST_SUITE_BOT_NAME)
                .withBotUser(new EntityReference().withFullyQualifiedName(TEST_SUITE_BOT_NAME)));
    when(userRepository.getByName(isNull(), eq(TEST_SUITE_BOT_NAME), any()))
        .thenAnswer(invocation -> botUserHoldingCurrentToken());
  }

  private User botUserHoldingCurrentToken() {
    return new User()
        .withName(TEST_SUITE_BOT_NAME)
        .withFullyQualifiedName(TEST_SUITE_BOT_NAME)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken(currentBotToken)));
  }

  private String jwtTokenOf(IngestionPipeline pipeline) {
    return pipeline.getOpenMetadataServerConnection().getSecurityConfig().getJwtToken();
  }

  private IngestionPipeline testSuitePipeline(boolean deployed) {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("dq-pipeline")
        .withFullyQualifiedName("dq-pipeline")
        .withPipelineType(PipelineType.TEST_SUITE)
        .withDeployed(deployed);
  }

  private TestSuite testSuiteWith(IngestionPipeline pipeline) {
    return new TestSuite()
        .withId(UUID.randomUUID())
        .withName("contract-test-suite")
        .withFullyQualifiedName("contract-test-suite")
        .withPipelines(
            List.of(
                new EntityReference()
                    .withId(pipeline.getId())
                    .withType(Entity.INGESTION_PIPELINE)));
  }

  private DataContract dataContractFor(TestSuite testSuite) {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName("contract")
        .withFullyQualifiedName("table.dataContract_contract")
        .withTestSuite(referenceTo(testSuite));
  }

  private EntityReference referenceTo(TestSuite testSuite) {
    return new EntityReference()
        .withId(testSuite.getId())
        .withType(Entity.TEST_SUITE)
        .withName(testSuite.getName())
        .withFullyQualifiedName(testSuite.getFullyQualifiedName());
  }

  private OpenMetadataApplicationConfig createApplicationConfig() {
    PipelineServiceClientConfiguration pipelineServiceClientConfiguration =
        new PipelineServiceClientConfiguration();
    pipelineServiceClientConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    pipelineServiceClientConfiguration.setVerifySSL(VerifySSL.NO_SSL);
    pipelineServiceClientConfiguration.setSecretsManagerLoader(SecretsManagerClientLoader.AIRFLOW);

    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setPipelineServiceClientConfiguration(pipelineServiceClientConfiguration);
    config.setClusterName("openmetadata");
    return config;
  }
}
