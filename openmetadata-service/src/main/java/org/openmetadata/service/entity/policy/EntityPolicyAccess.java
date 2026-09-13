package org.openmetadata.service.entity.policy;

import org.openmetadata.schema.EntityInterface;

/**
 * Supplies the shared graph to a focused entity policy.
 */
public interface EntityPolicyAccess<T extends EntityInterface> {

  EntityPolicyContext<T> context();
}
