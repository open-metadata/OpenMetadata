package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mockito;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.IngestionRunnerUnavailableException;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.secrets.SecretsManagerFactory;

class IngestionPipelineRepositoryTest {

  private static IngestionPipelineRepository repository;

  @BeforeAll
  static void setup() {
    repository = mock(IngestionPipelineRepository.class);
    when(repository.hasScheduleChanged(
            org.mockito.ArgumentMatchers.any(IngestionPipeline.class),
            org.mockito.ArgumentMatchers.any(IngestionPipeline.class)))
        .thenCallRealMethod();
    when(repository.hasSourceConfigChanged(
            org.mockito.ArgumentMatchers.any(IngestionPipeline.class),
            org.mockito.ArgumentMatchers.any(IngestionPipeline.class)))
        .thenCallRealMethod();

    SecretsManagerConfiguration smConfig = new SecretsManagerConfiguration();
    smConfig.setSecretsManager(SecretsManagerProvider.DB);
    SecretsManagerFactory.createSecretsManager(smConfig, "test");
  }

  @Test
  void deleteDeployedPipelineReportsSkippedCleanupForUnavailableRunner() {
    IngestionPipeline pipeline = createBasicPipeline();
    IngestionPipelineRepository cleanupRepository =
        repositoryWithClient(unavailableRunnerClient(pipeline));

    boolean wasRunnerCleanupSkipped = cleanupRepository.deleteDeployedPipeline(pipeline, true);

    assertTrue(wasRunnerCleanupSkipped);
  }

  @Test
  void deleteDeployedPipelinePreservesUnavailableRunnerFailureByDefault() {
    IngestionPipeline pipeline = createBasicPipeline();
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    IngestionRunnerUnavailableException unavailable =
        new IngestionRunnerUnavailableException("runner unavailable");
    doThrow(unavailable).when(pipelineServiceClient).deletePipeline(pipeline);
    IngestionPipelineRepository cleanupRepository = repositoryWithClient(pipelineServiceClient);

    IngestionRunnerUnavailableException actual =
        assertThrows(
            IngestionRunnerUnavailableException.class,
            () -> cleanupRepository.deleteDeployedPipeline(pipeline, false));

    assertEquals(unavailable, actual);
  }

  @Test
  void deleteDeployedPipelineDoesNotSuppressOtherPipelineFailures() {
    IngestionPipeline pipeline = createBasicPipeline();
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    PipelineServiceClientException deploymentFailure =
        new PipelineServiceClientException("runner rejected deletion");
    doThrow(deploymentFailure).when(pipelineServiceClient).deletePipeline(pipeline);
    IngestionPipelineRepository cleanupRepository = repositoryWithClient(pipelineServiceClient);

    PipelineServiceClientException actual =
        assertThrows(
            PipelineServiceClientException.class,
            () -> cleanupRepository.deleteDeployedPipeline(pipeline, true));

    assertEquals(deploymentFailure, actual);
  }

  @Test
  void deleteDeployedPipelineReportsCompletedCleanup() {
    IngestionPipeline pipeline = createBasicPipeline();
    IngestionPipelineRepository cleanupRepository =
        repositoryWithClient(mock(PipelineServiceClientInterface.class));

    boolean wasRunnerCleanupSkipped = cleanupRepository.deleteDeployedPipeline(pipeline, true);

    assertFalse(wasRunnerCleanupSkipped);
  }

