package org.openmetadata.service.jdbi3;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;

/**
 * Counts the knowledge pills extracted from each of a batch of Context Center sources. Shared by
 * the ContextFile and Page repositories so a list response reports the same memoryCount a
 * single-entity GET does, without one query per row.
 */
final class MemoryCountFetcher {

  private MemoryCountFetcher() {}

  static Map<UUID, Integer> countByEntityId(
      CollectionDAO daoCollection, List<String> sourceIds, String sourceEntityType) {
    Map<UUID, Integer> counts = new HashMap<>();
    if (sourceIds == null || sourceIds.isEmpty()) {
      return counts;
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                sourceIds,
                Relationship.MENTIONED_IN.ordinal(),
                sourceEntityType,
                Entity.CONTEXT_MEMORY);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      counts.merge(UUID.fromString(record.getFromId()), 1, Integer::sum);
    }
    return counts;
  }
}
