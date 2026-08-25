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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class TaskRepositoryDedupByIdTest {

  @Test
  void testDedupByIdCollapsesDuplicateUserFromTeamAndDirectOwner() {
    UUID sharedUserId = UUID.randomUUID();
    EntityReference directOwner = userRef(sharedUserId, "alice");
    EntityReference teamMemberDuplicate = userRef(sharedUserId, "alice");
    EntityReference otherMember = userRef(UUID.randomUUID(), "bob");

    List<EntityReference> deduped =
        TaskRepository.dedupById(List.of(directOwner, teamMemberDuplicate, otherMember));

    assertEquals(2, deduped.size());
    assertEquals(sharedUserId, deduped.get(0).getId());
    assertEquals("bob", deduped.get(1).getName());
  }

  @Test
  void testDedupByIdCollapsesUserPresentInTwoTeams() {
    UUID sharedUserId = UUID.randomUUID();
    EntityReference fromTeamOne = userRef(sharedUserId, "alice");
    EntityReference fromTeamTwo = userRef(sharedUserId, "alice");

    List<EntityReference> deduped = TaskRepository.dedupById(List.of(fromTeamOne, fromTeamTwo));

    assertEquals(1, deduped.size());
    assertEquals(sharedUserId, deduped.get(0).getId());
  }

  @Test
  void testDedupByIdPreservesInsertionOrderOfFirstOccurrence() {
    EntityReference first = userRef(UUID.randomUUID(), "first");
    EntityReference second = userRef(UUID.randomUUID(), "second");
    EntityReference secondDuplicate = userRef(second.getId(), "second");
    EntityReference third = userRef(UUID.randomUUID(), "third");

    List<EntityReference> deduped =
        TaskRepository.dedupById(List.of(first, second, secondDuplicate, third));

    assertEquals(3, deduped.size());
    assertEquals("first", deduped.get(0).getName());
    assertEquals("second", deduped.get(1).getName());
    assertEquals("third", deduped.get(2).getName());
  }

  @Test
  void testDedupByIdReturnsEmptyListForEmptyInput() {
    assertTrue(TaskRepository.dedupById(List.of()).isEmpty());
  }

  private static EntityReference userRef(UUID id, String name) {
    return new EntityReference().withId(id).withType(Entity.USER).withName(name);
  }
}
