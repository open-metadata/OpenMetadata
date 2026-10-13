/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.context.review;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.EntityReference;

/**
 * One side of a memory conflict as a reviewer compares it: what the memory claims, what it is
 * about, where it came from and when its content last changed. A conflict review records it for
 * each side when it opens, and a decision is refused once a contradicted memory's content changes,
 * so the claim a reviewer reads is the one the decision acts on.
 */
record MemoryClaim(
    UUID id,
    String name,
    String title,
    String question,
    String answer,
    String status,
    Long contentUpdatedAt,
    EntityReference anchor,
    String source,
    String author) {

  /** Room for any stated claim while a task with several contradictions stays small. */
  static final int MAX_ANSWER_LENGTH = 1000;

  static MemoryClaim of(ContextMemory memory) {
    return new MemoryClaim(
        memory.getId(),
        memory.getName(),
        MemoryConflictReviewTasks.label(memory),
        memory.getQuestion(),
        capped(memory.getAnswer()),
        memory.getEntityStatus() == null ? null : memory.getEntityStatus().value(),
        contentUpdatedAt(memory),
        memory.getPrimaryEntity(),
        sourceOf(memory),
        authorOf(memory));
  }

  private static String capped(String answer) {
    boolean fits = answer == null || answer.length() <= MAX_ANSWER_LENGTH;
    return fits ? answer : answer.substring(0, MAX_ANSWER_LENGTH - 1) + "…";
  }

  /** Revalidation returns an old memory to review without touching its content. */
  private static Long contentUpdatedAt(ContextMemory memory) {
    Long contentUpdatedAt = memory.getLastContentUpdatedAt();
    return contentUpdatedAt == null ? memory.getUpdatedAt() : contentUpdatedAt;
  }

  /** The file or page the memory was extracted from, else how it was made. */
  private static String sourceOf(ContextMemory memory) {
    EntityReference source = memory.getSourceEntity();
    String howItWasMade = memory.getSourceType() == null ? null : memory.getSourceType().value();
    return source == null ? howItWasMade : nameOf(source);
  }

  private static String authorOf(ContextMemory memory) {
    List<EntityReference> owners = listOrEmpty(memory.getOwners());
    return owners.isEmpty() ? memory.getUpdatedBy() : nameOf(owners.getFirst());
  }

  private static String nameOf(EntityReference reference) {
    String displayName = reference.getDisplayName();
    return nullOrEmpty(displayName) ? reference.getName() : displayName;
  }
}
