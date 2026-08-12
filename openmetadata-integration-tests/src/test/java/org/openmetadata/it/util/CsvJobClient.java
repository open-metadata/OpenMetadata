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

package org.openmetadata.it.util;

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

/**
 * Drives the CSV async job APIs over plain HTTP. Shared because the multi-node suite has to address
 * a specific server by base URL rather than going through the SDK client, and the single-node suite
 * needs the same start/poll/download sequence.
 */
public final class CsvJobClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final Duration JOB_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  private final String baseUrl;

  private CsvJobClient(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  /** Targets whichever server {@code SdkClients} is configured against. */
  public static CsvJobClient onDefaultServer() {
    return new CsvJobClient(SdkClients.getServerUrl());
  }

  /** Targets one specific server, for tests that span a cluster. */
  public static CsvJobClient on(String baseUrl) {
    return new CsvJobClient(baseUrl + "/api");
  }

  public String startJob(String method, String path, String body)
      throws IOException, InterruptedException {
    return startJob(method, path, body, SdkClients.getAdminToken());
  }

  public String startJob(String method, String path, String body, String token)
      throws IOException, InterruptedException {
    HttpResponse<String> response = request(method, path, body, token);
    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 202,
        "Job creation failed: " + response.statusCode() + " " + response.body());
    String jobId = MAPPER.readTree(response.body()).path("jobId").asText();
    assertTrue(!jobId.isEmpty(), "Job creation must return a jobId: " + response.body());
    return jobId;
  }

  public String startExport(String path) throws IOException, InterruptedException {
    return startJob("GET", path, null);
  }

  public JsonNode awaitJobStatus(String jobId, String expectedStatus) {
    Awaitility.await()
        .atMost(JOB_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> expectedStatus.equals(fetchJob(jobId).path("status").asText()));
    return fetchJob(jobId);
  }

  public JsonNode fetchJob(String jobId) {
    try {
      HttpResponse<String> response = request("GET", "/v1/csvAsyncJobs/" + jobId, null);
      assertEquals(200, response.statusCode(), "Job fetch failed: " + response.body());
      return MAPPER.readTree(response.body());
    } catch (IOException | InterruptedException e) {
      throw new IllegalStateException("Failed to fetch CSV job " + jobId, e);
    }
  }

  public HttpResponse<String> downloadResult(String jobId)
      throws IOException, InterruptedException {
    return request("GET", "/v1/csvAsyncJobs/" + jobId + "/result", null);
  }

  public JsonNode listJobs() throws IOException, InterruptedException {
    HttpResponse<String> response = request("GET", "/v1/csvAsyncJobs?limit=50", null);
    assertEquals(200, response.statusCode(), "Job listing failed: " + response.body());
    return MAPPER.readTree(response.body());
  }

  public boolean listContainsJob(String jobId) throws IOException, InterruptedException {
    boolean found = false;
    for (JsonNode job : listJobs()) {
      if (jobId.equals(job.path("jobId").asText())) {
        found = true;
      }
    }
    return found;
  }

  public HttpResponse<String> request(String method, String path, String body)
      throws IOException, InterruptedException {
    return request(method, path, body, SdkClients.getAdminToken());
  }

  public HttpResponse<String> request(String method, String path, String body, String token)
      throws IOException, InterruptedException {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + token);
    if ("PUT".equals(method)) {
      builder
          .header("Content-Type", "text/plain")
          .PUT(HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
    } else {
      builder.GET();
    }
    return HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }
}
