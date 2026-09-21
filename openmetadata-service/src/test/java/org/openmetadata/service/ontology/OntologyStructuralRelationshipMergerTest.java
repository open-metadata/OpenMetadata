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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyStructuralRelationship;
import org.openmetadata.service.ontology.OntologyStructuralRelationshipMerger.Accumulator;

class OntologyStructuralRelationshipMergerTest {
  @Test
  void addsOneCanonicalOperationForInverseSelections() {
    final OntologyStructuralTestFixtures.RelationshipCase fixture =
        OntologyStructuralTestFixtures.relationshipCase();
    final OntologyStructuralRelationshipMerger merger = merger();
    final Accumulator accumulator = Accumulator.empty();

    merger.merge(
        fixture.subsetOne(),
        desired(fixture.sourceOne()),
        fixture.context(),
        "modeler",
        accumulator);
    merger.merge(
        fixture.subsetTwo(),
        desired(fixture.sourceTwo()),
        fixture.context(),
        "modeler",
        accumulator);

    assertEquals(1, accumulator.operations().size());
    assertEquals(
        OntologyChangeOperationType.ADD_RELATIONSHIP,
        accumulator.operations().getFirst().getOperationType());
  }

  @Test
  void deletesAnAssertedRelationshipAbsentFromTheSourceSnapshot() {
    final OntologyStructuralTestFixtures.RelationshipCase fixture =
        OntologyStructuralTestFixtures.relationshipCase();
    fixture
        .subsetOne()
        .setRelatedTerms(
            List.of(
                OntologyStructuralTestFixtures.relation(
                    OntologyStructuralTestFixtures.hasPart(), fixture.subsetTwo())));
    final Accumulator accumulator = Accumulator.empty();

    merger().merge(fixture.subsetOne(), List.of(), fixture.context(), "modeler", accumulator);

    assertEquals(1, accumulator.operations().size());
    assertEquals(
        OntologyChangeOperationType.DELETE_RELATIONSHIP,
        accumulator.operations().getFirst().getOperationType());
  }

  private static List<OntologyStructuralRelationship> desired(final GlossaryTerm source) {
    return OntologyTermStructureMapper.sourceStructure(source).getRelationships();
  }

  private static OntologyStructuralRelationshipMerger merger() {
    final RelationshipTypeResolver resolver = mock(RelationshipTypeResolver.class);
    final RelationshipType hasPart = OntologyStructuralTestFixtures.hasPart();
    final RelationshipType partOf = OntologyStructuralTestFixtures.partOf();
    when(resolver.require(hasPart.getName())).thenReturn(hasPart);
    when(resolver.require(partOf.getName())).thenReturn(partOf);
    final Clock clock =
        Clock.fixed(Instant.ofEpochMilli(OntologyStructuralTestFixtures.NOW), ZoneOffset.UTC);
    return new OntologyStructuralRelationshipMerger(resolver, clock);
  }
}
