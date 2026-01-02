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

package org.openmetadata.service.services.apis;

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
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.APICollectionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.apis.APICollectionMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

/**
 * Service layer for APICollection entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.API_COLLECTION)
public class APICollectionService
    extends EntityBaseService<APICollection, APICollectionRepository> {

  @Getter private final APICollectionMapper mapper;
  public static final String FIELDS = "owners,apiEndpoints,tags,extension,domains,sourceHash";

  @Inject
  public APICollectionService(
      APICollectionRepository repository,
      Authorizer authorizer,
      APICollectionMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.API_COLLECTION, APICollection.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public APICollection addHref(UriInfo uriInfo, APICollection apiCollection) {
    super.addHref(uriInfo, apiCollection);
    Entity.withHref(uriInfo, apiCollection.getService());
    return apiCollection;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("apiEndpoints", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public Response updateVote(String updatedBy, UUID id, VoteRequest request) {
    return repository.updateVote(updatedBy, id, request).toResponse();
  }

  public Response bulkCreateOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<CreateAPICollection> createRequests,
      EntityMapper<APICollection, CreateAPICollection> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class APICollectionList extends ResultList<APICollection> {
    /* Required for serde */
  }
}
