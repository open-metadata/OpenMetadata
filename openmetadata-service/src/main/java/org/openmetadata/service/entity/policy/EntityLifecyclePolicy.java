package org.openmetadata.service.entity.policy;

import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityWriteCallbacks;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.PropagationDescriptor;

public interface EntityLifecyclePolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  /**
   * Get the list of propagatable fields to child entities in the search index *
   */
  public default List<PropagationDescriptor> getSearchPropagationDescriptors() {
    return List.of(
        new PropagationDescriptor(
            FIELD_OWNERS, PropagationDescriptor.PropagationType.ENTITY_REFERENCE_LIST, null),
        new PropagationDescriptor(
            FIELD_DOMAINS, PropagationDescriptor.PropagationType.ENTITY_REFERENCE_LIST, null),
        new PropagationDescriptor(
            Entity.FIELD_DISABLED, PropagationDescriptor.PropagationType.SIMPLE_VALUE, null),
        new PropagationDescriptor(
            Entity.FIELD_TEST_SUITES, PropagationDescriptor.PropagationType.RAW_REPLACE, null),
        new PropagationDescriptor(
            FIELD_DISPLAY_NAME,
            PropagationDescriptor.PropagationType.NESTED_FIELD,
            context().schema().entityType() + "." + FIELD_DISPLAY_NAME));
  }

  /**
   * Whether a single entity instance should be written to the search index on the live
   * create/update path. Defaults to true; override to keep specific instances out of the index.
   * The bulk reindex applies the same rule at the DB-query level via {@link #getReindexFilter()}.
   */
  public default boolean isSearchIndexable(EntityInterface entity) {
    return true;
  }

  /**
   * Whether a single entity instance should be embedded into the vector/semantic index. Defaults to
   * {@link #isSearchIndexable}; override when an instance may be keyword-searchable but must not be
   * reachable through the vector path — for instance when its chunk documents cannot carry the
   * fields its privacy model needs the vector query to filter on.
   */
  public default boolean isVectorEmbeddable(EntityInterface entity) {
    return context().policy().isSearchIndexable(entity);
  }

  /**
   * Filter the search reindex uses to both list and count this entity's rows. Defaults to all rows;
   * override to keep specific instances out of the search index. The reader and every entity-count
   * site share this filter so the job total matches what actually gets indexed.
   */
  public default ListFilter getReindexFilter() {
    return new ListFilter(Include.ALL);
  }

  /**
   * Invalidate cache entries when entity is deleted
   */
  public default void invalidateCache(T entity) {
    EntityCaches.invalidations()
        .entityDeleted(
            context().schema().entityType(), entity.getId(), entity.getFullyQualifiedName());
  }

  @SuppressWarnings("unused")
  public default void postCreate(T entity) {
    context().services().getLifecyclePublisher().created(entity);
  }

  public default void writeThroughCache(T entity, boolean update) {
    context().services().getPersistence().publish(entity);
  }

  public default void writeThroughCacheMany(List<T> entities, boolean update) {
    EntityWriteCallbacks.writeThroughCacheMany(context(), entities, update, List.of());
  }

  /**
   * Bulk updates benefit more from cheap invalidation than write-through recaching.
   * This avoids N background DB reads that can contend with foreground requests.
   */
  public default void invalidateMany(List<T> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    for (T entity : entities) {
      context().policy().invalidate(entity);
    }
  }

  public default void postCreate(List<T> entities) {
    context().services().getLifecyclePublisher().createdMany(entities);
  }

  @SuppressWarnings("unused")
  public default void postUpdate(T original, T updated) {
    context().services().getLifecyclePublisher().updated(updated);
  }

  public default void postDelete(T entity, boolean hardDelete) {
    context().services().getLifecyclePublisher().deleted(entity, hardDelete);
  }

  public default void deleteFromSearch(T entity, boolean hardDelete) {
    context().services().getLifecyclePublisher().publishDeletion(entity, hardDelete);
  }

  public default void restoreFromSearch(T entity) {
    context().services().getLifecyclePublisher().publishRestoration(entity);
  }

  public default void invalidate(T entity) {
    EntityCaches.invalidations()
        .beforeEntityInvalidation(
            context().schema().entityType(), entity.getId(), entity.getFullyQualifiedName());
    context().policy().invalidateCache(entity);
    EntityPolicySupport.deferCacheBundleInvalidation(
        context().schema().entityType(), entity.getId(), entity.getFullyQualifiedName());
  }
}
