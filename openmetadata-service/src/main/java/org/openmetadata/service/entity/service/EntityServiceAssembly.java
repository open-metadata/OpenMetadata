package org.openmetadata.service.entity.service;

import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

/** Binds service policies to the configured secrets, reference and cache providers at startup. */
public final class EntityServiceAssembly {
  private EntityServiceAssembly() {}

  public static <T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
      EntityServiceOperations<T, S> create(
          final EntityServicePolicy<T, S> policy,
          final Class<S> connectionClass,
          final ServiceType serviceType) {
    return new EntityServiceOperations<>(
        policy,
        new EntityServiceOperations.Definition<>(connectionClass, serviceType),
        new EntityServiceOperations.Infrastructure(
            SecretsManagerFactory::getSecretsManager,
            EntityMaskerFactory::getEntityMasker,
            EntityCaches.invalidations(),
            ids ->
                Entity.getEntityReferencesByIds(
                    Entity.INGESTION_PIPELINE, ids, Include.NON_DELETED)));
  }
}
