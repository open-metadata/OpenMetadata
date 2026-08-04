/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.UpdateTermRelation;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;

class TermRelationMutatorTest {
  private static final UUID TERM_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID TARGET_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
  private static final UUID RELATIONSHIP_ID =
      UUID.fromString("33333333-3333-3333-3333-333333333333");

  @Test
  void updatePreservesStableIdentityTargetAndAuditMetadata() {
    TermRelation existing = authoredRelation();
    UpdateTermRelation request =
        new UpdateTermRelation()
            .withRelationType("hasPart")
            .withProvenance(RelationProvenance.IMPORTED)
            .withStatus(EntityStatus.APPROVED);

    TermRelation updated = TermRelationMutator.update(existing, request, "hasPart");

    assertEquals(RELATIONSHIP_ID, updated.getId());
    assertSame(existing.getTerm(), updated.getTerm());
    assertEquals(existing.getCreatedAt(), updated.getCreatedAt());
    assertEquals(existing.getCreatedBy(), updated.getCreatedBy());
    assertEquals("hasPart", updated.getRelationType());
    assertEquals(RelationProvenance.IMPORTED, updated.getProvenance());
    assertEquals(EntityStatus.APPROVED, updated.getStatus());
  }

  @Test
  void omittedFieldsRetainTheirPersistedValues() {
    TermRelation existing = authoredRelation().withProvenance(RelationProvenance.IMPORTED);
    UpdateTermRelation request = new UpdateTermRelation().withStatus(EntityStatus.IN_REVIEW);

    TermRelation updated =
        TermRelationMutator.update(existing, request, existing.getRelationType());

    assertEquals(existing.getRelationType(), updated.getRelationType());
    assertEquals(existing.getProvenance(), updated.getProvenance());
    assertEquals(EntityStatus.IN_REVIEW, updated.getStatus());
  }

  @Test
  void findsOneRelationshipByItsStableId() {
    TermRelation expected = authoredRelation();
    GlossaryTerm term = new GlossaryTerm().withId(TERM_ID).withRelatedTerms(List.of(expected));

    TermRelation actual = TermRelationMutator.requireById(term, RELATIONSHIP_ID);

    assertSame(expected, actual);
  }

  @Test
  void rejectsMissingAndEmptyStableIdUpdates() {
    GlossaryTerm term = new GlossaryTerm().withId(TERM_ID);

    assertThrows(
        EntityNotFoundException.class,
        () -> TermRelationMutator.requireById(term, RELATIONSHIP_ID));
    assertThrows(
        BadRequestException.class,
        () -> TermRelationMutator.requireUpdate(new UpdateTermRelation()));
  }

  @Test
  void inferredProvenanceIsServerManagedAndReadOnly() {
    TermRelation inferred = authoredRelation().withProvenance(RelationProvenance.INFERRED);
    UpdateTermRelation inferredRequest =
        new UpdateTermRelation().withProvenance(RelationProvenance.INFERRED);

    assertThrows(BadRequestException.class, () -> TermRelationMutator.requireMutable(inferred));
    assertThrows(
        BadRequestException.class, () -> TermRelationMutator.requireUpdate(inferredRequest));
  }

  private static TermRelation authoredRelation() {
    return new TermRelation()
        .withId(RELATIONSHIP_ID)
        .withTerm(new EntityReference().withId(TARGET_ID).withType("glossaryTerm"))
        .withRelationType("partOf")
        .withProvenance(RelationProvenance.MANUAL)
        .withStatus(EntityStatus.DRAFT)
        .withCreatedBy("ontology-editor")
        .withCreatedAt(1_700_000_000_000L);
  }
}
