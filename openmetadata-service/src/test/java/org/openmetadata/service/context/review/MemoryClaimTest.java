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
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class MemoryClaimTest {

  private static final EntityReference ORDERS =
      new EntityReference()
          .withId(UUID.randomUUID())
          .withType(Entity.TABLE)
          .withName("fact_order")
          .withDisplayName("Orders");

  @Test
  void aClaimStatesWhatTheMemoryHoldsAndWhatItIsAbout() {
    ContextMemory memory =
        memory()
            .withName("orders_policy.pdf-4f1c")
            .withTitle("Active customer: three orders")
            .withQuestion("Who counts as an active customer?")
            .withAnswer("Three completed orders in 90 days.")
            .withEntityStatus(ContextMemoryStatus.DRAFT)
            .withPrimaryEntity(ORDERS);

    MemoryClaim claim = MemoryClaim.of(memory);

    assertEquals(memory.getId(), claim.id());
    assertEquals("orders_policy.pdf-4f1c", claim.name());
    assertEquals("Active customer: three orders", claim.title());
    assertEquals("Who counts as an active customer?", claim.question());
    assertEquals("Three completed orders in 90 days.", claim.answer());
    assertEquals("Draft", claim.status());
    assertEquals(ORDERS, claim.anchor());
  }

  @Test
  void aClaimSaysWhereTheMemoryCameFromAndWhoOwnsIt() {
    EntityReference policy =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.CONTEXT_FILE)
            .withName("orders_policy.pdf");
    EntityReference ana =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.USER)
            .withName("ana")
            .withDisplayName("Ana");

    MemoryClaim extracted =
        MemoryClaim.of(memory().withSourceEntity(policy).withOwners(List.of(ana)));
    MemoryClaim typed =
        MemoryClaim.of(
            memory().withSourceType(ContextMemorySourceType.MANUAL).withUpdatedBy("joe"));

    assertEquals("orders_policy.pdf", extracted.source());
    assertEquals("Ana", extracted.author());
    assertEquals("Manual", typed.source());
    assertEquals("joe", typed.author());
  }

  /** Revalidation moves an old memory back to review without changing what it says. */
  @Test
  void aClaimIsDatedByItsContentNotItsLastWrite() {
    MemoryClaim revalidated =
        MemoryClaim.of(memory().withLastContentUpdatedAt(100L).withUpdatedAt(900L));
    MemoryClaim neverEdited = MemoryClaim.of(memory().withUpdatedAt(900L));

    assertEquals(100L, revalidated.contentUpdatedAt());
    assertEquals(900L, neverEdited.contentUpdatedAt());
  }

  @Test
  void aLongAnswerIsCapped() {
    String answer = "x".repeat(MemoryClaim.MAX_ANSWER_LENGTH + 50);

    MemoryClaim claim = MemoryClaim.of(memory().withAnswer(answer));

    assertEquals(MemoryClaim.MAX_ANSWER_LENGTH, claim.answer().length());
    assertEquals('…', claim.answer().charAt(MemoryClaim.MAX_ANSWER_LENGTH - 1));
  }

  @Test
  void aMemoryWithNothingToSayHasNoSourceOrStatus() {
    MemoryClaim claim = MemoryClaim.of(memory().withSourceType(null));

    assertNull(claim.source());
    assertNull(claim.status());
    assertNull(claim.answer());
  }

  private static ContextMemory memory() {
    return new ContextMemory().withId(UUID.randomUUID()).withName("memory").withTitle("Memory");
  }
}
