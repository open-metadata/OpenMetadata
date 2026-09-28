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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyStructuralDiffState;
import org.openmetadata.schema.api.data.OntologyTermStructuralDiff;
import org.openmetadata.schema.type.OntologyStructuralField;

class OntologyStructuralDiffServiceTest {
  @Test
  void classifiesAllThreeWayStructuralStates() {
    assertEquals(OntologyStructuralDiffState.UNCHANGED, state(Changes.NONE));
    assertEquals(OntologyStructuralDiffState.SOURCE_CHANGED, state(Changes.SOURCE));
    assertEquals(OntologyStructuralDiffState.SUBSET_CHANGED, state(Changes.SUBSET));
    assertEquals(OntologyStructuralDiffState.MERGEABLE, state(Changes.MERGEABLE));
    assertEquals(OntologyStructuralDiffState.CONFLICT, state(Changes.CONFLICT));
  }

  @Test
  void reportsTypedConflictFieldsAndVersionedSnapshots() {
    final OntologyStructuralTestFixtures.TermCase fixture = changed(Changes.CONFLICT);
    final OntologyTermStructuralDiff diff = diff(fixture);

    assertEquals(Set.of(OntologyStructuralField.DESCRIPTION), diff.getConflictingFields());
    assertEquals(fixture.sourceTerm().getVersion(), diff.getCurrentSourceVersion());
    assertEquals(fixture.subsetTerm().getVersion(), diff.getSubsetVersion());
    assertTrue(diff.getBase().getDescription().endsWith("description"));
  }

  private static OntologyStructuralDiffState state(final Changes changes) {
    return diff(changed(changes)).getState();
  }

  private static OntologyTermStructuralDiff diff(
      final OntologyStructuralTestFixtures.TermCase fixture) {
    final OntologyStructuralDiffService service =
        new OntologyStructuralDiffService(OntologyStructuralTestFixtures.reader(fixture.terms()));
    return service
        .diff(fixture.source(), fixture.target(), Set.of(fixture.subsetTerm().getId()))
        .getData()
        .getFirst();
  }

  private static OntologyStructuralTestFixtures.TermCase changed(final Changes changes) {
    final OntologyStructuralTestFixtures.TermCase fixture =
        OntologyStructuralTestFixtures.termCase();
    switch (changes) {
      case NONE -> {}
      case SOURCE -> fixture.sourceTerm().setDescription("Source description changed");
      case SUBSET -> fixture.subsetTerm().setDisplayName("Local display changed");
      case MERGEABLE -> {
        fixture.sourceTerm().setDescription("Source description changed");
        fixture.subsetTerm().setDisplayName("Local display changed");
      }
      case CONFLICT -> {
        fixture.sourceTerm().setDescription("Source description changed");
        fixture.subsetTerm().setDescription("Local description changed");
      }
    }
    return fixture;
  }

  private enum Changes {
    NONE,
    SOURCE,
    SUBSET,
    MERGEABLE,
    CONFLICT
  }
}
