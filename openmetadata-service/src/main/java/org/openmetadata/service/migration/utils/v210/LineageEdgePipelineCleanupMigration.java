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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.lineage.LineageEdgePipeline;

/**
 * Clears the {@code pipeline} reference from lineage edges that name something other than a pipeline
 * or a stored procedure.
 *
 * <p>Such an edge used to copy the named entity — a database service and its encrypted connection
 * among them — into the downstream entity's search document, which every user can read
 * (ANT-2026-RL0ZDKB8). New writes have been refused since the fix, but edges written before it keep
 * the reference, so the database-backed lineage reads still return its name and description. This
 * clears it. Each cleared reference is logged so operators can rotate the credentials of any service
 * it named; the copies already in the search index are removed by the post-upgrade reindex, not
 * here.
 *
 * <p>The scan is a keyset walk over the full relationship key, so it holds one batch at a time and a
 * concurrent delete neither skips a row nor re-reads a prefix. The step is idempotent — a second run
 * finds the references already cleared — but it is guarded by {@code runOnce} so a large relationship
 * table is not rescanned on every later 2.1.0 data migration.
 */
@Slf4j
public final class LineageEdgePipelineCleanupMigration {
  public static final String STEP_NAME = "cleanupNonPipelineLineageEdges";
  private static final int BATCH_SIZE = 500;

  private LineageEdgePipelineCleanupMigration() {}

  public static void clearNonPipelineEdgePipelines(CollectionDAO collectionDAO) {
    CollectionDAO.EntityRelationshipDAO relationshipDAO = collectionDAO.relationshipDAO();
    Cursor cursor = Cursor.start();
    int cleared = 0;
    while (true) {
      List<CollectionDAO.EntityRelationshipObject> batch = cursor.read(relationshipDAO);
      if (batch.isEmpty()) {
        break;
      }
      cleared += clearBatch(relationshipDAO, batch);
      cursor = Cursor.after(batch.getLast());
    }
    LOG.info(
        "Lineage edge pipeline cleanup: cleared {} non-pipeline pipeline reference(s)", cleared);
  }

  private static int clearBatch(
      CollectionDAO.EntityRelationshipDAO relationshipDAO,
      List<CollectionDAO.EntityRelationshipObject> batch) {
    int cleared = 0;
    for (CollectionDAO.EntityRelationshipObject row : batch) {
      if (clearEdgeIfNonPipeline(relationshipDAO, row)) {
        cleared++;
      }
    }
    return cleared;
  }

  /** Clears and rewrites the edge when its pipeline is not a pipeline or a stored procedure. */
  private static boolean clearEdgeIfNonPipeline(
      CollectionDAO.EntityRelationshipDAO relationshipDAO,
      CollectionDAO.EntityRelationshipObject row) {
    if (row.getRelation() != Relationship.UPSTREAM.ordinal() || nullOrEmpty(row.getJson())) {
      return false;
    }
    LineageDetails details = JsonUtils.readValue(row.getJson(), LineageDetails.class);
    EntityReference pipeline = details.getPipeline();
    boolean isNonPipeline =
        pipeline != null && !LineageEdgePipeline.isSupportedType(pipeline.getType());
    if (isNonPipeline) {
      logClearedReference(row, pipeline);
      details.setPipeline(null);
      rewriteEdge(relationshipDAO, row, details);
    }
    return isNonPipeline;
  }

  private static void rewriteEdge(
      CollectionDAO.EntityRelationshipDAO relationshipDAO,
      CollectionDAO.EntityRelationshipObject row,
      LineageDetails details) {
    relationshipDAO.insert(
        UUID.fromString(row.getFromId()),
        UUID.fromString(row.getToId()),
        row.getFromEntity(),
        row.getToEntity(),
        Relationship.UPSTREAM.ordinal(),
        JsonUtils.pojoToJson(details));
  }

  private static void logClearedReference(
      CollectionDAO.EntityRelationshipObject row, EntityReference pipeline) {
    LOG.warn(
        "Cleared lineage edge {} -> {}: it named {} '{}' ({}) as its pipeline; rotate that entity's"
            + " credentials if it is a service",
        row.getFromId(),
        row.getToId(),
        pipeline.getType(),
        pipeline.getName(),
        pipeline.getId());
  }

  private record Cursor(String fromId, String toId, int relation, String relationType) {
    private static Cursor start() {
      return new Cursor("", "", -1, "");
    }

    private static Cursor after(CollectionDAO.EntityRelationshipObject row) {
      String relationType = row.getRelationType() == null ? "" : row.getRelationType();
      return new Cursor(row.getFromId(), row.getToId(), row.getRelation(), relationType);
    }

    private List<CollectionDAO.EntityRelationshipObject> read(
        CollectionDAO.EntityRelationshipDAO relationshipDAO) {
      return relationshipDAO.getAllRelationshipsAfter(
          fromId, toId, relation, relationType, BATCH_SIZE);
    }
  }
}
