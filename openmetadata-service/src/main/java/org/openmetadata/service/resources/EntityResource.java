package org.openmetadata.service.resources;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ResultList;

@Slf4j
public abstract class EntityResource<T extends EntityInterface, K extends EntityRepository<T>> {
  protected final Class<T> entityClass;
  protected final String entityType;
  protected final List<String> allowedFields;
  protected final K dao;
  protected final Authorizer authorizer;

  protected EntityResource(Class<T> entityClass, K repository, Authorizer authorizer) {
    this.entityClass = entityClass;
    entityType = Entity.getEntityTypeFromClass(entityClass);
    allowedFields = Entity.getAllowedFields(entityClass);
    this.dao = repository;
    this.authorizer = authorizer;
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
    OperationContext listOperationContext = new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    return listInternal(
        uriInfo,
        securityContext,
        fieldsParam,
        filter,
        limitParam,
        before,
        after,
        listOperationContext,
        getResourceContext());
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after,
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    RestUtil.validateCursors(before, after);
    authorizer.authorize(securityContext, operationContext, resourceContext, true);
    Fields fields = getFields(fieldsParam);

    ResultList<T> resultList;
    if (before != null) { // Reverse paging
      resultList = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else { // Forward paging or first page
      resultList = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, resultList);
  }

  public T getInternal(UriInfo uriInfo, SecurityContext securityContext, UUID id, String fieldsParam, Include include)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    return getInternal(
        uriInfo, securityContext, id, fieldsParam, include, operationContext, getResourceContextById(id));
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include,
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    authorizer.authorize(securityContext, operationContext, resourceContext, true);
    Fields fields = getFields(fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  public T getByNameInternal(
      UriInfo uriInfo, SecurityContext securityContext, String name, String fieldsParam, Include include)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    return getByNameInternal(
        uriInfo, securityContext, name, fieldsParam, include, operationContext, getResourceContextByName(name));
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include,
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    authorizer.authorize(securityContext, operationContext, resourceContext, true);
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
    OperationContext createOperationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    dao.prepare(entity);
    authorizer.authorize(
        securityContext, createOperationContext, getResourceContextByName(entity.getFullyQualifiedName()), allowBots);
    PutResponse<T> response = dao.createOrUpdate(uriInfo, entity);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response patchInternal(UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id), true);
    PatchResponse<T> response = dao.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response delete(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete,
      boolean allowBots)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id), true);
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
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name), true);
    DeleteResponse<T> response =
        dao.deleteByName(securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public T copy(T entity, CreateEntity request, String updatedBy) throws IOException {
    EntityReference owner = dao.validateOwner(request.getOwner());
    entity.setId(UUID.randomUUID());
    entity.setName(request.getName());
    entity.setDisplayName(request.getDisplayName());
    entity.setDescription(request.getDescription());
    entity.setOwner(owner);
    entity.setExtension(request.getExtension());
    entity.setUpdatedBy(updatedBy);
    entity.setUpdatedAt(System.currentTimeMillis());
    return entity;
  }

  protected ResourceContext getResourceContext() {
    return ResourceContext.builder().resource(entityType).entityRepository(dao).build();
  }

  protected ResourceContext getResourceContextById(UUID id) {
    return ResourceContext.builder().resource(entityType).entityRepository(dao).id(id).build();
  }

  protected ResourceContext getResourceContextByName(String name) {
    return ResourceContext.builder().resource(entityType).entityRepository(dao).name(name).build();
  }
}
