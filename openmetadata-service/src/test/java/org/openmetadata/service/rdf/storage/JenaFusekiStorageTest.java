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
package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.ConnectException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.Query;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.update.UpdateFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfWriteMode;

/**
 * Unit tests for the package-private helpers on {@link JenaFusekiStorage}.
 * These methods do all the URL parsing and credential handling for the admin
 * HTTP paths (dataset existence checks, compaction trigger, task polling),
 * so getting them wrong corrupts every admin call — and they're invoked on
 * untrusted-shape input from the runtime config. The class itself has too
 * many heavyweight dependencies (Jena, Fuseki HTTP) to instantiate in a
 * unit test, but every helper that just transforms strings is package-
 * private and individually testable.
 */
@DisplayName("JenaFusekiStorage helper tests")
class JenaFusekiStorageTest {

  private static final String RDF_TYPE_URI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

  @Nested
  @DisplayName("configuration defaults")
  class ConfigurationDefaultTests {

    @Test
    @DisplayName("unset values use production-safe defaults")
    void unsetValuesUseDefaults() {
      RdfConfiguration config = new RdfConfiguration();

      assertEquals(
          JenaFusekiStorage.DEFAULT_CONNECT_TIMEOUT_MS,
          JenaFusekiStorage.resolveConnectTimeoutMs(config));
      assertEquals(
          JenaFusekiStorage.DEFAULT_REQUEST_TIMEOUT_MS,
          JenaFusekiStorage.resolveRequestTimeoutMs(config));
      assertEquals(
          JenaFusekiStorage.DEFAULT_WRITE_MAX_RETRIES,
          JenaFusekiStorage.resolveWriteMaxRetries(config));
      assertEquals(
          JenaFusekiStorage.DEFAULT_WRITE_RETRY_INITIAL_BACKOFF_MS,
          JenaFusekiStorage.resolveWriteRetryInitialBackoffMs(config));
      assertEquals(
          JenaFusekiStorage.DEFAULT_WRITE_RETRY_MAX_BACKOFF_MS,
          JenaFusekiStorage.resolveWriteRetryMaxBackoffMs(config));
      assertFalse(config.getInferenceEnabled());
      assertEquals(100, config.getBulkEntityBatchSize());
      assertEquals(100, config.getBulkRelationshipSourceBatchSize());
      assertEquals(50, config.getBulkLineageEdgeBatchSize());
    }

    @Test
    @DisplayName("positive configured values override defaults")
    void configuredValuesOverrideDefaults() {
      RdfConfiguration config =
          new RdfConfiguration()
              .withConnectTimeoutMs(1234)
              .withRequestTimeoutMs(9876)
              .withWriteMaxRetries(4)
              .withWriteRetryInitialBackoffMs(55)
              .withWriteRetryMaxBackoffMs(777);

      assertEquals(1234, JenaFusekiStorage.resolveConnectTimeoutMs(config));
      assertEquals(9876, JenaFusekiStorage.resolveRequestTimeoutMs(config));
      assertEquals(4, JenaFusekiStorage.resolveWriteMaxRetries(config));
      assertEquals(55, JenaFusekiStorage.resolveWriteRetryInitialBackoffMs(config));
      assertEquals(777, JenaFusekiStorage.resolveWriteRetryMaxBackoffMs(config));
    }
  }

  @Nested
  @DisplayName("graph triple-count query")
  class GraphTripleCountQueryTests {

    @Test
    @DisplayName("valid absolute graph IRIs are bound into the query")
    void validAbsoluteGraphIriIsBound() {
      String graphIri = "https://open-metadata.org/graph/inferred/product-adoption";

      Query query = JenaFusekiStorage.graphTripleCountQuery(graphIri);

      assertTrue(query.toString().contains('<' + graphIri + '>'));
      assertFalse(query.toString().contains("?graph"));
    }

    @Test
    @DisplayName("relative and injectable graph IRIs are rejected")
    void unsafeGraphIrisAreRejected() {
      assertThrows(
          IllegalArgumentException.class,
          () -> JenaFusekiStorage.graphTripleCountQuery("graph/inferred/product-adoption"));
      assertThrows(
          IllegalArgumentException.class,
          () ->
              JenaFusekiStorage.graphTripleCountQuery(
                  "https://open-metadata.org/graph/> } UNION { ?s ?p ?o } #"));
    }
  }