  /**
   * A runner that is down is the observable channel for whether the teardown was attempted at all:
   * with {@code allowUnavailableRunner=false} — the mode every delete but {@code forceDelete} uses
   * — {@code deleteDeployedPipeline} propagates {@link IngestionRunnerUnavailableException}, so the
   * exception surfaces exactly when {@code postDelete} reaches the orchestrator and stays silent
   * when it does not. The two tests below therefore pin both halves of the {@code hardDelete} guard
   * through {@code postDelete} itself rather than through {@code deleteDeployedPipeline}, which the
   * other tests in this class call directly and which would keep passing if the guard were dropped.
   */
  @Test
  void postDeleteLeavesTheDeployedPipelineAloneOnSoftDelete() {
    IngestionPipeline pipeline = createBasicPipeline();
    IngestionPipelineRepository cleanupRepository =
        repositoryWithClient(unavailableRunnerClient(pipeline));

    assertDoesNotThrow(
        () -> cleanupRepository.postDelete(pipeline, false),
        "A soft delete is reversible and restore cannot redeploy, so it must not touch the "
            + "orchestrator — nor fail when the orchestrator is unreachable");
  }

  @Test
  void postDeleteTearsDownTheDeployedPipelineOnHardDelete() {
    IngestionPipeline pipeline = createBasicPipeline();
    IngestionPipelineRepository cleanupRepository =
        repositoryWithClient(unavailableRunnerClient(pipeline));

    assertThrows(
        IngestionRunnerUnavailableException.class,
        () -> cleanupRepository.postDelete(pipeline, true),
        "A hard delete must still remove the DAG from the orchestrator");
  }

  private PipelineServiceClientInterface unavailableRunnerClient(IngestionPipeline pipeline) {
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    doThrow(new IngestionRunnerUnavailableException("runner unavailable"))
        .when(pipelineServiceClient)
        .deletePipeline(pipeline);
    return pipelineServiceClient;
  }

  private IngestionPipelineRepository repositoryWithClient(
      PipelineServiceClientInterface pipelineServiceClient) {
    IngestionPipelineRepository cleanupRepository =
        mock(IngestionPipelineRepository.class, Mockito.CALLS_REAL_METHODS);
    cleanupRepository.setPipelineServiceClient(pipelineServiceClient);
    return cleanupRepository;
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("legacySourceConfigTypes")
  void deployLegacyPipelineAddsDefaultSourceConfigTypeBeforeCallingRunner(
      String testCase, PipelineType pipelineType, String serviceType, String expectedConfigType) {
    IngestionPipeline pipeline = legacyPipeline(pipelineType, serviceType);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    PipelineServiceClientResponse response = new PipelineServiceClientResponse().withCode(200);
    when(pipelineServiceClient.deployPipeline(
            any(IngestionPipeline.class), any(ServiceEntityInterface.class)))
        .thenReturn(response);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);
    ServiceEntityInterface service = mock(ServiceEntityInterface.class);

    PipelineServiceClientResponse actual =
        deploymentRepository.deployIngestionPipeline(pipeline, service);

    assertEquals(response, actual);
    assertEquals(expectedConfigType, sourceConfigMap(pipeline).get("type"));
    assertEquals("preserved", sourceConfigMap(pipeline).get("existingSetting"));
    verify(pipelineServiceClient).deployPipeline(pipeline, service);
  }

