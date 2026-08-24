package org.openmetadata.service.migration.utils.v201;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

@Slf4j
public final class MigrationUtil {
  private static final int BATCH_SIZE = 1_000;
  private static final String SOURCE_CONFIG_TYPE = "type";
  private static final String REVERSE_INGESTION_OPERATIONS = "operations";
  private static final String REVERSE_INGESTION_CONFIG_TYPE = "ReverseIngestion";

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

  private MigrationUtil() {}

  public record MigrationResult(int scanned, int repaired, int unresolved) {}

  enum RepairOutcome {
    NOT_NEEDED,
    REPAIRED,
    UNRESOLVED
  }

  public static MigrationResult backfillSourceConfigTypes(CollectionDAO collectionDAO) {
    CollectionDAO.IngestionPipelineDAO pipelineDAO = collectionDAO.ingestionPipelineDAO();
    ListFilter filter = new ListFilter(Include.ALL);
    String afterName = "";
    String afterId = "";
    int scanned = 0;
    int repaired = 0;
    int unresolved = 0;

    while (true) {
      List<String> pipelineJson = pipelineDAO.listAfter(filter, BATCH_SIZE, afterName, afterId);
      if (pipelineJson.isEmpty()) {
        break;
      }

      List<ObjectNode> pipelines = new ArrayList<>(pipelineJson.size());
      List<String> pipelineIds = new ArrayList<>(pipelineJson.size());
      for (String json : pipelineJson) {
        ObjectNode pipeline = (ObjectNode) JsonUtils.readTree(json);
        pipelines.add(pipeline);
        pipelineIds.add(pipeline.path("id").asText());
        afterName = pipeline.path("name").asText();
        afterId = pipeline.path("id").asText();
      }

      Map<String, String> serviceTypes = getServiceTypes(collectionDAO, pipelineIds);
      for (ObjectNode pipeline : pipelines) {
        scanned++;
        String id = pipeline.path("id").asText();
        RepairOutcome outcome = repairSourceConfigType(pipeline, serviceTypes.get(id));
        if (outcome == RepairOutcome.REPAIRED) {
          pipelineDAO.update(
              UUID.fromString(id),
              pipeline.path("fullyQualifiedName").asText(),
              pipeline.toString());
          repaired++;
        } else if (outcome == RepairOutcome.UNRESOLVED) {
          unresolved++;
        }
      }
    }

    LOG.info(
        "Ingestion pipeline source config migration completed: scanned={}, repaired={}, unresolved={}",
        scanned,
        repaired,
        unresolved);
    return new MigrationResult(scanned, repaired, unresolved);
  }

  private static Map<String, String> getServiceTypes(
      CollectionDAO collectionDAO, List<String> pipelineIds) {
    Map<String, String> serviceTypes = new HashMap<>();
    collectionDAO
        .relationshipDAO()
        .findFromBatch(pipelineIds, Relationship.CONTAINS.ordinal(), Include.ALL)
        .forEach(record -> serviceTypes.put(record.getToId(), record.getFromEntity()));
    return serviceTypes;
  }

  static RepairOutcome repairSourceConfigType(ObjectNode pipeline, String serviceType) {
    RepairOutcome outcome = RepairOutcome.UNRESOLVED;
    JsonNode sourceConfig = pipeline.get("sourceConfig");
    if (sourceConfig instanceof ObjectNode sourceConfigObject
        && sourceConfigObject.get("config") instanceof ObjectNode configObject) {
      JsonNode existingType = configObject.get(SOURCE_CONFIG_TYPE);
      if (isMissingOrBlank(existingType)) {
        String sourceConfigType = getSourceConfigType(pipeline, configObject, serviceType);
        if (sourceConfigType != null) {
          configObject.put(SOURCE_CONFIG_TYPE, sourceConfigType);
          outcome = RepairOutcome.REPAIRED;
        }
      } else if (existingType.isTextual()) {
        outcome = RepairOutcome.NOT_NEEDED;
      }
    }
    return outcome;
  }

  private static boolean isMissingOrBlank(JsonNode type) {
    return type == null || type.isNull() || type.isTextual() && type.asText().isBlank();
  }

  private static String getSourceConfigType(
      ObjectNode pipeline, ObjectNode config, String serviceType) {
    String sourceConfigType;
    if (config.has(REVERSE_INGESTION_OPERATIONS)) {
      sourceConfigType = REVERSE_INGESTION_CONFIG_TYPE;
    } else {
      PipelineType pipelineType = getPipelineType(pipeline);
      Map<PipelineType, String> serviceConfigTypes = SOURCE_CONFIG_TYPES.get(serviceType);
      sourceConfigType =
          serviceConfigTypes == null || pipelineType == null
              ? null
              : serviceConfigTypes.get(pipelineType);
      if (sourceConfigType == null && pipelineType != null) {
        sourceConfigType = SOURCE_CONFIG_TYPES_BY_PIPELINE.get(pipelineType);
      }
    }
    return sourceConfigType;
  }

  private static PipelineType getPipelineType(ObjectNode pipeline) {
    PipelineType pipelineType = null;
    try {
      pipelineType = PipelineType.fromValue(pipeline.path("pipelineType").asText());
    } catch (IllegalArgumentException ignored) {
      LOG.debug("Unable to infer source config type for pipeline with invalid pipelineType");
    }
    return pipelineType;
  }
}
