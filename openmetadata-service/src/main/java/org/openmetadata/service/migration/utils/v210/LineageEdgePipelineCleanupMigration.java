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
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
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
 * concurrent delete neither skips a row nor re-reads a prefix. It carries its own SQL so its plan
 * does not change with the shared relationship DAO. Each page must be a range read of the primary
 * key, or every page re-reads the table up to the cursor and the scan grows with the square of the
 * table. Postgres makes that range only from a row comparison, MySQL only from the expanded {@code
 * OR} form, and the page has no other predicate
 * (ADR:2026-11-11-a-composite-keyset-page-is-a-row-comparison-on-postgres-and-an-or-chain-on-mysql),
 * so lineage edges are picked here. The step is idempotent, since
 * a second run finds the references already cleared, but it is guarded by {@code runOnce} so a large
 * relationship table is not rescanned on every later 2.1.0 data migration.
 */
@Slf4j
public final class LineageEdgePipelineCleanupMigration {
  public static final String STEP_NAME = "cleanupNonPipelineLineageEdges";
  private static final int BATCH_SIZE = 500;
  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  private static final String COLUMNS =
      "SELECT fromId, toId, relation, relationType, json FROM entity_relationship WHERE ";
  private static final String PAGE_ORDER =
      " ORDER BY fromId, toId, relation, relationType LIMIT :limit";
  private static final String POSTGRES_PAGE =
      COLUMNS
          + "(fromId, toId, relation, relationType) > (:fromId, :toId, :relation, :relationType)"
          + PAGE_ORDER;
  private static final String MYSQL_PAGE =
      COLUMNS
          + "(fromId > :fromId"
          + " OR (fromId = :fromId AND toId > :toId)"
          + " OR (fromId = :fromId AND toId = :toId AND relation > :relation)"
          + " OR (fromId = :fromId AND toId = :toId AND relation = :relation"
          + " AND relationType > :relationType))"
          + PAGE_ORDER;
  private static final String ROW_KEY =
      " WHERE fromId = :fromId AND toId = :toId AND relation = :relation"
          + " AND relationType = :relationType";
  private static final String POSTGRES_REWRITE =
      "UPDATE entity_relationship SET json = CAST(:json AS jsonb)" + ROW_KEY;
  private static final String MYSQL_REWRITE =
      "UPDATE entity_relationship SET json = :json" + ROW_KEY;

  private LineageEdgePipelineCleanupMigration() {}

  public static void clearNonPipelineEdgePipelines(
      final Handle handle, final ConnectionType connectionType) {
    Cursor cursor = Cursor.start();
    int cleared = 0;
    List<Edge> batch = cursor.read(handle, connectionType);
    while (!batch.isEmpty()) {
      cleared += clearBatch(handle, connectionType, batch);
      cursor = Cursor.after(batch.getLast());
      batch = cursor.read(handle, connectionType);
    }
    LOG.info(
        "Lineage edge pipeline cleanup: cleared {} non-pipeline pipeline reference(s)", cleared);
  }

  /** The page query for the engine; package-private so a test can read its plan. */
  static String pageSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> MYSQL_PAGE;
      case POSTGRES -> POSTGRES_PAGE;
    };
  }

  private static String rewriteSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> MYSQL_REWRITE;
      case POSTGRES -> POSTGRES_REWRITE;
    };
  }

  private static int clearBatch(
      final Handle handle, final ConnectionType connectionType, final List<Edge> batch) {
    int cleared = 0;
    for (Edge edge : batch) {
      if (clearEdgeIfNonPipeline(handle, connectionType, edge)) {
        cleared++;
      }
    }
    return cleared;
  }

  /** Clears and rewrites the edge when its pipeline is not a pipeline or a stored procedure. */
  private static boolean clearEdgeIfNonPipeline(
      final Handle handle, final ConnectionType connectionType, final Edge edge) {
    if (edge.relation() != UPSTREAM || nullOrEmpty(edge.json())) {
      return false;
    }
    LineageDetails details = JsonUtils.readValue(edge.json(), LineageDetails.class);
    EntityReference pipeline = details.getPipeline();
    boolean isNonPipeline =
        pipeline != null && !LineageEdgePipeline.isSupportedType(pipeline.getType());
    if (isNonPipeline) {
      logClearedReference(edge, pipeline);
      details.setPipeline(null);
      rewriteEdge(handle, connectionType, edge, details);
    }
    return isNonPipeline;
  }

  /** Rewrites the edge's details in place, keyed by its full primary key. */
  private static void rewriteEdge(
      final Handle handle,
      final ConnectionType connectionType,
      final Edge edge,
      final LineageDetails details) {
    handle
        .createUpdate(rewriteSql(connectionType))
        .bind("json", JsonUtils.pojoToJson(details))
        .bind("fromId", edge.fromId())
        .bind("toId", edge.toId())
        .bind("relation", edge.relation())
        .bind("relationType", edge.relationType())
        .execute();
  }

  private static void logClearedReference(final Edge edge, final EntityReference pipeline) {
    LOG.warn(
        "Cleared lineage edge {} -> {}: it named {} '{}' ({}) as its pipeline; rotate that entity's"
            + " credentials if it is a service",
        edge.fromId(),
        edge.toId(),
        pipeline.getType(),
        pipeline.getName(),
        pipeline.getId());
  }

  /** One row of the scan, keyed by the full primary key. */
  private record Edge(String fromId, String toId, int relation, String relationType, String json) {}

  private record Cursor(String fromId, String toId, int relation, String relationType) {
    private static Cursor start() {
      return new Cursor("", "", -1, "");
    }

    private static Cursor after(final Edge edge) {
      return new Cursor(edge.fromId(), edge.toId(), edge.relation(), edge.relationType());
    }

    private List<Edge> read(final Handle handle, final ConnectionType connectionType) {
      return handle
          .createQuery(pageSql(connectionType))
          .bind("fromId", fromId)
          .bind("toId", toId)
          .bind("relation", relation)
          .bind("relationType", relationType)
          .bind("limit", BATCH_SIZE)
          .map(
              (rs, ctx) ->
                  new Edge(
                      rs.getString("fromId"),
                      rs.getString("toId"),
                      rs.getInt("relation"),
                      rs.getString("relationType"),
                      rs.getString("json")))
          .list();
    }
  }
}
