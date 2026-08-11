/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for the ingestion progress SSE stream
 * ({@code GET /progress/{fqn}/stream/{runId}}).
 *
 * <p>These cover the contract a client (UI EventSource, the poll helper) depends on: the stream
 * commits its HTTP response and delivers the current progress snapshot promptly instead of
 * buffering forever. A blocked {@link HttpURLConnection#getResponseCode()} here is exactly the
 * hang that the previous {@code StreamingOutput} implementation produced.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IngestionPipelineProgressStreamIT {

  private static final String API_BASE = "/v1/services/ingestionPipelines";
  private static final int READ_TIMEOUT_MS = 15000;

  @Test
  void testStreamDeliversSeededProgressSnapshot(TestNamespace ns)
      throws OpenMetadataException, IOException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    String pipelineFQN = pipeline.getFullyQualifiedName();
    UUID runId = UUID.randomUUID();
    String marker = "progress-marker-" + runId;

    seedProgress(pipelineFQN, runId, marker);
    SseResult result = readFirstDataEvent(streamUrl(pipelineFQN, runId));

    assertEquals(200, result.status(), "Progress stream must commit a 200 response, not hang");
    assertNotNull(result.data(), "Stream must deliver the seeded snapshot as the first event");
    assertTrue(
        result.data().contains(marker),
        "Snapshot event must carry the seeded progress, got: " + result.data());
    assertTrue(
        result.data().contains("\"entityType\":\"DatabaseSchema\"")
            && result.data().contains("\"label\":\"xyz\""),
        "Snapshot event must carry the nested progress tree, got: " + result.data());
  }

  @Test
  void testStreamForUnknownPipelineReturns404() throws IOException {
    UUID runId = UUID.randomUUID();
    SseResult result = readFirstDataEvent(streamUrl("non.existent.pipeline", runId));

    assertEquals(404, result.status(), "Unknown pipeline must return 404, not hang");
  }

  private void seedProgress(String pipelineFQN, UUID runId, String marker)
      throws OpenMetadataException {
    String path = "/v1/services/ingestionPipelines/progress/" + pipelineFQN + "/" + runId;
    Map<String, Object> update =
        Map.of(
            "runId", runId.toString(),
            "timestamp", System.currentTimeMillis(),
            "updateType", "PROCESSING",
            "currentEntity", marker,
            "progress",
                Map.of(
                    "label",
                    "",
                    "entityType",
                    "Database",
                    "processed",
                    1,
                    "expected",
                    3,
                    "active",
                    true,
                    "overflow",
                    0,
                    "children",
                    List.of(
                        Map.of(
                            "label",
                            "xyz",
                            "entityType",
                            "DatabaseSchema",
                            "processed",
                            0,
                            "expected",
                            10,
                            "active",
                            true,
                            "overflow",
                            0,
                            "children",
                            List.of()))));
    SdkClients.adminClient().getHttpClient().execute(HttpMethod.PUT, path, update, String.class);
  }

  private String streamUrl(String pipelineFQN, UUID runId) {
    return SdkClients.getServerUrl() + API_BASE + "/progress/" + pipelineFQN + "/stream/" + runId;
  }

  private SseResult readFirstDataEvent(String url) throws IOException {
    HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
    connection.setRequestProperty("Authorization", "Bearer " + SdkClients.getAdminToken());
    connection.setRequestProperty("Accept", "text/event-stream");
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(READ_TIMEOUT_MS);

    SseResult result;
    try {
      int status = connection.getResponseCode();
      result = new SseResult(status, status == 200 ? readData(connection) : null);
    } finally {
      connection.disconnect();
    }
    return result;
  }

  private String readData(HttpURLConnection connection) throws IOException {
    String data = null;
    try (BufferedReader reader =
        new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.startsWith("data:")) {
          data = line.substring("data:".length()).trim();
          break;
        }
      }
    }
    return data;
  }

  private IngestionPipeline createTestPipeline(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withType(DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA);
    CreateIngestionPipeline createRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline_progress_test"))
            .withDisplayName("Test Pipeline for Progress Streaming")
            .withDescription("Test pipeline for progress streaming functionality")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                new AirflowConfig()
                    .withStartDate(
                        new org.joda.time.DateTime("2022-06-10T15:06:47+00:00").toDate()));
    return SdkClients.adminClient().ingestionPipelines().create(createRequest);
  }

  private record SseResult(int status, String data) {}
}
