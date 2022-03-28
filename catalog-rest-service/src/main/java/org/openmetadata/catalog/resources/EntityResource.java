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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

public abstract class EntityResource<T, K extends EntityRepository<T>> {
  protected final List<String> allowedFields;
  protected final K dao;
  protected final Authorizer authorizer;
  private final boolean supportsOwner;

  public EntityResource(Class<T> entityClass, K repository, Authorizer authorizer) {
    allowedFields = Entity.getEntityFields(entityClass);
    supportsOwner = allowedFields.contains(FIELD_OWNER);
    this.dao = repository;
    this.authorizer = authorizer;
  }

  public final Fields getFields(String fields) {
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
    Fields fields = getFields(fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  public T getByNameInternal(
      UriInfo uriInfo, SecurityContext securityContext, String name, String fieldsParam, Include include)
      throws IOException {
    Fields fields = getFields(fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, name, fields, include));
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, T entity, int flags) throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, flags);
    entity = addHref(uriInfo, dao.create(uriInfo, entity));
    EntityInterface<T> entityInterface = dao.getEntityInterface(entity);
    return Response.created(entityInterface.getHref()).entity(entity).build();
  }

  public Response createOrUpdate(UriInfo uriInfo, SecurityContext securityContext, T entity, int checkFlags)
      throws IOException {
    EntityReference owner = SecurityUtil.checkOwner(checkFlags) ? dao.getOriginalOwner(entity) : null;
    SecurityUtil.authorize(authorizer, securityContext, null, owner, checkFlags);
    PutResponse<T> response = dao.createOrUpdate(uriInfo, entity);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response patchInternal(UriInfo uriInfo, SecurityContext securityContext, String id, JsonPatch patch)
      throws IOException {
    T entity = dao.get(uriInfo, id, supportsOwner ? getFields(FIELD_OWNER) : Fields.EMPTY_FIELDS);
    EntityInterface<T> entityInterface = dao.getEntityInterface(entity);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, entityInterface.getEntityReference(), entityInterface.getOwner(), patch);
    PatchResponse<T> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response delete(UriInfo uriInfo, SecurityContext securityContext, String id, boolean recursive, int checkFlags)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, checkFlags);
    DeleteResponse<T> response = dao.delete(securityContext.getUserPrincipal().getName(), id, recursive);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }
}
