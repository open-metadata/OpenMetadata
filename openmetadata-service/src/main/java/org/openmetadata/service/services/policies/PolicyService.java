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

package org.openmetadata.service.services.policies;

import jakarta.ws.rs.core.SecurityContext;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.resources.policies.PolicyMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.POLICY)
public class PolicyService extends AbstractEntityService<Policy> {

  @Getter private final PolicyMapper mapper;

  @Inject
  public PolicyService(
      PolicyRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      PolicyMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.POLICY);
    this.mapper = mapper;
  }

  public void validateCondition(SecurityContext securityContext, String expression) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    CompiledRule.validateExpression(expression, Boolean.class);
  }
}
