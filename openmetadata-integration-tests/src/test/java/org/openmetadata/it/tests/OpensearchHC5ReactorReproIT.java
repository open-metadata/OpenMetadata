package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.junit.jupiter.api.Assumptions.abort;

import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.concurrent.FutureCallback;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.EntityDetails;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpHost;
import org.apache.hc.core5.http.HttpResponse;
import org.apache.hc.core5.http.nio.AsyncResponseConsumer;
import org.apache.hc.core5.http.nio.CapacityChannel;
import org.apache.hc.core5.http.protocol.HttpContext;
import org.apache.hc.core5.reactor.IOReactorConfig;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.opensearch.SafeResponseConsumer;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Options;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;
import os.org.opensearch.client.transport.httpclient5.HttpAsyncResponseConsumerFactory;

/**
 * Regression guards for the three fixes applied against the "I/O reactor has been shut down"
 * family of failures (opensearch-java
 * <a href="https://github.com/opensearch-project/opensearch-java/issues/1969">#1969</a>; ports
 * the pattern from elasticsearch-java
 * <a href="https://github.com/elastic/elasticsearch-java/pull/1049">#1049</a>).
 *
 * <p>Every test here asserts <b>post-fix</b> behavior and will fail if any of the following are
 * reverted:
 *
 * <ul>
 *   <li>{@link OpenSearchVectorService#close()} must NOT close the shared HC5 transport.
 *   <li>{@code OpenSearchClient.createApacheHttpClient5Transport} must install
 *       {@link SafeResponseConsumer} as the outer wrapper on the response-consumer factory.
 *   <li>{@link SafeResponseConsumer} itself must convert {@code Error} to
 *       {@code RuntimeException} in every {@code AsyncResponseConsumer} method.
 * </ul>
 */
@Slf4j
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.CONCURRENT)
class OpensearchHC5ReactorReproIT {

  @Container
  static OpensearchContainer<?> opensearch =
      new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("discovery.type", "single-node")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private org.openmetadata.service.search.opensearch.OpenSearchClient osClient;

  @BeforeAll
  void setUp() {
    ElasticSearchConfiguration cfg =
        new ElasticSearchConfiguration()
            .withHost(opensearch.getHost())
            .withPort(opensearch.getMappedPort(9200))
            .withScheme("http")
            .withConnectionTimeoutSecs(10)
            .withSocketTimeoutSecs(30)
            .withKeepAliveTimeoutSecs(600)
            .withBatchSize(10)
            .withClusterAlias("")
            .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    osClient = new org.openmetadata.service.search.opensearch.OpenSearchClient(cfg);
  }

  @AfterAll
  void tearDown() {
    if (osClient != null) {
      osClient.close();
    }
  }

  /**
   * FIX #1: {@link OpenSearchVectorService#close()} must no-op on the shared transport.
   *
   * <p>Before the fix, this method called {@code client._transport().close()} on an
   * opensearch-java client whose transport is shared with every other manager on the production
   * {@code OpenSearchClient}. Closing it there permanently shut down the HC5 IOReactor for the
   * whole process — subsequent cluster operations threw "I/O reactor has been shut down" or
   * "Connection pool shut down" until JVM restart.
   */
  @Test
  void vectorServiceCloseMustNotKillSharedTransport() throws Exception {
    assertNotNull(
        osClient.getNewClient().cluster().health(), "baseline cluster.health() should work");

    OpenSearchVectorService sharedTransportConsumer =
        new OpenSearchVectorService(osClient.getNewClient(), null);
    sharedTransportConsumer.close();

    assertDoesNotThrow(
        () -> osClient.getNewClient().cluster().health(),
        "after OpenSearchVectorService.close(), the main OpenSearchClient must still work — "
            + "the vector service must not close the shared transport");
  }

