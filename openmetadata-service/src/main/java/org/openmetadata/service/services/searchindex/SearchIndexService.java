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

package org.openmetadata.service.services.searchindex;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SearchIndexRepository;
import org.openmetadata.service.resources.searchindex.SearchIndexMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.SEARCH_INDEX)
public class SearchIndexService extends AbstractEntityService<SearchIndex> {

  @Getter private final SearchIndexMapper mapper;
  private final SearchIndexRepository searchIndexRepository;

  @Inject
  public SearchIndexService(
      SearchIndexRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      SearchIndexMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.SEARCH_INDEX);
    this.searchIndexRepository = repository;
    this.mapper = mapper;
  }

  public SearchIndex addSampleData(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, SearchIndexSampleData sampleData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    SearchIndex searchIndex = searchIndexRepository.addSampleData(id, sampleData);
    return addHref(uriInfo, searchIndex);
  }

  public SearchIndex getSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());
    SearchIndex searchIndex = searchIndexRepository.getSampleData(id, authorizePII);
    return addHref(uriInfo, searchIndex);
  }

  public RestUtil.PutResponse<SearchIndex> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return searchIndexRepository.addFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<SearchIndex> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return searchIndexRepository.deleteFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<SearchIndex> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return searchIndexRepository.updateVote(
        securityContext.getUserPrincipal().getName(), id, request);
  }

  private SearchIndex addHref(UriInfo uriInfo, SearchIndex searchIndex) {
    Entity.withHref(uriInfo, searchIndex.getOwners());
    Entity.withHref(uriInfo, searchIndex.getFollowers());
    Entity.withHref(uriInfo, searchIndex.getService());
    return searchIndex;
  }
}
