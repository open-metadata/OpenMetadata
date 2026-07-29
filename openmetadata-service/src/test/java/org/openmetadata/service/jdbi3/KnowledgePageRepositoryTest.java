/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class KnowledgePageRepositoryTest {
  private static final UUID PAGE_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID PARENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

  @Test
  void cyclicMove_movingPageUnderItself_isRejected() {
    assertTrue(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, "a.b", PAGE_ID, "a.b"));
  }

  @Test
  void cyclicMove_movingPageUnderDirectChild_isRejected() {
    assertTrue(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, "a.b", PARENT_ID, "a.b.c"));
  }

  @Test
  void cyclicMove_movingPageUnderDeepDescendant_isRejected() {
    assertTrue(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, "a.b", PARENT_ID, "a.b.c.d"));
  }

  @Test
  void cyclicMove_movingUnderUnrelatedParent_isAllowed() {
    assertFalse(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, "a.b", PARENT_ID, "a.x"));
  }

  @Test
  void cyclicMove_movingUnderTopLevelPage_isAllowed() {
    assertFalse(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, "a.b", PARENT_ID, "z"));
  }

  @Test
  void cyclicMove_siblingWithSharedNamePrefix_isAllowed() {
    // "a.bc" is NOT a descendant of "a.b" despite the string prefix; the dot boundary matters.
    assertFalse(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, "a.b", PARENT_ID, "a.bc"));
  }

  @Test
  void cyclicMove_newPageWithoutFqn_isAllowed() {
    // On create the page has no FQN yet and no descendants, so a parent can never be cyclic.
    assertFalse(KnowledgePageRepository.isCyclicParentMove(PAGE_ID, null, PARENT_ID, "a.b"));
  }
}
