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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.MergeOntologyStructure;
import org.openmetadata.schema.api.data.OntologyStructuralMergeResult;
import org.openmetadata.schema.api.data.OntologyStructuralMergeSelection;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyStructuralField;
import org.openmetadata.service.ontology.OntologyStructuralMergeService.MergeExecution;

class OntologyStructuralMergeServiceTest {
  @Test
  void persistsSelectiveFieldsWithoutOverwritingLocalStructure() {
    final OntologyStructuralTestFixtures.TermCase fixture =
        OntologyStructuralTestFixtures.termCase();
    fixture.sourceTerm().setDescription("Changed upstream description");
    fixture.subsetTerm().setDisplayName("Local application label");
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final OntologyStructuralMergeService service = service(fixture.terms(), stored);

    final OntologyStructuralMergeResult result =
        service.merge(
            fixture.source(),
            fixture.target(),
            request(
                fixture.source().getId(),
                fixture.target().getId(),
                Set.of(fixture.subsetTerm().getId()),
                fixture.subsetTerm().getId(),
                Set.of(OntologyStructuralField.DESCRIPTION)),
            new MergeExecution(null, "modeler"));

    final GlossaryTerm updated = stored.get().getOperations().getFirst().getTerm();
    assertEquals(stored.get().getId(), result.getChangeSet().getId());
    assertEquals(OntologyChangeSetState.DRAFT, stored.get().getState());
    assertEquals("Changed upstream description", updated.getDescription());
    assertEquals("Local application label", updated.getDisplayName());
    assertEquals(
        "Changed upstream description",
        updated.getOntologySource().getSourceSnapshot().getDescription());
  }

  @Test
  void createsTypedRelationshipOperationsInTheSameDraft() {
    final OntologyStructuralTestFixtures.RelationshipCase fixture =
        OntologyStructuralTestFixtures.relationshipCase();
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final OntologyStructuralMergeService service = service(fixture.terms(), stored);

    final OntologyStructuralMergeResult result =
        service.merge(
            fixture.source(),
            fixture.target(),
            request(
                fixture.source().getId(),
                fixture.target().getId(),
                Set.of(fixture.subsetOne().getId(), fixture.subsetTwo().getId()),
                fixture.subsetOne().getId(),
                Set.of(OntologyStructuralField.RELATIONSHIPS)),
            new MergeExecution(null, "modeler"));

    assertEquals(2, stored.get().getOperations().size());
    assertEquals(1, result.getRelationshipOperations().size());
    assertEquals(
        OntologyChangeOperationType.ADD_RELATIONSHIP,
        result.getRelationshipOperations().getFirst().getOperationType());
  }

  private static OntologyStructuralMergeService service(
      final List<GlossaryTerm> terms, final AtomicReference<OntologyChangeSet> stored) {
    final OntologyStructuralDiffService.TermReader reader =
        OntologyStructuralTestFixtures.reader(terms);
    final Clock clock =
        Clock.fixed(Instant.ofEpochMilli(OntologyStructuralTestFixtures.NOW), ZoneOffset.UTC);
    return new OntologyStructuralMergeService(
        new OntologyStructuralDiffService(reader),
        reader,
        new OntologyStructuralRelationshipMerger(resolver(), clock),
        clock,
        (uriInfo, changeSet, user, impersonatedBy) -> {
          stored.set(changeSet);
          return changeSet.withFullyQualifiedName(changeSet.getName()).withVersion(0.1D);
        });
  }

  private static RelationshipTypeResolver resolver() {
    final RelationshipTypeResolver resolver = mock(RelationshipTypeResolver.class);
    final RelationshipType hasPart = OntologyStructuralTestFixtures.hasPart();
    final RelationshipType partOf = OntologyStructuralTestFixtures.partOf();
    when(resolver.require(hasPart.getName())).thenReturn(hasPart);
    when(resolver.require(partOf.getName())).thenReturn(partOf);
    return resolver;
  }

  private static MergeOntologyStructure request(
      final UUID sourceId,
      final UUID targetId,
      final Set<UUID> contextIds,
      final UUID subsetTermId,
      final Set<OntologyStructuralField> fields) {
    final OntologyStructuralMergeSelection selection =
        new OntologyStructuralMergeSelection().withSubsetTermId(subsetTermId).withFields(fields);
    return new MergeOntologyStructure()
        .withSourceGlossaryId(sourceId)
        .withTargetGlossaryId(targetId)
        .withContextTermIds(contextIds)
        .withSelections(List.of(selection))
        .withChangeSetName("structuralMerge")
        .withChangeSetDisplayName("Structural merge")
        .withChangeSetDescription("Review selected upstream changes");
  }
}
