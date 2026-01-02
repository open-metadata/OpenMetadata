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
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.APIEndpointRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.apis.APIEndpointMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

/**
 * Service layer for APIEndpoint entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.API_ENDPOINT)
public class APIEndpointService extends EntityBaseService<APIEndpoint, APIEndpointRepository> {

  @Getter private final APIEndpointMapper mapper;
  public static final String FIELDS =
      "owners,followers,tags,extension,domains,dataProducts,sourceHash";

  @Inject
  public APIEndpointService(
      APIEndpointRepository repository,
      Authorizer authorizer,
      APIEndpointMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.API_ENDPOINT, APIEndpoint.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public APIEndpoint addHref(UriInfo uriInfo, APIEndpoint apiEndpoint) {
    super.addHref(uriInfo, apiEndpoint);
    Entity.withHref(uriInfo, apiEndpoint.getApiCollection());
    Entity.withHref(uriInfo, apiEndpoint.getService());
    return apiEndpoint;
  }

  public Response updateVote(String updatedBy, UUID id, VoteRequest request) {
    return repository.updateVote(updatedBy, id, request).toResponse();
  }

  public Response bulkCreateOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<CreateAPIEndpoint> createRequests,
      EntityMapper<APIEndpoint, CreateAPIEndpoint> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class APIEndpointList extends ResultList<APIEndpoint> {
    /* Required for serde */
  }
}
