package org.openmetadata.catalog.resources;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
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

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after)
      throws GeneralSecurityException, IOException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(allowedFields, fieldsParam);

    ResultList<T> resultList;
    if (before != null) { // Reverse paging
      resultList = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else { // Forward paging or first page
      resultList = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, resultList);
  }

  public T getInternal(UriInfo uriInfo, SecurityContext securityContext, String id, String fieldsParam, Include include)
      throws IOException, ParseException {
    Fields fields = new Fields(allowedFields, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  public T getByNameInternal(
      UriInfo uriInfo, SecurityContext securityContext, String name, String fieldsParam, Include include)
      throws IOException, ParseException {
    Fields fields = new Fields(allowedFields, fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, name, fields, include));
  }
}
