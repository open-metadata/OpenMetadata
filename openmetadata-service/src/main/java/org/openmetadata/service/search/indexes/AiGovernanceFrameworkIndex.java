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
package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.service.Entity;

public class AiGovernanceFrameworkIndex implements TaggableIndex {
  final AIGovernanceFramework framework;

  public AiGovernanceFrameworkIndex(AIGovernanceFramework framework) {
    this.framework = framework;
  }

  @Override
  public Object getEntity() {
    return framework;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.AI_GOVERNANCE_FRAMEWORK;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
