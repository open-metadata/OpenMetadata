package org.openmetadata.service.events.lifecycle;

import java.util.Map;
import java.util.UUID;

/**
 * Additional metadata for an entity update that is not part of the public entity schema: ordering
 * revisions, and whether a bulk search write must be searchable before it returns, as a single
 * update's write is.
 */
public record EntityUpdateContext(Map<UUID, Long> relationshipRevisions, boolean refreshSearch) {
  private static final EntityUpdateContext EMPTY = new EntityUpdateContext(Map.of());
  private static final EntityUpdateContext REFRESH_SEARCH = new EntityUpdateContext(Map.of(), true);

  public EntityUpdateContext {
    relationshipRevisions =
        relationshipRevisions == null ? Map.of() : Map.copyOf(relationshipRevisions);
  }

  public EntityUpdateContext(Map<UUID, Long> relationshipRevisions) {
    this(relationshipRevisions, false);
  }

  public static EntityUpdateContext empty() {
    return EMPTY;
  }

  public static EntityUpdateContext refreshingSearch() {
    return REFRESH_SEARCH;
  }

  public EntityUpdateContext forEntity(UUID entityId) {
    Long revision = relationshipRevisions.get(entityId);
    return revision == null ? EMPTY : new EntityUpdateContext(Map.of(entityId, revision));
  }
}
