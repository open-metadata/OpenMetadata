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

package org.openmetadata.service.migration.utils.v203;

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
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Repairs service-level lineage that routes through a pipeline service.
 *
 * <p>Until this release, a pipeline-annotated entity edge produced <em>three</em> service-level
 * edges: {@code fromService → pipelineService}, {@code pipelineService → toService} <em>and</em> a
 * direct {@code fromService → toService}. The service graph therefore drew two parallel paths for
 * one flow of data. {@code LineageRepository.addServiceLineage} now treats the two shapes as
 * mutually exclusive, but existing rows keep the redundant direct edge until it is removed here.
 *
 * <p>A direct edge is only redundant when <em>every</em> child edge behind it is pipeline
 * annotated; a service pair that also carries plain, un-annotated lineage must keep its direct edge
 * with a refcount covering just those plain edges. Both counts are recomputed from the child edges
 * themselves rather than derived from the stored {@code assetEdges}, so the repair is a fixed point:
 * a second run reads the same child rows, arrives at the same target, and changes nothing. Deriving
 * the target by subtracting from the stored count would instead delete a legitimate direct edge on
 * the second pass.
 *
 * <p>Operators must reindex afterwards: the lineage graph is served from the search index, which is
 * rebuilt from these rows.
 */
@Slf4j
public class ServiceLineagePipelineRoutingMigration {

  private ServiceLineagePipelineRoutingMigration() {}

  private static final int BATCH_SIZE = 500;
  private static final String SERVICE_FIELD = "service";

  /**
   * Lineage concentrates on far fewer entities than the catalog holds, so a modest cap keeps the
   * repeated endpoint lookups cheap without letting the scan's memory grow with the table.
   */
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

  private record ServicePair(UUID fromId, UUID toId) {}

  /** Child edges behind one service pair, split by whether they route through a pipeline. */
  private static final class ChildEdgeCounts {
    private int annotated;
    private int plain;
  }

  enum Outcome {
    DELETED,
    RECOUNTED,
    UNCHANGED
  }

  public static void removeServiceEdgesBypassingPipeline(CollectionDAO collectionDAO) {
    LOG.info("Starting migration: removing service lineage edges that bypass the pipeline service");

    Map<ServicePair, ChildEdgeCounts> counts = countChildEdgesByServicePair(collectionDAO);
    int deleted = 0;
    int recounted = 0;
    int failed = 0;

    for (Map.Entry<ServicePair, ChildEdgeCounts> entry : counts.entrySet()) {
      if (entry.getValue().annotated == 0) {
        continue;
      }
      try {
        Outcome outcome = repairDirectEdge(collectionDAO, entry.getKey(), entry.getValue().plain);
        deleted += outcome == Outcome.DELETED ? 1 : 0;
        recounted += outcome == Outcome.RECOUNTED ? 1 : 0;
      } catch (Exception e) {
        failed++;
        LOG.warn(
            "Failed to repair service edge {} -> {}: {}",
            entry.getKey().fromId(),
            entry.getKey().toId(),
            e.getMessage());
      }
    }

    LOG.info(
        "Service lineage repair complete: {} redundant direct edges deleted, {} refcounts corrected."
            + " Run an Elasticsearch/OpenSearch reindex so the lineage graph reflects these rows.",
        deleted,
        recounted);
    if (failed > 0) {
      LOG.warn(
          "{} service pairs could not be repaired and still carry a redundant direct edge or a stale"
              + " refcount. This migration is safe to re-run (via openmetadata-ops.sh migrate) once"
              + " the cause above is resolved.",
          failed);
    }
  }

