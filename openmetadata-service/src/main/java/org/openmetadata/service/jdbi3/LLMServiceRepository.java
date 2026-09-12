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
package org.openmetadata.service.jdbi3;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.LLMConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.service.EntityServiceAssembly;
import org.openmetadata.service.entity.service.EntityServiceOperations;
import org.openmetadata.service.entity.service.EntityServicePolicy;
import org.openmetadata.service.resources.services.llm.LLMServiceResource;

@Slf4j
@Repository
public class LLMServiceRepository implements EntityServicePolicy<LLMService, LLMConnection> {

  public LLMServiceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                LLMServiceResource.COLLECTION_PATH,
                Entity.LLM_SERVICE,
                LLMService.class,
                Entity.getCollectionDAO().llmServiceDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    this.serviceOperations =
        EntityServiceAssembly.create(this, LLMConnection.class, ServiceType.LLM);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
  }

  private final EntityPolicyContext<LLMService> entityContext;

  private final EntityServiceOperations<LLMService, LLMConnection> serviceOperations;

  @Override
  public final EntityPolicyContext<LLMService> context() {
    return entityContext;
  }

  @Override
  public final EntityServiceOperations<LLMService, LLMConnection> serviceOperations() {
    return serviceOperations;
  }
}