  /**
   * FIX #2: production {@code OpenSearchClient.createApacheHttpClient5Transport} must install
   * {@link SafeResponseConsumer} as the outer wrapper on the response-consumer factory.
   *
   * <p>Walks the production transport via reflection down to the response-consumer factory and
   * asserts the consumer it produces is (or wraps) a {@link SafeResponseConsumer}. Fails if the
   * {@code setOptions(...)} call in production wiring is removed or the factory is reconfigured
   * to bypass the wrapper.
   */
  @Test
  void productionTransportMustWrapResponseConsumerWithSafeResponseConsumer() throws Exception {
    ApacheHttpClient5Transport transport =
        (ApacheHttpClient5Transport) osClient.getLowLevelClient();
    assertNotNull(transport, "production OpenSearchClient must expose HC5 transport");

    // opensearch-java doesn't expose the transport options via a public getter, so this
    // assertion relies on the "transportOptions" field name. If a future upgrade renames or
    // repackages that field the test will skip (not fail) — signalling a needed review rather
    // than a false regression.
    ApacheHttpClient5Options options;
    try {
      options = (ApacheHttpClient5Options) readField(transport, "transportOptions");
    } catch (NoSuchFieldException e) {
      abort(
          "opensearch-java internal field layout changed (no 'transportOptions' field on "
              + transport.getClass().getName()
              + "). Review the SafeResponseConsumer wiring against the new API and update "
              + "this test.");
      return;
    }
    assertNotNull(options, "transport must have ApacheHttpClient5Options set");

    HttpAsyncResponseConsumerFactory factory = options.getHttpAsyncResponseConsumerFactory();
    assertNotNull(factory, "options must have a HttpAsyncResponseConsumerFactory");

    AsyncResponseConsumer<?> produced = factory.createHttpAsyncResponseConsumer();
    assertInstanceOf(
        SafeResponseConsumer.class,
        produced,
        "production consumer factory must produce a SafeResponseConsumer instance. Got "
            + produced.getClass().getName()
            + ". This means OpenSearchClient.createApacheHttpClient5Transport is missing the "
            + "setOptions(...) call that installs SafeResponseConsumer.");
  }

