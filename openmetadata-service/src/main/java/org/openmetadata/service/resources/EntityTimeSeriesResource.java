package org.openmetadata.service.resources;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.List;
import lombok.Getter;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

public abstract class EntityTimeSeriesResource<
    T extends EntityTimeSeriesInterface, K extends EntityTimeSeriesRepository<T>> {
  protected final Class<T> entityClass;
  protected final String entityType;
  @Getter protected final K repository;
  protected final Authorizer authorizer;

  public EntityTimeSeriesResource(String entityType, Authorizer authorizer) {
    this.entityType = entityType;
    this.entityClass = (Class<T>) Entity.getEntityClassFromType(entityType);
    this.repository = (K) Entity.getEntityTimeSeriesRepository(entityType);
    this.authorizer = authorizer;
    Entity.registerTimeSeriesResourcePermissions(entityType);
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    // Nothing to do in the default implementation
  }

  protected Response create(T entity, String extension, String recordFQN) {
    entity = repository.createNewRecord(entity, extension, recordFQN);
    return Response.ok(entity).build();
  }

  protected Response create(T entity, String recordFQN) {
    entity = repository.createNewRecord(entity, recordFQN);
    return Response.ok(entity).build();
  }

  protected ResultList<T> listInternalFromSearch(
      SecurityContext securityContext,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.listFromSearchWithOffset(
        fields, searchListFilter, limit, offset, searchSortFilter, q, queryString);
  }

  protected ResultList<T> listInternalFromSearch(
      SecurityContext securityContext,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic)
      throws IOException {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    return repository.listFromSearchWithOffset(
        fields, searchListFilter, limit, offset, searchSortFilter, q, queryString);
  }

  public ResultList<T> listLatestFromSearch(
      SecurityContext securityContext,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      String groupBy,
      String q,
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.listLatestFromSearch(fields, searchListFilter, groupBy, q);
  }

  public ResultList<T> listLatestFromSearch(
      SecurityContext securityContext,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      String groupBy,
      String q,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic)
      throws IOException {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    return repository.listLatestFromSearch(fields, searchListFilter, groupBy, q);
  }

  protected T latestInternalFromSearch(
      SecurityContext securityContext,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      String q,
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.latestFromSearch(fields, searchListFilter, q);
  }

  protected T latestInternalFromSearch(
      SecurityContext securityContext,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      String q,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic)
      throws IOException {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    return repository.latestFromSearch(fields, searchListFilter, q);
  }
}