  /**
   * Buckets every entity-level lineage edge under the service pair it contributes to. Keyset
   * pagination keeps the scan linear; an OFFSET walk re-traverses the skipped prefix on every page
   * and degrades badly on large lineage tables.
   */
  private static Map<ServicePair, ChildEdgeCounts> countChildEdgesByServicePair(
      CollectionDAO collectionDAO) {
    Map<ServicePair, ChildEdgeCounts> counts = new HashMap<>();
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
        return counts;
      }
      for (CollectionDAO.EntityRelationshipObject record : batch) {
        tally(record, serviceCache, counts);
      }
      CollectionDAO.EntityRelationshipObject last = batch.getLast();
      fromId = last.getFromId();
      toId = last.getToId();
      relation = last.getRelation();
      relationType = last.getRelationType() == null ? "" : last.getRelationType();
    }
  }

  private static void tally(
      CollectionDAO.EntityRelationshipObject record,
      Cache<String, Optional<EntityReference>> serviceCache,
      Map<ServicePair, ChildEdgeCounts> counts) {
    if (record.getRelation() != Relationship.UPSTREAM.ordinal()
        || SERVICE_ENTITY_TYPES.contains(record.getFromEntity())
        || SERVICE_ENTITY_TYPES.contains(record.getToEntity())) {
      return;
    }
    try {
      EntityReference fromService =
          serviceOf(record.getFromEntity(), record.getFromId(), serviceCache);
      EntityReference toService = serviceOf(record.getToEntity(), record.getToId(), serviceCache);
      if (fromService == null
          || toService == null
          || fromService.getId().equals(toService.getId())) {
        return;
      }
      ChildEdgeCounts pairCounts =
          counts.computeIfAbsent(
              new ServicePair(fromService.getId(), toService.getId()), k -> new ChildEdgeCounts());
      if (isPipelineAnnotated(record.getJson())) {
        pairCounts.annotated++;
      } else {
        pairCounts.plain++;
      }
    } catch (Exception e) {
      LOG.warn(
          "Skipping lineage edge {} -> {}: {}",
          record.getFromId(),
          record.getToId(),
          e.getMessage());
    }
  }

  private static boolean isPipelineAnnotated(String json) {
    if (json == null || !json.contains("\"pipeline\"")) {
      return false;
    }
    LineageDetails details = JsonUtils.readValue(json, LineageDetails.class);
    return details.getPipeline() != null && details.getPipeline().getId() != null;
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
              EntityInterface entity =
                  Entity.getEntity(entityType, UUID.fromString(id), SERVICE_FIELD, Include.ALL);
              return Optional.ofNullable(entity.getService());
            })
        .orElse(null);
  }

  private static Outcome repairDirectEdge(
      CollectionDAO collectionDAO, ServicePair pair, int plainChildEdges) {
    CollectionDAO.EntityRelationshipObject direct =
        collectionDAO
            .relationshipDAO()
            .getRecord(pair.fromId(), pair.toId(), Relationship.UPSTREAM.ordinal());
    if (direct == null || involvesPipelineService(direct)) {
      return Outcome.UNCHANGED;
    }

    LineageDetails details = JsonUtils.readValue(direct.getJson(), LineageDetails.class);
    if (plainChildEdges == 0) {
      collectionDAO
          .relationshipDAO()
          .delete(
              pair.fromId(),
              direct.getFromEntity(),
              pair.toId(),
              direct.getToEntity(),
              Relationship.UPSTREAM.ordinal());
      return Outcome.DELETED;
    }
    if (nullSafeAssetEdges(details) == plainChildEdges) {
      return Outcome.UNCHANGED;
    }

    details.withAssetEdges(plainChildEdges);
    collectionDAO
        .relationshipDAO()
        .insert(
            pair.fromId(),
            pair.toId(),
            direct.getFromEntity(),
            direct.getToEntity(),
            Relationship.UPSTREAM.ordinal(),
            JsonUtils.pojoToJson(details));
    return Outcome.RECOUNTED;
  }

  /**
   * Both pipeline hops have a pipelineService endpoint, so a pair that has one is ambiguous: the
   * stored row may be a hop rather than the redundant direct edge, and its refcount was built from a
   * different set of child edges. Such pairs are left untouched — the duplicated-path symptom is
   * between two data services.
   */
  private static boolean involvesPipelineService(CollectionDAO.EntityRelationshipObject direct) {
    return Entity.PIPELINE_SERVICE.equals(direct.getFromEntity())
        || Entity.PIPELINE_SERVICE.equals(direct.getToEntity());
  }

  private static int nullSafeAssetEdges(LineageDetails details) {
    return details.getAssetEdges() == null ? 0 : details.getAssetEdges();
  }
}
