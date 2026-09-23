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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.api.rdf.RdfStatus;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.RdfProjectionHealth;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.testcontainers.containers.GenericContainer;

/** Real metadata requests, durable live hooks and the public projection status contract. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfLiveProjectionIT {
  private static final UUID APP_ID = UUID.randomUUID();
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static GenericContainer<?> fuseki;
  private static HttpServer unavailable;
  private static RdfConfiguration servingConfig;
  private static RdfConfiguration unavailableConfig;

  @BeforeAll
  static void start() throws Exception {
    fuseki = TestSuiteBootstrap.createFusekiContainer();
    fuseki.start();
    servingConfig = configuration("http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(3030));
    unavailable = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    unavailable.createContext(
        "/",
        exchange -> {
          exchange.sendResponseHeaders(503, -1);
          exchange.close();
        });
    unavailable.start();
    unavailableConfig = configuration("http://127.0.0.1:" + unavailable.getAddress().getPort());
    final AppRunRecord completed =
        new AppRunRecord()
            .withAppId(APP_ID)
            .withAppName("RdfIndexApp")
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withTimestamp(System.currentTimeMillis())
            .withStartTime(System.currentTimeMillis())
            .withExtension(STATUS);
    Entity.getCollectionDAO()
        .appExtensionTimeSeriesDao()
        .insert(JsonUtils.pojoToJson(completed), STATUS);
  }

  @AfterAll
  static void stop() {
    RdfUpdater.disable();
    Entity.getCollectionDAO().appExtensionTimeSeriesDao().delete(APP_ID.toString(), STATUS);
    if (unavailable != null) {
      unavailable.stop(0);
    }
    if (fuseki != null) {
      fuseki.close();
    }
  }

  @Test
  void liveMetadataRecoversAfterWriterRestartWithoutAReindex(final TestNamespace namespace)
      throws Exception {
    RdfUpdater.initialize(unavailableConfig);
    final Glossary glossary = GlossaryTestFactory.createWithName(namespace, "durableRecovery");
    final GlossaryTerm term =
        GlossaryTermTestFactory.createWithName(namespace, glossary, "recoveredTerm");
    final RdfLiveWriteStore otherServer =
        new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());
    Awaitility.await().atMost(Duration.ofSeconds(30)).until(otherServer::isDegraded);
    assertEquals(RdfProjectionState.DEGRADED, status());
    assertTrue(otherServer.pendingWrites() > 0);

    RdfUpdater.initialize(unavailableConfig);
    assertEquals(RdfProjectionState.DEGRADED, status());
    RdfUpdater.initialize(servingConfig);
    Awaitility.await().atMost(Duration.ofSeconds(60)).until(() -> otherServer.pendingWrites() == 0);

    try (JenaFusekiStorage storage = new JenaFusekiStorage(servingConfig)) {
      final Model model = storage.getEntity(Entity.GLOSSARY_TERM, term.getId());
      try {
        assertTrue(model.contains(null, null, term.getName()));
      } finally {
        model.close();
      }
    }
    assertEquals(RdfProjectionState.READY, status());
    assertEquals(
        APP_ID,
        JsonUtils.readValue(
                Entity.getCollectionDAO()
                    .appExtensionTimeSeriesDao()
                    .listAppExtensionByName("RdfIndexApp", 1, 0, STATUS)
                    .getFirst(),
                AppRunRecord.class)
            .getAppId());
    GlossaryTestFactory.delete(glossary);
    Awaitility.await().atMost(Duration.ofSeconds(30)).until(() -> otherServer.pendingWrites() == 0);
  }

  @Test
  void quotedGlossaryTagsProjectWithoutDegradingLiveWrites(final TestNamespace namespace)
      throws Exception {
    RdfUpdater.initialize(servingConfig);
    final var glossary = GlossaryTestFactory.createWithName(namespace, "glossary%.quoted");
    final var term = GlossaryTermTestFactory.createWithName(namespace, glossary, "term%.quoted");
    final var service = DatabaseServiceTestFactory.createPostgres(namespace);
    final var schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    final var table = TableTestFactory.createSimple(namespace, schema.getFullyQualifiedName());
    final var tag =
        new TagLabel()
            .withTagFQN(term.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", "add")
        .put("path", "/tags/-")
        .set("value", JsonUtils.valueToTree(tag));
    SdkClients.adminClient().tables().patch(table.getId(), patch);
    // Waiting on pendingWrites() == 0 is not a barrier for this patch: the queue is a single
    // global table (SELECT COUNT(*) FROM rdf_live_write_queue) shared by every test in the lane,
    // so it can already read zero before this write is even enqueued and the wait returns
    // immediately. Poll the outcome the assertion needs instead — it is specific to this table and
    // cannot be satisfied by somebody else's drain.
    //
    // One storage handle serves both polls. Building a JenaFusekiStorage per retry would open HTTP
    // clients and re-read the ontology on every attempt across two 60s windows, trading this flake
    // for load of its own.
    try (var storage = new JenaFusekiStorage(servingConfig)) {
      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .untilAsserted(() -> assertHasGlossaryTerm(storage, table.getId(), term.getId(), true));
      assertEquals(RdfProjectionState.READY, status());

      // Same reasoning in reverse: the delete is hard, recursive and permanent, so the projection
      // must drop the edge. Polling for its removal proves the delete's writes drained, rather
      // than a shared counter that may never have counted them.
      GlossaryTestFactory.delete(glossary);
      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .untilAsserted(() -> assertHasGlossaryTerm(storage, table.getId(), term.getId(), false));
      assertEquals(RdfProjectionState.READY, status());
    }
  }

  @Test
  void persistedFailureSurvivesHealthReinitialization() throws Exception {
    RdfUpdater.initialize(servingConfig);
    final RdfLiveWriteStore store = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());
    RdfProjectionHealth.markDegraded(new IllegalStateException("untracked projection failure"));
    try {
      RdfProjectionHealth.initialize(new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC()));
      assertEquals(RdfProjectionState.DEGRADED, status());
    } finally {
      store.markRebuilt(store.failureVersion());
    }
    assertEquals(RdfProjectionState.READY, status());
  }

  private static RdfProjectionState status() throws Exception {
    final HttpResponse<String> response =
        HTTP.send(
            HttpRequest.newBuilder()
                .uri(URI.create(SdkClients.getServerUrl() + "/v1/rdf/status"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + SdkClients.getAdminToken())
                .GET()
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    return JsonUtils.readValue(response.body(), RdfStatus.class).getProjectionState();
  }

  private static RdfConfiguration configuration(final String endpoint) {
    return new RdfConfiguration()
        .withEnabled(true)
        .withBaseUri(URI.create("https://open-metadata.org/"))
        .withStorageType(RdfConfiguration.StorageType.FUSEKI)
        .withRemoteEndpoint(URI.create(endpoint + "/openmetadata"))
        .withDataset("openmetadata")
        .withUsername("admin")
        .withPassword("test-admin")
        .withRequestTimeoutMs(10000)
        .withWriteMaxRetries(0);
  }

  private static void assertHasGlossaryTerm(
      final JenaFusekiStorage storage,
      final UUID tableId,
      final UUID termId,
      final boolean expected) {
    final Model model = storage.getEntity(Entity.TABLE, tableId);
    // getEntity returns null for a graph not yet written and for a failed or circuit-open read;
    // neither proves the edge state. The table is never deleted, so retry until it is readable.
    assertNotNull(model, "no readable RDF graph for table " + tableId);
    try {
      assertEquals(
          expected,
          model.contains(
              model.createResource("https://open-metadata.org/entity/table/" + tableId),
              model.createProperty("https://open-metadata.org/ontology/hasGlossaryTerm"),
              model.createResource("https://open-metadata.org/entity/glossaryTerm/" + termId)),
          "om:hasGlossaryTerm edge from table " + tableId + " to term " + termId);
    } finally {
      model.close();
    }
  }
}
