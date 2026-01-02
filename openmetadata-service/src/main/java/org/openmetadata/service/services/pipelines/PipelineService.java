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
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.pipelines.PipelineMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.PIPELINE)
public class PipelineService extends EntityBaseService<Pipeline, PipelineRepository> {

  @Getter private final PipelineMapper mapper;
  public static final String FIELDS =
      "owners,tasks,pipelineStatus,followers,tags,extension,scheduleInterval,domains,sourceHash";

  @Inject
  public PipelineService(
      PipelineRepository repository, Authorizer authorizer, PipelineMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.PIPELINE, Pipeline.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Pipeline addHref(UriInfo uriInfo, Pipeline pipeline) {
    super.addHref(uriInfo, pipeline);
    Entity.withHref(uriInfo, pipeline.getService());
    return pipeline;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("tasks,pipelineStatus", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_LINEAGE, MetadataOperation.EDIT_STATUS);
  }

  public RestUtil.PutResponse<?> addPipelineStatus(
      SecurityContext securityContext, String fqn, PipelineStatus pipelineStatus) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.addPipelineStatus(fqn, pipelineStatus);
  }

  public Pipeline deletePipelineStatus(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, Long timestamp) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_STATUS);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    Pipeline pipeline = repository.deletePipelineStatus(fqn, timestamp);
    return addHref(uriInfo, pipeline);
  }

  public RestUtil.PutResponse<Pipeline> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Pipeline> deleteFollower(
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
      List<CreatePipeline> createRequests,
      EntityMapper<Pipeline, CreatePipeline> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class PipelineList extends ResultList<Pipeline> {
    /* Required for serde */
  }

  public static class PipelineStatusList extends ResultList<PipelineStatus> {
    /* Required for serde */
  }
}
