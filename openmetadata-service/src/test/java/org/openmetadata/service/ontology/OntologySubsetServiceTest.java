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
import org.openmetadata.schema.api.data.OntologySubsetResult;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;

class OntologySubsetServiceTest {
  @Test
  void persistsOneReviewableDraftForTheTargetModel() {
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final OntologySubsetService service =
        new OntologySubsetService(
            new OntologySubsetValidator(),
            OntologySubsetTestFixtures.selector(),
            OntologySubsetTestFixtures.draftFactory(),
            (uriInfo, changeSet, user, impersonatedBy) -> {
              stored.set(changeSet);
              return changeSet.withFullyQualifiedName(changeSet.getName()).withVersion(0.1D);
            });

    final OntologySubsetResult result =
        service.build(
            null,
            OntologySubsetTestFixtures.sourceGlossary(),
            OntologySubsetTestFixtures.targetGlossary(),
            OntologySubsetTestFixtures.request(true),
            "modeler");

    assertEquals(stored.get().getId(), result.getChangeSet().getId());
    assertEquals(OntologyChangeSetState.DRAFT, stored.get().getState());
    assertEquals(4, stored.get().getUndoCursor());
    assertEquals(3, result.getSources().size());
    assertEquals(
        OntologySubsetTestFixtures.targetGlossary().getId(),
        stored.get().getGlossaries().getFirst().getId());
  }
}
