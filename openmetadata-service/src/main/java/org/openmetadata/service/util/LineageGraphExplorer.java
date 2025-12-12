package org.openmetadata.service.util;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public final class LineageGraphExplorer {
  private final CollectionDAO dao;
  private static final int RELATIONSHIP_UPSTREAM = Relationship.UPSTREAM.ordinal();

  public LineageGraphExplorer(CollectionDAO dao) {
    this.dao = dao;
  }

  public Set<EntityReference> findUniqueEntitiesDownstream(UUID id, String type, Integer maxDepth) {
    if (maxDepth != null && maxDepth <= 0) {
      return Set.of();
    }

    Set<EntityReference> result = new LinkedHashSet<>();
    Set<UUID> visited = new HashSet<>();
    visited.add(id);

    dfs(id, type, 0, maxDepth, visited, result);
    return result;
  }

  private void dfs(
      UUID id,
      String type,
      int currentDepth,
      Integer maxDepth,
      Set<UUID> visited,
      Set<EntityReference> result) {

    if (maxDepth != null && currentDepth >= maxDepth) {
      return;
    }

    List<CollectionDAO.EntityRelationshipRecord> records =
        dao.relationshipDAO().findTo(id, type, RELATIONSHIP_UPSTREAM);

    for (CollectionDAO.EntityRelationshipRecord record : records) {
      UUID recordId = record.getId();

      if (!visited.add(recordId)) {
        continue;
      }

      try {
        EntityReference ref =
            Entity.getEntityReferenceById(record.getType(), recordId, Include.NON_DELETED);
        result.add(ref);
        dfs(recordId, record.getType(), currentDepth + 1, maxDepth, visited, result);
      } catch (Exception e) {
        LOG.debug(
            "Failed to resolve entity reference: type={}, id={}", record.getType(), recordId, e);
      }
    }
  }
}
