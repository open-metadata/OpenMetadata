package org.openmetadata.service.migration.utils.v1126;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  private record ServiceEdge(UUID fromId, String fromType, UUID toId, String toType) {}

  private static final Set<String> SERVICE_ENTITY_TYPES =
      Set.of(
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.METADATA_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.API_SERVICE,
          Entity.DRIVE_SERVICE);

  public static void migratePipelineServiceEdges(CollectionDAO collectionDAO) {
    LOG.info("Starting migration: creating pipeline service edges for existing lineage data");

    Map<ServiceEdge, LineageDetails> edgesToCreate = new LinkedHashMap<>();

    int batchSize = 500;
    long offset = 0;
    List<CollectionDAO.EntityRelationshipObject> batch;

    do {
      batch =
          collectionDAO
              .relationshipDAO()
              .getRecordWithOffset(Relationship.UPSTREAM.ordinal(), offset, batchSize);
      for (CollectionDAO.EntityRelationshipObject record : batch) {
        if (SERVICE_ENTITY_TYPES.contains(record.getFromEntity())) {
          continue; // Skip service-level edges; we need data-asset-level edges
        }
        String json = record.getJson();
        if (json == null || !json.contains("\"pipeline\"")) {
          continue;
        }
        collectPipelineServiceEdges(record, edgesToCreate);
      }
      offset += batchSize;
    } while (batch.size() == batchSize);

    int created = 0;
    for (Map.Entry<ServiceEdge, LineageDetails> entry : edgesToCreate.entrySet()) {
      try {
        if (insertEdgeIfMissing(collectionDAO, entry.getKey(), entry.getValue())) {
          created++;
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to insert pipeline service edge {} -> {}: {}",
            entry.getKey().fromId(),
            entry.getKey().toId(),
            e.getMessage());
      }
    }

    LOG.info("Pipeline service edges migration complete: {} edges created", created);
  }

  private static void collectPipelineServiceEdges(
      CollectionDAO.EntityRelationshipObject record,
      Map<ServiceEdge, LineageDetails> edgesToCreate) {

    try {
      LineageDetails details = JsonUtils.readValue(record.getJson(), LineageDetails.class);
      EntityReference pipelineRef = details.getPipeline();
      if (pipelineRef == null || pipelineRef.getId() == null) {
        return;
      }

      EntityInterface fromEntity =
          Entity.getEntity(
              record.getFromEntity(), UUID.fromString(record.getFromId()), "service", Include.ALL);
      EntityInterface toEntity =
          Entity.getEntity(
              record.getToEntity(), UUID.fromString(record.getToId()), "service", Include.ALL);
      EntityInterface pipelineEntity =
          Entity.getEntity(pipelineRef.getType(), pipelineRef.getId(), "service", Include.ALL);

      EntityReference fromService = fromEntity.getService();
      EntityReference toService = toEntity.getService();
      EntityReference pipelineService = pipelineEntity.getService();

      if (fromService == null || toService == null || pipelineService == null) {
        return;
      }

      putEdgeIfDistinct(
          edgesToCreate,
          fromService.getId(),
          fromService.getType(),
          pipelineService.getId(),
          pipelineService.getType(),
          details);
      putEdgeIfDistinct(
          edgesToCreate,
          pipelineService.getId(),
          pipelineService.getType(),
          toService.getId(),
          toService.getType(),
          details);

    } catch (Exception e) {
      LOG.warn(
          "Skipping lineage edge {} -> {}: {}",
          record.getFromId(),
          record.getToId(),
          e.getMessage());
    }
  }

  private static void putEdgeIfDistinct(
      Map<ServiceEdge, LineageDetails> edgesToCreate,
      UUID fromId,
      String fromType,
      UUID toId,
      String toType,
      LineageDetails sourceDetails) {

    if (fromId.equals(toId)) {
      return;
    }
    ServiceEdge key = new ServiceEdge(fromId, fromType, toId, toType);
    edgesToCreate.putIfAbsent(key, buildServiceLineageDetails(sourceDetails));
  }

  private static LineageDetails buildServiceLineageDetails(LineageDetails source) {
    return new LineageDetails()
        .withCreatedAt(source.getCreatedAt())
        .withCreatedBy(source.getCreatedBy())
        .withUpdatedAt(source.getUpdatedAt())
        .withUpdatedBy(source.getUpdatedBy())
        .withSource(LineageDetails.Source.CHILD_ASSETS)
        .withPipeline(null)
        .withAssetEdges(1);
  }

  private static boolean insertEdgeIfMissing(
      CollectionDAO collectionDAO, ServiceEdge edge, LineageDetails details) {

    CollectionDAO.EntityRelationshipObject existing =
        collectionDAO
            .relationshipDAO()
            .getRecord(edge.fromId(), edge.toId(), Relationship.UPSTREAM.ordinal());
    if (existing != null) {
      return false;
    }

    collectionDAO
        .relationshipDAO()
        .insert(
            edge.fromId(),
            edge.toId(),
            edge.fromType(),
            edge.toType(),
            Relationship.UPSTREAM.ordinal(),
            JsonUtils.pojoToJson(details));
    return true;
  }
}
