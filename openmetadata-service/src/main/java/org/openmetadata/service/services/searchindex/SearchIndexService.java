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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SearchIndexRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.searchindex.SearchIndexMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.SEARCH_INDEX)
public class SearchIndexService extends EntityBaseService<SearchIndex, SearchIndexRepository> {

  @Getter private final SearchIndexMapper mapper;
  public static final String FIELDS =
      "owners,followers,tags,extension,domains,dataProducts,sourceHash";

  @Inject
  public SearchIndexService(
      SearchIndexRepository repository,
      Authorizer authorizer,
      SearchIndexMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.SEARCH_INDEX, SearchIndex.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public SearchIndex addHref(UriInfo uriInfo, SearchIndex searchIndex) {
    super.addHref(uriInfo, searchIndex);
    Entity.withHref(uriInfo, searchIndex.getService());
    return searchIndex;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    return listOf(MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.EDIT_SAMPLE_DATA);
  }

  public SearchIndex addSampleData(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, SearchIndexSampleData sampleData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    SearchIndex searchIndex = repository.addSampleData(id, sampleData);
    return addHref(uriInfo, searchIndex);
  }

  public SearchIndex getSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());
    SearchIndex searchIndex = repository.getSampleData(id, authorizePII);
    return addHref(uriInfo, searchIndex);
  }

  public RestUtil.PutResponse<SearchIndex> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<SearchIndex> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public Response updateVote(SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  public Response bulkCreateOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<CreateSearchIndex> createRequests,
      EntityMapper<SearchIndex, CreateSearchIndex> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class SearchIndexList extends ResultList<SearchIndex> {
    /* Required for serde */
  }
}
