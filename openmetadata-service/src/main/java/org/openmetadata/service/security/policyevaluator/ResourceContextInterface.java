package org.openmetadata.service.security.policyevaluator;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

public interface ResourceContextInterface {
  enum Operation {
    PATCH,
    PUT,
    DELETE,
    NONE
  }

  String getResource();

  // Get owner of a resource. If the resource does not support owner or has no owner, return null
  List<EntityReference> getOwners();

  // Get Tags associated with a resource. If the resource does not support tags or has no tags,
  // return null
  List<TagLabel> getTags();

  EntityInterface getEntity();

  /**
   * The entity already resolved while evaluating policy, or null if evaluation never needed it.
   * Unlike {@link #getEntity()} this never triggers a load, so callers can reuse what the decision
   * fetched without forcing work on requests that were authorized without inspecting the resource.
   */
  default EntityInterface getResolvedEntity() {
    return null;
  }

  /**
   * Policy attributes the resolved entity is known to carry. Callers reusing {@link
   * #getResolvedEntity()} must check this covers the projection they intend to serve, since an
   * entity resolved for the decision is not guaranteed to include everything a caller asked for.
   */
  default Set<String> getLoadedFields() {
    return Collections.emptySet();
  }

  List<EntityReference> getDomains();

  /**
   * True when this context addresses a whole collection (a list request) rather than a single
   * entity, so no concrete entity can ever be resolved. Distinguishes a genuine list request from a
   * single-entity request whose target merely failed to resolve (e.g. an {@code EntityNotFound}),
   * which also leaves {@link #getEntity()} null but must not be treated as an authorized collection.
   */
  default boolean isCollectionRequest() {
    return false;
  }
}
