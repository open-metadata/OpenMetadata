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

package org.openmetadata.service.services.domains;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.Map;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.domains.DomainMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DOMAIN)
public class DomainService extends EntityBaseService<Domain, DomainRepository> {

  public static final String FIELDS =
      "tags,children,childrenCount,owners,experts,extension,followers";

  @Getter private final DomainMapper mapper;

  @Inject
  public DomainService(
      DomainRepository repository, Authorizer authorizer, DomainMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.DOMAIN, Domain.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Domain addHref(UriInfo uriInfo, Domain domain) {
    super.addHref(uriInfo, domain);
    Entity.withHref(uriInfo, domain.getFollowers());
    Entity.withHref(uriInfo, domain.getExperts());
    Entity.withHref(uriInfo, domain.getReviewers());
    Entity.withHref(uriInfo, domain.getChildren());
    Entity.withHref(uriInfo, domain.getDomains());
    Entity.withHref(uriInfo, domain.getDataProducts());
    Entity.withHref(uriInfo, domain.getParent());
    return domain;
  }

  public BulkOperationResult bulkAddAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkAddAssets(name, request);
  }

  public BulkOperationResult bulkRemoveAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkRemoveAssets(name, request);
  }

  public ResultList<EntityHierarchy> buildHierarchy(
      String fieldsParam, int limit, String directChildrenOf, int offset) {
    return repository.buildHierarchy(fieldsParam, limit, directChildrenOf, offset);
  }

  public RestUtil.PutResponse<Domain> addDomainFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Domain> deleteDomainFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public ResultList<EntityReference> getDomainAssets(UUID id, int limit, int offset) {
    return repository.getDomainAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getDomainAssetsByName(String fqn, int limit, int offset) {
    return repository.getDomainAssetsByName(fqn, limit, offset);
  }

  public Map<String, Integer> getAllDomainsWithAssetsCount() {
    return repository.getAllDomainsWithAssetsCount();
  }

  private void authorizeEditAll(SecurityContext securityContext, String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
  }

  public static class DomainList extends ResultList<Domain> {
    @SuppressWarnings("unused")
    public DomainList() {}
  }
}
