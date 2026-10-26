/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.deployWorkflowAssigning;
import static org.openmetadata.it.tests.ChangeRequestITSupport.filterScopedTo;
import static org.openmetadata.it.tests.ChangeRequestITSupport.onlyPendingRequest;
import static org.openmetadata.it.tests.ChangeRequestITSupport.requestsFor;
import static org.openmetadata.it.tests.DomainReassignmentAuthorizationIT.createTable;
import static org.openmetadata.it.tests.DomainReassignmentAuthorizationIT.domainOf;
import static org.openmetadata.it.tests.DomainReassignmentAuthorizationIT.domainScopedUser;
import static org.openmetadata.it.tests.DomainReassignmentAuthorizationIT.patchDomains;
import static org.openmetadata.it.tests.DomainReassignmentAuthorizationIT.patchWholeDocument;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.tests.DomainReassignmentAuthorizationIT.DomainScopedUser;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;

/**
 * A domain move is authorized before an approval workflow can hold it, so a move the caller may not
 * make is refused instead of becoming a change request someone could approve.
 */
// Each test deploys a workflow that receives the signals of every table event, so the class runs
// alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class DomainMoveApprovalAuthorizationIT {

  @Test
  void aMoveIntoAnUnheldDomainIsRefusedNotHeld(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());
    gateDomainsOf(ns, table);

    assertThrows(
        ForbiddenException.class,
        () -> patchWholeDocument(scoped.client(), table, scoped.otherDomain()));
    assertTrue(requestsFor(table.getId()).isEmpty(), "a refused move submits no change request");
    assertEquals(scoped.heldDomain().getId(), domainOf(table));
  }

  @Test
  void aMoveWithinAHeldDomainIsHeldForApproval(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());
    gateDomainsOf(ns, table);

    patchDomains(scoped.client(), table, scoped.heldSubDomain());

    onlyPendingRequest(table.getId());
    assertEquals(scoped.heldDomain().getId(), domainOf(table), "the move waits for approval");
  }

  private static void gateDomainsOf(TestNamespace ns, Table table) {
    deployWorkflowAssigning(
        ns,
        Entity.TABLE,
        "\"domains\"",
        "",
        filterScopedTo(Entity.TABLE, table.getFullyQualifiedName()),
        SharedEntities.get().USER1.getEntityReference());
  }
}