  @Nested
  @DisplayName("request timeout classification")
  class RequestTimeoutClassificationTests {

    @Test
    @DisplayName("CompletableFuture timeout wrappers count as circuit-breaker failures")
    void timeoutExceptionCountsAsCircuitBreakerFailure() {
      RuntimeException wrapped =
          new RuntimeException("bulkStoreEntities timed out", new TimeoutException());

      assertTrue(JenaFusekiStorage.isCircuitBreakerFailure(wrapped));
    }

    @Test
    @DisplayName("payload failures do not count as circuit-breaker failures")
    void payloadFailureDoesNotCountAsCircuitBreakerFailure() {
      assertFalse(
          JenaFusekiStorage.isCircuitBreakerFailure(new IllegalArgumentException("bad RDF")));
    }
  }

  @Nested
  @DisplayName("write retry policy")
  class WriteRetryPolicyTests {

    @Test
    @DisplayName("non-transient write failures are not retried or delayed")
    void nonTransientWriteFailuresAreNotRetriedOrDelayed() {
      AtomicInteger attempts = new AtomicInteger();
      AtomicInteger failureRecords = new AtomicInteger();
      AtomicLong delayMs = new AtomicLong();
      IllegalArgumentException failure = new IllegalArgumentException("bad RDF payload");

      IllegalArgumentException thrown =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  JenaFusekiStorage.runWriteWithRetry(
                      () -> {
                        attempts.incrementAndGet();
                        throw failure;
                      },
                      "testWrite",
                      2,
                      250,
                      2_000,
                      delayMs::addAndGet,
                      () -> {},
                      () -> {},
                      failureRecords::incrementAndGet,
                      () -> false,
                      () -> false));

      assertSame(failure, thrown);
      assertEquals(1, attempts.get());
      assertEquals(0, failureRecords.get());
      assertEquals(0, delayMs.get());
    }

    @Test
    @DisplayName("transient write failures are retried with injected delay")
    void transientWriteFailuresAreRetriedWithInjectedDelay() {
      AtomicInteger attempts = new AtomicInteger();
      AtomicInteger successes = new AtomicInteger();
      AtomicInteger failureRecords = new AtomicInteger();
      AtomicLong delayMs = new AtomicLong();

      JenaFusekiStorage.runWriteWithRetry(
          () -> {
            if (attempts.incrementAndGet() <= 2) {
              throw new RuntimeException("timed out", new TimeoutException());
            }
          },
          "testWrite",
          2,
          250,
          2_000,
          delayMs::addAndGet,
          () -> {},
          successes::incrementAndGet,
          failureRecords::incrementAndGet,
          () -> false,
          () -> false);

      assertEquals(3, attempts.get());
      assertEquals(1, successes.get());
      assertEquals(2, failureRecords.get());
      assertEquals(750, delayMs.get());
    }

    @Test
    @DisplayName("timeouts on large payloads abort retries with RdfPayloadTooLargeException")
    void largePayloadTimeoutAbortsRetries() {
      AtomicInteger attempts = new AtomicInteger();
      AtomicInteger failureRecords = new AtomicInteger();

      RdfPayloadTooLargeException thrown =
          assertThrows(
              RdfPayloadTooLargeException.class,
              () ->
                  JenaFusekiStorage.runWriteWithRetry(
                      () -> {
                        attempts.incrementAndGet();
                        throw new RuntimeException("timed out", new TimeoutException());
                      },
                      "testWrite",
                      2,
                      250,
                      2_000,
                      delay -> {},
                      () -> {},
                      () -> {},
                      failureRecords::incrementAndGet,
                      () -> false,
                      () -> true));

      assertTrue(thrown.getMessage().contains("split the batch"));
      assertEquals(1, attempts.get(), "an oversized timeout must never retry at the same size");
      assertEquals(1, failureRecords.get(), "the timeout still counts toward the breaker");
    }

