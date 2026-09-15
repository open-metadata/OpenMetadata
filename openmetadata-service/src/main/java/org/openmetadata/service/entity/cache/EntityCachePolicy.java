package org.openmetadata.service.entity.cache;

import java.util.Set;
import org.openmetadata.service.Entity;

/** Keeps frequently mutated governance and workflow entities outside Redis entity caching. */
public final class EntityCachePolicy {
  private static final Set<String> EXCLUDED =
      Set.of(
          Entity.USER,
          Entity.TASK,
          Entity.WORKFLOW,
          Entity.WORKFLOW_DEFINITION,
          Entity.WORKFLOW_INSTANCE,
          Entity.WORKFLOW_INSTANCE_STATE,
          Entity.TEST_CASE_RESOLUTION_STATUS,
          Entity.BOT,
          Entity.DOMAIN,
          Entity.DATA_PRODUCT);

  private EntityCachePolicy() {}

  public static boolean isCacheable(final String entityType) {
    return entityType != null && !EXCLUDED.contains(entityType);
  }
}
