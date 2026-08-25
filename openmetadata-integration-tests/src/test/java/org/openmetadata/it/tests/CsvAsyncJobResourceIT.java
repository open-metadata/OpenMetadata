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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.CsvJobClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.csv.CsvExportPayload;
import org.openmetadata.service.csv.CsvExportSpool;

/**
 * Integration tests for the CSV async job APIs that back the bulk import/export experience: job
 * creation via entity exportAsync/importAsync, the user-scoped job listing and job status (neither
 * of which may carry export payloads), the result download endpoint, payload caps, access control,
 * and the search-results, lineage, and audit export jobs.
 *
 * <p>Export results live in the job row rather than on the local disk of whichever server ran the
 * job, so that a download served by any server in the cluster finds them.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class CsvAsyncJobResourceIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final CsvJobClient CLIENT = CsvJobClient.onDefaultServer();
  private static final Duration JOB_TIMEOUT = Duration.ofMinutes(2);
  private static final long TOKEN_TTL_SECONDS = 3600;

  @Test
  void test_exportJobLifecycle_listOmitsResult_resultDownloads(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "exportable");

    String jobId =
        startJob(
            "GET",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync",
            null,
            adminToken());

    JsonNode completedJob = awaitJobStatus(jobId, "COMPLETED");
    assertEquals("EXPORT", completedJob.path("operation").asText());
    assertEquals("metric", completedJob.path("entityType").asText());

    JsonNode listedJob = findJobInList(jobId);
    assertNotNull(listedJob, "The creator's job listing must include the export job");
    assertTrue(
        listedJob.path("result").isNull() || listedJob.path("result").isMissingNode(),
        "The jobs list must not carry export payloads; downloads go through /result");

    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode());
    assertTrue(
        result.headers().firstValue("Content-Type").orElse("").contains("text/csv"),
        "Result downloads as text/csv");
    assertTrue(
        result.body().contains(metric.getName()),
        "Exported CSV must contain the metric that was exported");
  }

  @Test
  void test_importJobHasNoDownloadableResult(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "importable");
    String csv = exportMetricCsv(metric);

    String jobId =
        startJob(
            "PUT",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/importAsync?dryRun=true",
            csv,
            adminToken());
    awaitJobStatus(jobId, "COMPLETED");

    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(
        400,
        result.statusCode(),
        "Import jobs have no downloadable export result: " + result.body());
  }

  @Test
  void test_importPayloadOverRowCapIsRejected(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "capped");
    String oversized = "name\n" + "row\n".repeat(100_001);

    HttpResponse<String> response =
        request(
            "PUT",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/importAsync?dryRun=true",
            oversized,
            adminToken());

    assertEquals(400, response.statusCode());
    assertTrue(
        response.body().contains("maximum allowed"),
        "Cap rejection should explain the limit: " + response.body());
  }

  @Test
  void test_jobsAreScopedToTheirCreator(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "scoped");
    String jobId =
        startJob(
            "GET",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync",
            null,
            adminToken());
    awaitJobStatus(jobId, "COMPLETED");

    // The username must equal the email local part: the JWT filter resolves the
    // principal from the email claim by its prefix.
    String otherUserName = ("csvjob_other_" + ns.shortPrefix()).toLowerCase();
    String otherUserEmail = otherUserName + "@test.openmetadata.org";
    SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(otherUserName)
                .withEmail(otherUserEmail)
                .withDescription("CSV async job access-control test user"));
    String otherUserToken =
        JwtAuthProvider.tokenFor(
            otherUserName, otherUserEmail, new String[] {"DataConsumer"}, TOKEN_TTL_SECONDS);

    HttpResponse<String> otherUserJob =
        request("GET", "/v1/csvAsyncJobs/" + jobId, null, otherUserToken);
    assertEquals(403, otherUserJob.statusCode(), "Another user's job must not be readable");

    HttpResponse<String> otherUserResult =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, otherUserToken);
    assertEquals(403, otherUserResult.statusCode(), "Another user's result must not download");

    HttpResponse<String> otherUserList =
        request("GET", "/v1/csvAsyncJobs?limit=50", null, otherUserToken);
    assertEquals(200, otherUserList.statusCode());
    JsonNode otherUserJobs = MAPPER.readTree(otherUserList.body());
    for (JsonNode job : otherUserJobs) {
      assertEquals(
          otherUserName,
          job.path("createdBy").asText(),
          "The list must only contain the caller's own jobs");
    }
  }

  @Test
  void test_searchExportRunsAsBackgroundJob() throws Exception {
    String jobId =
        startJob(
            "GET",
            "/v1/search/export/async?index=metric_search_index&q=*&size=5",
            null,
            adminToken());

    JsonNode completedJob = awaitJobStatus(jobId, "COMPLETED");
    assertEquals("EXPORT", completedJob.path("operation").asText());

    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode());
    assertTrue(
        result.body().startsWith("Entity Type,"),
        "Search export CSV must start with the header row: " + firstLine(result.body()));
  }

  @Test
  void test_missingJobReturns404() throws Exception {
    HttpResponse<String> response =
        request("GET", "/v1/csvAsyncJobs/999999999/result", null, adminToken());
    assertEquals(404, response.statusCode());
  }

  /**
   * Job ids come straight off the request path. An id that cannot name a row — non-numeric, or
   * numeric but wider than a long — has to read as "no such job", not as a server error.
   */
  @ParameterizedTest
  @ValueSource(strings = {"99999999999999999999", "not-a-job-id", "12x34"})
  void test_unusableJobIdIsNotFoundRatherThanServerError(String jobId) throws Exception {
    for (String path :
        List.of(
            "/v1/csvAsyncJobs/" + jobId,
            "/v1/csvAsyncJobs/" + jobId + "/result",
            "/v1/audit/logs/export/" + jobId + "/result")) {
      HttpResponse<String> response = request("GET", path, null, adminToken());
      assertEquals(404, response.statusCode(), path + " returned " + response.body());
    }
  }

  /**
   * The status endpoint is polled while a job runs, so it must not carry the export payload — only
   * the download endpoint may. Without this the whole CSV is transferred on every poll.
   */
  @Test
  void test_statusEndpointDoesNotCarryTheExportPayload(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "statuspayload");
    String jobId =
        startJob(
            "GET",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync",
            null,
            adminToken());

    JsonNode completedJob = awaitJobStatus(jobId, "COMPLETED");

    assertTrue(
        completedJob.path("result").isNull() || completedJob.path("result").isMissingNode(),
        "Job status must omit the export payload; downloads go through /result");
    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode(), "The payload must still be downloadable");
    assertTrue(result.body().contains(metric.getName()));
  }

  /** Downloading twice must work: the result is not consumed by the first read. */
  @Test
  void test_exportResultDownloadsRepeatedly(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "repeatable");
    String jobId =
        startJob(
            "GET",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync",
            null,
            adminToken());
    awaitJobStatus(jobId, "COMPLETED");

    HttpResponse<String> first =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    HttpResponse<String> second =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());

    assertEquals(200, first.statusCode());
    assertEquals(200, second.statusCode(), "A second download must not 404");
    assertEquals(first.body(), second.body(), "Repeat downloads must return identical CSV");
  }

  /**
   * The regression test for the multi-node download failure. A single server cannot be split across
   * hosts, but the property that broke is testable here: the completed export must leave nothing on
   * this server's disk, and the payload must be in the shared job row where any server can read it.
   *
   * <p>Before results moved into the row, the assertions below fail — the CSV was written to
   * {@code ${java.io.tmpdir}/openmetadata-csv-exports} and the row held only a pointer to it, so a
   * download served by any other server 404'd.
   */
  @Test
  void test_exportResultIsInTheJobRowAndNotOnLocalDisk(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "nodelocal");
    String jobId =
        startJob(
            "GET",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync",
            null,
            adminToken());
    awaitJobStatus(jobId, "COMPLETED");

    assertFalse(
        CsvExportSpool.exists(jobId),
        "A completed export must leave no node-local file; only the server that ran the job "
            + "would be able to serve it");

    String storedResult =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT result FROM background_jobs WHERE id = :id")
                        .bind("id", Long.parseLong(jobId))
                        .mapTo(String.class)
                        .one());
    assertTrue(
        CsvExportPayload.isCompressed(storedResult),
        "The job row must hold the compressed payload, not a pointer to local storage");

    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode());
    assertTrue(result.body().contains(metric.getName()));
  }

  /**
   * Audit exports are typed AUDIT_EXPORT so they stay out of the CSV jobs tray, which means every
   * lookup on their path has to include that type. Creating one used to read the row back through
   * the CSV-only query and NPE on a null job, so this covers the whole round trip: create, poll,
   * download.
   */
  @Test
  void test_auditExportRunsAsBackgroundJob() throws Exception {
    long endTs = System.currentTimeMillis();
    long startTs = endTs - Duration.ofDays(1).toMillis();

    String jobId =
        startJob(
            "GET",
            "/v1/audit/logs/export?startTs=" + startTs + "&endTs=" + endTs + "&limit=10",
            null,
            adminToken());

    assertTrue(
        jobId.chars().allMatch(Character::isDigit),
        "Audit export must return a background job id: " + jobId);

    // Polled through the status endpoint, which is what the UI falls back to: the
    // completion event only reaches sockets held by the server that ran the job.
    Awaitility.await()
        .atMost(JOB_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> "COMPLETED".equals(auditExportStatus(jobId)));

    HttpResponse<String> result =
        request("GET", "/v1/audit/logs/export/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode());
    assertTrue(
        result.body().trim().startsWith("["),
        "Audit export downloads as a JSON array: " + firstLine(result.body()));
  }

  private String auditExportStatus(String jobId) throws Exception {
    HttpResponse<String> response =
        request("GET", "/v1/audit/logs/export/" + jobId, null, adminToken());
    assertEquals(200, response.statusCode(), "Audit job status failed: " + response.body());
    return MAPPER.readTree(response.body()).path("status").asText();
  }

  /**
   * Lineage exports used to run on a local executor under a random UUID job id, so the result was
   * only ever pushed over the websocket of the server that ran it and was resolvable through no
   * API. They are background jobs now: a numeric id, a pollable status, and a download.
   */
  @Test
  void test_lineageExportRunsAsBackgroundJob(TestNamespace ns) throws Exception {
    Metric metric = createMetric(ns, "lineage");

    String jobId =
        startJob(
            "GET",
            "/v1/lineage/exportAsync?fqn="
                + metric.getFullyQualifiedName()
                + "&entityType=metric&upstreamDepth=1&downstreamDepth=1",
            null,
            adminToken());

    assertTrue(
        jobId.chars().allMatch(Character::isDigit),
        "Lineage export must return a background job id, not a local UUID: " + jobId);
    JsonNode completedJob = awaitJobStatus(jobId, "COMPLETED");
    assertEquals("EXPORT", completedJob.path("operation").asText());
    assertEquals("lineage", completedJob.path("entityType").asText());

    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode(), "Lineage export result must download: " + result.body());
  }

  private Metric createMetric(TestNamespace ns, String suffix) {
    CreateMetric create =
        new CreateMetric()
            .withName(ns.prefix("csvjob_" + suffix))
            .withDescription("CSV async job integration test metric");
    return SdkClients.adminClient().metrics().create(create);
  }

  private String exportMetricCsv(Metric metric) throws Exception {
    String jobId =
        startJob(
            "GET",
            "/v1/metrics/name/" + metric.getFullyQualifiedName() + "/exportAsync",
            null,
            adminToken());
    awaitJobStatus(jobId, "COMPLETED");
    HttpResponse<String> result =
        request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null, adminToken());
    assertEquals(200, result.statusCode());
    return result.body();
  }

  private String startJob(String method, String path, String body, String token)
      throws IOException, InterruptedException {
    return CLIENT.startJob(method, path, body, token);
  }

  private JsonNode awaitJobStatus(String jobId, String expectedStatus) {
    return CLIENT.awaitJobStatus(jobId, expectedStatus);
  }

  private JsonNode findJobInList(String jobId) throws IOException, InterruptedException {
    JsonNode match = null;
    for (JsonNode job : CLIENT.listJobs()) {
      if (jobId.equals(job.path("jobId").asText())) {
        match = job;
      }
    }
    return match;
  }

  private HttpResponse<String> request(String method, String path, String body, String token)
      throws IOException, InterruptedException {
    return CLIENT.request(method, path, body, token);
  }

  private String adminToken() {
    return SdkClients.getAdminToken();
  }

  private String firstLine(String body) {
    int newline = body.indexOf('\n');
    return newline > 0 ? body.substring(0, newline) : body;
  }
}
