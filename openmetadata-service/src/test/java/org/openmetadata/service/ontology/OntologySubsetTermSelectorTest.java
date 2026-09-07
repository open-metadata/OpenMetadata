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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.ontology.OntologySubsetTermSelector.SourceTerm;

class OntologySubsetTermSelectorTest {
  @Test
  void expandsDescendantsWithoutLosingDirectSelectionProvenance() {
    final List<SourceTerm> selected =
        OntologySubsetTestFixtures.selector()
            .select(
                OntologySubsetTestFixtures.sourceGlossary(),
                OntologySubsetTestFixtures.request(true));

    assertEquals(
        List.of(
            OntologySubsetTestFixtures.ROOT_ID,
            OntologySubsetTestFixtures.CHILD_ID,
            OntologySubsetTestFixtures.GRANDCHILD_ID),
        selected.stream().map(source -> source.term().getId()).toList());
    assertTrue(selected.getFirst().selectedDirectly());
    assertFalse(selected.get(1).selectedDirectly());
    assertFalse(selected.getLast().selectedDirectly());
  }

  @Test
  void keepsAnExplicitSelectionBoundedToTheRequestedTerms() {
    final List<SourceTerm> selected =
        OntologySubsetTestFixtures.selector()
            .select(
                OntologySubsetTestFixtures.sourceGlossary(),
                OntologySubsetTestFixtures.request(false));

    assertEquals(1, selected.size());
    assertEquals(OntologySubsetTestFixtures.ROOT_ID, selected.getFirst().term().getId());
  }
}
