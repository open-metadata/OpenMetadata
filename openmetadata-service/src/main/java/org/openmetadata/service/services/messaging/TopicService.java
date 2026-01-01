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

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TopicRepository;
import org.openmetadata.service.resources.topics.TopicMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.TOPIC)
public class TopicService extends AbstractEntityService<Topic> {

  @Getter private final TopicMapper mapper;
  private final TopicRepository topicRepository;

  @Inject
  public TopicService(
      TopicRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TopicMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.TOPIC);
    this.topicRepository = repository;
    this.mapper = mapper;
  }

  public Topic addSampleData(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, TopicSampleData sampleData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Topic topic = topicRepository.addSampleData(id, sampleData);
    return addHref(uriInfo, topic);
  }

  public Topic getSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());
    Topic topic = topicRepository.getSampleData(id, authorizePII);
    return addHref(uriInfo, topic);
  }

  public RestUtil.PutResponse<Topic> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return topicRepository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Topic> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return topicRepository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Topic> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return topicRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  private Topic addHref(UriInfo uriInfo, Topic topic) {
    Entity.withHref(uriInfo, topic.getOwners());
    Entity.withHref(uriInfo, topic.getFollowers());
    Entity.withHref(uriInfo, topic.getService());
    return topic;
  }
}
