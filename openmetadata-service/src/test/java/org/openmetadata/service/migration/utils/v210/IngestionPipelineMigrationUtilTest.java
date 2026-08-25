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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.RepairOutcome.NOT_NEEDED;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.RepairOutcome.REPAIRED;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.RepairOutcome.UNRESOLVED;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
  }

  @Test
  void repairSourceConfigTypeLeavesMalformedConfigUnresolved() {
    ObjectNode pipeline = JsonUtils.getObjectNode();
    pipeline.put("pipelineType", PipelineType.METADATA.value());
    pipeline.put("sourceConfig", "not-an-object");

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, result.outcome());
  }

  @Test
  void repairSourceConfigTypeLeavesNonStringExplicitTypeUnresolved() {
    ObjectNode sourceConfig = JsonUtils.getObjectNode();
    sourceConfig.put("type", 42);
    ObjectNode pipeline = pipeline(PipelineType.METADATA, sourceConfig);

    IngestionPipelineMigrationUtil.RepairResult result =
        IngestionPipelineMigrationUtil.repairSourceConfigType(pipeline, Entity.DATABASE_SERVICE);

    assertEquals(UNRESOLVED, result.outcome());
    assertEquals(42, config(pipeline).path("type").asInt());
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
    assertEquals(pipeline.path("id").asText(), result.unresolvedPipelines().getFirst().id());
    assertEquals(
        "no active supported service relationship",
        result.unresolvedPipelines().getFirst().reason());
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
        result.unresolvedPipelines().getFirst().reason());
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
    pipeline.put("id", UUID.randomUUID().toString());
    pipeline.put("name", "legacyPipeline");
    pipeline.put("fullyQualifiedName", "service.legacyPipeline");
    pipeline.put("pipelineType", pipelineType.value());
    pipeline.putObject("sourceConfig").set("config", config);
    return pipeline;
  }

  private static CollectionDAO.EntityRelationshipObject relationship(
      String pipelineId, String serviceType) {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(UUID.randomUUID().toString())
        .toId(pipelineId)
        .fromEntity(serviceType)
        .toEntity(Entity.INGESTION_PIPELINE)
        .relation(Relationship.CONTAINS.ordinal())
        .build();
  }

  private static ObjectNode config(ObjectNode pipeline) {
    return (ObjectNode) pipeline.path("sourceConfig").path("config");
  }
}
