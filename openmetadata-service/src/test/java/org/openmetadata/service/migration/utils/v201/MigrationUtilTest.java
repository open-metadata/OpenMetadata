package org.openmetadata.service.migration.utils.v201;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.openmetadata.service.migration.utils.v201.MigrationUtil.RepairOutcome.NOT_NEEDED;
import static org.openmetadata.service.migration.utils.v201.MigrationUtil.RepairOutcome.REPAIRED;
import static org.openmetadata.service.migration.utils.v201.MigrationUtil.RepairOutcome.UNRESOLVED;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class MigrationUtilTest {

  @ParameterizedTest(name = "{0}")
  @MethodSource("sourceConfigTypes")
  void repairSourceConfigTypeAddsExpectedType(
      String testCase, PipelineType pipelineType, String serviceType, String expectedType) {
    ObjectNode pipeline = pipeline(pipelineType, JsonUtils.getObjectNode());

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, serviceType);

    assertEquals(REPAIRED, outcome);
    assertEquals(expectedType, config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypeRecognizesReverseIngestionOperations() {
    ObjectNode sourceConfig = JsonUtils.getObjectNode();
    sourceConfig.putArray("operations");
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(REPAIRED, outcome);
    assertEquals("ReverseIngestion", config(pipeline).path("type").asText());
  }

  @ParameterizedTest
  @MethodSource("missingSourceConfigTypes")
  void repairSourceConfigTypeRepairsNullAndBlankTypes(ObjectNode sourceConfig) {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(REPAIRED, outcome);
    assertEquals("DatabaseMetadata", config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypePreservesExplicitType() {
    ObjectNode sourceConfig = JsonUtils.getObjectNode();
    sourceConfig.put("type", "DatabaseMetadata");
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(NOT_NEEDED, outcome);
    assertEquals("DatabaseMetadata", config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypeIsIdempotentAfterRepair() {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());

    assertEquals(REPAIRED, MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE));
    assertEquals(
        NOT_NEEDED, MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE));
    assertEquals("DatabaseMetadata", config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypeLeavesUnknownMappingUnresolved() {
    ObjectNode pipeline = pipeline(PipelineType.USAGE, JsonUtils.getObjectNode());

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, Entity.DASHBOARD_SERVICE);

    assertEquals(UNRESOLVED, outcome);
    assertFalse(config(pipeline).has("type"));
  }

  @Test
  void repairSourceConfigTypeLeavesMalformedConfigUnresolved() {
    ObjectNode pipeline = JsonUtils.getObjectNode();
    pipeline.put("pipelineType", PipelineType.METADATA.value());
    pipeline.put("sourceConfig", "not-an-object");

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, outcome);
  }

  @Test
  void repairSourceConfigTypeLeavesNonStringExplicitTypeUnresolved() {
    ObjectNode sourceConfig = JsonUtils.getObjectNode();
    sourceConfig.put("type", 42);
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    MigrationUtil.RepairOutcome outcome =
        MigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, outcome);
    assertEquals(42, config(pipeline).path("type").asInt());
  }

  private static Stream<Arguments> sourceConfigTypes() {
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

  private static Stream<ObjectNode> missingSourceConfigTypes() {
    ObjectNode nullType = JsonUtils.getObjectNode();
    nullType.putNull("type");
    ObjectNode blankType = JsonUtils.getObjectNode();
    blankType.put("type", "   ");
    return Stream.of(nullType, blankType);
  }

  private static ObjectNode pipeline(PipelineType pipelineType, ObjectNode config) {
    ObjectNode pipeline = JsonUtils.getObjectNode();
    pipeline.put("pipelineType", pipelineType.value());
    pipeline.putObject("sourceConfig").set("config", config);
    return pipeline;
  }

  private static ObjectNode config(ObjectNode pipeline) {
    return (ObjectNode) pipeline.path("sourceConfig").path("config");
  }
}
