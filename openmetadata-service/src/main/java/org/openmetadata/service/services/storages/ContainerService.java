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

package org.openmetadata.service.services.storages;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContainerRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.storages.ContainerMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.CONTAINER)
public class ContainerService extends EntityBaseService<Container, ContainerRepository> {

  public static final String FIELDS =
      "parent,children,dataModel,owners,tags,followers,extension,domains,sourceHash";

  @Getter private final ContainerMapper mapper;

  @Inject
  public ContainerService(
      ContainerRepository repository,
      Authorizer authorizer,
      ContainerMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.CONTAINER, Container.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public Container addHref(UriInfo uriInfo, Container container) {
    super.addHref(uriInfo, container);
    Entity.withHref(uriInfo, container.getService());
    Entity.withHref(uriInfo, container.getParent());
    return container;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("parent,children,dataModel", MetadataOperation.VIEW_BASIC);
    return listOf();
  }

  public RestUtil.PutResponse<Container> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return repository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Container> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return repository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Container> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public ResultList<Container> listChildren(String fqn, Integer limit, Integer offset) {
    return repository.listChildren(fqn, limit, offset);
  }

  public static class ContainerList extends ResultList<Container> {}
}
