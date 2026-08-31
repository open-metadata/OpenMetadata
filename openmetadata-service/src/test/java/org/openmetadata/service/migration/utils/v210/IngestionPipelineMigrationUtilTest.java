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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.RepairOutcome.NOT_NEEDED;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.RepairOutcome.REPAIRED;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.RepairOutcome.UNRESOLVED;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class IngestionPipelineMigrationUtilTest {

  @ParameterizedTest(name = "{0}")
  @MethodSource("sourceConfigTypes")
  void repairSourceConfigTypeAddsExpectedType(
      String testCase, PipelineType pipelineType, String serviceType, String expectedType) {
    ObjectNode pipeline = pipeline(pipelineType, JsonUtils.getObjectNode());

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, serviceType);

    assertEquals(REPAIRED, result.outcome());
    assertEquals(expectedType, config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypeRecognizesReverseIngestionOperations() {
    ObjectNode sourceConfig = JsonUtils.getObjectNode();
    sourceConfig.putArray("operations");
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(REPAIRED, result.outcome());
    assertEquals("ReverseIngestion", config(pipeline).path("type").asText());
  }

  @ParameterizedTest
  @MethodSource("missingSourceConfigTypes")
  void repairSourceConfigTypeRepairsNullAndBlankTypes(ObjectNode sourceConfig) {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(REPAIRED, result.outcome());
    assertEquals("DatabaseMetadata", config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypePreservesExplicitType() {
    ObjectNode sourceConfig = JsonUtils.getObjectNode();
    sourceConfig.put("type", "DatabaseMetadata");
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(NOT_NEEDED, result.outcome());
    assertEquals("DatabaseMetadata", config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypeIsIdempotentAfterRepair() {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());

    assertEquals(
        REPAIRED,
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE)
            .outcome());
    assertEquals(
        NOT_NEEDED,
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE)
            .outcome());
    assertEquals("DatabaseMetadata", config(pipeline).path("type").asText());
  }

  @Test
  void repairSourceConfigTypeLeavesUnknownMappingUnresolved() {
    ObjectNode pipeline = pipeline(PipelineType.USAGE, JsonUtils.getObjectNode());

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DASHBOARD_SERVICE);

    assertEquals(UNRESOLVED, result.outcome());
    assertFalse(config(pipeline).has("type"));
    assertEquals(
        "unsupported pipelineType 'usage' for service type 'dashboardService'", result.reason());
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("malformedSourceConfigPipelines")
  void repairSourceConfigTypeLeavesEveryMalformedSourceConfigShapeUnresolved(
      String testCase, ObjectNode pipeline) {

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, result.outcome());
    assertEquals("sourceConfig.config is not an object", result.reason());
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("nonStringSourceConfigTypes")
  void repairSourceConfigTypeLeavesNonStringExplicitTypesUnresolved(
      String testCase, ObjectNode sourceConfig) {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, result.outcome());
    assertEquals("sourceConfig.config.type must be a non-blank string", result.reason());
    assertFalse(config(pipeline).path("type").isTextual());
  }

  @Test
  void repairSourceConfigTypeReportsInvalidPipelineType() {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    pipeline.put("pipelineType", "invalid-pipeline-type");

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, result.outcome());
    assertEquals("invalid pipelineType 'invalid-pipeline-type'", result.reason());
  }

  @Test
  void getServiceTypeResolutionsUsesOnlyNonDeletedSupportedRelationships() {
    String pipelineId = UUID.randomUUID().toString();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findFromBatch(
            List.of(pipelineId), Relationship.CONTAINS.ordinal(), Include.NON_DELETED))
        .thenReturn(
            List.of(
                relationship(pipelineId, Entity.DATABASE_SERVICE),
                relationship(pipelineId, Entity.USER)));

    Map<String, IngestionPipelineMigrationUtil.ServiceTypeResolution> resolutions =
        IngestionPipelineMigrationUtil.getServiceTypeResolutions(
            collectionDAO, List.of(pipelineId));

    assertEquals(Entity.DATABASE_SERVICE, resolutions.get(pipelineId).serviceType());
    verify(relationshipDAO)
        .findFromBatch(List.of(pipelineId), Relationship.CONTAINS.ordinal(), Include.NON_DELETED);
  }

  @Test
  void resolveServiceTypeResolutionsIsOrderIndependentForAmbiguousServices() {
    String pipelineId = UUID.randomUUID().toString();
    CollectionDAO.EntityRelationshipObject database =
        relationship(pipelineId, Entity.DATABASE_SERVICE);
    CollectionDAO.EntityRelationshipObject dashboard =
        relationship(pipelineId, Entity.DASHBOARD_SERVICE);

    var first =
        IngestionPipelineMigrationUtil.resolveServiceTypeResolutions(List.of(database, dashboard));
    var second =
        IngestionPipelineMigrationUtil.resolveServiceTypeResolutions(List.of(dashboard, database));

    assertFalse(first.get(pipelineId).isResolved());
    assertEquals(first.get(pipelineId).reason(), second.get(pipelineId).reason());
  }

  @Test
  void resolveServiceTypeResolutionsTreatsMultipleSameTypeServicesAsAmbiguous() {
    String pipelineId = UUID.randomUUID().toString();

    var resolutions =
        IngestionPipelineMigrationUtil.resolveServiceTypeResolutions(
            List.of(
                relationship(pipelineId, Entity.DATABASE_SERVICE),
                relationship(pipelineId, Entity.DATABASE_SERVICE)));

    var resolution = resolutions.get(pipelineId);
    assertFalse(resolution.isResolved());
    assertEquals(
        "multiple active supported service relationships: databaseService, databaseService",
        resolution.reason());
  }

  @Test
  void resolveServiceTypeResolutionsDeduplicatesTheSameRelationship() {
    String pipelineId = UUID.randomUUID().toString();
    String serviceId = UUID.randomUUID().toString();
    CollectionDAO.EntityRelationshipObject relationship =
        relationship(pipelineId, Entity.DATABASE_SERVICE, serviceId);

    var resolutions =
        IngestionPipelineMigrationUtil.resolveServiceTypeResolutions(
            List.of(relationship, relationship));

    assertEquals(Entity.DATABASE_SERVICE, resolutions.get(pipelineId).serviceType());
    assertTrue(resolutions.get(pipelineId).isResolved());
  }

  @Test
  void resolveServiceTypeResolutionsIgnoresRelationshipsToOtherEntities() {
    String pipelineId = UUID.randomUUID().toString();
    CollectionDAO.EntityRelationshipObject relationship =
        relationship(
            pipelineId, Entity.DATABASE_SERVICE, UUID.randomUUID().toString(), Entity.USER);

    var resolutions =
        IngestionPipelineMigrationUtil.resolveServiceTypeResolutions(List.of(relationship));

    assertTrue(resolutions.isEmpty());
  }

  @Test
  void backfillReportsPipelineWithoutActiveServiceRelationship() {
    ObjectNode pipeline = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.IngestionPipelineDAO pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1_000), anyString(), anyString()))
        .thenReturn(List.of(pipeline.toString()), List.of());
    when(relationshipDAO.findFromBatch(
            List.of(pipeline.path("id").asText()),
            Relationship.CONTAINS.ordinal(),
            Include.NON_DELETED))
        .thenReturn(List.of());

    IngestionPipelineMigrationUtil.MigrationResult result =
        IngestionPipelineMigrationUtil.backfillSourceConfigTypes(collectionDAO);

    assertEquals(1, result.scanned());
    assertEquals(0, result.repaired());
    assertEquals(1, result.unresolved());
    assertEquals(pipeline.path("id").asText(), result.unresolvedPipelineSamples().getFirst().id());
    assertEquals(
        "no active supported service relationship",
        result.unresolvedPipelineSamples().getFirst().reason());
  }

  @Test
  void backfillKeepsOnlyABoundedSampleOfUnresolvedPipelines() {
    int unresolvedPipelineCount = 101;
    List<String> pipelines =
        IntStream.range(0, unresolvedPipelineCount)
            .mapToObj(
                ignored -> pipeline(PipelineType.METADATA, JsonUtils.getObjectNode()).toString())
            .toList();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.IngestionPipelineDAO pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1_000), anyString(), anyString()))
        .thenReturn(pipelines, List.of());
    when(relationshipDAO.findFromBatch(
            any(), eq(Relationship.CONTAINS.ordinal()), eq(Include.NON_DELETED)))
        .thenReturn(List.of());

    IngestionPipelineMigrationUtil.MigrationResult result =
        IngestionPipelineMigrationUtil.backfillSourceConfigTypes(collectionDAO);

    assertEquals(unresolvedPipelineCount, result.scanned());
    assertEquals(unresolvedPipelineCount, result.unresolved());
    assertEquals(
        IngestionPipelineMigrationUtil.MAX_UNRESOLVED_PIPELINE_SAMPLES,
        result.unresolvedPipelineSamples().size());
  }

  @Test
  void backfillLeavesPipelineOnlyTypeWithoutActiveServiceRelationshipUnresolved() {
    ObjectNode pipeline = pipeline(PipelineType.DBT, JsonUtils.getObjectNode());
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.IngestionPipelineDAO pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1_000), anyString(), anyString()))
        .thenReturn(List.of(pipeline.toString()), List.of());
    when(relationshipDAO.findFromBatch(
            List.of(pipeline.path("id").asText()),
            Relationship.CONTAINS.ordinal(),
            Include.NON_DELETED))
        .thenReturn(List.of());

    IngestionPipelineMigrationUtil.MigrationResult result =
        IngestionPipelineMigrationUtil.backfillSourceConfigTypes(collectionDAO);

    assertEquals(1, result.scanned());
    assertEquals(0, result.repaired());
    assertEquals(1, result.unresolved());
    assertFalse(config(pipeline).has("type"));
    assertEquals(
        "no active supported service relationship",
        result.unresolvedPipelineSamples().getFirst().reason());
  }

  @Test
  void backfillRepairsPipelineOnlyTypeWithActiveServiceRelationship() {
    ObjectNode pipeline = pipeline(PipelineType.DBT, JsonUtils.getObjectNode());
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.IngestionPipelineDAO pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1_000), anyString(), anyString()))
        .thenReturn(List.of(pipeline.toString()), List.of());
    when(relationshipDAO.findFromBatch(
            List.of(pipeline.path("id").asText()),
            Relationship.CONTAINS.ordinal(),
            Include.NON_DELETED))
        .thenReturn(List.of(relationship(pipeline.path("id").asText(), Entity.DATABASE_SERVICE)));

    IngestionPipelineMigrationUtil.MigrationResult result =
        IngestionPipelineMigrationUtil.backfillSourceConfigTypes(collectionDAO);

    assertEquals(1, result.scanned());
    assertEquals(1, result.repaired());
    assertEquals(0, result.unresolved());
    ArgumentCaptor<String> updatedJson = ArgumentCaptor.forClass(String.class);
    verify(pipelineDAO)
        .update(
            eq(UUID.fromString(pipeline.path("id").asText())),
            eq(pipeline.path("fullyQualifiedName").asText()),
            updatedJson.capture());
    ObjectNode updatedPipeline = (ObjectNode) JsonUtils.readTree(updatedJson.getValue());
    assertEquals("DBT", config(updatedPipeline).path("type").asText());
  }

  @Test
  void backfillPaginatesAndWritesOnlyPipelinesThatNeedRepair() {
    ObjectNode repairedPipeline = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    ObjectNode alreadyTypedPipeline = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    config(alreadyTypedPipeline).put("type", "DatabaseMetadata");
    ObjectNode invalidPipelineType = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    invalidPipelineType.put("pipelineType", "not-a-pipeline-type");

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.IngestionPipelineDAO pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1_000), anyString(), anyString()))
        .thenReturn(
            List.of(repairedPipeline.toString(), alreadyTypedPipeline.toString()),
            List.of(invalidPipelineType.toString()),
            List.of());
    when(relationshipDAO.findFromBatch(
            List.of(repairedPipeline.path("id").asText(), alreadyTypedPipeline.path("id").asText()),
            Relationship.CONTAINS.ordinal(),
            Include.NON_DELETED))
        .thenReturn(
            List.of(
                relationship(repairedPipeline.path("id").asText(), Entity.DATABASE_SERVICE),
                relationship(alreadyTypedPipeline.path("id").asText(), Entity.DATABASE_SERVICE)));
    when(relationshipDAO.findFromBatch(
            List.of(invalidPipelineType.path("id").asText()),
            Relationship.CONTAINS.ordinal(),
            Include.NON_DELETED))
        .thenReturn(
            List.of(
                relationship(invalidPipelineType.path("id").asText(), Entity.DATABASE_SERVICE)));

    IngestionPipelineMigrationUtil.MigrationResult result =
        IngestionPipelineMigrationUtil.backfillSourceConfigTypes(collectionDAO);

    assertEquals(3, result.scanned());
    assertEquals(1, result.repaired());
    assertEquals(1, result.unresolved());
    assertEquals(
        "invalid pipelineType 'not-a-pipeline-type'",
        result.unresolvedPipelineSamples().getFirst().reason());
    verify(pipelineDAO).listAfter(any(ListFilter.class), eq(1_000), eq(""), eq(""));
    verify(pipelineDAO)
        .listAfter(
            any(ListFilter.class),
            eq(1_000),
            eq(alreadyTypedPipeline.path("name").asText()),
            eq(alreadyTypedPipeline.path("id").asText()));
    verify(pipelineDAO)
        .listAfter(
            any(ListFilter.class),
            eq(1_000),
            eq(invalidPipelineType.path("name").asText()),
            eq(invalidPipelineType.path("id").asText()));
    ArgumentCaptor<String> updatedJson = ArgumentCaptor.forClass(String.class);
    verify(pipelineDAO, times(1))
        .update(
            eq(UUID.fromString(repairedPipeline.path("id").asText())),
            eq(repairedPipeline.path("fullyQualifiedName").asText()),
            updatedJson.capture());
    verify(pipelineDAO, never())
        .update(
            eq(UUID.fromString(alreadyTypedPipeline.path("id").asText())),
            anyString(),
            anyString());
    ObjectNode updatedPipeline = (ObjectNode) JsonUtils.readTree(updatedJson.getValue());
    assertEquals("DatabaseMetadata", config(updatedPipeline).path("type").asText());
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

  private static Stream<Arguments> malformedSourceConfigPipelines() {
    ObjectNode missingSourceConfig = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    missingSourceConfig.remove("sourceConfig");
    ObjectNode nullSourceConfig = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    nullSourceConfig.putNull("sourceConfig");
    ObjectNode missingConfig = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    ((ObjectNode) missingConfig.get("sourceConfig")).remove("config");
    ObjectNode scalarConfig = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    ((ObjectNode) scalarConfig.get("sourceConfig")).put("config", "not-an-object");
    ObjectNode arrayConfig = pipeline(PipelineType.METADATA, JsonUtils.getObjectNode());
    ((ObjectNode) arrayConfig.get("sourceConfig")).putArray("config");
    return Stream.of(
        Arguments.of("missing sourceConfig", missingSourceConfig),
        Arguments.of("null sourceConfig", nullSourceConfig),
        Arguments.of("missing sourceConfig.config", missingConfig),
        Arguments.of("scalar sourceConfig.config", scalarConfig),
        Arguments.of("array sourceConfig.config", arrayConfig));
  }

  private static Stream<Arguments> nonStringSourceConfigTypes() {
    ObjectNode numericType = JsonUtils.getObjectNode();
    numericType.put("type", 42);
    ObjectNode booleanType = JsonUtils.getObjectNode();
    booleanType.put("type", true);
    ObjectNode arrayType = JsonUtils.getObjectNode();
    arrayType.putArray("type");
    ObjectNode objectType = JsonUtils.getObjectNode();
    objectType.putObject("type");
    return Stream.of(
        Arguments.of("number type", numericType),
        Arguments.of("boolean type", booleanType),
        Arguments.of("array type", arrayType),
        Arguments.of("object type", objectType));
  }

  private static ObjectNode pipeline(PipelineType pipelineType, ObjectNode config) {
    ObjectNode pipeline = JsonUtils.getObjectNode();
    pipeline.put("id", UUID.randomUUID().toString());
    pipeline.put("name", "legacyPipeline");
    pipeline.put("fullyQualifiedName", "service.legacyPipeline");
    pipeline.put("pipelineType", pipelineType.value());
    pipeline.putObject("sourceConfig").set("config", config);
    return pipeline;
  }

  private static CollectionDAO.EntityRelationshipObject relationship(
      String pipelineId, String serviceType) {
    return relationship(pipelineId, serviceType, UUID.randomUUID().toString());
  }

  private static CollectionDAO.EntityRelationshipObject relationship(
      String pipelineId, String serviceType, String serviceId) {
    return relationship(pipelineId, serviceType, serviceId, Entity.INGESTION_PIPELINE);
  }

  private static CollectionDAO.EntityRelationshipObject relationship(
      String pipelineId, String serviceType, String serviceId, String toEntity) {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(serviceId)
        .toId(pipelineId)
        .fromEntity(serviceType)
        .toEntity(toEntity)
        .relation(Relationship.CONTAINS.ordinal())
        .build();
  }

  private static ObjectNode config(ObjectNode pipeline) {
    return (ObjectNode) pipeline.path("sourceConfig").path("config");
  }
}
