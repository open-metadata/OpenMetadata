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

package org.openmetadata.service.services.pipelines;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PipelineRepository;
import org.openmetadata.service.resources.pipelines.PipelineMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.PIPELINE)
public class PipelineService extends AbstractEntityService<Pipeline> {

  @Getter private final PipelineMapper mapper;
  private final PipelineRepository pipelineRepository;

  @Inject
  public PipelineService(
      PipelineRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      PipelineMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.PIPELINE);
    this.pipelineRepository = repository;
    this.mapper = mapper;
  }

  public RestUtil.PutResponse<?> addPipelineStatus(
      SecurityContext securityContext, String fqn, PipelineStatus pipelineStatus) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return pipelineRepository.addPipelineStatus(fqn, pipelineStatus);
  }

  public Pipeline deletePipelineStatus(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, Long timestamp) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    Pipeline pipeline = pipelineRepository.deletePipelineStatus(fqn, timestamp);
    return addHref(uriInfo, pipeline);
  }

  public RestUtil.PutResponse<Pipeline> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return pipelineRepository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Pipeline> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return pipelineRepository.deleteFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Pipeline> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return pipelineRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  private Pipeline addHref(UriInfo uriInfo, Pipeline pipeline) {
    Entity.withHref(uriInfo, pipeline.getOwners());
    Entity.withHref(uriInfo, pipeline.getFollowers());
    Entity.withHref(uriInfo, pipeline.getService());
    return pipeline;
  }
}