  @Test
  void deployLegacyPipelineRejectsUnknownSourceConfigTypeBeforeCallingRunner() {
    IngestionPipeline pipeline = legacyPipeline(PipelineType.USAGE, Entity.DASHBOARD_SERVICE);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);

    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                deploymentRepository.deployIngestionPipeline(
                    pipeline, mock(ServiceEntityInterface.class)));

    assertEquals("sourceConfig.config.type is required", exception.getMessage());
    verifyNoInteractions(pipelineServiceClient);
  }

  @Test
  void deployPipelineRejectsMalformedSourceConfigBeforeCallingRunner() {
    IngestionPipeline pipeline = legacyPipeline(PipelineType.METADATA, Entity.DATABASE_SERVICE);
    pipeline.getSourceConfig().setConfig("not-an-object");
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);

    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                deploymentRepository.deployIngestionPipeline(
                    pipeline, mock(ServiceEntityInterface.class)));

    assertEquals("sourceConfig.config must be an object with type", exception.getMessage());
    verifyNoInteractions(pipelineServiceClient);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("invalidLegacySourceConfigs")
  void deployLegacyPipelineRejectsInvalidExplicitSourceConfigTypeBeforeCallingRunner(
      String testCase, Object config) {
    IngestionPipeline pipeline =
        legacyPipelineWithConfig(config, PipelineType.METADATA, Entity.DATABASE_SERVICE);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);

    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                deploymentRepository.deployIngestionPipeline(
                    pipeline, mock(ServiceEntityInterface.class)));

    assertEquals("sourceConfig.config.type is required", exception.getMessage());
    verifyNoInteractions(pipelineServiceClient);
  }

  @Test
  void deployNewPipelineWithoutSourceConfigTypeRejectsBeforeCallingRunner() {
    IngestionPipeline pipeline = legacyPipeline(PipelineType.METADATA, Entity.DATABASE_SERVICE);
    pipeline.setId(null);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);

    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                deploymentRepository.deployIngestionPipeline(
                    pipeline, mock(ServiceEntityInterface.class)));

    assertEquals("sourceConfig.config.type is required", exception.getMessage());
    verifyNoInteractions(pipelineServiceClient);
  }

  @Test
  void deployLegacyPipelineWithNullSourceConfigTypeAddsDefaultBeforeCallingRunner() {
    Map<String, Object> config = new HashMap<>();
    config.put("type", null);
    IngestionPipeline pipeline =
        legacyPipelineWithConfig(config, PipelineType.METADATA, Entity.DATABASE_SERVICE);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    PipelineServiceClientResponse response = new PipelineServiceClientResponse().withCode(200);
    when(pipelineServiceClient.deployPipeline(
            any(IngestionPipeline.class), any(ServiceEntityInterface.class)))
        .thenReturn(response);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);
    ServiceEntityInterface service = mock(ServiceEntityInterface.class);

    PipelineServiceClientResponse actual =
        deploymentRepository.deployIngestionPipeline(pipeline, service);

    assertEquals(response, actual);
    assertEquals("DatabaseMetadata", sourceConfigMap(pipeline).get("type"));
    verify(pipelineServiceClient).deployPipeline(pipeline, service);
  }

  @Test
  void deployLegacyPipelineWithBlankSourceConfigTypeAddsDefaultBeforeCallingRunner() {
    Map<String, Object> config = new HashMap<>();
    config.put("type", "   ");
    IngestionPipeline pipeline =
        legacyPipelineWithConfig(config, PipelineType.METADATA, Entity.DATABASE_SERVICE);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    PipelineServiceClientResponse response = new PipelineServiceClientResponse().withCode(200);
    when(pipelineServiceClient.deployPipeline(
            any(IngestionPipeline.class), any(ServiceEntityInterface.class)))
        .thenReturn(response);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);
    ServiceEntityInterface service = mock(ServiceEntityInterface.class);

    PipelineServiceClientResponse actual =
        deploymentRepository.deployIngestionPipeline(pipeline, service);

    assertEquals(response, actual);
    assertEquals("DatabaseMetadata", sourceConfigMap(pipeline).get("type"));
    verify(pipelineServiceClient).deployPipeline(pipeline, service);
  }

  @Test
  void deployLegacyReverseIngestionAddsDefaultSourceConfigTypeBeforeCallingRunner() {
    Map<String, Object> config = new HashMap<>();
    config.put("operations", List.of());
    IngestionPipeline pipeline =
        legacyPipelineWithConfig(config, PipelineType.METADATA, Entity.DATABASE_SERVICE);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    PipelineServiceClientResponse response = new PipelineServiceClientResponse().withCode(200);
    when(pipelineServiceClient.deployPipeline(
            any(IngestionPipeline.class), any(ServiceEntityInterface.class)))
        .thenReturn(response);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);
    ServiceEntityInterface service = mock(ServiceEntityInterface.class);

    PipelineServiceClientResponse actual =
        deploymentRepository.deployIngestionPipeline(pipeline, service);

    assertEquals(response, actual);
    assertEquals("ReverseIngestion", sourceConfigMap(pipeline).get("type"));
    verify(pipelineServiceClient).deployPipeline(pipeline, service);
  }

  @Test
  void deployPipelinePreservesExplicitSourceConfigType() {
    IngestionPipeline pipeline =
        legacyPipelineWithConfig(
            new HashMap<>(Map.of("type", "DatabaseMetadata")),
            PipelineType.METADATA,
            Entity.DATABASE_SERVICE);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    PipelineServiceClientResponse response = new PipelineServiceClientResponse().withCode(200);
    when(pipelineServiceClient.deployPipeline(
            any(IngestionPipeline.class), any(ServiceEntityInterface.class)))
        .thenReturn(response);
    IngestionPipelineRepository deploymentRepository = repositoryWithClient(pipelineServiceClient);
    ServiceEntityInterface service = mock(ServiceEntityInterface.class);

    PipelineServiceClientResponse actual =
        deploymentRepository.deployIngestionPipeline(pipeline, service);

    assertEquals(response, actual);
    assertEquals("DatabaseMetadata", sourceConfigMap(pipeline).get("type"));
    verify(pipelineServiceClient).deployPipeline(pipeline, service);
  }

  private static Stream<Arguments> legacySourceConfigTypes() {
    return Stream.of(
        Arguments.of(
            "database metadata",
            PipelineType.METADATA,
            Entity.DATABASE_SERVICE,
            "DatabaseMetadata"),
        Arguments.of(
            "dashboard metadata",
            PipelineType.METADATA,
            Entity.DASHBOARD_SERVICE,
            "DashboardMetadata"),
        Arguments.of(
            "messaging metadata",
            PipelineType.METADATA,
            Entity.MESSAGING_SERVICE,
            "MessagingMetadata"),
        Arguments.of(
            "pipeline metadata",
            PipelineType.METADATA,
            Entity.PIPELINE_SERVICE,
            "PipelineMetadata"),
        Arguments.of(
            "machine-learning metadata",
            PipelineType.METADATA,
            Entity.MLMODEL_SERVICE,
            "MlModelMetadata"),
        Arguments.of(
            "storage metadata", PipelineType.METADATA, Entity.STORAGE_SERVICE, "StorageMetadata"),
        Arguments.of(
            "drive metadata", PipelineType.METADATA, Entity.DRIVE_SERVICE, "DriveMetadata"),
        Arguments.of(
            "search metadata", PipelineType.METADATA, Entity.SEARCH_SERVICE, "SearchMetadata"),
        Arguments.of("api metadata", PipelineType.METADATA, Entity.API_SERVICE, "ApiMetadata"),
        Arguments.of("mcp metadata", PipelineType.METADATA, Entity.MCP_SERVICE, "McpMetadata"),
        Arguments.of(
            "security metadata",
            PipelineType.METADATA,
            Entity.SECURITY_SERVICE,
            "SecurityMetadata"),
        Arguments.of(
            "OpenMetadata service metadata",
            PipelineType.METADATA,
            Entity.METADATA_SERVICE,
            "DatabaseMetadata"),
        Arguments.of(
            "database usage", PipelineType.USAGE, Entity.DATABASE_SERVICE, "DatabaseUsage"),
        Arguments.of(
            "database lineage", PipelineType.LINEAGE, Entity.DATABASE_SERVICE, "DatabaseLineage"),
        Arguments.of(
            "dashboard lineage",
            PipelineType.LINEAGE,
            Entity.DASHBOARD_SERVICE,
            "DashboardMetadata"),
        Arguments.of(
            "database profiler", PipelineType.PROFILER, Entity.DATABASE_SERVICE, "Profiler"),
        Arguments.of(
            "database auto classification",
            PipelineType.AUTO_CLASSIFICATION,
            Entity.DATABASE_SERVICE,
            "AutoClassification"),
        Arguments.of(
            "messaging auto classification",
            PipelineType.AUTO_CLASSIFICATION,
            Entity.MESSAGING_SERVICE,
            "AutoClassification"),
        Arguments.of(
            "storage auto classification",
            PipelineType.AUTO_CLASSIFICATION,
            Entity.STORAGE_SERVICE,
            "AutoClassification"),
        Arguments.of("dbt", PipelineType.DBT, Entity.DATABASE_SERVICE, "DBT"),
        Arguments.of("test suite", PipelineType.TEST_SUITE, Entity.TEST_SUITE, "TestSuite"),
        Arguments.of(
            "data insight", PipelineType.DATA_INSIGHT, Entity.METADATA_SERVICE, "dataInsight"),
        Arguments.of(
            "search reindex",
            PipelineType.ELASTIC_SEARCH_REINDEX,
            Entity.METADATA_SERVICE,
            "MetadataToElasticSearch"),
        Arguments.of(
            "application", PipelineType.APPLICATION, Entity.METADATA_SERVICE, "Application"),
        Arguments.of(
            "policy agent", PipelineType.POLICY_AGENT, Entity.DATABASE_SERVICE, "PolicyAgent"));
  }

  private static Stream<Arguments> invalidLegacySourceConfigs() {
    return Stream.of(
        Arguments.of("non-string type", Map.of("type", 42)),
        Arguments.of(
            "raw-map enum type",
            Map.of(
                "type",
                DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA)));
  }

  @Test
  @DisplayName("requiresRedeployment should detect schedule changes from Scheduled to On-Demand")
  void testRequiresRedeployment_ScheduleToOnDemand_ShouldReturnTrue() {
    IngestionPipeline original = createPipelineWithSchedule("0 0 * * *");
    IngestionPipeline updated = createPipelineWithSchedule(null);

    boolean requiresRedeployment = repository.hasScheduleChanged(original, updated);

    assertTrue(
        requiresRedeployment, "Changing from Scheduled to On-Demand should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should detect schedule changes from On-Demand to Scheduled")
  void testRequiresRedeployment_OnDemandToScheduled_ShouldReturnTrue() {
    IngestionPipeline original = createPipelineWithSchedule(null);
    IngestionPipeline updated = createPipelineWithSchedule("0 0 * * *");

    boolean requiresRedeployment = repository.hasScheduleChanged(original, updated);

    assertTrue(
        requiresRedeployment, "Changing from On-Demand to Scheduled should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should NOT require redeployment when schedule is unchanged")
  void testRequiresRedeployment_NoScheduleChange_ShouldReturnFalse() {
    IngestionPipeline original = createPipelineWithSchedule("0 0 * * *");
    IngestionPipeline updated = createPipelineWithSchedule("0 0 * * *");

    boolean requiresRedeployment = repository.hasScheduleChanged(original, updated);

    assertFalse(requiresRedeployment, "Same schedule should not require redeployment");
  }

  @Test
  @DisplayName("hasScheduleChanged should handle both null schedules")
  void testHasScheduleChanged_BothNull_ShouldReturnFalse() {
    IngestionPipeline original = createPipelineWithSchedule(null);
    IngestionPipeline updated = createPipelineWithSchedule(null);

    boolean hasChanged = repository.hasScheduleChanged(original, updated);

    assertFalse(hasChanged, "Both null schedules should not indicate a change");
  }

  @Test
  @DisplayName("hasScheduleChanged should handle null AirflowConfig")
  void testHasScheduleChanged_NullAirflowConfig_ShouldHandleGracefully() {
    IngestionPipeline original = new IngestionPipeline();
    original.setAirflowConfig(null);
    IngestionPipeline updated = createPipelineWithSchedule("0 0 * * *");

    boolean hasChanged = repository.hasScheduleChanged(original, updated);

    assertTrue(hasChanged, "Null to non-null schedule should indicate a change");
  }

  @Test
  @DisplayName("requiresRedeployment should detect enabled changes")
  void testRequiresRedeployment_EnabledChange_ShouldReturnTrue() {
    IngestionPipeline original = createBasicPipeline();
    original.setEnabled(true);
    IngestionPipeline updated = createBasicPipeline();
    updated.setEnabled(false);

    boolean requiresRedeployment = !Objects.equals(original.getEnabled(), updated.getEnabled());

    assertTrue(requiresRedeployment, "Enabled change should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should NOT require redeployment when enabled is unchanged")
  void testRequiresRedeployment_EnabledUnchanged_ShouldReturnFalse() {
    IngestionPipeline original = createBasicPipeline();
    original.setEnabled(true);
    IngestionPipeline updated = createBasicPipeline();
    updated.setEnabled(true);

    boolean requiresRedeployment = !Objects.equals(original.getEnabled(), updated.getEnabled());

    assertFalse(requiresRedeployment, "Same enabled value should not require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should handle null enabled values")
  void testRequiresRedeployment_NullEnabled_ShouldNotThrowNPE() {
    IngestionPipeline original = createBasicPipeline();
    original.setEnabled(null);
    IngestionPipeline updated = createBasicPipeline();
    updated.setEnabled(true);

    boolean requiresRedeployment = !Objects.equals(original.getEnabled(), updated.getEnabled());

    assertTrue(requiresRedeployment, "Null to non-null enabled should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should detect loggerLevel changes")
  void testRequiresRedeployment_LoggerLevelChange_ShouldReturnTrue() {
    IngestionPipeline original = createBasicPipeline();
    original.setLoggerLevel(LogLevels.INFO);
    IngestionPipeline updated = createBasicPipeline();
    updated.setLoggerLevel(LogLevels.DEBUG);

    boolean requiresRedeployment =
        !Objects.equals(original.getLoggerLevel(), updated.getLoggerLevel());

    assertTrue(requiresRedeployment, "LoggerLevel change should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should NOT require redeployment when loggerLevel is unchanged")
  void testRequiresRedeployment_LoggerLevelUnchanged_ShouldReturnFalse() {
    IngestionPipeline original = createBasicPipeline();
    original.setLoggerLevel(LogLevels.INFO);
    IngestionPipeline updated = createBasicPipeline();
    updated.setLoggerLevel(LogLevels.INFO);

    boolean requiresRedeployment =
        !Objects.equals(original.getLoggerLevel(), updated.getLoggerLevel());

    assertFalse(requiresRedeployment, "Same loggerLevel should not require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should handle null loggerLevel values")
  void testRequiresRedeployment_NullLoggerLevel_ShouldNotThrowNPE() {
    IngestionPipeline original = createBasicPipeline();
    original.setLoggerLevel(null);
    IngestionPipeline updated = createBasicPipeline();
    updated.setLoggerLevel(LogLevels.DEBUG);

    boolean requiresRedeployment =
        !Objects.equals(original.getLoggerLevel(), updated.getLoggerLevel());

    assertTrue(requiresRedeployment, "Null to non-null loggerLevel should require redeployment");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should detect config changes")
  void testHasSourceConfigChanged_DifferentConfig_ShouldReturnTrue() {
    IngestionPipeline original = createPipelineWithSourceConfig("table1");
    IngestionPipeline updated = createPipelineWithSourceConfig("table2");

    boolean hasChanged = repository.hasSourceConfigChanged(original, updated);

    assertTrue(hasChanged, "Different sourceConfig should indicate a change");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should NOT detect change when config is same")
  void testHasSourceConfigChanged_SameConfig_ShouldReturnFalse() {
    IngestionPipeline original = createPipelineWithSourceConfig("table1");
    IngestionPipeline updated = createPipelineWithSourceConfig("table1");

    boolean hasChanged = repository.hasSourceConfigChanged(original, updated);

    assertFalse(hasChanged, "Same sourceConfig should not indicate a change");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should handle both null configs")
  void testHasSourceConfigChanged_BothNull_ShouldReturnFalse() {
    IngestionPipeline original = new IngestionPipeline();
    original.setSourceConfig(null);
    IngestionPipeline updated = new IngestionPipeline();
    updated.setSourceConfig(null);

    boolean hasChanged = repository.hasSourceConfigChanged(original, updated);

    assertFalse(hasChanged, "Both null sourceConfigs should not indicate a change");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should handle one null config")
  void testHasSourceConfigChanged_OneNull_ShouldReturnTrue() {
    IngestionPipeline original = new IngestionPipeline();
    original.setSourceConfig(null);
    IngestionPipeline updated = createPipelineWithSourceConfig("table1");

    boolean hasChanged = repository.hasSourceConfigChanged(original, updated);

    assertTrue(hasChanged, "Null to non-null sourceConfig should indicate a change");
  }

  @Test
  @DisplayName(
      "buildIngestionPipelineDecrypted with null service should produce decrypted pipeline without service")
  void testBuildIngestionPipelineDecrypted_NullServicePreserved() {
    IngestionPipeline pipeline = createBasicPipeline();
    pipeline.setService(null);

    IngestionPipeline decrypted =
        IngestionPipelineRepository.buildIngestionPipelineDecrypted(pipeline);

    assertNull(
        decrypted.getService(),
        "Decrypted pipeline should have null service when original has null service."
            + " This happens when the pipeline is loaded via findByName (service is a relationship"
            + " field stripped before DB storage). deployPipelineBeforeUpdate must restore it.");
  }

  @Test
  @DisplayName("buildIngestionPipelineDecrypted with service set should preserve it")
  void testBuildIngestionPipelineDecrypted_ServicePreserved() {
    UUID serviceId = UUID.randomUUID();
    EntityReference serviceRef = new EntityReference();
    serviceRef.setId(serviceId);
    serviceRef.setName("OpenMetadata");
    serviceRef.setType("metadataService");

    IngestionPipeline pipeline = createBasicPipeline();
    pipeline.setService(serviceRef);

    IngestionPipeline decrypted =
        IngestionPipelineRepository.buildIngestionPipelineDecrypted(pipeline);

    assertNotNull(decrypted.getService());
    assertEquals("OpenMetadata", decrypted.getService().getName());
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("invalidSourceConfigs")
  void validateSourceConfigHasTypeRejectsInvalidConfig(
      String testCase, IngestionPipeline pipeline, String expectedMessage) {
    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () -> IngestionPipelineRepository.validateSourceConfigHasType(pipeline));

    assertEquals(expectedMessage, exception.getMessage());
  }

  @Test
  void validateSourceConfigHasTypeAcceptsRawConfigWithType() {
    IngestionPipeline pipeline = pipelineWithConfig(Map.of("type", "DatabaseMetadata"));

    assertDoesNotThrow(() -> IngestionPipelineRepository.validateSourceConfigHasType(pipeline));
  }

  @Test
  void validateSourceConfigHasTypeAcceptsTypedConfigWithDefaultType() {
    IngestionPipeline pipeline = pipelineWithConfig(new DatabaseServiceMetadataPipeline());

    assertDoesNotThrow(() -> IngestionPipelineRepository.validateSourceConfigHasType(pipeline));
  }

  private static Stream<Arguments> invalidSourceConfigs() {
    Map<String, Object> nullType = new HashMap<>();
    nullType.put("type", null);

    return Stream.of(
        Arguments.of(
            "missing sourceConfig",
            new IngestionPipeline(),
            "sourceConfig.config.type is required"),
        Arguments.of(
            "missing config",
            new IngestionPipeline().withSourceConfig(new SourceConfig()),
            "sourceConfig.config.type is required"),
        Arguments.of(
            "empty config", pipelineWithConfig(Map.of()), "sourceConfig.config.type is required"),
        Arguments.of(
            "null type", pipelineWithConfig(nullType), "sourceConfig.config.type is required"),
        Arguments.of(
            "empty type",
            pipelineWithConfig(Map.of("type", "")),
            "sourceConfig.config.type is required"),
        Arguments.of(
            "blank type",
            pipelineWithConfig(Map.of("type", "   ")),
            "sourceConfig.config.type is required"),
        Arguments.of(
            "non-string type",
            pipelineWithConfig(Map.of("type", 42)),
            "sourceConfig.config.type is required"),
        Arguments.of(
            "raw-map enum type",
            pipelineWithConfig(
                Map.of(
                    "type",
                    DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA)),
            "sourceConfig.config.type is required"),
        Arguments.of(
            "scalar config",
            pipelineWithConfig("DatabaseMetadata"),
            "sourceConfig.config must be an object with type"),
        Arguments.of(
            "list config",
            pipelineWithConfig(List.of()),
            "sourceConfig.config must be an object with type"));
  }

  private static IngestionPipeline createPipelineWithSchedule(String schedule) {
    IngestionPipeline pipeline = createBasicPipeline();
    AirflowConfig airflowConfig = new AirflowConfig();
    airflowConfig.setScheduleInterval(schedule);
    pipeline.setAirflowConfig(airflowConfig);
    return pipeline;
  }

  private static IngestionPipeline createPipelineWithSourceConfig(String schemaFilterPattern) {
    IngestionPipeline pipeline = createBasicPipeline();
    SourceConfig sourceConfig = new SourceConfig();
    DatabaseServiceMetadataPipeline metadataConfig = new DatabaseServiceMetadataPipeline();
    metadataConfig.setSchemaFilterPattern(
        new org.openmetadata.schema.metadataIngestion.FilterPattern()
            .withIncludes(java.util.List.of(schemaFilterPattern)));
    sourceConfig.setConfig(metadataConfig);
    pipeline.setSourceConfig(sourceConfig);
    return pipeline;
  }

  @Test
  @DisplayName("closeStream is a no-op when log storage is not configured")
  void testCloseStream_LogStorageNotConfigured_NoOp() {
    IngestionPipelineRepository repo = mock(IngestionPipelineRepository.class);
    when(repo.isLogStorageEnabled()).thenReturn(false);
    doCallRealMethod()
        .when(repo)
        .closeStream(
            org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(UUID.class));

    assertDoesNotThrow(() -> repo.closeStream("test-service.test-pipeline", UUID.randomUUID()));
  }

  private static IngestionPipeline createBasicPipeline() {
    IngestionPipeline pipeline = new IngestionPipeline();
    pipeline.setName("test-pipeline");
    pipeline.setFullyQualifiedName("test-service.test-pipeline");

    EntityReference serviceRef = new EntityReference();
    serviceRef.setName("test-service");
    pipeline.setService(serviceRef);

    return pipeline;
  }

  private static IngestionPipeline legacyPipeline(PipelineType pipelineType, String serviceType) {
    return legacyPipelineWithConfig(
        new HashMap<>(Map.of("existingSetting", "preserved")), pipelineType, serviceType);
  }

  private static IngestionPipeline legacyPipelineWithConfig(
      Object config, PipelineType pipelineType, String serviceType) {
    IngestionPipeline pipeline = pipelineWithConfig(config);
    pipeline.setId(UUID.randomUUID());
    pipeline.setName("legacy-pipeline");
    pipeline.setPipelineType(pipelineType);
    pipeline.setService(new EntityReference().withName("legacy-service").withType(serviceType));
    return pipeline;
  }

  private static Map<?, ?> sourceConfigMap(IngestionPipeline pipeline) {
    return (Map<?, ?>) pipeline.getSourceConfig().getConfig();
  }

  private static IngestionPipeline pipelineWithConfig(Object config) {
    return new IngestionPipeline().withSourceConfig(new SourceConfig().withConfig(config));
  }
}
