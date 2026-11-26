package org.openmetadata.service.search.vector;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorIndexService.LiveEntities;

/**
 * The live entities as their repositories find them, soft deleted ones excluded: one query per
 * entity type and page. An id this server cannot check, of a type it has no repository for or not
 * an entity id at all, counts as live, so its chunks stay.
 */
public final class RepositoryLiveEntities implements LiveEntities {

  @Override
  public Set<String> of(String entityType, List<String> ids) {
    Set<String> live = new HashSet<>();
    Map<UUID, String> byEntityId = new LinkedHashMap<>();
    for (String id : ids) {
      UUID entityId = parse(id);
      if (entityId == null) {
        live.add(id);
      } else {
        byEntityId.put(entityId, id);
      }
    }
    if (Entity.hasEntityRepository(entityType)) {
      List<UUID> entityIds = new ArrayList<>(byEntityId.keySet());
      for (EntityInterface<?> entity :
          Entity.getEntityRepository(entityType).find(entityIds, Include.NON_DELETED)) {
        live.add(byEntityId.get(entity.getId()));
      }
    } else {
      live.addAll(byEntityId.values());
    }
    return live;
  }

  private static UUID parse(String id) {
    UUID entityId;
    try {
      entityId = UUID.fromString(id);
    } catch (IllegalArgumentException notAnEntityId) {
      entityId = null;
    }
    return entityId;
  }
}
