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

package org.openmetadata.service.services.messaging;

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
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TopicRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.topics.TopicMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.TOPIC)
public class TopicService extends EntityBaseService<Topic, TopicRepository> {

  @Getter private final TopicMapper mapper;
  public static final String FIELDS =
      "owners,followers,tags,extension,domains,dataProducts,sourceHash";

  @Inject
  public TopicService(
      TopicRepository repository, Authorizer authorizer, TopicMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.TOPIC, Topic.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Topic addHref(UriInfo uriInfo, Topic topic) {
    super.addHref(uriInfo, topic);
    Entity.withHref(uriInfo, topic.getService());
    return topic;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    return listOf(MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.EDIT_SAMPLE_DATA);
  }

  public Topic addSampleData(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, TopicSampleData sampleData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Topic topic = repository.addSampleData(id, sampleData);
    return addHref(uriInfo, topic);
  }

  public Topic getSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());
    Topic topic = repository.getSampleData(id, authorizePII);
    return addHref(uriInfo, topic);
  }

  public RestUtil.PutResponse<Topic> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Topic> deleteFollower(
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
      List<CreateTopic> createRequests,
      EntityMapper<Topic, CreateTopic> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class TopicList extends ResultList<Topic> {
    /* Required for serde */
  }
}
