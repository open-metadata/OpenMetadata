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
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.StoredProcedureRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.databases.StoredProcedureMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.STORED_PROCEDURE)
public class StoredProcedureService
    extends EntityBaseService<StoredProcedure, StoredProcedureRepository> {

  public static final String FIELDS = "owners,tags,followers,votes,extension,domains,sourceHash";

  @Getter private final StoredProcedureMapper mapper;

  @Inject
  public StoredProcedureService(
      StoredProcedureRepository repository,
      Authorizer authorizer,
      StoredProcedureMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.STORED_PROCEDURE, StoredProcedure.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public StoredProcedure addHref(UriInfo uriInfo, StoredProcedure storedProcedure) {
    super.addHref(uriInfo, storedProcedure);
    Entity.withHref(uriInfo, storedProcedure.getDatabaseSchema());
    Entity.withHref(uriInfo, storedProcedure.getDatabase());
    Entity.withHref(uriInfo, storedProcedure.getService());
    return storedProcedure;
  }

  public RestUtil.PutResponse<StoredProcedure> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public RestUtil.PutResponse<StoredProcedure> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return repository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<StoredProcedure> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return repository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public static class StoredProcedureList extends ResultList<StoredProcedure> {
    /* Required for serde */
  }
}
