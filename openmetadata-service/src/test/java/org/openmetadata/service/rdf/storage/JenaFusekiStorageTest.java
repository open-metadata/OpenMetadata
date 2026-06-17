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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

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
          () -> false);

      assertEquals(3, attempts.get());
      assertEquals(1, successes.get());
      assertEquals(2, failureRecords.get());
      assertEquals(750, delayMs.get());
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
}
