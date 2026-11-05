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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.RelationProvenance;

class OntologyRelationshipRetypePlannerTest {
  @Test
  void retypesOneStableRelationshipDespiteInverseProjectionDuplication() {
    final RelationshipType source = OntologyBulkTestFixtures.relationshipType("broader");
    final RelationshipType target = OntologyBulkTestFixtures.relationshipType("relatedTo");
    final GlossaryTerm customer = OntologyBulkTestFixtures.customer();
    final GlossaryTerm account = OntologyBulkTestFixtures.account();
    customer.setRelatedTerms(
        List.of(OntologyBulkTestFixtures.relation(account, source, RelationProvenance.MANUAL)));
    account.setRelatedTerms(
        List.of(OntologyBulkTestFixtures.relation(customer, source, RelationProvenance.MANUAL)));

    final OntologyBulkPlan plan =
        planner(source, target)
            .plan(
                OntologyBulkTestFixtures.retypeRequest(source, target), List.of(customer, account));

    assertEquals(1, plan.validRows());
    assertEquals(0, plan.invalidRows());
    assertEquals(
        OntologyChangeOperationType.UPDATE_RELATIONSHIP,
        plan.operations().getFirst().getOperationType());
    assertEquals(
        OntologyBulkTestFixtures.RELATIONSHIP_ID,
        plan.operations().getFirst().getRelationship().getId());
    assertEquals(
        target.getId(),
        plan.operations().getFirst().getRelationship().getRelationshipType().getId());
  }

  @Test
  void rejectsInferredRelationshipMutations() {
    final RelationshipType source = OntologyBulkTestFixtures.relationshipType("broader");
    final RelationshipType target = OntologyBulkTestFixtures.relationshipType("relatedTo");
    final GlossaryTerm customer = OntologyBulkTestFixtures.customer();
    final GlossaryTerm account = OntologyBulkTestFixtures.account();
    customer.setRelatedTerms(
        List.of(OntologyBulkTestFixtures.relation(account, source, RelationProvenance.INFERRED)));

    final OntologyBulkPlan plan =
        planner(source, target)
            .plan(
                OntologyBulkTestFixtures.retypeRequest(source, target), List.of(customer, account));

    assertEquals(0, plan.validRows());
    assertEquals(1, plan.invalidRows());
    assertEquals(
        OntologyBulkErrorCode.INFERRED_RELATIONSHIP_READ_ONLY, plan.errors().getFirst().getCode());
  }

  private static OntologyRelationshipRetypePlanner planner(
      final RelationshipType source, final RelationshipType target) {
    final RelationshipTypeResolver resolver = mock(RelationshipTypeResolver.class);
    when(resolver.require(source.getId())).thenReturn(source);
    when(resolver.require(target.getId())).thenReturn(target);
    return new OntologyRelationshipRetypePlanner(resolver);
  }
}
