package org.openmetadata.service.entity.policy;

import org.openmetadata.schema.EntityInterface;

public interface EntityPolicy<T extends EntityInterface>
    extends EntityModuleAccess<T>,
        EntityBulkPolicy<T>,
        EntityReadPolicy<T>,
        EntityMutationPolicy<T>,
        EntityMetadataPolicy<T>,
        EntityInheritancePolicy<T>,
        EntityLifecyclePolicy<T>,
        EntitySeedPolicy<T>,
        EntityDeletionPolicy<T> {}
