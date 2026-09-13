package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.entity.bulk.EntityBulkMutation;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

public final class EntityBulkCallbacks {

  private EntityBulkCallbacks() {}

  public static <T extends EntityInterface> void publishBulkUpdateEvents(
      EntityPolicyContext<T> context,
      final List<EntityBulkMutation<T>> mutations,
      final String actor) {
    final List<String> events = new ArrayList<>(mutations.size());
    for (final EntityBulkMutation<T> mutation : mutations) {
      context
          .policy()
          .buildChangeEventJsonForBulkOperation(
              mutation.getUpdated(), mutation.getChangeType(), actor)
          .ifPresent(events::add);
    }
    context.policy().insertChangeEventsBatch(events);
  }

  public static <T extends EntityInterface> EntityInterface loadMembershipAuditSource(
      EntityPolicyContext<T> context, String type, UUID id) {
    // An audit snapshot must see the owning transaction without publishing uncommitted cache data.
    RequestEntityCache.invalidate(type, id, null);
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      return Entity.getEntity(type, id, "id", ALL);
    } finally {
      RequestEntityCache.invalidate(type, id, null);
    }
  }
}
