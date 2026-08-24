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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

/** Repairs legacy ingestion pipeline source configurations before strict type validation. */
@Slf4j
public final class IngestionPipelineMigrationUtil {
  private static final int BATCH_SIZE = 1_000;
  private static final String SOURCE_CONFIG_TYPE = "type";
  private static final String REVERSE_INGESTION_OPERATIONS = "operations";
  private static final String REVERSE_INGESTION_CONFIG_TYPE = "ReverseIngestion";
  private static final String MISSING_SERVICE_RELATIONSHIP =
      "no active supported service relationship";
  private static final String INVALID_SOURCE_CONFIG = "sourceConfig.config is not an object";
  private static final String INVALID_SOURCE_CONFIG_TYPE =
      "sourceConfig.config.type must be a non-blank string";

  private static final Map<String, Map<PipelineType, String>> SOURCE_CONFIG_TYPES =
      Map.ofEntries(
          Map.entry(
              Entity.DATABASE_SERVICE,
              Map.of(
                  PipelineType.METADATA, "DatabaseMetadata",
                  PipelineType.USAGE, "DatabaseUsage",
                  PipelineType.LINEAGE, "DatabaseLineage",
                  PipelineType.PROFILER, "Profiler",
                  PipelineType.AUTO_CLASSIFICATION, "AutoClassification")),
          Map.entry(
              Entity.DASHBOARD_SERVICE,
              Map.of(
                  PipelineType.METADATA, "DashboardMetadata",
                  PipelineType.LINEAGE, "DashboardMetadata")),
          Map.entry(
              Entity.MESSAGING_SERVICE,
              Map.of(
                  PipelineType.METADATA, "MessagingMetadata",
                  PipelineType.AUTO_CLASSIFICATION, "AutoClassification")),
          Map.entry(Entity.PIPELINE_SERVICE, Map.of(PipelineType.METADATA, "PipelineMetadata")),
          Map.entry(Entity.MLMODEL_SERVICE, Map.of(PipelineType.METADATA, "MlModelMetadata")),
          Map.entry(
              Entity.STORAGE_SERVICE,
              Map.of(
                  PipelineType.METADATA, "StorageMetadata",
                  PipelineType.AUTO_CLASSIFICATION, "AutoClassification")),
          Map.entry(Entity.DRIVE_SERVICE, Map.of(PipelineType.METADATA, "DriveMetadata")),
          Map.entry(Entity.SEARCH_SERVICE, Map.of(PipelineType.METADATA, "SearchMetadata")),
          Map.entry(Entity.API_SERVICE, Map.of(PipelineType.METADATA, "ApiMetadata")),
          Map.entry(Entity.MCP_SERVICE, Map.of(PipelineType.METADATA, "McpMetadata")),
          Map.entry(Entity.SECURITY_SERVICE, Map.of(PipelineType.METADATA, "SecurityMetadata")),
          Map.entry(Entity.METADATA_SERVICE, Map.of(PipelineType.METADATA, "DatabaseMetadata")));

  private static final Map<PipelineType, String> SOURCE_CONFIG_TYPES_BY_PIPELINE =
      Map.of(
          PipelineType.DBT, "DBT",
          PipelineType.TEST_SUITE, "TestSuite",
          PipelineType.DATA_INSIGHT, "dataInsight",
          PipelineType.ELASTIC_SEARCH_REINDEX, "MetadataToElasticSearch",
          PipelineType.APPLICATION, "Application",
          PipelineType.POLICY_AGENT, "PolicyAgent");

  private IngestionPipelineMigrationUtil() {}

  public record MigrationResult(
      int scanned, int repaired, List<UnresolvedPipeline> unresolvedPipelines) {
    public MigrationResult {
      unresolvedPipelines = List.copyOf(unresolvedPipelines);
    }

    public int unresolved() {
      return unresolvedPipelines.size();
    }
  }

  public record UnresolvedPipeline(String id, String fullyQualifiedName, String reason) {}

  enum RepairOutcome {
    NOT_NEEDED,
    REPAIRED,
    UNRESOLVED
  }

  record RepairResult(RepairOutcome outcome, String reason) {
    private static RepairResult notNeeded() {
      return new RepairResult(RepairOutcome.NOT_NEEDED, null);
    }

    private static RepairResult repaired() {
      return new RepairResult(RepairOutcome.REPAIRED, null);
    }

    private static RepairResult unresolved(String reason) {
      return new RepairResult(RepairOutcome.UNRESOLVED, reason);
    }
  }

  record ServiceTypeResolution(String serviceType, String reason) {
    private static ServiceTypeResolution resolved(String serviceType) {
      return new ServiceTypeResolution(serviceType, null);
    }

    private static ServiceTypeResolution missing() {
      return new ServiceTypeResolution(null, MISSING_SERVICE_RELATIONSHIP);
    }

    private static ServiceTypeResolution ambiguous(Set<String> serviceTypes) {
      return new ServiceTypeResolution(
          null, "multiple active supported service types: " + String.join(", ", serviceTypes));
    }

