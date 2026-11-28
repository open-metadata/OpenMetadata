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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.DomainLineageSteps.MAPPER;
import static org.openmetadata.it.tests.DomainLineageSteps.assertEdgeAbsent;
import static org.openmetadata.it.tests.DomainLineageSteps.assetEdges;
import static org.openmetadata.it.tests.DomainLineageSteps.awaitPlatformLineage;
import static org.openmetadata.it.tests.DomainLineageSteps.client;
import static org.openmetadata.it.tests.DomainLineageSteps.deleteEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.domain;
import static org.openmetadata.it.tests.DomainLineageSteps.putEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.setDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.table;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.ForkedOperations;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.util.DomainLineageRecovery;
import org.openmetadata.service.util.DomainLineageRecovery.Status;
import org.openmetadata.service.util.LineageDomainInheritors;

/**
 * A domain write over the descendant cap leaves its descendants' rollups under their old domains
 * and records, in its own transaction, that a rebuild is due. The status an operator reads says so
 * until the documented recovery runs (#33961, PR review P1). The cap is lowered to two so three
 * tables go over it.
 */
@Isolated(
    "lowers the server's descendant cap, records drift in the server-wide rebuild state and runs"
        + " the rebuild over the whole entity_relationship table")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class DomainLineageRecoveryIT {

  private static final int CAP = 2;
  private static final String DOMAIN_LINEAGE_STATUS = "Domain Lineage";
  private static final int REPAIR_DUE_EXIT_CODE = 2;

  @Test
  void anOverCapMoveThenAnEdgeDeleteIsRepairedByTheRecordedRecovery(TestNamespace ns)
      throws Exception {
    Topology topology = Topology.create(ns);
    assertEquals(3, assetEdges(topology.d1(), topology.d2()));
    assertEquals(Status.HEALTHY, DomainLineageRecovery.read().status());

    try (AutoCloseable cap = LineageDomainInheritors.capReprojectionForTesting(CAP)) {
      setDomains(client().databaseServices(), topology.serviceA().getId(), topology.d3());
    }

    assertEquals(3, assetEdges(topology.d1(), topology.d2()), "over the cap nothing moved");
    assertEdgeAbsent(topology.d3(), topology.d2());
    assertEquals(Status.REBUILD_REQUIRED, DomainLineageRecovery.read().status());
    JsonNode due = domainLineageStatus();
    assertFalse(due.path("passed").asBoolean(), due.toString());
    assertTrue(
        due.path("message").asText().contains(DomainLineageRecovery.REBUILD_COMMAND),
        due.toString());
    assertEquals(
        REPAIR_DUE_EXIT_CODE,
        ForkedOperations.run("rebuild-domain-lineage", "--status"),
        "see target/forked-ops-*.log");

    deleteEdge(topology.t1(), topology.target());

    assertEquals(3, assetEdges(topology.d1(), topology.d2()), "the decrement found no new pair");
    assertEdgeAbsent(topology.d3(), topology.d2());

    assertEquals(0, ForkedOperations.run("rebuild-domain-lineage"), "see target/forked-ops-*.log");

    assertEdgeAbsent(topology.d1(), topology.d2());
    assertEquals(2, assetEdges(topology.d3(), topology.d2()));
    assertEquals(Status.REINDEX_REQUIRED, DomainLineageRecovery.read().status());
    JsonNode reindexDue = domainLineageStatus();
    assertFalse(reindexDue.path("passed").asBoolean(), reindexDue.toString());
    assertFalse(
        reindexDue.path("message").asText().contains(DomainLineageRecovery.REBUILD_COMMAND),
        reindexDue.toString());

    assertEquals(
        0,
        ForkedOperations.run("reindex", "--force", "--entities=domain,dataProduct"),
        "see target/forked-ops-*.log");

    assertEquals(Status.HEALTHY, DomainLineageRecovery.read().status());
    assertTrue(domainLineageStatus().path("passed").asBoolean());
    awaitPlatformLineage(topology.d3(), topology.d2(), true);
    awaitPlatformLineage(topology.d1(), topology.d2(), false);
  }

  private static JsonNode domainLineageStatus() throws Exception {
    String status =
        client().getHttpClient().executeForString(HttpMethod.GET, "/v1/system/status", null);
    return MAPPER.readTree(status).path(DOMAIN_LINEAGE_STATUS);
  }

  /**
   * Service A (domain D1) holds t0, t1 and t2, each with an edge to the target in service B
   * (domain D2); D3 is where service A moves.
   */
  private record Topology(
      DatabaseService serviceA,
      Table t0,
      Table t1,
      Table t2,
      Table target,
      Domain d1,
      Domain d2,
      Domain d3) {

    static Topology create(TestNamespace ns) {
      DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, serviceA);
      DatabaseSchema schemaB = DatabaseSchemaTestFactory.createSimple(ns, serviceB);
      Domain d1 = domain(ns, "d1");
      Domain d2 = domain(ns, "d2");
      setDomains(client().databaseServices(), serviceA.getId(), d1);
      setDomains(client().databaseServices(), serviceB.getId(), d2);
      Topology topology =
          new Topology(
              serviceA,
              table(ns, schemaA, "t0"),
              table(ns, schemaA, "t1"),
              table(ns, schemaA, "t2"),
              table(ns, schemaB, "target"),
              d1,
              d2,
              domain(ns, "d3"));
      putEdge(topology.t0(), topology.target());
      putEdge(topology.t1(), topology.target());
      putEdge(topology.t2(), topology.target());
      return topology;
    }
  }
}
