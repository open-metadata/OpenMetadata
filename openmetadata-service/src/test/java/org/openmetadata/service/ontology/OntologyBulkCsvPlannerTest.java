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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;

class OntologyBulkCsvPlannerTest {
  private static final UUID PARENT_ID = UUID.fromString("0aa6965a-4a9a-49c5-8e21-54ec2f3feea6");
  private static final UUID CHILD_ID = UUID.fromString("0958f082-5c76-47b9-803b-d4db010cdd2e");
  private final OntologyBulkCsvPlanner planner =
      new OntologyBulkCsvPlanner(
          new OntologyBulkCsvParser(), new OntologyIriMinter(), OntologyBulkTestFixtures.clock());

  @Test
  void plansParentFirstCreatesAndOptimisticUpdates() {
    final GlossaryTerm customer = OntologyBulkTestFixtures.customer();
    final String csv =
        OntologyBulkTestFixtures.header()
            + '\n'
            + "CREATE,"
            + PARENT_ID
            + ",Party,Party,Party concept,,\n"
            + "CREATE,"
            + CHILD_ID
            + ",Person,Person,Person concept,"
            + PARENT_ID
            + ",\n"
            + "UPDATE,"
            + customer.getId()
            + ",,Customer label,Updated customer description,,\n";

    final OntologyBulkPlan plan = plan(csv, List.of(customer));

    assertEquals(3, plan.validRows());
    assertEquals(0, plan.invalidRows());
    assertEquals(2, plan.counts().creates());
    assertEquals(1, plan.counts().updates());
    assertEquals(PARENT_ID, plan.operations().get(1).getTerm().getParent().getId());
    assertNotNull(plan.operations().getFirst().getTerm().getIri());
    final OntologyChangeOperation update = plan.operations().getLast();
    assertEquals(OntologyChangeOperationType.UPDATE_TERM, update.getOperationType());
    assertEquals(customer.getVersion(), update.getBaseVersion());
    assertEquals("Updated customer description", update.getTerm().getDescription());
  }

  @Test
  void countsNoOpUpdatesAsValidUnchangedRows() {
    final GlossaryTerm customer = OntologyBulkTestFixtures.customer();
    final String csv =
        OntologyBulkTestFixtures.header() + "\nUPDATE," + customer.getId() + ",,,,,\n";

    final OntologyBulkPlan plan = plan(csv, List.of(customer));

    assertEquals(0, plan.validRows());
    assertEquals(0, plan.invalidRows());
    assertEquals(1, plan.unchangedRows());
  }

  @Test
  void reportsStableIdentityAndHierarchyErrorsWithoutPartialRows() {
    final String csv =
        OntologyBulkTestFixtures.header()
            + "\nCREATE,not-a-uuid,Invalid,Invalid,Invalid concept,,\n"
            + "CREATE,"
            + CHILD_ID
            + ",Child,Child,Child concept,"
            + PARENT_ID
            + ",\n";

    final OntologyBulkPlan plan = plan(csv, List.of());

    assertEquals(0, plan.validRows());
    assertEquals(2, plan.invalidRows());
    assertEquals(OntologyBulkErrorCode.INVALID_IDENTIFIER, plan.errors().getFirst().getCode());
    assertEquals(OntologyBulkErrorCode.TERM_NOT_FOUND, plan.errors().getLast().getCode());
  }

  private OntologyBulkPlan plan(final String csv, final List<GlossaryTerm> terms) {
    return planner.plan(
        OntologyBulkTestFixtures.glossary(),
        OntologyBulkTestFixtures.csvRequest(csv, true),
        terms,
        OntologyBulkTestFixtures.USER);
  }
}
