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

  /**
   * Tags on {@link #getServiceReference()}, empty when the resource has no service.
   *
   * <p>This and the two accessors below must be derived from the reference rather than answered as
   * "absent", or an implementation that resolves a real entity — {@code TestCaseResourceContext}
   * resolving the tested table, the task and conversation contexts resolving their about-entity —
   * would report no service tags, type or environment for a resource that plainly has all three,
   * and every {@code matchAnyServiceTag} / {@code matchAnyServiceType} / {@code
   * matchAnyServiceEnvironment} Deny would silently fail open there while {@code
   * matchAnyServiceName} kept matching.
   *
   * <p>An interface cannot memoize on the instance, so the three share a request-scoped memo keyed
   * by service id; {@link ResourceContext} and {@link CreateResourceContext} override them with
   * per-context memoization instead.
   */
  default List<TagLabel> getServiceTags() {
    return ServiceAttributeCache.resolve(getServiceReference()).tags();
  }

  /**
   * Connector type of {@link #getServiceReference()} — {@code Snowflake}, {@code Postgres} — or
   * null when the resource has no service. This is the service's own {@code serviceType}, not the
   * {@code databaseService}/{@code dashboardService} entity type carried by its reference.
   */
  default String getServiceType() {
    return ServiceAttributeCache.resolve(getServiceReference()).serviceType();
  }

  /**
   * Declared environment of {@link #getServiceReference()} — {@code Production}, {@code
   * Development} — or null when the resource has no service or the admin has not set one.
   */
  default String getServiceEnvironment() {
    return ServiceAttributeCache.resolve(getServiceReference()).environment();
  }
}
