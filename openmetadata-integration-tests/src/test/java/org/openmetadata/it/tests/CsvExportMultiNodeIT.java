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
 * Exercises a CSV export whose lifecycle spans two servers: the export is requested on one node and
 * downloaded from another, which is the shape that failed in production — the download is
 * load-balanced to whichever node is free, rarely the one that ran the job.
 *
 * <p>{@link SessionMultiNodeCluster} starts each additional server in its own JVM and temporary
 * directory. The export must be available through shared storage without relying on shared JVM
 * statics or the originating node's temporary directory. The host filesystem is still shared;
 * {@code CsvAsyncJobResourceIT#test_exportResultIsInTheJobRowAndNotOnLocalDisk} separately checks
 * that export payloads are not written to disk.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class CsvExportMultiNodeIT {

  @Test
  void exportStartedOnOneNodeDownloadsFromAnother(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    CsvJobClient nodeA = CsvJobClient.on(cluster.nodeABaseUrl());
    CsvJobClient nodeB = CsvJobClient.on(cluster.nodeBBaseUrl());
    Metric metric = createMetric(ns);

    String jobId = nodeA.startExport(exportPath(metric));
    // Polled from the far node: job state has to be readable wherever the request lands.
    nodeB.awaitJobStatus(jobId, "COMPLETED");

    HttpResponse<String> download = nodeB.downloadResult(jobId);

    assertEquals(
        200,
        download.statusCode(),
        "A completed export must download from a node that did not run it: " + download.body());
    assertTrue(
        download.body().contains(metric.getName()),
        "The CSV served by the far node must be the exported content");
  }

  @Test
  void jobListingIsVisibleFromEitherNode(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    CsvJobClient nodeA = CsvJobClient.on(cluster.nodeABaseUrl());
    CsvJobClient nodeB = CsvJobClient.on(cluster.nodeBBaseUrl());
    Metric metric = createMetric(ns);

    String jobId = nodeA.startExport(exportPath(metric));
    nodeB.awaitJobStatus(jobId, "COMPLETED");

    assertTrue(nodeA.listContainsJob(jobId), "The originating node must list the job");
    assertTrue(nodeB.listContainsJob(jobId), "The far node must list the job too");
  }

  private static String exportPath(Metric metric) {
    return "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync";
  }

  private Metric createMetric(TestNamespace ns) {
    return SdkClients.adminClient()
        .metrics()
        .create(
            new CreateMetric()
                .withName(ns.prefix("csvjob_multinode"))
                .withDescription("CSV export multi-node integration test metric"));
  }
}