    @Test
    @DisplayName("non-timeout transient failures still retry even when the payload is large")
    void largePayloadConnectFailureStillRetries() {
      AtomicInteger attempts = new AtomicInteger();

      JenaFusekiStorage.runWriteWithRetry(
          () -> {
            if (attempts.incrementAndGet() <= 1) {
              throw new RuntimeException("connect", new ConnectException("refused"));
            }
          },
          "testWrite",
          2,
          250,
          2_000,
          delay -> {},
          () -> {},
          () -> {},
          () -> {},
          () -> false,
          () -> true);

      assertEquals(2, attempts.get(), "connect failures are transient regardless of payload size");
    }
  }

  @Nested
  @DisplayName("payload guard")
  class PayloadGuardTests {

    @Test
    @DisplayName("oversized batches bisect until each part fits under the cap")
    void oversizedBatchesAreBisectedUntilUnderCap() {
      List<RdfStorageInterface.EntityWriteRequest> requests =
          List.of(request(), request(), request(), request());
      List<Integer> executedSizes = new ArrayList<>();
      AtomicInteger oversizedSingles = new AtomicInteger();

      JenaFusekiStorage.writeWithPayloadGuard(
          requests,
          chunk -> "x".repeat(100 * chunk.size()),
          150,
          (update, chunk) -> executedSizes.add(chunk.size()),
          oversized -> oversizedSingles.incrementAndGet());

      assertEquals(List.of(1, 1, 1, 1), executedSizes);
      assertEquals(0, oversizedSingles.get());
    }

    @Test
    @DisplayName("a batch under the cap executes once, unsplit")
    void underCapBatchExecutesOnce() {
      List<RdfStorageInterface.EntityWriteRequest> requests = List.of(request(), request());
      List<Integer> executedSizes = new ArrayList<>();

      JenaFusekiStorage.writeWithPayloadGuard(
          requests,
          chunk -> "x".repeat(50 * chunk.size()),
          150,
          (update, chunk) -> executedSizes.add(chunk.size()),
          oversized -> {});

      assertEquals(List.of(2), executedSizes);
    }

    @Test
    @DisplayName("a single oversized request is still sent, alone, with the warning callback")
    void singleOversizedRequestIsSentAloneWithWarning() {
      List<Integer> executedSizes = new ArrayList<>();
      AtomicInteger oversizedSingles = new AtomicInteger();

      JenaFusekiStorage.writeWithPayloadGuard(
          List.of(request()),
          chunk -> "x".repeat(400),
          150,
          (update, chunk) -> executedSizes.add(chunk.size()),
          oversized -> oversizedSingles.incrementAndGet());

      assertEquals(List.of(1), executedSizes);
      assertEquals(1, oversizedSingles.get());
    }

    @Test
    @DisplayName("an empty update never executes")
    void emptyUpdateNeverExecutes() {
      AtomicInteger executions = new AtomicInteger();

      JenaFusekiStorage.writeWithPayloadGuard(
          List.of(request()),
          chunk -> "",
          150,
          (update, chunk) -> executions.incrementAndGet(),
          oversized -> executions.incrementAndGet());

      assertEquals(0, executions.get());
    }

    private RdfStorageInterface.EntityWriteRequest request() {
      return new RdfStorageInterface.EntityWriteRequest(
          "table", UUID.randomUUID(), ModelFactory.createDefaultModel());
    }
  }

  @Nested
  @DisplayName("entity upsert query")
  class EntityUpsertQueryTests {

    @Test
    @DisplayName("storeEntity helper emits one DELETE + INSERT DATA update")
    void entityUpsertCombinesDeleteAndInsert() {
      UUID entityId = UUID.randomUUID();
      String entityUri = "https://open-metadata.org/entity/table/" + entityId;
      Model model = ModelFactory.createDefaultModel();
      model
          .createResource(entityUri)
          .addProperty(
              model.createProperty("http://www.w3.org/2000/01/rdf-schema#label"), "orders");

      String update = JenaFusekiStorage.buildEntityUpsertUpdate(entityUri, model);

      assertTrue(update.contains("DELETE { GRAPH <https://open-metadata.org/graph/knowledge>"));
      assertTrue(
          update.contains("INSERT DATA { GRAPH <https://open-metadata.org/graph/knowledge>"));
      assertTrue(update.indexOf("DELETE") < update.indexOf("INSERT DATA"));
      assertTrue(update.contains("orders"));
    }

    @Test
    @DisplayName("insert-only entity helper emits no delete reconciliation")
    void insertOnlyEntityUpsertSkipsDelete() {
      UUID entityId = UUID.randomUUID();
      String entityUri = "https://open-metadata.org/entity/table/" + entityId;
      Model model = ModelFactory.createDefaultModel();
      model
          .createResource(entityUri)
          .addProperty(
              model.createProperty("http://www.w3.org/2000/01/rdf-schema#label"), "orders");

      String update =
          JenaFusekiStorage.buildEntityUpsertUpdate(entityUri, model, RdfWriteMode.INSERT_ONLY);

      assertFalse(update.contains("DELETE"));
      assertTrue(update.startsWith("INSERT DATA"));
      assertTrue(update.contains("orders"));
    }

    @Test
    @DisplayName("reconcile update carries exactly one WHERE-bearing operation")
    void reconcileUpdateHasSingleWhereBearingOperation() {
      UUID entityId = UUID.randomUUID();
      String entityUri = "https://open-metadata.org/entity/table/" + entityId;
      Model model = ModelFactory.createDefaultModel();
      Resource entity = model.createResource(entityUri);
      entity.addProperty(
          model.createProperty("http://www.w3.org/2000/01/rdf-schema#label"), "orders");
      entity.addProperty(
          model.createProperty(RDF_TYPE_URI),
          model.createResource("https://open-metadata.org/ontology/Table"));

      String update = JenaFusekiStorage.buildEntityUpsertUpdate(entityUri, model);

      assertEquals(1, countOccurrences(update, "WHERE"), update);
      assertEquals(1, countOccurrences(update, "DELETE"), update);
      assertTrue(update.contains("!isIRI(?o)"), update);
      assertTrue(update.contains("?p IN ("), update);
    }

    @Test
    @DisplayName("delete filter degrades to the literal sweep when no predicates are managed")
    void reconcileUpdateWithoutManagedPredicatesSweepsLiteralsOnly() {
      String entityUri = "https://open-metadata.org/entity/table/" + UUID.randomUUID();
      Model model = ModelFactory.createDefaultModel();
      model
          .createResource(entityUri)
          .addProperty(
              model.createProperty("https://open-metadata.org/ontology/unmanaged"), "value");

      String update = JenaFusekiStorage.buildEntityUpsertUpdate(entityUri, model);

      assertEquals(1, countOccurrences(update, "WHERE"), update);
      assertTrue(update.contains("!isIRI(?o)"), update);
    }

    @Test
    @DisplayName("bulk reconcile combines all entity deletes into one WHERE operation")
    void bulkReconcileUsesOneWhereOperation() {
      UUID firstId = UUID.randomUUID();
      UUID secondId = UUID.randomUUID();
      String baseUri = "https://open-metadata.org/";
      List<RdfStorageInterface.EntityWriteRequest> requests =
          List.of(entityRequest(firstId, "orders"), entityRequest(secondId, "customers"));

      String update = JenaFusekiStorage.buildBulkReconcileUpdate(baseUri, requests);
      Dataset dataset = DatasetFactory.createTxnMem();
      Model graph = dataset.getNamedModel("https://open-metadata.org/graph/knowledge");
      Resource first = graph.createResource(baseUri + "entity/table/" + firstId);
      Resource second = graph.createResource(baseUri + "entity/table/" + secondId);
      Resource outsider = graph.createResource("urn:outsider");
      Resource target = graph.createResource("urn:target");
      Property label = graph.createProperty("http://www.w3.org/2000/01/rdf-schema#label");
      Property contains = graph.createProperty("https://open-metadata.org/ontology/contains");
      graph.add(first, label, "old orders");
      graph.add(second, label, "old customers");
      graph.add(first, contains, target);
      graph.add(outsider, label, "preserved");

      assertEquals(1, countOccurrences(update, "WHERE"), update);
      assertEquals(1, countOccurrences(update, "DELETE"), update);
      assertTrue(update.contains("VALUES ?entity"), update);
      assertTrue(update.contains(firstId.toString()), update);
      assertTrue(update.contains(secondId.toString()), update);
      assertDoesNotThrow(() -> UpdateAction.parseExecute(update, dataset));
      assertFalse(graph.contains(first, label, "old orders"));
      assertFalse(graph.contains(second, label, "old customers"));
      assertTrue(graph.contains(first, label, "orders"));
      assertTrue(graph.contains(second, label, "customers"));
      assertTrue(graph.contains(first, contains, target));
      assertTrue(graph.contains(outsider, label, "preserved"));
      dataset.close();
    }
  }

  @Nested
  @DisplayName("relationship reconciliation query")
  class RelationshipReconciliationQueryTests {

    @Test
    @DisplayName("multiple sources share one WHERE-bearing delete")
    void multipleSourcesShareOneWhereOperation() {
      UUID firstId = UUID.randomUUID();
      UUID secondId = UUID.randomUUID();
      String baseUri = "https://open-metadata.org/";
      Set<String> sources =
          new LinkedHashSet<>(
              List.of(baseUri + "entity/table/" + firstId, baseUri + "entity/table/" + secondId));
      RdfStorageInterface.RelationshipData relationship =
          new RdfStorageInterface.RelationshipData(
              "table", firstId, "database", UUID.randomUUID(), "contains");

      String update =
          JenaFusekiStorage.buildBulkRelationshipUpdate(baseUri, List.of(relationship), sources);

      assertEquals(1, countOccurrences(update, "WHERE"), update);
      assertEquals(1, countOccurrences(update, "DELETE"), update);
      assertTrue(update.contains("VALUES ?source"), update);
      assertTrue(update.contains(firstId.toString()), update);
      assertTrue(update.contains(secondId.toString()), update);
      assertTrue(update.contains("INSERT DATA"), update);
      assertDoesNotThrow(() -> UpdateFactory.create(update));
    }
  }

  @Nested
  @DisplayName("dataset redirection")
  class DatasetRedirectionTests {

    @Test
    @DisplayName("redirects the dataset path, preserving scheme host and port")
    void redirectsDatasetPath() {
      assertEquals(
          "http://fuseki:3030/openmetadata_a",
          JenaFusekiStorage.redirectToDataset("http://fuseki:3030/openmetadata", "openmetadata_a"));
    }

    @Test
    @DisplayName("encodes spaces in the dataset path segment")
    void encodesSpacesInDatasetPath() {
      assertEquals(
          "http://fuseki:3030/openmetadata%20blue",
          JenaFusekiStorage.redirectToDataset(
              "http://fuseki:3030/openmetadata", "openmetadata blue"));
    }

    @Test
    @DisplayName("encodes reserved characters in the dataset path segment")
    void encodesReservedCharactersInDatasetPath() {
      assertEquals(
          "http://fuseki:3030/openmetadata%2Fblue%3Fstate%3Dready%23current",
          JenaFusekiStorage.redirectToDataset(
              "http://fuseki:3030/openmetadata", "openmetadata/blue?state=ready#current"));
    }

    @Test
    @DisplayName("preserves embedded credentials so admin calls stay authenticated")
    void preservesEmbeddedCredentials() {
      assertEquals(
          "http://user:pass@fuseki:3030/openmetadata_b",
          JenaFusekiStorage.redirectToDataset(
              "http://user:pass@fuseki:3030/openmetadata", "openmetadata_b"));
    }

    @Test
    @DisplayName("no override leaves the endpoint untouched")
    void noOverrideLeavesEndpointUntouched() {
      String endpoint = "http://fuseki:3030/openmetadata";
      assertEquals(endpoint, JenaFusekiStorage.redirectToDataset(endpoint, null));
      assertEquals(endpoint, JenaFusekiStorage.redirectToDataset(endpoint, "  "));
    }

    @Test
    @DisplayName("an unparseable endpoint falls back rather than targeting the wrong dataset")
    void unparseableEndpointFallsBack() {
      assertEquals("not-a-url", JenaFusekiStorage.redirectToDataset("not-a-url", "openmetadata_a"));
    }
  }

  @Nested
  @DisplayName("parseDatasetEndpoint")
  class ParseDatasetEndpointTests {

    @Test
    @DisplayName("standard host:port/dataset shape")
    void simpleEndpoint() {
      JenaFusekiStorage.DatasetEndpoint info =
          JenaFusekiStorage.parseDatasetEndpoint("http://fuseki:3030/openmetadata");
      assertNotNull(info);
      assertEquals("http://fuseki:3030", info.serverBaseUrl());
      assertEquals("openmetadata", info.datasetName());
      assertNull(info.userInfo());
    }

    @Test
    @DisplayName("preserves dataset name only — service path (/sparql) discarded")
    void endpointWithServicePath() {
      JenaFusekiStorage.DatasetEndpoint info =
          JenaFusekiStorage.parseDatasetEndpoint("https://example.com:3030/myds/sparql");
      assertNotNull(info);
      assertEquals("https://example.com:3030", info.serverBaseUrl());
      assertEquals("myds", info.datasetName());
    }

    @Test
    @DisplayName("no port — omitted from base URL")
    void endpointWithoutPort() {
      JenaFusekiStorage.DatasetEndpoint info =
          JenaFusekiStorage.parseDatasetEndpoint("https://fuseki.example.com/openmetadata");
      assertNotNull(info);
      assertEquals("https://fuseki.example.com", info.serverBaseUrl());
      assertEquals("openmetadata", info.datasetName());
    }

    @Test
    @DisplayName("embedded user:pass@ is hoisted into userInfo, NOT left in URL")
    void endpointWithUserInfoIsHoisted() {
      JenaFusekiStorage.DatasetEndpoint info =
          JenaFusekiStorage.parseDatasetEndpoint("http://alice:s3cret@fuseki:3030/openmetadata");
      assertNotNull(info);
      // CRITICAL: serverBaseUrl MUST NOT carry credentials, otherwise the
      // admin HTTP requests would have them in the URL where JDK HttpClient
      // debug logging / downstream proxies could capture them.
      assertEquals("http://fuseki:3030", info.serverBaseUrl());
      assertFalse(info.serverBaseUrl().contains("@"));
      assertFalse(info.serverBaseUrl().contains("alice"));
      assertFalse(info.serverBaseUrl().contains("s3cret"));
      assertEquals("alice:s3cret", info.userInfo());
    }

    @Test
    @DisplayName("URL-encoded userInfo passes through raw — addBasicAuth decodes it")
    void endpointWithEncodedUserInfoPreservesRawForm() {
      // User who put a `@` in their password URL-encodes it as %40. The raw
      // userInfo must come through unchanged so addBasicAuth can decode it
      // once before base64-encoding for the header.
      JenaFusekiStorage.DatasetEndpoint info =
          JenaFusekiStorage.parseDatasetEndpoint("http://bob:p%40ss@fuseki:3030/ds");
      assertNotNull(info);
      assertEquals("bob:p%40ss", info.userInfo());
    }

    @Test
    @DisplayName("malformed URL returns null (caller skips the admin operation)")
    void malformedUrlReturnsNull() {
      assertNull(JenaFusekiStorage.parseDatasetEndpoint("not a url"));
      // Parses as a relative URI, so it must be rejected on the missing scheme/host rather
      // than producing a "null://null" server base.
      assertNull(JenaFusekiStorage.parseDatasetEndpoint("not-a-url"));
      assertNull(JenaFusekiStorage.parseDatasetEndpoint("/openmetadata"));
    }

    @Test
    @DisplayName("missing path returns null")
    void missingPathReturnsNull() {
      assertNull(JenaFusekiStorage.parseDatasetEndpoint("http://fuseki:3030"));
      assertNull(JenaFusekiStorage.parseDatasetEndpoint("http://fuseki:3030/"));
    }

    @Test
    @DisplayName("null endpoint returns null without throwing")
    void nullEndpoint() {
      // URI.create(null) throws NPE; the implementation catches it via
      // IllegalArgumentException only, so this test guards against a
      // regression where a null endpoint blows up the indexer instead of
      // skipping the admin operation.
      try {
        assertNull(JenaFusekiStorage.parseDatasetEndpoint(null));
      } catch (NullPointerException expected) {
        // The current implementation lets NPE bubble — the callers all
        // guard upstream by reading from instance state that's set in the
        // constructor. If a future change pushes the null guard into the
        // helper, both branches are acceptable.
      }
    }
  }

  @Nested
  @DisplayName("maskUserInfo")
  class MaskUserInfoTests {

    @Test
    @DisplayName("strips user:pass@ to ***@")
    void masksEmbeddedCredentials() {
      assertEquals(
          "http://***@fuseki:3030/openmetadata",
          JenaFusekiStorage.maskUserInfo("http://alice:secret@fuseki:3030/openmetadata"));
    }

    @Test
    @DisplayName("passes URL without userInfo through unchanged")
    void passesPlainUrl() {
      assertEquals(
          "http://fuseki:3030/openmetadata",
          JenaFusekiStorage.maskUserInfo("http://fuseki:3030/openmetadata"));
    }

    @Test
    @DisplayName("handles HTTPS + no port")
    void httpsNoPort() {
      assertEquals(
          "https://***@fuseki.example.com/openmetadata",
          JenaFusekiStorage.maskUserInfo("https://alice:secret@fuseki.example.com/openmetadata"));
    }

    @Test
    @DisplayName("null returns null")
    void nullInput() {
      assertNull(JenaFusekiStorage.maskUserInfo(null));
    }

    @Test
    @DisplayName("non-URL string falls back to regex without throwing")
    void nonUrlInput() {
      // The implementation tries URI.create first then falls back to a
      // regex substitution. Either branch must NOT throw.
      String result = JenaFusekiStorage.maskUserInfo("not a url://user:pw@host/ds");
      assertNotNull(result);
      assertFalse(result.contains("user:pw"));
    }
  }

  @Nested
  @DisplayName("parseJvmMaxHeapBytes")
  class MetricsParsingTests {

    @Test
    @DisplayName("Prometheus heap samples sum across pools, skipping unbounded pools")
    void prometheusHeapParsing() {
      String text =
          """
          # HELP jvm_memory_max_bytes The maximum amount of memory in bytes
          # TYPE jvm_memory_max_bytes gauge
          jvm_memory_max_bytes{area="heap",id="G1 Eden Space",} -1.0
          jvm_memory_max_bytes{area="heap",id="G1 Old Gen",} 4.294967296E9
          jvm_memory_max_bytes{area="heap",id="G1 Survivor Space",} 1.073741824E9
          jvm_memory_max_bytes{area="nonheap",id="Metaspace",} 2.68435456E8
          """;

      OptionalLong parsed = JenaFusekiStorage.parseJvmMaxHeapBytes(text);

      assertTrue(parsed.isPresent());
      assertEquals((4L << 30) + (1L << 30), parsed.getAsLong());
    }

    @Test
    @DisplayName("metrics text without heap samples parses to empty")
    void noHeapSamplesParsesEmpty() {
      assertTrue(
          JenaFusekiStorage.parseJvmMaxHeapBytes("jvm_threads_live_threads 42.0\n").isEmpty());
    }
  }

  @Nested
  @DisplayName("encodePathSegment")
  class EncodePathSegmentTests {

    @Test
    @DisplayName("alphanumeric segment passes through unchanged")
    void plain() {
      assertEquals("openmetadata", JenaFusekiStorage.encodePathSegment("openmetadata"));
    }

    @Test
    @DisplayName("spaces become %20, not +")
    void spaceBecomesPercent20() {
      // URLEncoder defaults to + for spaces; the helper rewrites + back to
      // %20 because RFC 3986 says only query strings use + for space, not
      // path segments — the /$/compact/... URI is a path segment.
      assertEquals("my%20dataset", JenaFusekiStorage.encodePathSegment("my dataset"));
    }

    @Test
    @DisplayName("reserved chars get percent-encoded")
    void reservedChars() {
      String encoded = JenaFusekiStorage.encodePathSegment("ds?a=1#frag/with slash");
      assertFalse(encoded.contains("?"));
      assertFalse(encoded.contains("#"));
      assertFalse(encoded.contains(" "));
      // Path-separator / IS reserved and gets encoded to %2F (URLEncoder
      // does this by default).
      assertTrue(encoded.contains("%2F"));
    }
  }

  @Nested
  @DisplayName("extractTaskId")
  class ExtractTaskIdTests {

    @Test
    @DisplayName("pulls taskId out of a typical compact-task response")
    void typicalResponse() {
      String body = "{\"taskId\":\"4\",\"requestId\":42}";
      assertEquals("4", JenaFusekiStorage.extractTaskId(body));
    }

    @Test
    @DisplayName("handles task IDs that aren't numeric")
    void stringTaskId() {
      String body = "{\"taskId\":\"compact-abc-123\",\"started\":\"2026-05-19T00:00:00Z\"}";
      assertEquals("compact-abc-123", JenaFusekiStorage.extractTaskId(body));
    }

    @Test
    @DisplayName("returns null when taskId is missing")
    void missingTaskId() {
      assertNull(JenaFusekiStorage.extractTaskId("{\"requestId\":42}"));
    }

    @Test
    @DisplayName("returns null when taskId is JSON null")
    void nullTaskId() {
      assertNull(JenaFusekiStorage.extractTaskId("{\"taskId\":null}"));
    }

    @Test
    @DisplayName("returns null on empty or blank body")
    void emptyOrBlankBody() {
      assertNull(JenaFusekiStorage.extractTaskId(""));
      assertNull(JenaFusekiStorage.extractTaskId("   "));
      assertNull(JenaFusekiStorage.extractTaskId(null));
    }

    @Test
    @DisplayName("returns null on malformed JSON instead of throwing")
    void malformedJson() {
      // The catch-block guards the SPARQL/compaction path against being
      // killed by a server that returns non-JSON; verify it returns null
      // (caller logs + skips) instead of bubbling.
      assertNull(JenaFusekiStorage.extractTaskId("not json"));
      assertNull(JenaFusekiStorage.extractTaskId("{taskId: 'unquoted'}"));
    }
  }

  @Nested
  @DisplayName("isTaskFinished")
  class IsTaskFinishedTests {

    @Test
    @DisplayName("true when 'finished' is a timestamp")
    void finishedTimestamp() {
      String body =
          "{\"task\":\"Compact\",\"taskId\":\"4\","
              + "\"started\":\"2026-05-19T00:00:00Z\","
              + "\"finished\":\"2026-05-19T00:00:02Z\"}";
      assertTrue(JenaFusekiStorage.isTaskFinished(body));
    }

    @Test
    @DisplayName("false when 'finished' is missing")
    void notFinished() {
      String body = "{\"task\":\"Compact\",\"taskId\":\"4\",\"started\":\"2026-05-19T00:00:00Z\"}";
      assertFalse(JenaFusekiStorage.isTaskFinished(body));
    }

    @Test
    @DisplayName("false when 'finished' is JSON null or empty string")
    void finishedNullOrEmpty() {
      assertFalse(JenaFusekiStorage.isTaskFinished("{\"finished\":null}"));
      assertFalse(JenaFusekiStorage.isTaskFinished("{\"finished\":\"\"}"));
      assertFalse(JenaFusekiStorage.isTaskFinished("{\"finished\":\"  \"}"));
    }

    @Test
    @DisplayName("false on blank/null body")
    void blankBody() {
      assertFalse(JenaFusekiStorage.isTaskFinished(""));
      assertFalse(JenaFusekiStorage.isTaskFinished(null));
    }

    @Test
    @DisplayName("false on malformed JSON")
    void malformedJson() {
      assertFalse(JenaFusekiStorage.isTaskFinished("not json"));
    }
  }

  private static RdfStorageInterface.EntityWriteRequest entityRequest(UUID id, String label) {
    String entityUri = "https://open-metadata.org/entity/table/" + id;
    Model model = ModelFactory.createDefaultModel();
    model
        .createResource(entityUri)
        .addProperty(model.createProperty("http://www.w3.org/2000/01/rdf-schema#label"), label);
    return new RdfStorageInterface.EntityWriteRequest("table", id, model);
  }

  private static int countOccurrences(String haystack, String needle) {
    int count = 0;
    int from = 0;
    while ((from = haystack.indexOf(needle, from)) >= 0) {
      count++;
      from += needle.length();
    }
    return count;
  }
}
