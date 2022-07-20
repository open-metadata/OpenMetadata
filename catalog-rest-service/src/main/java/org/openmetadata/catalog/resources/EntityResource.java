package org.openmetadata.catalog.resources;

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.CreateEntity;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.policyevaluator.OperationContext;
import org.openmetadata.catalog.security.policyevaluator.ResourceContext;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
public abstract class EntityResource<T extends EntityInterface, K extends EntityRepository<T>> {
  protected final Class<T> entityClass;
  protected final String entityType;
  protected final List<String> allowedFields;
  protected final K dao;
  protected final Authorizer authorizer;
  private final boolean supportsOwner;
  protected final OperationContext createOperationContext;
  protected final OperationContext deleteOperationContext;
  protected final OperationContext getOperationContext;
  protected final OperationContext listOperationContext;

  protected EntityResource(Class<T> entityClass, K repository, Authorizer authorizer) {
    this.entityClass = entityClass;
    entityType = Entity.getEntityTypeFromClass(entityClass);
    allowedFields = Entity.getAllowedFields(entityClass);
    supportsOwner = allowedFields.contains(FIELD_OWNER);
    this.dao = repository;
    this.authorizer = authorizer;

    createOperationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    deleteOperationContext = new OperationContext(entityType, MetadataOperation.DELETE);

    listOperationContext = new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    getOperationContext = new OperationContext(entityType, MetadataOperation.VIEW_ALL);
  }

  public final Fields getFields(String fields) {
    if (fields != null && fields.equals("*")) {
      return new Fields(allowedFields, String.join(",", allowedFields));
    }
    return new Fields(allowedFields, fields);
  }

  public abstract T addHref(UriInfo uriInfo, T entity);

  public final ResultList<T> addHref(UriInfo uriInfo, ResultList<T> list) {
    listOrEmpty(list.getData()).forEach(i -> addHref(uriInfo, i));
    return list;
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after)
      throws IOException {
    RestUtil.validateCursors(before, after);
    authorizer.authorize(securityContext, listOperationContext, getResourceContext(), true);
    Fields fields = getFields(fieldsParam);

    ResultList<T> resultList;
    if (before != null) { // Reverse paging
      resultList = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else { // Forward paging or first page
      resultList = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, resultList);
  }

  public T getInternal(UriInfo uriInfo, SecurityContext securityContext, String id, String fieldsParam, Include include)
      throws IOException {
    authorizer.authorize(securityContext, getOperationContext, getResourceContextById(id), true);
    Fields fields = getFields(fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  public T getByNameInternal(
      UriInfo uriInfo, SecurityContext securityContext, String name, String fieldsParam, Include include)
      throws IOException {
    authorizer.authorize(securityContext, getOperationContext, getResourceContextByName(name), true);
    Fields fields = getFields(fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, name, fields, include));
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, T entity, boolean allowBots)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, allowBots);
    entity = addHref(uriInfo, dao.create(uriInfo, entity));
    LOG.info("Created {}:{}", Entity.getEntityTypeFromObject(entity), entity.getId());
    return Response.created(entity.getHref()).entity(entity).build();
  }

  public Response createOrUpdate(UriInfo uriInfo, SecurityContext securityContext, T entity, boolean allowBots)
      throws IOException {
    dao.prepare(entity);
    authorizer.authorize(
        securityContext, createOperationContext, getResourceContextByName(entity.getFullyQualifiedName()), allowBots);
    PutResponse<T> response = dao.createOrUpdate(uriInfo, entity);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response patchInternal(UriInfo uriInfo, SecurityContext securityContext, String id, JsonPatch patch)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id), true);
    PatchResponse<T> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response delete(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String id,
      boolean recursive,
      boolean hardDelete,
      boolean allowBots)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, allowBots);
    DeleteResponse<T> response = dao.delete(securityContext.getUserPrincipal().getName(), id, recursive, hardDelete);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response deleteByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      boolean recursive,
      boolean hardDelete,
      boolean allowBots)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, allowBots);
    DeleteResponse<T> response =
        dao.deleteByName(securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public T copy(T entity, CreateEntity request, String updatedBy) {
    entity.setId(UUID.randomUUID());
    entity.setName(request.getName());
    entity.setDisplayName(request.getDisplayName());
    entity.setDescription(request.getDescription());
    entity.setOwner(request.getOwner());
    entity.setExtension(request.getExtension());
    entity.setUpdatedBy(updatedBy);
    entity.setUpdatedAt(System.currentTimeMillis());
    return entity;
  }

  protected ResourceContext getResourceContext() {
    return ResourceContext.builder().resource(entityType).entityRepository(dao).build();
  }

  protected ResourceContext getResourceContextById(String id) {
    String fields = supportsOwner ? FIELD_OWNER : null;
    return ResourceContext.builder().resource(entityType).entityRepository(dao).id(id).fields(fields).build();
  }

  protected ResourceContext getResourceContextByName(String name) {
    String fields = supportsOwner ? FIELD_OWNER : null;
    return ResourceContext.builder().resource(entityType).entityRepository(dao).name(name).fields(fields).build();
  }
}
