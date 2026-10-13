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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.LongStream;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.RdfUpdater;

/**
 * Writes that reach the serving graph without the live-write queue must still move the enqueued
 * watermark, or reasoning results computed before them would pass for current. Isolated, so no
 * other test records a write outside the queue while one is measured.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfSourceRevisionIT {
  private static final String APP_NAME = "RdfIndexApp";
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String GRAPH = BASE_URI + "graph/it/source-revision";
  private static final java.net.http.HttpClient HTTP_CLIENT =
      java.net.http.HttpClient.newHttpClient();

  @BeforeAll
  static void enableLiveProjection() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    if (!RdfUpdater.isEnabled()) {
      RdfUpdater.initialize(
          new RdfConfiguration()
              .withEnabled(true)
              .withBaseUri(URI.create(BASE_URI))
              .withStorageType(RdfConfiguration.StorageType.FUSEKI)
              .withRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()))
              .withDataset("openmetadata")
              .withUsername("admin")
              .withPassword("test-admin"));
    }
  }

  @Test
  void anAdminSparqlUpdateRecordsOneUntrackedWrite() {
    assertEquals(
        1, untrackedWritesDuring(() -> assertEquals(200, update(insertData()).statusCode())));
  }

  @Test
  void aPipelineRunRecordedInTheGraphRecordsOneUntrackedWrite(final TestNamespace ns) {
    final Pipeline pipeline =
        SdkClients.adminClient()
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(ns.prefix("pipeline"))
                    .withService(
                        PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName()));

    final long recorded =
        untrackedWritesDuring(
            () ->
                SdkClients.adminClient()
                    .pipelines()
                    .addPipelineStatus(
                        pipeline.getFullyQualifiedName(),
                        new PipelineStatus()
                            .withExecutionStatus(StatusType.Successful)
                            .withTimestamp(System.currentTimeMillis())));

    assertEquals(1, recorded);
  }

  @Test
  void anInPlaceReindexRecordsAWriteBeforeAndAfterItWrites() {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger is not compatible with K8s pipelines");
    final HttpClient client = SdkClients.adminClient().getHttpClient();
    final AppRunRecord previous = awaitNoRunInFlight(client);
    final AppRunRecord[] run = new AppRunRecord[1];

    final long recorded =
        untrackedWritesDuring(
            () -> {
              trigger(client);
              run[0] = awaitRunAfter(client, previous);
            });

    assertTrue(
        Set.of("completed", "success").contains(status(run[0])), () -> "Reindex failed: " + run[0]);
    assertEquals(2, recorded);
  }

  /**
   * Counts the queue IDs handed out during {@code action} that left no row to deliver. Delivery is
   * paused by holding the drain guard, so every live write enqueued meanwhile stays in the queue and
   * is told apart from untracked writes, whose rows are gone as soon as they commit.
   */
  private static long untrackedWritesDuring(final Runnable action) {
    try (Handle drainGuard = TestSuiteBootstrap.getJdbi().open()) {
      drainGuard.begin();
      try {
        drainGuard
            .createQuery("SELECT id FROM rdf_live_write_guard WHERE id = 'drain' FOR UPDATE")
            .mapTo(String.class)
            .one();
        final RdfLiveWriteStore liveWrites =
            new RdfLiveWriteStore(TestSuiteBootstrap.getJdbi(), Clock.systemUTC());
        final long before = liveWrites.enqueuedWatermark();
        action.run();
        final long after = liveWrites.enqueuedWatermark();
        final Set<Long> queued = Set.copyOf(queuedAfter(before));
        return LongStream.rangeClosed(before + 1, after).filter(id -> !queued.contains(id)).count();
      } finally {
        drainGuard.rollback();
      }
    }
  }

  private static List<Long> queuedAfter(final long id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT id FROM rdf_live_write_queue WHERE id > :id")
                    .bind("id", id)
                    .mapTo(Long.class)
                    .list());
  }

  private static String insertData() {
    return "INSERT DATA { GRAPH <"
        + GRAPH
        + "> { <urn:it:revision> <urn:it:value> \""
        + UUID.randomUUID()
        + "\" } }";
  }

  private static HttpResponse<String> update(final String update) {
    final HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/rdf/sparql/update"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    JsonUtils.pojoToJson(new SparqlQuery().withQuery(update))))
            .build();
    try {
      return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(exception);
    }
  }

  private static void trigger(final HttpClient client) {
    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            error -> error.getMessage() != null && error.getMessage().contains("already running"))
        .until(
            () -> {
              client.execute(
                  HttpMethod.POST,
                  "/v1/apps/trigger/" + APP_NAME,
                  Map.of("entities", List.of("glossary"), "recreateIndex", false),
                  Void.class);
              return true;
            });
  }

  private static AppRunRecord latestRun(final HttpClient client) {
    try {
      return client.execute(
          HttpMethod.GET, "/v1/apps/name/" + APP_NAME + "/runs/latest", null, AppRunRecord.class);
    } catch (RuntimeException noRunYet) {
      return null;
    }
  }

  private static String status(final AppRunRecord run) {
    return run.getStatus() == null ? "" : run.getStatus().value().toLowerCase(Locale.ROOT);
  }

  private static boolean finished(final AppRunRecord run) {
    return Set.of("completed", "success", "failed", "activeerror", "stopped").contains(status(run));
  }

  private static AppRunRecord awaitNoRunInFlight(final HttpClient client) {
    final AppRunRecord[] latest = new AppRunRecord[1];
    Awaitility.await("No " + APP_NAME + " run in flight")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              latest[0] = latestRun(client);
              return latest[0] == null || finished(latest[0]);
            });
    return latest[0];
  }

  private static AppRunRecord awaitRunAfter(final HttpClient client, final AppRunRecord previous) {
    final AppRunRecord[] run = new AppRunRecord[1];
    Awaitility.await(APP_NAME + " run completion")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              run[0] = latestRun(client);
              return run[0] != null
                  && (previous == null || run[0].getStartTime() > previous.getStartTime())
                  && finished(run[0]);
            });
    return run[0];
  }
}
