package org.openmetadata.service.events.lifecycle;

import java.util.Map;
import java.util.UUID;

/** Additional ordering metadata for an entity update that is not part of the public entity schema. */
public record EntityUpdateContext(Map<UUID, Long> relationshipRevisions) {
  private static final EntityUpdateContext EMPTY = new EntityUpdateContext(Map.of());

  public EntityUpdateContext {
    relationshipRevisions =
        relationshipRevisions == null ? Map.of() : Map.copyOf(relationshipRevisions);
  }

  public static EntityUpdateContext empty() {
    return EMPTY;
  }

  public EntityUpdateContext forEntity(UUID entityId) {
    Long revision = relationshipRevisions.get(entityId);
    return revision == null ? EMPTY : new EntityUpdateContext(Map.of(entityId, revision));
  }
}
