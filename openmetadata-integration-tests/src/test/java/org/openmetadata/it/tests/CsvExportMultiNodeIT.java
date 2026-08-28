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
 * <p><b>What this covers, and what it does not.</b> {@link SessionMultiNodeCluster} starts extra
 * Dropwizard instances inside this JVM, so the nodes share a database (the point of the test) but
 * also share a filesystem and JVM statics. That means this suite proves the job APIs and the
 * download are mediated entirely by shared state, but it would <em>not</em> fail if export payloads
 * were moved back onto local disk — both nodes would still see the same {@code java.io.tmpdir}.
 * {@code CsvAsyncJobResourceIT#test_exportResultIsInTheJobRowAndNotOnLocalDisk} is the test that
 * pins that down, by asserting no node-local file is produced at all.
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
