package org.openmetadata.service.entity.policy;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityQueryCallbacks;
import org.openmetadata.service.entity.metadata.DerivedTagLoader;
import org.openmetadata.service.entity.metadata.EntityTagReader;
import org.openmetadata.service.entity.read.EntityPagePolicy;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntitySearchReader;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadPlan;
import org.openmetadata.service.entity.read.ReadPlanBuilder;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil;

public interface EntityReadPolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  /**
   * Set the requested fields in an entity. This is used for requesting specific fields in the object during GET
   * operations. It is also used during PUT and PATCH operations to set up fields that can be updated.
   *
   * @param entity The entity to set fields on
   * @param fields The fields to set
   * @param relationIncludes Per-relation include filter for handling soft-deleted related entities
   */
  public void setFields(T entity, Fields fields, RelationIncludes relationIncludes);

  /**
   * Set the requested fields in an entity. This is used for requesting specific fields in the object during GET
   * operations. It is also used during PUT and PATCH operations to set up fields that can be updated.
   */
  public void clearFields(T entity, Fields fields);

  /**
   * Batch-resolve EntityReferences by id for the bulk field fetchers.
   *
   * <p>Fails fast on an id that cannot be resolved, preserving the contract of the per-record
   * {@link Entity#getEntityReferenceById} calls this replaced. The batch query underneath
   * ({@code findReferencesByIds}) is a plain {@code WHERE id IN (...)}, so it silently omits ids it
   * cannot find; without this check an orphaned relationship row would change from failing the
   * request to silently dropping the reference.
   */
  public default Map<UUID, EntityReference> batchResolveRefs(String entityType, List<UUID> ids) {
    List<UUID> distinctIds = ids.stream().distinct().toList();
    Map<UUID, EntityReference> refsById = new HashMap<>();
    if (!distinctIds.isEmpty()) {
      for (EntityReference ref :
          Entity.getEntityReferencesByIds(entityType, distinctIds, Include.ALL)) {
        refsById.put(ref.getId(), ref);
      }
      for (UUID id : distinctIds) {
        if (!refsById.containsKey(id)) {
          throw EntityNotFoundException.byMessage(
              CatalogExceptionMessage.entityNotFound(entityType, id));
        }
      }
    }
    return refsById;
  }

  public default T getByName(UriInfo uriInfo, String fqn, Fields fields) {
    return context()
        .policy()
        .reads()
        .byName(
            fqn,
            new EntityReadService.Query(
                uriInfo, fields, RelationIncludes.fromInclude(NON_DELETED), false));
  }

  /**
   * Hook for repositories to extend {@link ReadPlan} with entity-specific relation fields or
   * prefetch intent without changing common planner behavior.
   */
  public default void augmentReadPlan(
      ReadPlanBuilder builder, T entity, Fields fields, RelationIncludes relationIncludes) {
    // Default no-op. Repositories can append entity-specific read planning here.
  }

  /**
   * Hook for repositories to execute entity-specific prefetch reads using the already-built read plan.
   * Results should be attached to the entity or request-scoped bundle to avoid fallback DAO calls.
   */
  public default void prefetchEntitySpecificReadData(
      T entity, ReadPlan readPlan, ReadBundle bundle) {
    // Default no-op. Repositories can prefetch entity-specific data in few queries here.
  }

  /**
   * Executes {@link #setFields}  on a list of entities. By default, this method processes
   * each entity individually. To enable batch processing, override this method in a subclass.
   * <p>
   * For efficient bulk processing, ensure all fields used in {@link #setFields}
   * have corresponding batch processing methods, such as {@code fetchAndSetXXX}. For instance,
   * if handling an inheritable field, extend {@link #fetchInheritableRelationships}.
   * <p>
   * Example implementation can be found in {@link GlossaryTermRepository#setFieldsInBulk}.
   */
  public default void setFieldsInBulk(Fields fields, List<T> entities, ListFilter filter) {
    context().policy().setFieldsInBulk(fields, entities);
  }

  public default void setFieldsInBulk(Fields fields, List<T> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    try (var ignored = phase("fetchFields")) {
      context().policy().fieldLoading().populate(entities, fields);
    }
    try (var ignored = phase("setInheritedFields")) {
      context().policy().setInheritedFields(entities, fields);
    }
    for (T entity : entities) {
      context().policy().clearFieldsInternal(entity, fields);
    }
  }

  public default EntityPagePolicy<T> pagingPolicy() {
    return EntityPagePolicy.standard();
  }

  /**
   * This method returns the cursor value for pagination.
   * By default, it uses the entity's name. However, in cases where the name can be the same for different entities,
   * it is recommended to override this method to use the (name,id) key  instead.
   * The id is always unique, which helps to avoid pagination issues caused by duplicate names and have unique ordering.
   */
  public default String getCursorValue(T entity) {
    return context().policy().getCursorValue(entity.getName(), String.valueOf(entity.getId()));
  }

  public default String getCursorValue(String name, String id) {
    Map<String, String> cursorMap = Map.of("name", name, "id", id);
    return JsonUtils.pojoToJson(cursorMap);
  }

  public default String getCursorAtOffset(ListFilter filter, int offset) {
    EntityDAO.CursorRow row = context().schema().dao().getCursorAtOffset(filter, offset);
    if (row == null) {
      EntityPolicySupport.LOG.debug(
          "getCursorAtOffset for {} at offset {} returned empty (filter condition={})",
          context().schema().entityType(),
          offset,
          filter.getCondition(context().schema().dao().getTableName()));
      return null;
    }
    return RestUtil.encodeCursor(context().policy().getCursorValue(row.name(), row.id()));
  }

  public default T setFieldsInternal(T entity, Fields fields) {
    return context().policy().setFieldsInternal(entity, fields, NON_DELETED);
  }

  public default T setFieldsInternal(T entity, Fields fields, Include include) {
    return context()
        .policy()
        .setFieldsInternal(entity, fields, RelationIncludes.fromInclude(include));
  }

  public default T setFieldsInternal(T entity, Fields fields, RelationIncludes relationIncludes) {
    return context()
        .services()
        .getMetadataReads()
        .hydrator()
        .hydrate(entity, fields, relationIncludes);
  }

  public default void clearFieldsInternal(T entity, Fields fields) {
    context().services().getMetadataReads().hydrator().clear(entity, fields);
  }

  public default ResultList<T> listFromSearchWithOffset(
      UriInfo uriInfo,
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      SecurityContext securityContext)
      throws IOException {
    return context()
        .services()
        .getQueries()
        .search()
        .list(
            uriInfo,
            new EntitySearchReader.Query(
                searchListFilter,
                new EntitySearchReader.Page(limit, offset),
                searchSortFilter,
                q,
                queryString),
            getSubjectContext(securityContext));
  }

  public default T withHref(UriInfo uriInfo, T entity) {
    if (uriInfo == null) {
      return entity;
    }
    return entity.withHref(context().policy().getHref(uriInfo, entity.getId()));
  }

  public default URI getHref(UriInfo uriInfo, UUID id) {
    return RestUtil.getHref(uriInfo, context().schema().collectionPath(), id);
  }

  public default void fetchAndSetChildren(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_CHILDREN) || entities == null || nullOrEmpty(entities)) {
      return;
    }
    Map<UUID, List<EntityReference>> childrenMap =
        EntityQueryCallbacks.batchFetchChildren(context(), entities);
    for (T entity : entities) {
      entity.setChildren(childrenMap.get(entity.getId()));
    }
  }

  public default void enrichEntitiesForAuth(List<T> entities) {
    context().services().getMetadataReads().access().populateForAuth(entities);
  }

  /**
   * Batch-loads tags onto these entities in one query, for authorization. Used by the bulk path so a
   * tag policy evaluates against tags fetched once for the whole request rather than once per entity.
   */
  public default void batchLoadTags(List<T> entities) {
    context()
        .services()
        .getTagReader()
        .populate(
            entities,
            new EntityTagReader.Projection(true, false, DerivedTagLoader.FailureMode.PROPAGATE));
  }

  public default DerivedTagLoader.FailureMode derivedTagFailureMode() {
    return DerivedTagLoader.FailureMode.PROPAGATE;
  }
}
