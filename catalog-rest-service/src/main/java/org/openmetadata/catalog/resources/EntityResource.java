package org.openmetadata.catalog.resources;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.util.ResultList;

public abstract class EntityResource<T, K extends EntityRepository<T>> {
  protected final List<String> allowedFields;
  protected final K dao;
  protected final Authorizer authorizer;

  public EntityResource(Class<T> entityClass, K repository, Authorizer authorizer) {
    allowedFields = Entity.getEntityFields(entityClass);
    this.dao = repository;
    this.authorizer = authorizer;
  }

  public abstract T addHref(UriInfo uriInfo, T entity);

  public final ResultList<T> addHref(UriInfo uriInfo, ResultList<T> list) {
    listOrEmpty(list.getData()).forEach(i -> addHref(uriInfo, i));
    return list;
  }
}
