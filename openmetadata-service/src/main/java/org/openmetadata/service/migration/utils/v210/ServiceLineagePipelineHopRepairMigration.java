/*
 *  Copyright 2026 Collate
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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Repairs the {@code assetEdges} refcount on pipeline-service hop rows that the v1126/v1131
 * backfill wrote with a hard-coded {@code 1} instead of the count of contributing child-asset edges.
 *
 * <p>The backfill collapses all pipeline-annotated child edges of a service pair onto one
 * {@code ServiceEdge} map key and stores {@code withAssetEdges(1)}, regardless of how many child
 * edges feed the hop. The runtime treats {@code assetEdges} as a live refcount it decrements on
 * every contributing child-edge delete and removes the hop when it drops below 1, so a hop stored
 * with {@code 1} is deleted the first time any one of its N contributors is removed — while the
 * other N-1 children still need it. The v2.0.3 repair migration recomputes direct-edge refcounts
 * from child edges but explicitly skips any pair involving a pipeline service, so these backfilled
 * hops are never repaired.
 *
 * <p>This migration recomputes each hop's {@code assetEdges} from the child edges themselves (a
 * fixed point: a second run reads the same child rows, arrives at the same target, and changes
 * nothing), then upserts the row so already-upgraded instances where the backfill wrote the wrong
 * count are corrected. Hops with no attributable child edges are left untouched — their cleanup is
 * the runtime's job on the next child-edge delete.
 *
 * <p>Operators must reindex afterwards: the lineage graph is served from the search index, which is
 * rebuilt from these rows.
 */
@Slf4j
public class ServiceLineagePipelineHopRepairMigration {

  public static final String STEP_NAME = "repairPipelineServiceHopRefcounts";

  private static final int BATCH_SIZE = 500;
  private static final String SERVICE_FIELD = "service";
  private static final int SERVICE_CACHE_SIZE = 10_000;

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

  private record ServiceEdge(UUID fromId, String fromType, UUID toId, String toType) {}

  private ServiceLineagePipelineHopRepairMigration() {}

  /**
   * Recomputes {@code assetEdges} for every pipeline-service hop from the child edges that feed it,
   * and upserts the row so the runtime refcount matches the number of contributing child edges.
   */
  public static void repairPipelineServiceHopRefcounts(CollectionDAO collectionDAO) {
    LOG.info("Starting migration: repairing pipeline service hop refcounts");

    Map<ServiceEdge, Integer> hopCounts = countHopContributions(collectionDAO);

    int repaired = 0;
    int created = 0;
    int failed = 0;
    for (Map.Entry<ServiceEdge, Integer> entry : hopCounts.entrySet()) {
      if (entry.getValue() <= 0) {
        continue;
      }
      try {
        Outcome outcome = repairHopRow(collectionDAO, entry.getKey(), entry.getValue());
        if (outcome == Outcome.REPAIRED) {
          repaired++;
        } else if (outcome == Outcome.CREATED) {
          created++;
        }
      } catch (Exception e) {
        failed++;
        LOG.warn(
            "Failed to repair pipeline service hop {} -> {}: {}",
            entry.getKey().fromId(),
            entry.getKey().toId(),
            e.getMessage());
      }
    }

    LOG.info(
        "Pipeline service hop repair complete: {} hop refcounts corrected, {} hops created,"
            + " {} failed. Run an Elasticsearch/OpenSearch reindex so the lineage graph reflects"
            + " these rows.",
        repaired,
        created,
        failed);
    if (failed > 0) {
      LOG.warn(
          "{} pipeline service hop(s) could not be repaired and still carry a stale refcount."
              + " This migration is safe to re-run (via openmetadata-ops.sh migrate) once the"
              + " cause above is resolved.",
          failed);
    }
  }

  /**
   * Scans every entity-level lineage edge and tallies, per pipeline-service hop, the child edges
   * that feed it. Keyset pagination keeps the scan linear; an OFFSET walk re-traverses the skipped
   * prefix on every page and degrades badly on large lineage tables.
   */
  private static Map<ServiceEdge, Integer> countHopContributions(CollectionDAO collectionDAO) {
    Map<ServiceEdge, Integer> hopCounts = new HashMap<>();
    Cache<String, Optional<EntityReference>> serviceCache =
        Caffeine.newBuilder().maximumSize(SERVICE_CACHE_SIZE).build();

    String fromId = "";
    String toId = "";
    int relation = -1;
    String relationType = "";

    while (true) {
      List<CollectionDAO.EntityRelationshipObject> batch =
          collectionDAO
              .relationshipDAO()
              .getAllRelationshipsAfter(fromId, toId, relation, relationType, BATCH_SIZE);
      if (batch.isEmpty()) {
        return hopCounts;
      }
      for (CollectionDAO.EntityRelationshipObject record : batch) {
        tally(record, serviceCache, hopCounts);
      }
      CollectionDAO.EntityRelationshipObject last = batch.getLast();
      fromId = last.getFromId();
      toId = last.getToId();
      relation = last.getRelation();
      relationType = last.getRelationType() == null ? "" : last.getRelationType();
    }
  }

