package org.openmetadata.service.entity;

import io.micrometer.core.instrument.Metrics;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.util.EntityUtil.Fields;

public final class EntityQueryCallbacks {

  private EntityQueryCallbacks() {}

  public static <T extends EntityInterface> void setInheritedFields(
      EntityPolicyContext<T> context,
      List<T> entities,
      Fields fields,
      Map<UUID, EntityReference> unhydratedParentRefs) {
    context.services().getQueries().inheritance().load(entities, fields, unhydratedParentRefs);
  }

  public static <T extends EntityInterface> void recordReadBundleFallback(
      EntityPolicyContext<T> context, String field, String reason) {
    Metrics.counter(
            "readbundle.fallback",
            "entity",
            context.schema().entityType(),
            "field",
            field == null ? "unknown" : field,
            "reason",
            reason == null ? "unknown" : reason)
        .increment();
  }

  public static <T extends EntityInterface> Map<UUID, List<EntityReference>> batchFetchChildren(
      EntityPolicyContext<T> context, List<T> entities) {
    return context
        .services()
        .getMetadataReads()
        .batch()
        .children(entities, context.schema().entityType());
  }
}
