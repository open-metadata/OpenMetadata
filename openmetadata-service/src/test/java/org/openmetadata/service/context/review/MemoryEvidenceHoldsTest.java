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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;

class MemoryEvidenceHoldsTest {

  private final Query query = query();
  private final MemoryTable memories = new MemoryTable();
  private final MemoryEvidenceHolds holds = new MemoryEvidenceHolds(memories);

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "UNPROCESSED"})
  void retiringItsQueryHoldsAnActiveMemoryForReviewNamingTheQuery(ContextMemoryStatus status) {
    UUID memory = memories.add(status, query);

    holds.holdMemoriesSupportedBy(query);

    ContextMemory held = memories.current(memory);
    assertEquals(ContextMemoryStatus.DRAFT, held.getEntityStatus());
    assertEquals(MemoryEvidenceHolds.reason(query.getId()), held.getStatusReason());
    assertTrue(held.getStatusReason().contains(query.getId().toString()));
    assertTrue(relatedIds(held).isEmpty(), "the hold drops the retired evidence link");
  }

  @Test
  void aMemoryWithoutAStageWasInUseAndIsHeld() {
    UUID memory = memories.add(null, query);

    holds.holdMemoriesSupportedBy(query);

    assertEquals(ContextMemoryStatus.DRAFT, memories.current(memory).getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "UNPROCESSED"},
      mode = EnumSource.Mode.EXCLUDE)
  void aMemoryAlreadyInReviewOrRetiredKeepsItsStageAndReason(ContextMemoryStatus status) {
    UUID memory = memories.add(status, query);

    holds.holdMemoriesSupportedBy(query);

    assertEquals(status, memories.current(memory).getEntityStatus());
    assertNull(memories.current(memory).getStatusReason());
    assertEquals(0, memories.writes.size());
  }

  @Test
  void aRepeatedRetirementWritesNothingTheSecondTime() {
    UUID memory = memories.add(ContextMemoryStatus.APPROVED, query);

    holds.holdMemoriesSupportedBy(query);
    holds.holdMemoriesSupportedBy(query);

    assertEquals(List.of(memory), memories.writes);
  }

  @Test
  void aMemoryThatNoLongerCitesTheQueryIsLeftAlone() {
    UUID memory = memories.add(ContextMemoryStatus.APPROVED, query);
    memories.editBeforeNextLoad(memory, current -> current.withRelatedEntities(List.of()));

    holds.holdMemoriesSupportedBy(query);

    assertEquals(ContextMemoryStatus.APPROVED, memories.current(memory).getEntityStatus());
    assertEquals(0, memories.writes.size());
  }

  @Test
  void aConcurrentEditIsReadAgainAndTheMemoryIsStillHeld() {
    UUID memory = memories.add(ContextMemoryStatus.APPROVED, query);
    memories.editBeforeNextWrite(memory, current -> current.withAnswer("Edited meanwhile."));

    holds.holdMemoriesSupportedBy(query);

    ContextMemory held = memories.current(memory);
    assertEquals(ContextMemoryStatus.DRAFT, held.getEntityStatus());
    assertEquals("Edited meanwhile.", held.getAnswer(), "the concurrent edit is not overwritten");
  }

  @Test
  void aConcurrentRetirementIsRespected() {
    UUID memory = memories.add(ContextMemoryStatus.APPROVED, query);
    memories.editBeforeNextWrite(
        memory, current -> current.withEntityStatus(ContextMemoryStatus.REJECTED));

    holds.holdMemoriesSupportedBy(query);

    assertEquals(ContextMemoryStatus.REJECTED, memories.current(memory).getEntityStatus());
  }

  @Test
  void editsThatKeepRacingTheHoldRefuseTheDelete() {
    UUID memory = memories.add(ContextMemoryStatus.APPROVED, query);
    for (int edit = 0; edit < MemoryEvidenceHolds.MAX_ATTEMPTS; edit++) {
      memories.editBeforeNextWrite(memory, current -> current.withAnswer("Edited again."));
    }

    assertThrows(PreconditionFailedException.class, () -> holds.holdMemoriesSupportedBy(query));
    assertEquals(ContextMemoryStatus.APPROVED, memories.current(memory).getEntityStatus());
  }

  @Test
  void aRetryAfterAPartialFailureHoldsWhatTheFirstAttemptMissed() {
    UUID first = memories.add(ContextMemoryStatus.APPROVED, query);
    UUID second = memories.add(ContextMemoryStatus.APPROVED, query);
    memories.failNextWrite(second, new IllegalStateException("the database went away"));

    assertThrows(IllegalStateException.class, () -> holds.holdMemoriesSupportedBy(query));
    assertEquals(ContextMemoryStatus.DRAFT, memories.current(first).getEntityStatus());
    assertEquals(ContextMemoryStatus.APPROVED, memories.current(second).getEntityStatus());

    holds.holdMemoriesSupportedBy(query);

    assertEquals(ContextMemoryStatus.DRAFT, memories.current(second).getEntityStatus());
    assertEquals(List.of(first, second), memories.writes, "the held memory is not written again");
  }

  /**
   * A principal a memory was shared with and that was deleted since stays in {@code sharedWith}, and
   * every PATCH of that memory then fails looking it up, before anything is written. Deleting the
   * Query must still succeed, and the other memories citing it are still held.
   */
  @Test
  void aMemorySharedWithADeletedPrincipalNeitherBlocksTheDeleteNorStopsTheOthers() {
    UUID unwritable = memories.add(ContextMemoryStatus.APPROVED, query);
    UUID other = memories.add(ContextMemoryStatus.APPROVED, query);
    memories.failNextWrite(
        unwritable, EntityNotFoundException.byMessage("user instance for " + UUID.randomUUID()));

    assertDoesNotThrow(() -> holds.holdMemoriesSupportedBy(query));

    assertEquals(ContextMemoryStatus.APPROVED, memories.current(unwritable).getEntityStatus());
    assertEquals(ContextMemoryStatus.DRAFT, memories.current(other).getEntityStatus());
    assertEquals(List.of(other), memories.writes);
  }

  @Test
  void aMemoryWithSeveralSupportingQueriesKeepsTheReasonOfTheFirstOneRetired() {
    Query other = query();
    UUID memory = memories.add(ContextMemoryStatus.APPROVED, query, other);

    holds.holdMemoriesSupportedBy(query);
    holds.holdMemoriesSupportedBy(other);

    ContextMemory held = memories.current(memory);
    assertEquals(MemoryEvidenceHolds.reason(query.getId()), held.getStatusReason());
    assertEquals(List.of(other.getId()), relatedIds(held), "only the retired Query is dropped");
    assertEquals(1, memories.writes.size());
  }

  @Test
  void onlyTheMemoriesCitingTheRetiredQueryAreHeld() {
    UUID citing = memories.add(ContextMemoryStatus.APPROVED, query);
    UUID unrelated = memories.add(ContextMemoryStatus.APPROVED, query());

    holds.holdMemoriesSupportedBy(query);

    assertEquals(ContextMemoryStatus.DRAFT, memories.current(citing).getEntityStatus());
    assertEquals(ContextMemoryStatus.APPROVED, memories.current(unrelated).getEntityStatus());
  }

  @Test
  void aMemoryWrittenCitingAQueryThatNoLongerExistsEntersReview() {
    EntityReference cited = reference(query);
    ContextMemory memory = memory(ContextMemoryStatus.UNPROCESSED);

    MemoryEvidenceHolds.holdIfCitingRetired(memory, List.of(cited));

    assertEquals(ContextMemoryStatus.DRAFT, memory.getEntityStatus());
    assertEquals(MemoryEvidenceHolds.reason(query.getId()), memory.getStatusReason());
  }

  @Test
  void aMemoryWrittenCitingADeletedQueryEntersReview() {
    EntityReference cited = reference(query).withDeleted(true);
    ContextMemory memory = memory(ContextMemoryStatus.APPROVED, cited);

    MemoryEvidenceHolds.holdIfCitingRetired(memory, List.of(cited));

    assertEquals(ContextMemoryStatus.DRAFT, memory.getEntityStatus());
  }

  @Test
  void aMemoryWrittenCitingALiveQueryOrAlreadyRetiredIsUntouched() {
    EntityReference cited = reference(query);
    ContextMemory live = memory(ContextMemoryStatus.UNPROCESSED, cited);
    ContextMemory rejected = memory(ContextMemoryStatus.REJECTED);

    MemoryEvidenceHolds.holdIfCitingRetired(live, List.of(cited));
    MemoryEvidenceHolds.holdIfCitingRetired(rejected, List.of(cited));
    MemoryEvidenceHolds.holdIfCitingRetired(memory(ContextMemoryStatus.APPROVED), null);

    assertEquals(ContextMemoryStatus.UNPROCESSED, live.getEntityStatus());
    assertEquals(ContextMemoryStatus.REJECTED, rejected.getEntityStatus());
    assertNull(rejected.getStatusReason());
  }

  private static List<UUID> relatedIds(ContextMemory memory) {
    return memory.getRelatedEntities().stream().map(EntityReference::getId).toList();
  }

  private static Query query() {
    UUID id = UUID.randomUUID();
    return new Query().withId(id).withName(id.toString()).withFullyQualifiedName("svc." + id);
  }

  private static EntityReference reference(Query query) {
    return new EntityReference()
        .withId(query.getId())
        .withType(Entity.QUERY)
        .withFullyQualifiedName(query.getFullyQualifiedName());
  }

  private static ContextMemory memory(ContextMemoryStatus status, EntityReference... related) {
    UUID id = UUID.randomUUID();
    return new ContextMemory()
        .withId(id)
        .withName("memory-" + id)
        .withAnswer("amount_cents stores cents.")
        .withEntityStatus(status)
        .withUpdatedAt(1L)
        .withRelatedEntities(new ArrayList<>(List.of(related)));
  }

  /**
   * The relationship rows and memory rows a hold reads, with the version guard a real write has:
   * an edit landing between the read and the write refuses the write.
   */
  private static final class MemoryTable implements MemoryEvidenceHolds.MemoryStore {
    private final Map<UUID, ContextMemory> rows = new LinkedHashMap<>();
    private final Map<UUID, List<UnaryOperator<ContextMemory>>> beforeWrite = new LinkedHashMap<>();
    private final Map<UUID, UnaryOperator<ContextMemory>> beforeLoad = new LinkedHashMap<>();
    private final Map<UUID, RuntimeException> failing = new LinkedHashMap<>();
    private final List<UUID> writes = new ArrayList<>();

    UUID add(ContextMemoryStatus status, Query... cited) {
      ContextMemory memory =
          memory(
              status,
              List.of(cited).stream()
                  .map(MemoryEvidenceHoldsTest::reference)
                  .toArray(EntityReference[]::new));
      rows.put(memory.getId(), memory);
      return memory.getId();
    }

    ContextMemory current(UUID id) {
      return rows.get(id);
    }

    void editBeforeNextWrite(UUID id, UnaryOperator<ContextMemory> edit) {
      beforeWrite.computeIfAbsent(id, ignored -> new ArrayList<>()).add(edit);
    }

    void editBeforeNextLoad(UUID id, UnaryOperator<ContextMemory> edit) {
      beforeLoad.put(id, edit);
    }

    void failNextWrite(UUID id, RuntimeException failure) {
      failing.put(id, failure);
    }

    @Override
    public List<UUID> citing(UUID queryId) {
      return rows.values().stream()
          .filter(
              memory ->
                  memory.getRelatedEntities().stream()
                      .anyMatch(reference -> queryId.equals(reference.getId())))
          .map(ContextMemory::getId)
          .toList();
    }

    @Override
    public Optional<ContextMemory> load(UUID memoryId) {
      UnaryOperator<ContextMemory> edit = beforeLoad.remove(memoryId);
      if (edit != null) {
        edit(memoryId, edit);
      }
      return Optional.ofNullable(rows.get(memoryId))
          .map(memory -> JsonUtils.deepCopy(memory, ContextMemory.class));
    }

    @Override
    public void write(MemoryChange change) {
      UUID id = change.before().getId();
      List<UnaryOperator<ContextMemory>> edits = beforeWrite.getOrDefault(id, new ArrayList<>());
      if (!edits.isEmpty()) {
        edit(id, edits.removeFirst());
      }
      RuntimeException failure = failing.remove(id);
      if (failure != null) {
        throw failure;
      }
      if (!change.before().getUpdatedAt().equals(rows.get(id).getUpdatedAt())) {
        throw new PreconditionFailedException("changed since read");
      }
      rows.put(id, change.after().withUpdatedAt(change.before().getUpdatedAt() + 1));
      writes.add(id);
    }

    private void edit(UUID id, UnaryOperator<ContextMemory> edit) {
      ContextMemory edited = edit.apply(JsonUtils.deepCopy(rows.get(id), ContextMemory.class));
      rows.put(id, edited.withUpdatedAt(rows.get(id).getUpdatedAt() + 1));
    }
  }
}
