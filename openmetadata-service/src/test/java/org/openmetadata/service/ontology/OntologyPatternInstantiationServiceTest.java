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

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyPatternInstantiationResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;

class OntologyPatternInstantiationServiceTest {
  @Test
  void persistsOneTypedDraftAndReturnsItsPlannedResources() {
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final OntologyPatternInstantiationService service =
        new OntologyPatternInstantiationService(
            OntologyPatternTestFixtures.factory(),
            (uriInfo, changeSet, user) -> {
              stored.set(changeSet);
              return changeSet.withFullyQualifiedName(changeSet.getName()).withVersion(0.1D);
            });
    final Glossary glossary = OntologyPatternTestFixtures.glossary();
    final InstantiateOntologyPattern request = OntologyPatternTestFixtures.regulatoryRequest();

    final OntologyPatternInstantiationResult result =
        service.instantiate(null, glossary, request, "modeler");

    assertEquals(stored.get().getId(), result.getChangeSet().getId());
    assertEquals(OntologyChangeSetState.DRAFT, stored.get().getState());
    assertEquals(5, stored.get().getUndoCursor());
    assertEquals(3, result.getTerms().size());
    assertEquals(2, result.getRelationships().size());
    assertEquals(glossary.getId(), stored.get().getGlossaries().getFirst().getId());
  }
}
