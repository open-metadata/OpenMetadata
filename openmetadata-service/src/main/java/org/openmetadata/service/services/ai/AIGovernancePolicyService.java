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

import jakarta.ws.rs.core.UriInfo;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.ai.AIGovernancePolicyMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

/**
 * Service layer for AIGovernancePolicy entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.AI_GOVERNANCE_POLICY)
public class AIGovernancePolicyService
    extends EntityBaseService<AIGovernancePolicy, AIGovernancePolicyRepository> {

  @Getter private final AIGovernancePolicyMapper mapper;
  public static final String FIELDS = "owners,followers,tags,extension,domains";

  @Inject
  public AIGovernancePolicyService(
      AIGovernancePolicyRepository repository,
      Authorizer authorizer,
      AIGovernancePolicyMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.AI_GOVERNANCE_POLICY, AIGovernancePolicy.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  protected AIGovernancePolicy addHref(UriInfo uriInfo, AIGovernancePolicy policy) {
    super.addHref(uriInfo, policy);
    return policy;
  }

  public static class AIGovernancePolicyList extends ResultList<AIGovernancePolicy> {
    /* Required for serde */
  }
}