  /**
   * FIX #3: {@link SafeResponseConsumer} must convert {@code Error} thrown from response
   * parsing into a {@code RuntimeException} so the HC5 IOReactor's Exception-path catches it and
   * keeps running.
   *
   * <p>We build a transport whose delegate response consumer throws {@link Error} (simulating an
   * OOM during response parsing), wrap it with {@link SafeResponseConsumer}, and assert that:
   *
   * <ul>
   *   <li>the request that triggered the Error fails fast with a RuntimeException (not hung);
   *   <li>a subsequent request does NOT throw "I/O reactor has been shut down" — the reactor
   *       survived.
   * </ul>
   *
   * If SafeResponseConsumer is broken or missing, the follow-up assertion fails with the literal
   * production symptom.
   */
  @Test
  @org.junit.jupiter.api.Timeout(value = 60, unit = TimeUnit.SECONDS)
  void safeResponseConsumerMustKeepReactorAliveWhenDelegateThrowsError() throws Exception {
    HttpHost host = new HttpHost("http", opensearch.getHost(), opensearch.getMappedPort(9200));

    // Factory produces a fresh delegate + wrapper per request (matches production wiring
    // and avoids cross-request state sharing on the delegate).
    HttpAsyncResponseConsumerFactory wrappedFactory =
        () ->
            new SafeResponseConsumer<>(
                new AsyncResponseConsumer<ClassicHttpResponse>() {
                  @Override
                  public void consumeResponse(
                      HttpResponse response,
                      EntityDetails entityDetails,
                      HttpContext context,
                      FutureCallback<ClassicHttpResponse> resultCallback) {
                    throw new Error(
                        "simulated allocation failure in response consumer on selector thread");
                  }

                  @Override
                  public void informationResponse(HttpResponse response, HttpContext context) {}

                  @Override
                  public void failed(Exception cause) {}

                  @Override
                  public void updateCapacity(CapacityChannel capacityChannel) {}

                  @Override
                  public void consume(ByteBuffer src) {}

                  @Override
                  public void streamEnd(List<? extends Header> trailers) {}

                  @Override
                  public void releaseResources() {}
                });

    ApacheHttpClient5Options.Builder optsBuilder = ApacheHttpClient5Options.DEFAULT.toBuilder();
    optsBuilder.setHttpAsyncResponseConsumerFactory(wrappedFactory);

    ApacheHttpClient5Transport transport =
        ApacheHttpClient5TransportBuilder.builder(host)
            .setMapper(new JacksonJsonpMapper())
            .setHttpClientConfigCallback(
                hc -> {
                  hc.setIOReactorConfig(IOReactorConfig.custom().setIoThreadCount(1).build());
                  return hc;
                })
            .setOptions(optsBuilder.build())
            .build();

    os.org.opensearch.client.opensearch.OpenSearchClient oc =
        new os.org.opensearch.client.opensearch.OpenSearchClient(transport);

    try {
      // Trigger: consumer throws Error → SafeResponseConsumer rewrites to RuntimeException
      // → HC5 Exception-path catches it → request fails, reactor stays alive.
      CompletableFuture<Throwable> triggerResult =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  oc.cluster().health();
                  return null;
                } catch (Throwable t) {
                  return t;
                }
              });
      Throwable triggerError;
      try {
        triggerError = triggerResult.get(5, TimeUnit.SECONDS);
      } catch (TimeoutException te) {
        fail(
            "trigger request hung for 5s — SafeResponseConsumer should rethrow as "
                + "RuntimeException so HC5's Exception path completes the future, not orphan it");
        return;
      }
      assertNotNull(triggerError, "trigger request should have failed with wrapped Error");
      assertTrue(
          chainOf(triggerError).contains("Error consuming response"),
          () -> "expected SafeResponseConsumer wrapping: " + chainOf(triggerError));

      // No explicit wait needed: SafeResponseConsumer's rewrap-and-rethrow is synchronous
      // inside HC5's Exception path, so the reactor has already settled into its post-error
      // state by the time triggerResult.get() returned above.

      // Follow-up: reactor must still be alive. This request will ALSO hit the failing consumer
      // (same factory) and fail, but NOT with "I/O reactor has been shut down".
      CompletableFuture<Throwable> followUpResult =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  oc.cluster().health();
                  return null;
                } catch (Throwable t) {
                  return t;
                }
              });
      Throwable followUpError;
      try {
        followUpError = followUpResult.get(10, TimeUnit.SECONDS);
      } catch (TimeoutException hung) {
        fail("follow-up request hung for 10s - reactor appears dead");
        return;
      }

      String followUpChain = chainOf(followUpError);
      assertFalse(
          followUpChain.contains("I/O reactor has been shut down"),
          () ->
              "SafeResponseConsumer failed to keep the reactor alive. Follow-up request "
                  + "reports reactor shutdown: "
                  + followUpChain);
    } finally {
      try {
        transport.close();
      } catch (Exception e) {
        log.debug("Error closing test transport", e);
      }
    }
  }

  private static Object readField(Object target, String fieldName) throws Exception {
    Class<?> c = target.getClass();
    while (c != null) {
      try {
        Field f = c.getDeclaredField(fieldName);
        f.setAccessible(true);
        return f.get(target);
      } catch (NoSuchFieldException ignored) {
        c = c.getSuperclass();
      }
    }
    throw new NoSuchFieldException(
        "field '" + fieldName + "' not found on " + target.getClass().getName() + " or parents");
  }

  private static String chainOf(Throwable root) {
    if (root == null) return "<null>";
    StringBuilder sb = new StringBuilder();
    for (Throwable t = root; t != null; t = t.getCause()) {
      sb.append("\n    -> ").append(t.getClass().getName()).append(": ").append(t.getMessage());
      if (t.getCause() == t) break;
    }
    return sb.toString();
  }
}
