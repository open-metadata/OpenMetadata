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

import java.util.HashMap;
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
 * annotated; a service pair that also carries plain, un-annotated lineage must keep its direct edge.
 * The old code incremented {@code assetEdges} on the direct edge for every contributing child edge —
 * annotated or not — so the surviving count is {@code assetEdges - annotatedChildEdges}. Where that
 * reaches zero the edge existed solely because of the bug and is deleted; otherwise the refcount is
 * corrected so later deletions retire the edge at the right time.
 *
 * <p>Operators must reindex afterwards: the lineage graph is served from the search index, which is
 * rebuilt from these rows.
 */
@Slf4j
public class ServiceLineagePipelineRoutingMigration {

  private ServiceLineagePipelineRoutingMigration() {}

  private static final int BATCH_SIZE = 500;
  private static final String SERVICE_FIELD = "service";

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

  public static void removeServiceEdgesBypassingPipeline(CollectionDAO collectionDAO) {
    LOG.info("Starting migration: removing service lineage edges that bypass the pipeline service");

    Map<ServicePair, Integer> annotatedChildEdges = countPipelineAnnotatedChildEdges(collectionDAO);
    if (annotatedChildEdges.isEmpty()) {
      LOG.info("No pipeline-annotated lineage found, nothing to repair");
      return;
    }

    int deleted = 0;
    int recounted = 0;
    for (Map.Entry<ServicePair, Integer> entry : annotatedChildEdges.entrySet()) {
      try {
        Outcome outcome = repairDirectEdge(collectionDAO, entry.getKey(), entry.getValue());
        deleted += outcome == Outcome.DELETED ? 1 : 0;
        recounted += outcome == Outcome.RECOUNTED ? 1 : 0;
      } catch (Exception e) {
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
  }

  /**
   * Counts, per service pair, the pipeline-annotated child edges that wrongly contributed to a
   * direct service edge. Keyed by the <em>data</em> services so it lines up with the direct edge the
   * old code created, not with the pipeline hops.
   */
  private static Map<ServicePair, Integer> countPipelineAnnotatedChildEdges(
      CollectionDAO collectionDAO) {
    Map<ServicePair, Integer> counts = new HashMap<>();
    long offset = 0;
    List<CollectionDAO.EntityRelationshipObject> batch;

    do {
      batch =
          collectionDAO
              .relationshipDAO()
              .getRecordWithOffset(Relationship.UPSTREAM.ordinal(), offset, BATCH_SIZE);
      for (CollectionDAO.EntityRelationshipObject record : batch) {
        ServicePair pair = annotatedServicePair(record);
        if (pair != null) {
          counts.merge(pair, 1, Integer::sum);
        }
      }
      offset += BATCH_SIZE;
    } while (batch.size() == BATCH_SIZE);

    return counts;
  }

  private static ServicePair annotatedServicePair(CollectionDAO.EntityRelationshipObject record) {
    if (SERVICE_ENTITY_TYPES.contains(record.getFromEntity())
        || SERVICE_ENTITY_TYPES.contains(record.getToEntity())) {
      return null;
    }
    String json = record.getJson();
    if (json == null || !json.contains("\"pipeline\"")) {
      return null;
    }
    try {
      LineageDetails details = JsonUtils.readValue(json, LineageDetails.class);
      if (details.getPipeline() == null || details.getPipeline().getId() == null) {
        return null;
      }
      EntityReference fromService = serviceOf(record.getFromEntity(), record.getFromId());
      EntityReference toService = serviceOf(record.getToEntity(), record.getToId());
      if (fromService == null
          || toService == null
          || fromService.getId().equals(toService.getId())) {
        return null;
      }
      return new ServicePair(fromService.getId(), toService.getId());
    } catch (Exception e) {
      LOG.warn(
          "Skipping lineage edge {} -> {}: {}",
          record.getFromId(),
          record.getToId(),
          e.getMessage());
      return null;
    }
  }

  private static EntityReference serviceOf(String entityType, String entityId) {
    if (!Entity.entityHasField(entityType, SERVICE_FIELD)) {
      return null;
    }
    EntityInterface entity =
        Entity.getEntity(entityType, UUID.fromString(entityId), SERVICE_FIELD, Include.ALL);
    return entity.getService();
  }

  private enum Outcome {
    DELETED,
    RECOUNTED,
    UNCHANGED
  }

  private static Outcome repairDirectEdge(
      CollectionDAO collectionDAO, ServicePair pair, int annotatedCount) {
    CollectionDAO.EntityRelationshipObject direct =
        collectionDAO
            .relationshipDAO()
            .getRecord(pair.fromId(), pair.toId(), Relationship.UPSTREAM.ordinal());
    if (direct == null || involvesPipelineService(direct)) {
      return Outcome.UNCHANGED;
    }

    LineageDetails details = JsonUtils.readValue(direct.getJson(), LineageDetails.class);
    int remaining = nullSafeAssetEdges(details) - annotatedCount;

    if (remaining > 0) {
      details.withAssetEdges(remaining);
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
