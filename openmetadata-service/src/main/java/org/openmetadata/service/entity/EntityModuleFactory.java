package org.openmetadata.service.entity;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;

public final class EntityModuleFactory {

  private EntityModuleFactory() {}

  public static <T extends EntityInterface> void initialize(
      EntityPolicy<T> policy, boolean registerEntity) {
    final EntityPolicyContext<T> context = policy.context();
    context.bind(policy);
    EntityStorageAssembly.initialize(context);
    EntityMetadataAssembly.initialize(context);
    EntityQueryAssembly.initialize(context);
    EntityCommandAssembly.initialize(context);
    EntityDeletionAssembly.initialize(context);
    EntityBulkAssembly.initialize(context);
    EntityMutationAssembly.initialize(context);
    if (registerEntity) {
      Entity.registerEntity(context.schema().entityClass(), context.schema().entityType(), policy);
    }
  }
}
