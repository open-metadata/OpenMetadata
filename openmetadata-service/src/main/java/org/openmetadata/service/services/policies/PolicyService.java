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
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.policies.PolicyMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.POLICY)
public class PolicyService extends EntityBaseService<Policy, PolicyRepository> {

  public static final String FIELDS = "owners,location,teams,roles";

  @Getter private final PolicyMapper mapper;

  @Inject
  public PolicyService(
      PolicyRepository repository, Authorizer authorizer, PolicyMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.POLICY, Policy.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Policy addHref(UriInfo uriInfo, Policy policy) {
    super.addHref(uriInfo, policy);
    Entity.withHref(uriInfo, policy.getTeams());
    Entity.withHref(uriInfo, policy.getRoles());
    return policy;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("location,teams,roles", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public void initialize() {
    repository.initSeedDataFromResources();
  }

  public void validateCondition(SecurityContext securityContext, String expression) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    CompiledRule.validateExpression(expression, Boolean.class);
  }

  public static class PolicyList extends ResultList<Policy> {
    /* Required for serde */
  }
}
