/*
 *  Copyright 2026 Collate.
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

import java.util.Optional;
import org.junit.jupiter.api.Test;

class GlossaryTermRepositoryRenameTest {

  private static final String OLD_FQN = "Glossary.Old";
  private static final String NEW_FQN = "Glossary.New";

  @Test
  void ignoresInvalidRenamedDescendantFqns() {
    assertTrue(oldFqn(null).isEmpty());
    assertTrue(oldFqn("").isEmpty());
    assertTrue(oldFqn("Glossary").isEmpty());
    assertTrue(oldFqn("Glossary.Other.Child").isEmpty());
  }

  @Test
  void reconstructsTheOldFqnForARenamedDescendant() {
    assertEquals(
        Optional.of("Glossary.Old.Child.Grandchild"), oldFqn("Glossary.New.Child.Grandchild"));
  }

  private static Optional<String> oldFqn(String descendantNewFqn) {
    return GlossaryTermRepository.oldFqnForRenamedDescendant(OLD_FQN, NEW_FQN, descendantNewFqn);
  }
}
