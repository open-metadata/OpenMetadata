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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.service.ontology.OntologyPatternDraftFactory.Draft;

class OntologyPatternDraftFactoryTest {
  @ParameterizedTest
  @MethodSource("patterns")
  void buildsAnOrderedGovernedDraft(
      final InstantiateOntologyPattern request, final List<String> relationshipTypes) {
    final Draft draft =
        OntologyPatternTestFixtures.factory()
            .create(OntologyPatternTestFixtures.glossary(), request, "modeler");
    final List<GlossaryTerm> terms =
        draft.operations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.CREATE_TERM)
            .map(OntologyChangeOperation::getTerm)
            .toList();

    assertEquals(5, draft.operations().size());
    assertEquals(3, terms.size());
    assertNull(terms.getFirst().getParent());
    assertEquals(terms.getFirst().getId(), terms.get(1).getParent().getId());
    assertEquals(terms.get(1).getId(), terms.getLast().getParent().getId());
    assertTrue(terms.stream().allMatch(term -> term.getIri().isAbsolute()));
    assertTrue(terms.stream().allMatch(term -> term.getEntityStatus() == EntityStatus.DRAFT));
    assertEquals(relationshipTypes, relationshipNames(draft));
    assertTrue(
        draft.relationships().stream()
            .allMatch(
                relationship ->
                    relationship.getProvenance() == RelationProvenance.MANUAL
                        && relationship.getCreatedAt() == OntologyPatternTestFixtures.NOW));
  }

  private static List<String> relationshipNames(final Draft draft) {
    return draft.relationships().stream()
        .map(relationship -> relationship.getRelationshipType().getName())
        .toList();
  }

  private static Stream<Arguments> patterns() {
    return Stream.of(
        Arguments.of(
            OntologyPatternTestFixtures.regulatoryRequest(), List.of("hasPart", "hasPart")),
        Arguments.of(
            OntologyPatternTestFixtures.measuredKpiRequest(),
            List.of("calculatedFrom", "calculatedFrom")),
        Arguments.of(
            OntologyPatternTestFixtures.productHierarchyRequest(), List.of("partOf", "partOf")));
  }
}
