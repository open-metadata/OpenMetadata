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

package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;

class MemoryReviewHoldsTest {

  private static final String HOURS = "What are the Heronfield support desk hours?";

  /** Only a memory still stating its value can give another one; a legacy one has no stage. */
  @ParameterizedTest
  @CsvSource({
    "APPROVED, true",
    "UNPROCESSED, true",
    "DRAFT, true",
    "REJECTED, false",
    "SUPERSEDED, false",
    "INVALIDATED, false",
    "DEPRECATED, false",
    "ARCHIVED, false"
  })
  void onlyAStatedValueIsAnotherValue(ContextMemoryStatus stage, boolean another) {
    assertEquals(
        another,
        MemoryReviewHolds.givesAnotherValue(
            memory(HOURS, "9:00 to 17:00 CET").withEntityStatus(stage),
            memory(HOURS, "8:00 to 20:00 CET")));
  }

  @Test
  void aStagelessMemoryStatesItsValue() {
    assertTrue(
        MemoryReviewHolds.givesAnotherValue(
            memory(HOURS, "9:00 to 17:00 CET").withEntityStatus(null),
            memory(HOURS, "8:00 to 20:00 CET")));
    assertTrue(MemoryReviewHolds.isApproved(new ContextMemory()));
  }

  /** "What's" asks what "What is" asks; another question, or the same answer, is no other value. */
  @Test
  void anotherValueAnswersTheSameQuestionOtherwise() {
    ContextMemory approved = memory("What is the refund window?", "30 days");

    assertTrue(
        MemoryReviewHolds.givesAnotherValue(
            approved, memory("What's the refund window", "45 days")));
    assertFalse(
        MemoryReviewHolds.givesAnotherValue(
            approved, memory("What is the refund fee?", "45 days")));
    assertFalse(
        MemoryReviewHolds.givesAnotherValue(
            approved, memory("What is the refund window?", "  30   DAYS (section 4)")));
  }

  private static ContextMemory memory(String question, String answer) {
    return new ContextMemory()
        .withQuestion(question)
        .withAnswer(answer)
        .withEntityStatus(ContextMemoryStatus.APPROVED);
  }
}
