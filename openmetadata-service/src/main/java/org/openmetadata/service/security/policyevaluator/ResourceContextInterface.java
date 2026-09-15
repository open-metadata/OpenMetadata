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
   * The service that ingested this resource, or null when the resource is not backed by one.
   *
   * <p>{@link org.openmetadata.schema.EntityInterface#getService()} defaults to null, so entities
   * outside a service hierarchy — glossary terms, users, teams, domains, tags — answer null here
   * without any per-type handling. The same holds for the contexts whose {@link #getEntity()} is
   * always null.
   */
  default EntityReference getServiceReference() {
    EntityInterface entity = getEntity();
    return entity == null ? null : entity.getService();
  }

  /** Tags on {@link #getServiceReference()}, empty when the resource has no service. */
  default List<TagLabel> getServiceTags() {
    return Collections.emptyList();
  }

  /**
   * Connector type of {@link #getServiceReference()} — {@code Snowflake}, {@code Postgres} — or
   * null when the resource has no service. This is the service's own {@code serviceType}, not the
   * {@code databaseService}/{@code dashboardService} entity type carried by its reference.
   */
  default String getServiceType() {
    return null;
  }

  /**
   * Declared environment of {@link #getServiceReference()} — {@code Production}, {@code
   * Development} — or null when the resource has no service or the admin has not set one.
   */
  default String getServiceEnvironment() {
    return null;
  }
}
