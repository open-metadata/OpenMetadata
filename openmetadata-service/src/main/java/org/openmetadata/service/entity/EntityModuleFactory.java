package org.openmetadata.service.entity;

import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;

public final class EntityModuleFactory {

  private EntityModuleFactory() {}

  public static <T extends EntityInterface> void initialize(EntityPolicy<T> policy) {
    final EntityPolicyContext<T> context = policy.context();
    context.bind(policy);
    EntityStorageAssembly.initialize(context);
    EntityMetadataAssembly.initialize(context);
    EntityQueryAssembly.initialize(context);
    EntityCommandAssembly.initialize(context);
    EntityDeletionAssembly.initialize(context);
    EntityBulkAssembly.initialize(context);
    EntityMutationAssembly.initialize(context);
  }

  public static void create(
      Class<?> repositoryClass, OpenMetadataApplicationConfig config, Jdbi jdbi) {
    try {
      if (construct(repositoryClass, config, jdbi) instanceof EntityPolicy<?> policy) {
        register(policy);
      }
    } catch (ReflectiveOperationException failure) {
      throw new IllegalStateException(
          "Cannot initialize repository " + repositoryClass.getName(), failure);
    }
  }

  private static Object construct(
      Class<?> repositoryClass, OpenMetadataApplicationConfig config, Jdbi jdbi)
      throws ReflectiveOperationException {
    try {
      return repositoryClass.getDeclaredConstructor().newInstance();
    } catch (NoSuchMethodException missingDefault) {
      try {
        return repositoryClass
            .getDeclaredConstructor(OpenMetadataApplicationConfig.class)
            .newInstance(config);
      } catch (NoSuchMethodException missingConfig) {
        return repositoryClass.getDeclaredConstructor(Jdbi.class).newInstance(jdbi);
      }
    }
  }

  private static <T extends EntityInterface> void register(EntityPolicy<T> policy) {
    Entity.registerEntity(policy.getEntityClass(), policy.getEntityType(), policy);
  }
}
