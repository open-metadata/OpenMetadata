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

package org.openmetadata.service.services.ai;

import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AgentExecution;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AgentExecutionRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.AgentExecutionContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
@Singleton
public class AgentExecutionService {

  private static final String ENTITY_TYPE = Entity.AGENT_EXECUTION;

  @Getter private final AgentExecutionRepository repository;
  private final Authorizer authorizer;

  @Inject
  public AgentExecutionService(AgentExecutionRepository repository, Authorizer authorizer) {
    this.repository = repository;
    this.authorizer = authorizer;
  }

  public ResultList<AgentExecution> list(
      SecurityContext securityContext, ListFilter filter, int limit, Long startTs, Long endTs) {
    OperationContext operationContext =
        new OperationContext(ENTITY_TYPE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    if (startTs != null && endTs != null) {
      return repository.listWithOffset(null, filter, limit, startTs, endTs, false, false);
    }
    return repository.listWithOffset(null, filter, limit, false);
  }

  public AgentExecution getById(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(ENTITY_TYPE, MetadataOperation.VIEW_BASIC);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    return repository.getById(id);
  }

  public AgentExecution create(SecurityContext securityContext, AgentExecution entity) {
    OperationContext operationContext = new OperationContext(ENTITY_TYPE, MetadataOperation.CREATE);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    return repository.createNewRecord(entity, entity.getAgentId().toString());
  }

  public void deleteExecutionData(SecurityContext securityContext, UUID agentId, Long timestamp) {
    OperationContext operationContext = new OperationContext(ENTITY_TYPE, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    repository.deleteExecutionData(agentId, timestamp);
  }

  public void deleteById(SecurityContext securityContext, UUID id, boolean hardDelete) {
    OperationContext operationContext = new OperationContext(ENTITY_TYPE, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = AgentExecutionContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    repository.deleteById(id, hardDelete);
  }
}
