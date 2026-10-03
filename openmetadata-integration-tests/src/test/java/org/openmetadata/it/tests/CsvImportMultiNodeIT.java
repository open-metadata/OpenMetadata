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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SessionMultiNodeCluster;
import org.openmetadata.it.util.CsvJobClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;

/**
 * Exercises a CSV import whose lifecycle spans two servers: the import is requested on one node and
 * its validation result is read from another. This is the shape that hung in production — the
 * background worker that runs the import can be on a different pod than the one holding the user's
 * websocket, so the completion frame is dropped and the "Validating against catalog" step never
 * resolves. Serving the result from the shared job row (like exports already do) makes it reachable
 * from any node, independent of which pod ran the job or where the socket landed.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class CsvImportMultiNodeIT {

  @Test
  void importStartedOnOneNodeExposesResultFromAnother(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    CsvJobClient nodeA = CsvJobClient.on(cluster.nodeABaseUrl());
    CsvJobClient nodeB = CsvJobClient.on(cluster.nodeBBaseUrl());
    Metric metric = createMetric(ns);

    String csv = exportedCsv(nodeA, metric);
    String jobId = nodeA.startImport(importPath(metric), csv);
    // Polled from the far node: the job the browser waits on frequently runs on the other pod, so
    // its result has to be readable wherever the request lands.
    nodeB.awaitJobStatus(jobId, "COMPLETED");

    HttpResponse<String> result = nodeB.fetchImportResult(jobId);

    assertEquals(
        200,
        result.statusCode(),
        "A completed import's result must be retrievable from a node that did not run it: "
            + result.body());
    assertTrue(
        result.body().contains("success"), "The far node must serve the import validation result");
  }

  private static String exportedCsv(CsvJobClient node, Metric metric) throws Exception {
    String exportJobId = node.startExport(exportPath(metric));
    node.awaitJobStatus(exportJobId, "COMPLETED");
    HttpResponse<String> download = node.downloadResult(exportJobId);
    assertEquals(
        200, download.statusCode(), "Export must produce a CSV to re-import: " + download.body());
    return download.body();
  }

  private static String exportPath(Metric metric) {
    return "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync";
  }

  private static String importPath(Metric metric) {
    return "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/importAsync?dryRun=true";
  }

  private Metric createMetric(TestNamespace ns) {
    return SdkClients.adminClient()
        .metrics()
        .create(
            new CreateMetric()
                .withName(ns.prefix("csvimport_multinode"))
                .withDescription("CSV import multi-node integration test metric"));
  }
}
