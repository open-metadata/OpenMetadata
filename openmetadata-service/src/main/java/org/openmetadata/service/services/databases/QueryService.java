/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.services.databases;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.QueryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.query.QueryMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.QUERY)
public class QueryService extends EntityBaseService<Query, QueryRepository> {

  public static final String FIELDS = "owners,followers,users,votes,tags,queryUsedIn";
  @Getter private final QueryMapper mapper;

  public static class QueryList extends ResultList<Query> {}

  @Inject
  public QueryService(
      QueryRepository repository, Authorizer authorizer, QueryMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.QUERY, Query.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("users,queryUsedIn", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public Query addHref(UriInfo uriInfo, Query entity) {
    super.addHref(uriInfo, entity);
    Entity.withHref(uriInfo, entity.getUsers());
    Entity.withHref(uriInfo, entity.getQueryUsedIn());
    return entity;
  }

  public RestUtil.PutResponse<Query> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Query> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Query> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public RestUtil.PutResponse<?> addQueryUsage(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, List<EntityReference> entityIds) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.addQueryUsage(
        uriInfo, securityContext.getUserPrincipal().getName(), id, entityIds);
  }

  public RestUtil.PutResponse<?> addQueryUsers(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, List<String> userFqnList) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.addQueryUser(
        uriInfo, securityContext.getUserPrincipal().getName(), id, userFqnList);
  }

  public RestUtil.PutResponse<?> addQueryUsedBy(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, List<String> usedByList) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.addQueryUsedBy(
        uriInfo, securityContext.getUserPrincipal().getName(), id, usedByList);
  }

  public RestUtil.PutResponse<?> removeQueryUsedIn(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, List<EntityReference> entityIds) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.removeQueryUsedIn(
        uriInfo, securityContext.getUserPrincipal().getName(), id, entityIds);
  }
}
