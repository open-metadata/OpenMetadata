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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.service.ontology.OntologySubsetDraftFactory.Draft;
import org.openmetadata.service.ontology.OntologySubsetTermSelector.SourceTerm;

class OntologySubsetDraftFactoryTest {
  @Test
  void createsLocalConceptsWithPinnedProvenanceAndCanonicalRelationships() {
    final List<SourceTerm> selected =
        OntologySubsetTestFixtures.selector()
            .select(
                OntologySubsetTestFixtures.sourceGlossary(),
                OntologySubsetTestFixtures.request(true));
    final Draft draft =
        OntologySubsetTestFixtures.draftFactory()
            .create(
                OntologySubsetTestFixtures.sourceGlossary(),
                OntologySubsetTestFixtures.targetGlossary(),
                selected,
                true,
                "modeler");
    final List<GlossaryTerm> terms =
        draft.operations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.CREATE_TERM)
            .map(OntologyChangeOperation::getTerm)
            .toList();

    assertEquals(4, draft.operations().size());
    assertEquals(3, terms.size());
    assertEquals(1, draft.relationships().size());
    assertEquals(RelationProvenance.IMPORTED, draft.relationships().getFirst().getProvenance());
    assertEquals(terms.getFirst().getId(), terms.get(1).getParent().getId());
    assertEquals(terms.get(1).getId(), terms.getLast().getParent().getId());
    assertTrue(
        terms.stream()
            .allMatch(
                term ->
                    term.getIri().toString().startsWith("https://example.org/application/")
                        && term.getOntologySource().getCapturedAt()
                            == OntologySubsetTestFixtures.NOW));
    assertTrue(
        terms.getFirst().getConceptMappings().stream()
            .anyMatch(
                mapping ->
                    mapping.getMappingType() == ConceptMapping.ConceptMappingType.EXACT_MATCH));
    assertEquals(0.4D, draft.sources().getFirst().getSourceGlossaryVersion());
    assertEquals(0.3D, draft.sources().getFirst().getSourceTermVersion());
  }
}
