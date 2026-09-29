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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class ContextMemoryLifecycleTest {

  private static final ContextMemoryLifecycle.MemoryResolver RESOLVE =
      (reference, field) ->
          new EntityReference()
              .withId(reference.getId())
              .withType(Entity.CONTEXT_MEMORY)
              .withName("memory-" + reference.getId());

  private static final ContextMemoryLifecycle.MemoryResolver NO_LOOKUP =
      (reference, field) -> {
        throw new AssertionError(field + " must not be looked up");
      };

  @Test
  void leavingSupersededDropsTheSuccessorAndStaleReason() {
    ContextMemory original =
        memory(ContextMemoryStatus.SUPERSEDED)
            .withSupersededBy(memoryRef())
            .withStatusReason("Duplicate of the keeper");
    ContextMemory updated = copyOf(original).withStatus(ContextMemoryStatus.ACTIVE);

    ContextMemoryLifecycle.applyUpdate(original, updated, NO_LOOKUP);

    assertNull(updated.getSupersededBy());
    assertNull(updated.getStatusReason());
  }

  @Test
  void aStatusChangeKeepsItsNewReason() {
    ContextMemory original = memory(ContextMemoryStatus.ACTIVE);
    ContextMemory updated =
        copyOf(original)
            .withStatus(ContextMemoryStatus.INVALIDATED)
            .withStatusReason("Anchor table was deleted");

    ContextMemoryLifecycle.applyUpdate(original, updated, NO_LOOKUP);

    assertEquals("Anchor table was deleted", updated.getStatusReason());
  }

  @Test
  void supersedingResolvesTheNewSuccessor() {
    ContextMemory original = memory(ContextMemoryStatus.ACTIVE);
    EntityReference keeper = memoryRef();

    ContextMemory updated = supersededBy(original, keeper);
    ContextMemoryLifecycle.applyUpdate(original, updated, RESOLVE);

    assertEquals("memory-" + keeper.getId(), updated.getSupersededBy().getName());
  }

  @Test
  void anUnchangedSuccessorKeepsTheStoredReference() {
    EntityReference stored = memoryRef().withName("keeper");
    ContextMemory original = memory(ContextMemoryStatus.SUPERSEDED).withSupersededBy(stored);
    ContextMemory updated =
        copyOf(original)
            .withSupersededBy(
                new EntityReference().withId(stored.getId()).withType(Entity.CONTEXT_MEMORY));

    ContextMemoryLifecycle.applyUpdate(original, updated, NO_LOOKUP);

    assertSame(stored, updated.getSupersededBy());
  }

  @Test
  void supersededNeedsASuccessorAndOnlySupersededMayHaveOne() {
    ContextMemory active = memory(ContextMemoryStatus.ACTIVE);

    BadRequestException missing =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryLifecycle.applyUpdate(
                    active, copyOf(active).withStatus(ContextMemoryStatus.SUPERSEDED), RESOLVE));
    BadRequestException stray =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryLifecycle.applyUpdate(
                    active, copyOf(active).withSupersededBy(memoryRef()), RESOLVE));

    assertTrue(missing.getMessage().contains("requires supersededBy"));
    assertTrue(stray.getMessage().contains("only allowed on a Superseded memory"));
  }

  @Test
  void aSuccessorMustBeAnotherContextMemory() {
    ContextMemory active = memory(ContextMemoryStatus.ACTIVE);
    EntityReference table = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);
    EntityReference self =
        new EntityReference().withId(active.getId()).withType(Entity.CONTEXT_MEMORY);

    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryLifecycle.applyUpdate(active, supersededBy(active, table), RESOLVE));
    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryLifecycle.applyUpdate(active, supersededBy(active, self), RESOLVE));
  }

  @Test
  void onlyNewDisputesAreResolved() {
    MemoryDispute existing = new MemoryDispute().withMemory(memoryRef()).withReason("Says Q3");
    MemoryDispute added = new MemoryDispute().withMemory(memoryRef()).withReason("Says Q4");
    ContextMemory original = memory(ContextMemoryStatus.ACTIVE).withDisputes(List.of(existing));
    ContextMemory updated =
        copyOf(original)
            .withDisputes(List.of(JsonUtils.deepCopy(existing, MemoryDispute.class), added));
    ContextMemoryLifecycle.MemoryResolver resolveOnlyAdded =
        (reference, field) -> {
          assertEquals(added.getMemory().getId(), reference.getId());
          return RESOLVE.resolve(reference, field);
        };

    ContextMemoryLifecycle.applyUpdate(original, updated, resolveOnlyAdded);

    assertEquals(
        "memory-" + added.getMemory().getId(), updated.getDisputes().get(1).getMemory().getName());
  }

  @Test
  void disputesNeedAnOtherMemoryAndANonBlankReason() {
    ContextMemory active = memory(ContextMemoryStatus.ACTIVE);
    MemoryDispute blankReason = new MemoryDispute().withMemory(memoryRef()).withReason("  ");
    MemoryDispute noMemory = new MemoryDispute().withReason("Contradicts glossary");
    MemoryDispute self =
        new MemoryDispute()
            .withMemory(
                new EntityReference().withId(active.getId()).withType(Entity.CONTEXT_MEMORY))
            .withReason("Contradicts itself");

    for (MemoryDispute dispute : List.of(blankReason, noMemory, self)) {
      ContextMemory updated = copyOf(active).withDisputes(List.of(dispute));
      assertThrows(
          BadRequestException.class,
          () -> ContextMemoryLifecycle.applyUpdate(active, updated, RESOLVE));
    }
  }

  @Test
  void invalidTransitionFailsBeforeLookup() {
    ContextMemory draft = memory(ContextMemoryStatus.DRAFT);

    BadRequestException error =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryLifecycle.applyUpdate(
                    draft, supersededBy(draft, memoryRef()), NO_LOOKUP));

    assertTrue(error.getMessage().contains("Invalid memory status transition"));
  }

  @Test
  void createCannotBeSupersededWithoutASuccessor() {
    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryLifecycle.applyCreate(memory(ContextMemoryStatus.SUPERSEDED), RESOLVE));
  }

  private static ContextMemory memory(ContextMemoryStatus status) {
    return new ContextMemory().withId(UUID.randomUUID()).withName("memory").withStatus(status);
  }

  private static ContextMemory supersededBy(ContextMemory original, EntityReference successor) {
    return copyOf(original).withStatus(ContextMemoryStatus.SUPERSEDED).withSupersededBy(successor);
  }

  private static EntityReference memoryRef() {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_MEMORY);
  }

  private static ContextMemory copyOf(ContextMemory memory) {
    return JsonUtils.deepCopy(memory, ContextMemory.class);
  }
}