    boolean isResolved() {
      return serviceType != null;
    }
  }

  private record Cursor(String name, String id) {
    private static Cursor initial() {
      return new Cursor("", "");
    }
  }

  private record PipelineBatch(List<ObjectNode> pipelines, Cursor nextCursor) {
    private boolean isEmpty() {
      return pipelines.isEmpty();
    }
  }

  private static final class MigrationSummary {
    private int scanned;
    private int repaired;
    private final List<UnresolvedPipeline> unresolvedPipelines = new ArrayList<>();

    private void record(ObjectNode pipeline, RepairResult result) {
      scanned++;
      if (result.outcome() == RepairOutcome.REPAIRED) {
        repaired++;
      } else if (result.outcome() == RepairOutcome.UNRESOLVED) {
        unresolvedPipelines.add(
            new UnresolvedPipeline(
                pipelineId(pipeline),
                pipeline.path("fullyQualifiedName").asText(),
                result.reason()));
      }
    }

    private MigrationResult toResult() {
      return new MigrationResult(scanned, repaired, unresolvedPipelines);
    }
  }

  public static MigrationResult backfillSourceConfigTypes(CollectionDAO collectionDAO) {
    CollectionDAO.IngestionPipelineDAO pipelineDAO = collectionDAO.ingestionPipelineDAO();
    MigrationSummary summary = new MigrationSummary();
    PipelineBatch batch = getNextBatch(pipelineDAO, Cursor.initial());
    while (!batch.isEmpty()) {
      repairBatch(collectionDAO, pipelineDAO, batch.pipelines(), summary);
      batch = getNextBatch(pipelineDAO, batch.nextCursor());
    }
    MigrationResult result = summary.toResult();
    logMigrationResult(result);
    return result;
  }

  private static PipelineBatch getNextBatch(
      CollectionDAO.IngestionPipelineDAO pipelineDAO, Cursor cursor) {
    List<String> pipelineJson =
        pipelineDAO.listAfter(
            new ListFilter(Include.NON_DELETED), BATCH_SIZE, cursor.name(), cursor.id());
    List<ObjectNode> pipelines =
        pipelineJson.stream().map(IngestionPipelineMigrationUtil::toPipeline).toList();
    return new PipelineBatch(pipelines, getNextCursor(pipelines, cursor));
  }

  private static ObjectNode toPipeline(String pipelineJson) {
    return (ObjectNode) JsonUtils.readTree(pipelineJson);
  }

  private static Cursor getNextCursor(List<ObjectNode> pipelines, Cursor currentCursor) {
    if (pipelines.isEmpty()) {
      return currentCursor;
    }
    ObjectNode lastPipeline = pipelines.getLast();
    return new Cursor(lastPipeline.path("name").asText(), pipelineId(lastPipeline));
  }

  private static void repairBatch(
      CollectionDAO collectionDAO,
      CollectionDAO.IngestionPipelineDAO pipelineDAO,
      List<ObjectNode> pipelines,
      MigrationSummary summary) {
    Map<String, ServiceTypeResolution> serviceTypes =
        getServiceTypeResolutions(collectionDAO, pipelineIds(pipelines));
    for (ObjectNode pipeline : pipelines) {
      summary.record(pipeline, repairPipeline(pipelineDAO, pipeline, serviceTypes));
    }
  }

  private static RepairResult repairPipeline(
      CollectionDAO.IngestionPipelineDAO pipelineDAO,
      ObjectNode pipeline,
      Map<String, ServiceTypeResolution> serviceTypes) {
    ServiceTypeResolution resolution =
        serviceTypes.getOrDefault(pipelineId(pipeline), ServiceTypeResolution.missing());
    RepairResult result = repairSourceConfigType(pipeline, resolution);
    if (result.outcome() == RepairOutcome.REPAIRED) {
      pipelineDAO.update(
          UUID.fromString(pipelineId(pipeline)),
          pipeline.path("fullyQualifiedName").asText(),
          pipeline.toString());
    }
    return result;
  }

  private static List<String> pipelineIds(List<ObjectNode> pipelines) {
    return pipelines.stream().map(IngestionPipelineMigrationUtil::pipelineId).toList();
  }

  private static String pipelineId(ObjectNode pipeline) {
    return pipeline.path("id").asText();
  }

  static Map<String, ServiceTypeResolution> getServiceTypeResolutions(
      CollectionDAO collectionDAO, List<String> pipelineIds) {
    List<CollectionDAO.EntityRelationshipObject> relationships =
        collectionDAO
            .relationshipDAO()
            .findFromBatch(pipelineIds, Relationship.CONTAINS.ordinal(), Include.NON_DELETED);
    return resolveServiceTypeResolutions(relationships);
  }

