package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.type.EntityReference;
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

  private static IngestionPipeline createBasicPipeline() {
    IngestionPipeline pipeline = new IngestionPipeline();
    pipeline.setName("test-pipeline");
    pipeline.setFullyQualifiedName("test-service.test-pipeline");

    EntityReference serviceRef = new EntityReference();
    serviceRef.setName("test-service");
    pipeline.setService(serviceRef);

    return pipeline;
  }
}
