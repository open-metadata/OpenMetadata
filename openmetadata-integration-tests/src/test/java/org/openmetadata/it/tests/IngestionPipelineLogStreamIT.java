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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
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
 * Integration tests for the live log stream, {@code GET /logs/{fqn}/stream/{runId}}.
 *
 * <p>These cover the contract a browser depends on and that a blocking implementation cannot
 * satisfy: the response is committed immediately rather than buffered until the run ends, every
 * event carries the cursor needed to reconnect, and the server closes the stream by itself instead
 * of holding a connection and polling a backend forever.
 *
 * <p>Whether any log content exists depends on the pipeline backend available to the test
 * environment, so the assertions are about the shape and the lifecycle of the stream rather than
 * about specific log lines — those are covered by the unit tests around the tailer and its sources.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IngestionPipelineLogStreamIT {

  private static final String API_BASE = "/v1/services/ingestionPipelines";
  private static final int CONNECT_TIMEOUT_MS = 5000;
  private static final int READ_TIMEOUT_MS = 60000;
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Set<Object> TERMINAL_EVENT_TYPES = Set.of("complete", "error");

  @Test
  void testStreamCommitsImmediatelyAndEndsOnItsOwn(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    seedFinishedRun(pipeline.getFullyQualifiedName(), runId);

    SseStream stream = read(streamUrl(pipeline.getFullyQualifiedName(), runId.toString(), null));

    assertEquals(200, stream.status(), "the stream must commit a 200 response, not hang");
    Map<String, Object> terminal = stream.terminalEvent();
    assertNotNull(
        terminal,
        "the server must end the stream itself with a complete or error event, got: "
            + stream.events());
    assertEquals(runId.toString(), terminal.get("runId"));
  }

  @Test
  void testEveryEventNamesItsTypeAndRun(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    seedFinishedRun(pipeline.getFullyQualifiedName(), runId);

    SseStream stream = read(streamUrl(pipeline.getFullyQualifiedName(), runId.toString(), null));

    assertEquals(200, stream.status());
    assertFalse(stream.events().isEmpty(), "the stream must deliver at least one event");
    assertTrue(
        stream.events().stream()
            .allMatch(
                event ->
                    event.containsKey("eventType") && runId.toString().equals(event.get("runId"))),
        "every event must name its type and run, got: " + stream.events());
  }

  @Test
  void testStreamAcceptsAResumeCursor(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    seedFinishedRun(pipeline.getFullyQualifiedName(), runId);

    SseStream stream = read(streamUrl(pipeline.getFullyQualifiedName(), runId.toString(), "0"));

    assertEquals(200, stream.status(), "resuming from a cursor must be accepted, not rejected");
    assertNotNull(stream.terminalEvent());
  }

  @Test
  void testStreamById(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    seedFinishedRun(pipeline.getFullyQualifiedName(), runId);

    SseStream stream = read(streamUrl(pipeline.getId().toString(), runId.toString(), null));

    assertEquals(200, stream.status(), "the stream must accept the pipeline Id as well as its FQN");
    assertEquals(runId.toString(), stream.terminalEvent().get("runId"));
  }

  /**
   * Airflow names a run {@code scheduled__<timestamp>}, not with a UUID. Typing the path parameter
   * as a UUID used to reject such a run with a 404 before the request reached any log backend.
   */
  @Test
  void testStreamAcceptsARunNotNamedByUuid(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createTestPipeline(ns);
    seedFinishedRun(pipeline.getFullyQualifiedName(), UUID.randomUUID());

    SseStream stream =
        read(
            streamUrl(
                pipeline.getFullyQualifiedName(), "scheduled__2026-08-10T00%3A00%3A00", null));

    assertEquals(200, stream.status(), "a non-UUID run identifier must be accepted, not 404'd");
    assertNotNull(stream.terminalEvent());
  }

  @Test
  void testStreamForUnknownPipelineReturns404() throws Exception {
    SseStream stream = read(streamUrl("non.existent.pipeline", UUID.randomUUID().toString(), null));

    assertEquals(404, stream.status(), "an unknown pipeline must return 404, not hang");
  }

  @Test
  void testStreamRefusesInsteadOfHangingWhenNoLogBackendExists(TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "This deployment has a pipeline service to read from");
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    seedFinishedRun(pipeline.getFullyQualifiedName(), runId);

    SseStream stream = read(streamUrl(pipeline.getFullyQualifiedName(), runId.toString(), null));

    Map<String, Object> terminal = stream.terminalEvent();
    assertEquals("error", terminal.get("eventType"));
    assertNotNull(terminal.get("message"), "a refusal must explain itself, got: " + terminal);
  }

  private String streamUrl(String idOrFqn, String runId, String after) {
    String url = SdkClients.getServerUrl() + API_BASE + "/logs/" + idOrFqn + "/stream/" + runId;
    return after == null ? url : url + "?after=" + after;
  }

  /**
   * Records a terminal status for a run so the server knows the run is over and closes the stream
   * once it has drained, instead of tailing it until the idle backstop fires.
   */
  private void seedFinishedRun(String pipelineFQN, UUID runId) throws OpenMetadataException {
    Map<String, Object> status =
        Map.of(
            "runId", runId.toString(),
            "pipelineState", "success",
            "timestamp", System.currentTimeMillis(),
            "startDate", System.currentTimeMillis(),
            "endDate", System.currentTimeMillis());
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, API_BASE + "/" + pipelineFQN + "/pipelineStatus", status);
  }

  /** Reads a Server-Sent Events response to completion, bounded by the socket read timeout. */
  private SseStream read(String url) throws IOException {
    HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
    connection.setRequestProperty("Authorization", "Bearer " + SdkClients.getAdminToken());
    connection.setRequestProperty("Accept", "text/event-stream");
    connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
    connection.setReadTimeout(READ_TIMEOUT_MS);

    SseStream stream;
    try {
      int status = connection.getResponseCode();
      stream = new SseStream(status, status == 200 ? readData(connection) : List.of());
    } finally {
      connection.disconnect();
    }
    return stream;
  }

  private List<String> readData(HttpURLConnection connection) throws IOException {
    List<String> data = new ArrayList<>();
    try (BufferedReader reader =
        new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.startsWith("data:")) {
          data.add(line.substring("data:".length()).trim());
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
            .withName(ns.prefix("pipeline_log_stream_test"))
            .withDisplayName("Test Pipeline for Log Streaming")
            .withDescription("Test pipeline for the live log stream")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                new AirflowConfig()
                    .withStartDate(
                        new org.joda.time.DateTime("2022-06-10T15:06:47+00:00").toDate()));
    return SdkClients.adminClient().ingestionPipelines().create(createRequest);
  }

  /** The data frames one Server-Sent Events response delivered, and the status that carried them. */
  private record SseStream(int status, List<String> rawData) {

    List<Map<String, Object>> events() {
      List<Map<String, Object>> parsed = new ArrayList<>();
      for (String data : rawData) {
        parsed.add(parse(data));
      }
      parsed.removeIf(Map::isEmpty);
      return parsed;
    }

    /** The event the server ended the stream with, whichever way it chose to end it. */
    Map<String, Object> terminalEvent() {
      Map<String, Object> match = null;
      for (Map<String, Object> event : events()) {
        if (TERMINAL_EVENT_TYPES.contains(event.get("eventType"))) {
          match = event;
        }
      }
      return match;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> parse(String data) {
      Map<String, Object> parsed = Map.of();
      try {
        parsed = MAPPER.readValue(data, Map.class);
      } catch (IOException e) {
        // Anything that is not the JSON envelope is not an event — a heartbeat comment, say.
      }
      return parsed;
    }
  }
}