  static Map<String, ServiceTypeResolution> resolveServiceTypeResolutions(
      List<CollectionDAO.EntityRelationshipObject> relationships) {
    Map<String, Set<String>> serviceTypesByPipeline = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject relationship : relationships) {
      addServiceType(serviceTypesByPipeline, relationship);
    }
    Map<String, ServiceTypeResolution> resolutions = new HashMap<>();
    serviceTypesByPipeline.forEach(
        (pipelineId, serviceTypes) ->
            resolutions.put(pipelineId, resolveServiceTypes(serviceTypes)));
    return resolutions;
  }

  private static void addServiceType(
      Map<String, Set<String>> serviceTypesByPipeline,
      CollectionDAO.EntityRelationshipObject relationship) {
    if (isActiveServiceRelationship(relationship)) {
      serviceTypesByPipeline
          .computeIfAbsent(relationship.getToId(), ignored -> new TreeSet<>())
          .add(relationship.getFromEntity());
    }
  }

  private static boolean isActiveServiceRelationship(
      CollectionDAO.EntityRelationshipObject relationship) {
    return Entity.INGESTION_PIPELINE.equals(relationship.getToEntity())
        && SOURCE_CONFIG_TYPES.containsKey(relationship.getFromEntity());
  }

  private static ServiceTypeResolution resolveServiceTypes(Set<String> serviceTypes) {
    if (serviceTypes.size() == 1) {
      return ServiceTypeResolution.resolved(serviceTypes.iterator().next());
    }
    return ServiceTypeResolution.ambiguous(serviceTypes);
  }

  static RepairResult repairSourceConfigType(ObjectNode pipeline, String serviceType) {
    return repairSourceConfigType(pipeline, ServiceTypeResolution.resolved(serviceType));
  }

  private static RepairResult repairSourceConfigType(
      ObjectNode pipeline, ServiceTypeResolution serviceType) {
    ObjectNode config = getSourceConfig(pipeline);
    if (config == null) {
      return RepairResult.unresolved(INVALID_SOURCE_CONFIG);
    }
    JsonNode existingType = config.get(SOURCE_CONFIG_TYPE);
    if (hasExplicitType(existingType)) {
      return RepairResult.notNeeded();
    }
    if (!isMissingOrBlank(existingType)) {
      return RepairResult.unresolved(INVALID_SOURCE_CONFIG_TYPE);
    }
    String sourceConfigType = getSourceConfigType(pipeline, config, serviceType.serviceType());
    if (sourceConfigType == null) {
      return RepairResult.unresolved(getUnresolvedReason(pipeline, serviceType));
    }
    config.put(SOURCE_CONFIG_TYPE, sourceConfigType);
    return RepairResult.repaired();
  }

  private static ObjectNode getSourceConfig(ObjectNode pipeline) {
    JsonNode sourceConfig = pipeline.get("sourceConfig");
    if (sourceConfig instanceof ObjectNode sourceConfigObject
        && sourceConfigObject.get("config") instanceof ObjectNode configObject) {
      return configObject;
    }
    return null;
  }

  private static boolean hasExplicitType(JsonNode type) {
    return type != null && type.isTextual() && !type.asText().isBlank();
  }

  private static boolean isMissingOrBlank(JsonNode type) {
    return type == null || type.isNull() || type.isTextual() && type.asText().isBlank();
  }

  private static String getSourceConfigType(
      ObjectNode pipeline, ObjectNode config, String serviceType) {
    if (config.has(REVERSE_INGESTION_OPERATIONS)) {
      return REVERSE_INGESTION_CONFIG_TYPE;
    }
    PipelineType pipelineType = getPipelineType(pipeline);
    if (pipelineType == null) {
      return null;
    }
    Map<PipelineType, String> serviceConfigTypes =
        serviceType == null ? null : SOURCE_CONFIG_TYPES.get(serviceType);
    String sourceConfigType =
        serviceConfigTypes == null ? null : serviceConfigTypes.get(pipelineType);
    return sourceConfigType == null
        ? SOURCE_CONFIG_TYPES_BY_PIPELINE.get(pipelineType)
        : sourceConfigType;
  }

  private static String getUnresolvedReason(
      ObjectNode pipeline, ServiceTypeResolution serviceType) {
    PipelineType pipelineType = getPipelineType(pipeline);
    if (pipelineType == null) {
      return "invalid pipelineType '" + pipeline.path("pipelineType").asText() + "'";
    }
    if (!serviceType.isResolved()) {
      return serviceType.reason();
    }
    return "unsupported pipelineType '"
        + pipelineType.value()
        + "' for service type '"
        + serviceType.serviceType()
        + "'";
  }

  private static PipelineType getPipelineType(ObjectNode pipeline) {
    try {
      return PipelineType.fromValue(pipeline.path("pipelineType").asText());
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  private static void logMigrationResult(MigrationResult result) {
    LOG.info(
        "Ingestion pipeline source config migration completed: scanned={}, repaired={}, unresolved={}",
        result.scanned(),
        result.repaired(),
        result.unresolved());
    result
        .unresolvedPipelines()
        .forEach(
            pipeline ->
                LOG.warn(
                    "Unable to repair ingestion pipeline source config: id={}, fqn={}, reason={}",
                    pipeline.id(),
                    pipeline.fullyQualifiedName(),
                    pipeline.reason()));
  }
}
