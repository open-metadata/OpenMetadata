/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.context;

import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.service.mapper.EntityMapper;

public class ContextMemoryMapper implements EntityMapper<ContextMemory, CreateContextMemory> {
  @Override
  public ContextMemory createToEntity(CreateContextMemory create, String user) {
    // copy() owns the common fields: it sanitizes description and validates owners,
    // domains, and reviewers. Re-setting them here would reintroduce the raw
    // (unsanitized/unvalidated) values, so only ContextMemory-specific fields are set.
    return copy(new ContextMemory(), create, user)
        .withTitle(create.getTitle())
        .withSummary(create.getSummary())
        .withQuestion(create.getQuestion())
        .withAnswer(create.getAnswer())
        .withMemoryType(create.getMemoryType())
        .withMemoryScope(create.getMemoryScope())
        .withStatus(create.getStatus())
        .withShareConfig(create.getShareConfig())
        .withPrimaryEntity(create.getPrimaryEntity())
        .withRelatedEntities(create.getRelatedEntities())
        .withSourceType(create.getSourceType())
        .withSourceConversation(create.getSourceConversation())
        .withSourceHumanMessage(create.getSourceHumanMessage())
        .withSourceAssistantMessage(create.getSourceAssistantMessage())
        .withRootMemory(create.getRootMemory())
        .withParentMemory(create.getParentMemory())
        .withMachineRepresentation(create.getMachineRepresentation());
  }
}
