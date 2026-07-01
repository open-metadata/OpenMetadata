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

package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

public class ContextMemoryIndex implements TaggableIndex {
  final ContextMemory memory;

  public ContextMemoryIndex(ContextMemory memory) {
    this.memory = memory;
  }

  @Override
  public Object getEntity() {
    return memory;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.CONTEXT_MEMORY;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("title", memory.getTitle());
    doc.put("summary", memory.getSummary());
    doc.put("question", memory.getQuestion());
    doc.put("answer", memory.getAnswer());
    doc.put("memoryType", memory.getMemoryType() != null ? memory.getMemoryType().value() : null);
    doc.put(
        "memoryScope", memory.getMemoryScope() != null ? memory.getMemoryScope().value() : null);
    doc.put("status", memory.getStatus() != null ? memory.getStatus().value() : null);
    doc.put("sourceType", memory.getSourceType() != null ? memory.getSourceType().value() : null);
    doc.put(
        "sourceConversation",
        memory.getSourceConversation() != null ? memory.getSourceConversation().toString() : null);
    doc.put(
        "sourceHumanMessage",
        memory.getSourceHumanMessage() != null ? memory.getSourceHumanMessage().toString() : null);
    doc.put(
        "sourceAssistantMessage",
        memory.getSourceAssistantMessage() != null
            ? memory.getSourceAssistantMessage().toString()
            : null);
    doc.put("usageCount", memory.getUsageCount() != null ? memory.getUsageCount() : 0);
    doc.put("lastUsedAt", memory.getLastUsedAt());

    applyShareConfig(doc);
    applyEntityReferences(doc);
    return doc;
  }

  private void applyShareConfig(Map<String, Object> doc) {
    if (memory.getShareConfig() == null) {
      doc.put("visibility", null);
      doc.put("sharedWithIds", List.of());
      return;
    }
    doc.put(
        "visibility",
        memory.getShareConfig().getVisibility() != null
            ? memory.getShareConfig().getVisibility().value()
            : null);
    List<String> sharedWithIds = new ArrayList<>();
    for (MemorySharedPrincipal principal : listOrEmpty(memory.getShareConfig().getSharedWith())) {
      if (principal == null
          || principal.getPrincipal() == null
          || principal.getPrincipal().getId() == null) {
        continue;
      }
      sharedWithIds.add(principal.getPrincipal().getId().toString());
    }
    doc.put("sharedWithIds", sharedWithIds);
  }

  private void applyEntityReferences(Map<String, Object> doc) {
    doc.put("primaryEntity", getEntityWithDisplayName(memory.getPrimaryEntity()));
    List<EntityReference> related = getEntitiesWithDisplayName(memory.getRelatedEntities());
    doc.put("relatedEntities", related);
    doc.put("rootMemory", getEntityWithDisplayName(memory.getRootMemory()));
    doc.put("parentMemory", getEntityWithDisplayName(memory.getParentMemory()));
    doc.put("sourceFile", getEntityWithDisplayName(memory.getSourceFile()));
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("question", 10.0f);
    fields.put("question.ngram", 1.0f);
    fields.put("answer", 5.0f);
    fields.put("title", 8.0f);
    fields.put("title.ngram", 1.0f);
    fields.put("summary", 3.0f);
    return fields;
  }
}
