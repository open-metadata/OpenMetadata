package org.openmetadata.service.lineage;

import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;

/**
 * The entity types a lineage edge may carry as its pipeline. The edge copies the named entity, as
 * stored, into the downstream entity's search document, which any user can read, so any other type
 * would hand out fields its own API masks or denies — a service's connection, for one
 * (ANT-2026-RL0ZDKB8).
 *
 * <p>This is a pure type check with no dependency on the repository or the search client, so the
 * database-repair migration shares it without initializing either.
 */
public final class LineageEdgePipeline {
  private LineageEdgePipeline() {}

  public static boolean isSupportedType(String entityType) {
    return PIPELINE.equals(entityType) || STORED_PROCEDURE.equals(entityType);
  }
}
