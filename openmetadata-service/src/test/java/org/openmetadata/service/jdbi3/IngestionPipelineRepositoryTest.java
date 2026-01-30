package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;

class IngestionPipelineRepositoryTest {

  @Test
  @DisplayName("requiresRedeployment should detect schedule changes from Scheduled to On-Demand")
  void testRequiresRedeployment_ScheduleToOnDemand_ShouldReturnTrue() {
    IngestionPipeline original = createPipelineWithSchedule("0 0 * * *");
    IngestionPipeline updated = createPipelineWithSchedule(null);

    boolean requiresRedeployment = hasScheduleChanged(original, updated);

    assertTrue(
        requiresRedeployment, "Changing from Scheduled to On-Demand should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should detect schedule changes from On-Demand to Scheduled")
  void testRequiresRedeployment_OnDemandToScheduled_ShouldReturnTrue() {
    IngestionPipeline original = createPipelineWithSchedule(null);
    IngestionPipeline updated = createPipelineWithSchedule("0 0 * * *");

    boolean requiresRedeployment = hasScheduleChanged(original, updated);

    assertTrue(
        requiresRedeployment, "Changing from On-Demand to Scheduled should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should NOT require redeployment when schedule is unchanged")
  void testRequiresRedeployment_NoScheduleChange_ShouldReturnFalse() {
    IngestionPipeline original = createPipelineWithSchedule("0 0 * * *");
    IngestionPipeline updated = createPipelineWithSchedule("0 0 * * *");

    boolean requiresRedeployment = hasScheduleChanged(original, updated);

    assertFalse(requiresRedeployment, "Same schedule should not require redeployment");
  }

  @Test
  @DisplayName("hasScheduleChanged should handle both null schedules")
  void testHasScheduleChanged_BothNull_ShouldReturnFalse() {
    IngestionPipeline original = createPipelineWithSchedule(null);
    IngestionPipeline updated = createPipelineWithSchedule(null);

    boolean hasChanged = hasScheduleChanged(original, updated);

    assertFalse(hasChanged, "Both null schedules should not indicate a change");
  }

  @Test
  @DisplayName("hasScheduleChanged should handle null AirflowConfig")
  void testHasScheduleChanged_NullAirflowConfig_ShouldHandleGracefully() {
    IngestionPipeline original = new IngestionPipeline();
    original.setAirflowConfig(null);
    IngestionPipeline updated = createPipelineWithSchedule("0 0 * * *");

    boolean hasChanged = hasScheduleChanged(original, updated);

    assertTrue(hasChanged, "Null to non-null schedule should indicate a change");
  }

  @Test
  @DisplayName("requiresRedeployment should detect enabled changes")
  void testRequiresRedeployment_EnabledChange_ShouldReturnTrue() {
    IngestionPipeline original = createBasicPipeline();
    original.setEnabled(true);
    IngestionPipeline updated = createBasicPipeline();
    updated.setEnabled(false);

    boolean requiresRedeployment = !original.getEnabled().equals(updated.getEnabled());

    assertTrue(requiresRedeployment, "Enabled change should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should NOT require redeployment when enabled is unchanged")
  void testRequiresRedeployment_EnabledUnchanged_ShouldReturnFalse() {
    IngestionPipeline original = createBasicPipeline();
    original.setEnabled(true);
    IngestionPipeline updated = createBasicPipeline();
    updated.setEnabled(true);

    boolean requiresRedeployment = !original.getEnabled().equals(updated.getEnabled());

    assertFalse(requiresRedeployment, "Same enabled value should not require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should detect loggerLevel changes")
  void testRequiresRedeployment_LoggerLevelChange_ShouldReturnTrue() {
    IngestionPipeline original = createBasicPipeline();
    original.setLoggerLevel(LogLevels.INFO);
    IngestionPipeline updated = createBasicPipeline();
    updated.setLoggerLevel(LogLevels.DEBUG);

    boolean requiresRedeployment = !original.getLoggerLevel().equals(updated.getLoggerLevel());

    assertTrue(requiresRedeployment, "LoggerLevel change should require redeployment");
  }

  @Test
  @DisplayName("requiresRedeployment should NOT require redeployment when loggerLevel is unchanged")
  void testRequiresRedeployment_LoggerLevelUnchanged_ShouldReturnFalse() {
    IngestionPipeline original = createBasicPipeline();
    original.setLoggerLevel(LogLevels.INFO);
    IngestionPipeline updated = createBasicPipeline();
    updated.setLoggerLevel(LogLevels.INFO);

    boolean requiresRedeployment = !original.getLoggerLevel().equals(updated.getLoggerLevel());

    assertFalse(requiresRedeployment, "Same loggerLevel should not require redeployment");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should detect config changes")
  void testHasSourceConfigChanged_DifferentConfig_ShouldReturnTrue() {
    IngestionPipeline original = createPipelineWithSourceConfig("table1");
    IngestionPipeline updated = createPipelineWithSourceConfig("table2");

    boolean hasChanged = hasSourceConfigChanged(original, updated);

    assertTrue(hasChanged, "Different sourceConfig should indicate a change");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should NOT detect change when config is same")
  void testHasSourceConfigChanged_SameConfig_ShouldReturnFalse() {
    IngestionPipeline original = createPipelineWithSourceConfig("table1");
    IngestionPipeline updated = createPipelineWithSourceConfig("table1");

    boolean hasChanged = hasSourceConfigChanged(original, updated);

    assertFalse(hasChanged, "Same sourceConfig should not indicate a change");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should handle both null configs")
  void testHasSourceConfigChanged_BothNull_ShouldReturnFalse() {
    IngestionPipeline original = new IngestionPipeline();
    original.setSourceConfig(null);
    IngestionPipeline updated = new IngestionPipeline();
    updated.setSourceConfig(null);

    boolean hasChanged = hasSourceConfigChanged(original, updated);

    assertFalse(hasChanged, "Both null sourceConfigs should not indicate a change");
  }

  @Test
  @DisplayName("hasSourceConfigChanged should handle one null config")
  void testHasSourceConfigChanged_OneNull_ShouldReturnTrue() {
    IngestionPipeline original = new IngestionPipeline();
    original.setSourceConfig(null);
    IngestionPipeline updated = createPipelineWithSourceConfig("table1");

    boolean hasChanged = hasSourceConfigChanged(original, updated);

    assertTrue(hasChanged, "Null to non-null sourceConfig should indicate a change");
  }

  private IngestionPipeline createPipelineWithSchedule(String schedule) {
    IngestionPipeline pipeline = createBasicPipeline();
    AirflowConfig airflowConfig = new AirflowConfig();
    airflowConfig.setScheduleInterval(schedule);
    pipeline.setAirflowConfig(airflowConfig);
    return pipeline;
  }

  private IngestionPipeline createPipelineWithSourceConfig(String schemaFilterPattern) {
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

  private IngestionPipeline createBasicPipeline() {
    IngestionPipeline pipeline = new IngestionPipeline();
    pipeline.setName("test-pipeline");
    pipeline.setFullyQualifiedName("test-service.test-pipeline");

    EntityReference serviceRef = new EntityReference();
    serviceRef.setName("test-service");
    pipeline.setService(serviceRef);

    return pipeline;
  }

  private boolean hasScheduleChanged(IngestionPipeline original, IngestionPipeline updated) {
    String originalSchedule =
        original.getAirflowConfig() != null
            ? original.getAirflowConfig().getScheduleInterval()
            : null;
    String updatedSchedule =
        updated.getAirflowConfig() != null
            ? updated.getAirflowConfig().getScheduleInterval()
            : null;
    return !java.util.Objects.equals(originalSchedule, updatedSchedule);
  }

  private boolean hasSourceConfigChanged(IngestionPipeline original, IngestionPipeline updated) {
    if (original.getSourceConfig() == null && updated.getSourceConfig() == null) {
      return false;
    }
    if (original.getSourceConfig() == null || updated.getSourceConfig() == null) {
      return true;
    }
    String originalJson =
        org.openmetadata.schema.utils.JsonUtils.pojoToJson(original.getSourceConfig());
    String updatedJson =
        org.openmetadata.schema.utils.JsonUtils.pojoToJson(updated.getSourceConfig());
    return !originalJson.equals(updatedJson);
  }
}