  /**
   * If the record is a pipeline-annotated child edge (not a service-to-service row), resolves the
   * service triple it projects onto and increments the two hop counts it feeds.
   */
  private static void tally(
      CollectionDAO.EntityRelationshipObject record,
      Cache<String, Optional<EntityReference>> serviceCache,
      Map<ServiceEdge, Integer> hopCounts) {
    if (record.getRelation() != Relationship.UPSTREAM.ordinal()
        || SERVICE_ENTITY_TYPES.contains(record.getFromEntity())
        || SERVICE_ENTITY_TYPES.contains(record.getToEntity())) {
      return;
    }
    LineageDetails details;
    try {
      details = JsonUtils.readValue(record.getJson(), LineageDetails.class);
    } catch (Exception e) {
      // An unreadable edge cannot be classified, so it is skipped rather than counted as zero
      // (which would let a hop look uncontributed and be deleted while this edge still feeds it).
      LOG.warn(
          "Cannot read lineage edge {} -> {}, skipping its hop contribution: {}",
          record.getFromId(),
          record.getToId(),
          e.getMessage());
      return;
    }
    EntityReference pipelineRef = details.getPipeline();
    if (pipelineRef == null || pipelineRef.getId() == null) {
      return;
    }
    EntityReference fromService =
        serviceOf(record.getFromEntity(), record.getFromId(), serviceCache);
    EntityReference toService = serviceOf(record.getToEntity(), record.getToId(), serviceCache);
    EntityReference pipelineService = resolvePipelineService(pipelineRef, serviceCache);
    if (fromService == null || toService == null || pipelineService == null) {
      return;
    }
    incrementHop(hopCounts, fromService, pipelineService);
    incrementHop(hopCounts, pipelineService, toService);
  }

  private static void incrementHop(
      Map<ServiceEdge, Integer> hopCounts, EntityReference fromService, EntityReference toService) {
    if (fromService.getId().equals(toService.getId())) {
      return;
    }
    ServiceEdge hop =
        new ServiceEdge(
            fromService.getId(), fromService.getType(), toService.getId(), toService.getType());
    hopCounts.merge(hop, 1, Integer::sum);
  }

  /**
   * Resolves the service whose hops an annotated edge feeds, tolerating a pipeline deleted since the
   * edge was written. Hops are keyed by the pipeline's service rather than the pipeline, and the
   * reference stored on the edge still carries the FQN that names that service, so a missing pipeline
   * does not by itself make the service unknowable.
   */
  private static EntityReference resolvePipelineService(
      EntityReference pipelineRef, Cache<String, Optional<EntityReference>> serviceCache) {
    if (!Entity.entityHasField(pipelineRef.getType(), SERVICE_FIELD)) {
      return null;
    }
    try {
      EntityInterface<?> pipelineEntity =
          Entity.getEntity(pipelineRef.getType(), pipelineRef.getId(), SERVICE_FIELD, Include.ALL);
      return pipelineEntity.getService();
    } catch (EntityNotFoundException e) {
      return pipelineServiceFromFqn(pipelineRef);
    }
  }

  private static EntityReference pipelineServiceFromFqn(EntityReference pipelineRef) {
    if (pipelineRef == null || nullOrEmpty(pipelineRef.getFullyQualifiedName())) {
      return null;
    }
    String serviceName = FullyQualifiedName.getRoot(pipelineRef.getFullyQualifiedName());
    if (serviceName == null) {
      return null;
    }
    try {
      return Entity.getEntityReferenceByName(Entity.PIPELINE_SERVICE, serviceName, Include.ALL);
    } catch (EntityNotFoundException e) {
      LOG.debug("Pipeline service {} is gone as well: {}", serviceName, e.getMessage());
      return null;
    }
  }

  private static EntityReference serviceOf(
      String entityType, String entityId, Cache<String, Optional<EntityReference>> serviceCache) {
    if (!Entity.entityHasField(entityType, SERVICE_FIELD)) {
      return null;
    }
    return serviceCache
        .get(
            entityId,
            id -> {
              EntityInterface<?> entity =
                  Entity.getEntity(entityType, UUID.fromString(id), SERVICE_FIELD, Include.ALL);
              return Optional.ofNullable(entity.getService());
            })
        .orElse(null);
  }

  /**
   * Upserts the hop row so its {@code assetEdges} matches the recomputed count. An existing row
   * keeps its audit metadata and only has its refcount corrected; a missing row is created so
   * instances where the backfill was skipped are also covered.
   */
  private static Outcome repairHopRow(
      CollectionDAO collectionDAO, ServiceEdge hop, int childEdgeCount) {
    CollectionDAO.EntityRelationshipObject existing =
        collectionDAO
            .relationshipDAO()
            .getRecord(hop.fromId(), hop.toId(), Relationship.UPSTREAM.ordinal());
    if (existing == null) {
      LineageDetails details =
          new LineageDetails()
              .withCreatedAt(System.currentTimeMillis())
              .withUpdatedAt(System.currentTimeMillis())
              .withSource(LineageDetails.Source.CHILD_ASSETS)
              .withPipeline(null)
              .withAssetEdges(childEdgeCount);
      collectionDAO
          .relationshipDAO()
          .insert(
              hop.fromId(),
              hop.toId(),
              hop.fromType(),
              hop.toType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(details));
      return Outcome.CREATED;
    }
    LineageDetails details = JsonUtils.readValue(existing.getJson(), LineageDetails.class);
    if (nullSafeAssetEdges(details) == childEdgeCount) {
      return Outcome.UNCHANGED;
    }
    details.withAssetEdges(childEdgeCount);
    collectionDAO
        .relationshipDAO()
        .insert(
            hop.fromId(),
            hop.toId(),
            hop.fromType(),
            hop.toType(),
            Relationship.UPSTREAM.ordinal(),
            JsonUtils.pojoToJson(details));
    return Outcome.REPAIRED;
  }

  private static int nullSafeAssetEdges(LineageDetails details) {
    return details.getAssetEdges() == null ? 0 : details.getAssetEdges();
  }

  private static boolean nullOrEmpty(String s) {
    return s == null || s.isEmpty();
  }

  enum Outcome {
    CREATED,
    REPAIRED,
    UNCHANGED
  }
}
