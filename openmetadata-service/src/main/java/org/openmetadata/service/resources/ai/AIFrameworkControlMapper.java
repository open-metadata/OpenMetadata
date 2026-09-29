/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.ai.CreateAIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class AIFrameworkControlMapper
    implements EntityMapper<AIFrameworkControl, CreateAIFrameworkControl> {
  @Override
  public AIFrameworkControl createToEntity(CreateAIFrameworkControl create, String user) {
    return copy(new AIFrameworkControl(), create, user)
        .withFramework(getEntityReference(Entity.AI_GOVERNANCE_FRAMEWORK, create.getFramework()))
        .withCode(create.getCode())
        .withCategory(create.getCategory())
        .withEvidenceRequirements(create.getEvidenceRequirements());
  }
}
