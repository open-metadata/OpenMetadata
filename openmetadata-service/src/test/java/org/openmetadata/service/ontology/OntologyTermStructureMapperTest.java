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
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.OntologyTermStructure;
import org.openmetadata.schema.type.TermRelation;

class OntologyTermStructureMapperTest {
  @Test
  void canonicalizesSubsetIdentityAndRemovesOnlyItsProvenanceMapping() {
    final OntologyStructuralTestFixtures.TermCase fixture =
        OntologyStructuralTestFixtures.termCase();

    final OntologyTermStructure source =
        OntologyTermStructureMapper.sourceStructure(fixture.sourceTerm());
    final OntologyTermStructure subset =
        OntologyTermStructureMapper.subsetStructure(
            fixture.subsetTerm(), List.of(fixture.subsetTerm()));

    assertEquals(source, subset);
    assertEquals(1, fixture.subsetTerm().getConceptMappings().size());
    assertEquals(0, subset.getConceptMappings().size());
  }

  @Test
  void rejectsLegacyRelationshipsWithoutRegisteredTypedIdentity() {
    final OntologyStructuralTestFixtures.TermCase fixture =
        OntologyStructuralTestFixtures.termCase();
    fixture
        .sourceTerm()
        .setRelatedTerms(
            List.of(
                new TermRelation()
                    .withRelationType("relatedTo")
                    .withTerm(fixture.subsetTerm().getEntityReference())));

    assertThrows(
        BadRequestException.class,
        () -> OntologyTermStructureMapper.sourceStructure(fixture.sourceTerm()));
  }
}
