package org.openmetadata.service.entity.policy;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityQueryCallbacks;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.entity.read.EntityAccessMetadataReader;
import org.openmetadata.service.entity.read.EntityInheritanceLoader;
import org.openmetadata.service.entity.read.EntityInheritanceReader;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

public interface EntityInheritancePolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  /**
   * This method is called to set inherited fields that an entity inherits from its parent.
   *
   * @see TableRepository#setInheritedFields(Table, Fields) for an example implementation
   */
  @SuppressWarnings("unused")
  public default void setInheritedFields(T entity, Fields fields) {
    context().services().getQueries().inheritance().load(entity, fields);
  }

  /**
   * Return the parent's EntityReference without loading the parent entity. Subclasses override this
   * to enable batch parent loading in {@link #setInheritedFields(List, Fields)}. A type that can
   * have several CONTAINS parents at once (e.g. a test case, under both a test suite and a test
   * definition) must override this (or {@link #setInheritedFields(List, Fields)}) to name the one it
   * inherits from -- otherwise the ancestor fallback resolves an arbitrary CONTAINS parent.
   */
  public default EntityReference getParentReference(T entity) {
    return null;
  }

  /**
   * Fields to load on parent entities for inheritance. Override for repos that inherit more than domains.
   */
  public default String getInheritableFields() {
    return "domains";
  }

  /**
   * Fields to load on a parent of the given type. Entities whose parent may be one of several types
   * override this when a field is only valid on some of them; requesting a field a parent type does
   * not declare is rejected as an unknown field.
   */
  public default String getInheritableFields(String parentEntityType) {
    return context().policy().getInheritableFields();
  }

  /**
   * Determine whether parent traversal is required for inheritance based on requested fields and
   * whether the entity already has local values.
   */
  public default boolean requiresParentForInheritance(T entity, Fields fields) {
    boolean needsOwners =
        context().supports(FIELD_OWNERS)
            && fields.contains(FIELD_OWNERS)
            && nullOrEmpty(entity.getOwners());
    boolean needsDomains =
        context().supports(FIELD_DOMAINS)
            && fields.contains(FIELD_DOMAINS)
            && nullOrEmpty(entity.getDomains());
    return needsOwners || needsDomains;
  }

  public default T getForInheritance(UUID id, Fields fields, Include include) {
    return context().services().getQueries().inheritanceReads().read(id, fields, include);
  }

  public default void fetchInheritableRelationships(List<T> entities, Fields fields) {
    if (entities.isEmpty()) {
      return;
    }
    context()
        .services()
        .getMetadataReads()
        .access()
        .populateForInheritance(
            entities,
            new EntityAccessMetadataReader.Projection(
                fields.contains(FIELD_OWNERS) && context().supports(FIELD_OWNERS),
                fields.contains(FIELD_DOMAINS) && context().supports(FIELD_DOMAINS)));
  }

  @SuppressWarnings("unchecked")
  public default void fetchInheritableRelationshipsUntyped(List<?> entities, Fields fields) {
    context().policy().fetchInheritableRelationships((List<T>) entities, fields);
  }

  @SuppressWarnings("unchecked")
  public default void setInheritedFieldsUntyped(List<?> entities, Fields fields) {
    // Inheritance-ancestor path: these came from find() (getEntitiesForInheritance) with an
    // un-hydrated getParentReference(), so resolve their parent from the CONTAINS relationship and
    // pass it in -- that is how multi-level inheritance keeps walking up.
    List<T> ancestors = (List<T>) entities;
    EntityQueryCallbacks.setInheritedFields(
        context(), ancestors, fields, context().policy().batchFetchInheritanceParents(ancestors));
  }

  /**
   * Apply inherited fields from a loaded parent to the entity. Override for custom inheritance logic.
   */
  public default void applyInheritance(T entity, Fields fields, EntityInterface parent) {
    InheritedReferences.apply(InheritedReferences.Field.DOMAINS, entity, fields, parent);
  }

  /**
   * Batch-preload parent entities needed by {@link #prepare(Object, boolean)} during bulk operations.
   * Default uses {@link #getParentReference(Object)} to collect unique parents and batch-load them.
   * Repos with custom parent loading in prepare() can override for different behavior.
   */
  public default void preloadParentsForBulk(List<T> entities) {
    if (!nullOrEmpty(entities)) {
      context().policy().bulkPreparation().preload(entities);
    }
  }

  public default void preloadParentReferences(List<EntityReference> references) {
    if (references.isEmpty()) {
      return;
    }
    if (references.size() > EntityBulkPreparation.MAX_PARENTS) {
      throw new IllegalArgumentException("Parent preparation exceeds its bounded batch size");
    }
    final Cache<UUID, EntityInterface> loaded = newParentCache();
    final var byType = references.stream().collect(Collectors.groupingBy(EntityReference::getType));
    for (final var typed : byType.values()) {
      final List<? extends EntityInterface> parents = Entity.getEntities(typed, "", ALL);
      parents.forEach(parent -> loaded.put(parent.getId(), parent));
    }
    context().parentCache().set(loaded);
  }

  /**
   * Get a parent entity from the bulk-prepare cache, or load from DB if not cached.
   */
  public default EntityInterface getCachedParentOrLoad(
      EntityReference ref, String fields, Include include) {
    var cache = context().parentCache().get();
    if (cache != null && ref != null && ref.getId() != null) {
      var cached = cache.getIfPresent(ref.getId());
      if (cached != null) return cached;
    }
    return Entity.getEntity(ref, fields, include);
  }

  /**
   * Store preloaded parents in the thread-local cache.
   */
  public default void setParentCache(Map<UUID, EntityInterface> cache) {
    final Cache<UUID, EntityInterface> bounded = newParentCache();
    bounded.putAll(cache);
    context().parentCache().set(bounded);
  }

  private static Cache<UUID, EntityInterface> newParentCache() {
    return CacheBuilder.newBuilder()
        .maximumSize(EntityBulkPreparation.MAX_PARENTS)
        .concurrencyLevel(1)
        .build();
  }

  /**
   * Clear the parent cache after bulk prepare.
   */
  public default void clearParentCache() {
    context().parentCache().remove();
    context().services().getPersistence().clearStored();
  }

  /**
   * Loads an inheritance parent, tolerating a parent that has been hard-deleted since the child was
   * read. Returns null (skip inheritance) rather than propagating, matching {@link
   * EntityInheritanceLoader}.
   */
  public default <P extends EntityInterface> P loadInheritanceParentLeniently(
      EntityReference parentRef, String fields, Class<P> parentClass) {
    P result = null;
    if (parentRef != null && parentRef.getId() != null && !nullOrEmpty(parentRef.getType())) {
      try {
        EntityInterface parent =
            Entity.getEntityForInheritance(parentRef.getType(), parentRef.getId(), fields, ALL);
        if (parentClass.isInstance(parent)) {
          result = parentClass.cast(parent);
        }
      } catch (EntityNotFoundException e) {
        EntityPolicySupport.LOG.debug(
            "Inheritance parent {} {} no longer exists; skipping inheritance",
            parentRef.getType(),
            parentRef.getId());
      }
    }
    return result;
  }

  /**
   * Batch implementation that collects unique parent references, loads them in bulk, and applies
   * inheritance. Subclasses only need to override {@link #getParentReference(Object)},
   * {@link #getInheritableFields()}, and {@link #applyInheritance(Object, Fields, EntityInterface)}.
   * Repos with complex inheritance (e.g. GlossaryTerm, TestCase) can still override this method directly.
   */
  public default void setInheritedFields(List<T> entities, Fields fields) {
    // Direct list reads: parent references are already hydrated, so there are no un-hydrated
    // ancestors to resolve. Only the ancestor path (setInheritedFieldsUntyped) passes those in.
    EntityQueryCallbacks.setInheritedFields(context(), entities, fields, Map.of());
  }

  public default Map<UUID, EntityReference> batchFetchContainers(
      List<T> entities, String fromEntityType, Include include) {
    return context()
        .services()
        .getMetadataReads()
        .batch()
        .containers(entities, fromEntityType, include);
  }

  /**
   * Resolve each entity's inheritance parent from its live CONTAINS relationship. Used for ancestors
   * loaded via find() whose {@link #getParentReference} is not hydrated (e.g. a schema pulled in to
   * inherit a database service's domain). Only the parent id and type are taken from the relation
   * row -- {@link Entity#getEntitiesForInheritance} reloads the full parent -- so no extra reference
   * lookup is issued. If an entity has several live CONTAINS parents (a corrupt/duplicate edge) the
   * first is used and a warning logged, matching the single-entity read path
   * {@link EntityInheritanceReader}.
   */
  public default Map<UUID, EntityReference> batchFetchInheritanceParents(List<T> entities) {
    return context()
        .services()
        .getMetadataReads()
        .batch()
        .inheritanceParents(entities, context().schema().entityType());
  }

  public default EntityInterface getParentEntity(T entity, String fields) {
    return null;
  }

  public default EntityReference getParent(T entity) {
    return context()
        .policy()
        .relationships()
        .singleFrom(entity.getId(), Relationship.CONTAINS, context().schema().entityType(), false);
  }
}
