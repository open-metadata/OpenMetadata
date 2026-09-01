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

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkMatchField;
import org.openmetadata.schema.api.data.OntologyBulkMatchMode;
import org.openmetadata.schema.entity.data.GlossaryTerm;

class OntologyFindReplacePlannerTest {
  private final OntologyFindReplacePlanner planner = new OntologyFindReplacePlanner();

  @Test
  void replacesEveryCaseInsensitiveLiteralMatchWithoutRegexSemantics() {
    final GlossaryTerm customer = OntologyBulkTestFixtures.customer();
    final GlossaryTerm account = OntologyBulkTestFixtures.account();

    final OntologyBulkPlan plan =
        planner.plan(
            OntologyBulkTestFixtures.glossary(),
            OntologyBulkTestFixtures.findRequest(
                OntologyBulkMatchField.DESCRIPTION,
                OntologyBulkMatchMode.CONTAINS,
                "customer",
                "client",
                false,
                true),
            List.of(customer, account));

    assertEquals(2, plan.validRows());
    assertEquals(0, plan.invalidRows());
    assertEquals("client record", plan.operations().getFirst().getTerm().getDescription());
    assertEquals("client account", plan.operations().getLast().getTerm().getDescription());
    assertEquals(customer.getVersion(), plan.operations().getFirst().getBaseVersion());
  }

  @Test
  void rejectsNameCollisionsAndLeavesUnmatchedTermsUnchanged() {
    final GlossaryTerm customer = OntologyBulkTestFixtures.customer();
    final GlossaryTerm client =
        OntologyBulkTestFixtures.term(
            UUID.fromString("210bf664-eb81-4732-974d-a32a1bba61f2"),
            "Client",
            "Client record",
            null);

    final OntologyBulkPlan plan =
        planner.plan(
            OntologyBulkTestFixtures.glossary(),
            OntologyBulkTestFixtures.findRequest(
                OntologyBulkMatchField.NAME,
                OntologyBulkMatchMode.EXACT,
                "Customer",
                "Client",
                true,
                true),
            List.of(customer, client));

    assertEquals(0, plan.validRows());
    assertEquals(1, plan.invalidRows());
    assertEquals(1, plan.unchangedRows());
    assertEquals(OntologyBulkErrorCode.DUPLICATE_TERM, plan.errors().getFirst().getCode());
  }
}
