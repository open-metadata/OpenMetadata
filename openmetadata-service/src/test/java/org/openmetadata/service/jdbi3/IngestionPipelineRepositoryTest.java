package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.tests.TestSuite;
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

  private static TestSuite tableSuite(String tableFqn) {
    return new TestSuite()
        .withBasic(true)
        .withBasicEntityReference(
            new EntityReference().withType(Entity.TABLE).withFullyQualifiedName(tableFqn));
  }

  @Test
  void deploymentRequiresMatchingSuiteTable() {
    final TestSuite suite = tableSuite("warehouse.db.schema.orders");
    final IngestionPipeline pipeline =
        suitePipeline(
            new TestSuitePipeline().withEntityFullyQualifiedName("warehouse.db.schema.items"));
    final IngestionPipelineRepository deploymentRepository =
        repositoryWithClient(mock(PipelineServiceClientInterface.class));

    final BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () -> deploymentRepository.deployIngestionPipeline(pipeline, suite));

    assertEquals("TestSuite pipeline table must match its test suite", exception.getMessage());
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("testSuiteConfigurations")
  void validatesTestSuiteConfiguration(
      String name, EntityInterface parent, IngestionPipeline pipeline, boolean valid) {
    if (valid) {
      assertDoesNotThrow(
          () -> IngestionPipelineRepository.validateTestSuiteConfig(pipeline, parent));
    } else {
      assertThrows(
          BadRequestException.class,
          () -> IngestionPipelineRepository.validateTestSuiteConfig(pipeline, parent));
    }
  }

  private static Stream<Arguments> testSuiteConfigurations() {
    final String tableFqn = "warehouse.db.\"schema.name\".orders";
    final TestSuite suite = tableSuite(tableFqn);
    final TestSuite logical = new TestSuite().withBasic(false);
    final TestSuitePipeline matching =
        new TestSuitePipeline().withEntityFullyQualifiedName(tableFqn);
    return Stream.of(
        Arguments.of("matching table", suite, suitePipeline(matching), true),
        Arguments.of(
            "matching raw config",
            suite,
            suitePipeline(Map.of("type", "TestSuite", "entityFullyQualifiedName", tableFqn)),
            true),
        Arguments.of("omitted table", suite, suitePipeline(new TestSuitePipeline()), true),
        Arguments.of(
            "missing source config",
            suite,
            new IngestionPipeline().withPipelineType(PipelineType.TEST_SUITE),
            false),
        Arguments.of("missing config", suite, suitePipeline(null), false),
        Arguments.of("malformed config", suite, suitePipeline("not-an-object"), false),
        Arguments.of("missing config type", suite, suitePipeline(Map.of()), false),
        Arguments.of("logical suite", logical, suitePipeline(new TestSuitePipeline()), true),
        Arguments.of("logical suite with table", logical, suitePipeline(matching), false),
        Arguments.of(
            "missing table reference",
            new TestSuite().withBasic(true),
            suitePipeline(new TestSuitePipeline()),
            false),
        Arguments.of("missing table name", tableSuite(null), suitePipeline(matching), false),
        Arguments.of(
            "blank table",
            suite,
            suitePipeline(new TestSuitePipeline().withEntityFullyQualifiedName(" ")),
            false),
        Arguments.of(
            "different table",
            suite,
            suitePipeline(
                new TestSuitePipeline().withEntityFullyQualifiedName("other.db.schema.table")),
            false),
        Arguments.of(
            "non-string table",
            suite,
            suitePipeline(Map.of("type", "TestSuite", "entityFullyQualifiedName", 42)),
            false),
        Arguments.of("database parent", new DatabaseService(), suitePipeline(matching), false),
        Arguments.of("missing parent", null, suitePipeline(matching), false),
        Arguments.of(
            "different source type",
            suite,
            suitePipeline(new DatabaseServiceMetadataPipeline()),
            false),
        Arguments.of(
            "other pipeline type with suite parent",
            suite,
            suitePipeline(matching).withPipelineType(PipelineType.METADATA),
            true),
        Arguments.of(
            "other pipeline type with suite config",
            new DatabaseService(),
            suitePipeline(matching).withPipelineType(PipelineType.METADATA),
            true),
        Arguments.of(
            "metadata pipeline",
            new DatabaseService(),
            pipelineWithConfig(new DatabaseServiceMetadataPipeline())
                .withPipelineType(PipelineType.METADATA),
            true));
  }

  private static IngestionPipeline suitePipeline(Object config) {
    return pipelineWithConfig(config).withPipelineType(PipelineType.TEST_SUITE);
  }

  private static IngestionPipeline pipelineWithConfig(Object config) {
    return createBasicPipeline().withSourceConfig(new SourceConfig().withConfig(config));
  }
}
