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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.context.ExtractedMemoryApproval;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

class ExtractedMemoryApproverTest {

  private static ContextMemory pill(
      String question, ContextMemoryStatus status, ContextMemorySourceType sourceType) {
    UUID id = UUID.randomUUID();
    return new ContextMemory()
        .withId(id)
        .withName("pill-" + id)
        .withFullyQualifiedName("pill-" + id)
        .withQuestion(question)
        .withAnswer("An answer")
        .withEntityStatus(status)
        .withSourceType(sourceType);
  }

  private static ContextMemory extracted(String question, ContextMemoryStatus status) {
    return pill(question, status, ContextMemorySourceType.FILE_EXTRACTION);
  }

  private static List<UUID> ids(List<ContextMemory> memories) {
    return memories.stream().map(ContextMemory::getId).toList();
  }

  @Test
  void pendingPillsOfDistinctQuestionsAreApprovable() {
    ContextMemory window = extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory fee = extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(window, fee));

    assertEquals(ids(List.of(window, fee)), ids(plan.approvable()));
    assertEquals(List.of(), plan.needsDecision());
  }

  /** The extractor keeps two pills for one question only when their values conflict. */
  @Test
  void twoPendingValuesOfOneQuestionBothNeedADecision() {
    ContextMemory fifteen = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory twenty = extracted("  commission RATE? ", ContextMemoryStatus.UNPROCESSED);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(fifteen, twenty));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(fifteen, twenty)), ids(plan.needsDecision()));
  }

  /** An Approved value, a correction's included, or one in conflict review, contests the pill. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "DRAFT"})
  void aPendingPillBesideAnotherStatedValueNeedsADecision(ContextMemoryStatus stated) {
    ContextMemory pending = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory correction = pill("Commission rate?", stated, ContextMemorySourceType.MANUAL);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(pending, correction));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(pending)), ids(plan.needsDecision()));
  }

  /** A retired value no longer answers the question, so it contests nothing. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"REJECTED", "SUPERSEDED", "ARCHIVED", "DEPRECATED", "INVALIDATED"})
  void aRetiredValueOfTheSameQuestionDoesNotHoldThePill(ContextMemoryStatus retired) {
    ContextMemory pending = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);

    ExtractedMemoryApprover.Plan plan =
        ExtractedMemoryApprover.plan(List.of(pending, extracted("Commission rate?", retired)));

    assertEquals(ids(List.of(pending)), ids(plan.approvable()));
  }

  /** Only Unprocessed pills extraction made are approved: a Draft awaits its conflict review. */
  @Test
  void neitherADraftNorAPersonsPendingMemoryIsApprovable() {
    ContextMemory draft = extracted("Refund window?", ContextMemoryStatus.DRAFT);
    ContextMemory manual =
        pill("Refund fee?", ContextMemoryStatus.UNPROCESSED, ContextMemorySourceType.MANUAL);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(draft, manual));

    assertEquals(List.of(), plan.approvable());
    assertEquals(List.of(), plan.needsDecision());
  }

  @Test
  void aPreviewCountsWhatApprovalWouldDoAndNamesWhatItLeaves() {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory window = extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory fifteen = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory twenty = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(window, fifteen, twenty));

    ExtractedMemoryApproval preview = new ExtractedMemoryApprover(repository).preview(file);

    assertEquals(1, preview.getApproved());
    assertEquals(0, preview.getFailed());
    assertEquals(
        List.of(fifteen.getId(), twenty.getId()),
        preview.getNeedsDecision().stream().map(EntityReference::getId).toList());
  }
}
