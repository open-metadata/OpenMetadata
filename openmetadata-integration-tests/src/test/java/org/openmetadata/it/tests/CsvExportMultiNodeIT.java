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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SessionMultiNodeCluster;
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
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final Duration JOB_TIMEOUT = Duration.ofMinutes(2);

  @Test
  void exportStartedOnOneNodeDownloadsFromAnother(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    Metric metric = createMetric(ns);

    String jobId = startExport(cluster.nodeABaseUrl(), metric.getFullyQualifiedName());

    // Polled from the far node: job state has to be readable wherever the request lands.
    awaitCompletion(cluster.nodeBBaseUrl(), jobId);

    HttpResponse<String> download =
        get(cluster.nodeBBaseUrl() + "/api/v1/csvAsyncJobs/" + jobId + "/result");

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
    Metric metric = createMetric(ns);

    String jobId = startExport(cluster.nodeABaseUrl(), metric.getFullyQualifiedName());
    awaitCompletion(cluster.nodeBBaseUrl(), jobId);

    assertTrue(
        listContainsJob(cluster.nodeABaseUrl(), jobId), "The originating node must list the job");
    assertTrue(
        listContainsJob(cluster.nodeBBaseUrl(), jobId), "The far node must list the job too");
  }

  private Metric createMetric(TestNamespace ns) {
    return SdkClients.adminClient()
        .metrics()
        .create(
            new CreateMetric()
                .withName(ns.prefix("csvjob_multinode"))
                .withDescription("CSV export multi-node integration test metric"));
  }

  private String startExport(String baseUrl, String metricFqn) throws Exception {
    HttpResponse<String> response =
        get(baseUrl + "/api/v1/metrics/name/" + metricFqn + "/exportAsync");
    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 202,
        "Export start failed: " + response.statusCode() + " " + response.body());
    return MAPPER.readTree(response.body()).path("jobId").asText();
  }

  private void awaitCompletion(String baseUrl, String jobId) {
    Awaitility.await()
        .atMost(JOB_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> "COMPLETED".equals(fetchJob(baseUrl, jobId).path("status").asText()));
  }

  private JsonNode fetchJob(String baseUrl, String jobId) {
    try {
      HttpResponse<String> response = get(baseUrl + "/api/v1/csvAsyncJobs/" + jobId);
      assertEquals(200, response.statusCode(), "Job fetch failed: " + response.body());
      return MAPPER.readTree(response.body());
    } catch (IOException | InterruptedException e) {
      throw new IllegalStateException("Failed to fetch CSV job " + jobId, e);
    }
  }

  private boolean listContainsJob(String baseUrl, String jobId) throws Exception {
    HttpResponse<String> response = get(baseUrl + "/api/v1/csvAsyncJobs?limit=50");
    assertEquals(200, response.statusCode(), "Job listing failed: " + response.body());
    boolean found = false;
    for (JsonNode job : MAPPER.readTree(response.body())) {
      if (jobId.equals(job.path("jobId").asText())) {
        found = true;
      }
    }
    return found;
  }

  private HttpResponse<String> get(String url) throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
