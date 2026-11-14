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
package org.openmetadata.it.bootstrap;

import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static java.util.concurrent.TimeUnit.SECONDS;

import io.dropwizard.testing.ResourceHelpers;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.openmetadata.it.bootstrap.ForkedServerConfig.Ports;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A second OpenMetadata server in its own JVM, sharing the suite's database and search and, in the
 * Redis lane, its Redis. It shares no static with the suite's server. {@code SessionMultiNodeCluster}
 * runs both apps in one JVM, where {@code Credentials}, the cache bundle, the entity registry and the
 * Jersey filter choice are process-wide, so a cross-node credential test can pass for the wrong
 * reason. A forked JVM shares only the backing services, which is the production topology.
 *
 * <p><b>Keys.</b> The signing key files, key id, issuer and Fernet key are copied into the node's
 * yaml from the suite's own configuration object, so the node accepts every token the suite server
 * mints and decrypts every secret it stores. {@link #start} also fails when the two servers publish
 * different JWKS documents.
 *
 * <p><b>Ports.</b> Two free ports are probed and released just before the launch. When the process
 * dies before it is ready, which is how a port taken in between shows up, the launch is retried with
 * new ports, at most {@value #LAUNCH_ATTEMPTS} times.
 *
 * <p><b>Lifetime.</b> Close the node in {@code @AfterAll}. A shutdown hook closes nodes still open
 * when the test JVM exits normally or is terminated. When the test JVM is killed outright,
 * {@link ForkedServerLauncher} notices that its parent is gone within about a second and halts.
 *
 * <p><b>Cost.</b> One server boot per node, expected at 30 to 60 s, so the classes that use it run
 * in the multi-node and scale lanes only.
 */
public final class ForkedServerNode implements AutoCloseable {
  private static final Logger LOG = LoggerFactory.getLogger(ForkedServerNode.class);
  private static final int LAUNCH_ATTEMPTS = 3;
  private static final Duration READINESS_TIMEOUT = Duration.ofSeconds(120);
  private static final Duration SCRAPE_TIMEOUT = Duration.ofSeconds(10);
  private static final long FORCE_AFTER_SECONDS = 10;
  private static final AtomicInteger SEQUENCE = new AtomicInteger();
  private static final Set<ForkedServerNode> OPEN = ConcurrentHashMap.newKeySet();
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  static {
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(() -> OPEN.forEach(ForkedServerNode::close), "forked-node-cleanup"));
  }

  /** Per-node overrides of the {@code credentialVerification:} block, such as the sweep cadence. */
  public record Settings(Map<String, String> credentialVerification) {
    public static final Settings DEFAULT = new Settings(Map.of());

    public Settings withCredentialVerification(String key, String value) {
      Map<String, String> merged = new TreeMap<>(credentialVerification);
      merged.put(key, value);
      return new Settings(Map.copyOf(merged));
    }
  }

  private final int number;
  private final Ports ports;
  private final Process process;
  private final AtomicBoolean closed = new AtomicBoolean();

  private ForkedServerNode(int number, Ports ports, Process process) {
    this.number = number;
    this.ports = ports;
    this.process = process;
  }

  public static ForkedServerNode start(Settings settings) {
    int number = SEQUENCE.incrementAndGet();
    for (int attempt = 1; ; attempt++) {
      try {
        return launch(number, settings);
      } catch (ProcessExitedEarly exited) {
        if (attempt == LAUNCH_ATTEMPTS) {
          throw new IllegalStateException(
              "Forked node " + number + " exited before it was ready, see " + logPath(number),
              exited);
        }
        LOG.warn(
            "Forked node {} exited before it was ready (attempt {}), retrying", number, attempt);
      }
    }
  }

  /** The node's HTTP root, for example {@code http://localhost:41234}. Paths start with /api. */
  public URI apiBase() {
    return URI.create("http://localhost:" + ports.http());
  }

  /**
   * The sum of the values of the series called {@code name} in this node's {@code /prometheus}
   * output whose labels include every given key and value, for example
   * {@code metric("om_credential_reads_total", "reason", "miss")}. The name is the exported one:
   * dots become underscores and a counter ends in {@code _total}. A name or label set that matches
   * no series fails, so a misspelled meter cannot read as zero.
   */
  public double metric(String name, String... tags) {
    return PrometheusText.sum(scrape(), name, tags);
  }

  /** Stops the process, forcibly after {@value #FORCE_AFTER_SECONDS} s. Safe to call twice. */
  @Override
  public void close() {
    if (!closed.compareAndSet(false, true)) {
      return;
    }
    OPEN.remove(this);
    process.destroy();
    try {
      if (!process.waitFor(FORCE_AFTER_SECONDS, SECONDS)) {
        process.destroyForcibly().waitFor(FORCE_AFTER_SECONDS, SECONDS);
      }
    } catch (InterruptedException interrupted) {
      process.destroyForcibly();
      Thread.currentThread().interrupt();
    }
  }

  /** CPU time the node's process has used, for load reports. */
  public Duration cpuTime() {
    return process.info().totalCpuDuration().orElse(Duration.ZERO);
  }

  private static ForkedServerNode launch(int number, Settings settings) {
    Ports ports = freePorts();
    Path log = logPath(number);
    Process process =
        ForkedJvm.launch(
            ForkedServerLauncher.class.getName(),
            List.of("server", writeYaml(number, ports, settings).toString()),
            Map.of(
                ForkedServerLauncher.PARENT_PID,
                String.valueOf(ProcessHandle.current().pid()),
                "OM_TEST_SUPPORT_SEARCH_ENABLED",
                "true",
                "user.timezone",
                "UTC"),
            log);
    ForkedServerNode node = new ForkedServerNode(number, ports, process);
    OPEN.add(node);
    try {
      node.awaitReady();
      node.requireSameJwks();
    } catch (RuntimeException failure) {
      node.close();
      throw failure;
    }
    LOG.info("Forked node {} ready on {}", number, node.apiBase());
    return node;
  }

  private static Path writeYaml(int number, Ports ports, Settings settings) {
    OpenMetadataApplicationConfig suite = TestSuiteBootstrap.createApplicationConfigCopy();
    Path baseYaml = Path.of(ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml"));
    try {
      String yaml =
          ForkedServerConfig.render(baseYaml, suite, ports, settings.credentialVerification());
      return Files.writeString(ForkedJvm.logFile("forked-node-" + number + ".yaml"), yaml);
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
  }

  private static Path logPath(int number) {
    return ForkedJvm.logFile("forked-node-" + number + ".log");
  }

  private void awaitReady() {
    try {
      Awaitility.await("forked node " + number + " healthy on admin port " + ports.admin())
          .atMost(READINESS_TIMEOUT)
          .pollInterval(500, MILLISECONDS)
          .failFast("the forked node exited", () -> !process.isAlive())
          .until(this::healthy);
    } catch (ConditionTimeoutException timeout) {
      throw new IllegalStateException(
          "Forked node never became healthy: " + logPath(number), timeout);
    } catch (RuntimeException failure) {
      if (!process.isAlive()) {
        throw new ProcessExitedEarly(failure);
      }
      throw failure;
    }
  }

  private boolean healthy() {
    try {
      return get(adminUrl("/healthcheck")).statusCode() == 200;
    } catch (UncheckedIOException notYet) {
      return false;
    }
  }

  private void requireSameJwks() {
    String own = get(apiBase() + "/api/v1/system/config/jwks").body();
    String suite = get(TestSuiteBootstrap.getBaseUrl() + "/api/v1/system/config/jwks").body();
    if (!own.equals(suite)) {
      throw new IllegalStateException(
          "Forked node publishes different signing keys than the suite");
    }
  }

  private String scrape() {
    return get(adminUrl("/prometheus")).body();
  }

  private String adminUrl(String path) {
    return "http://localhost:" + ports.admin() + path;
  }

  private static HttpResponse<String> get(String url) {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(url)).timeout(SCRAPE_TIMEOUT).GET().build();
    try {
      return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while calling " + url, interrupted);
    }
  }

  private static Ports freePorts() {
    try (ServerSocket http = new ServerSocket(0);
        ServerSocket admin = new ServerSocket(0)) {
      return new Ports(http.getLocalPort(), admin.getLocalPort());
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
  }

  /** The process ended while the node was starting; the caller may retry with other ports. */
  private static final class ProcessExitedEarly extends RuntimeException {
    ProcessExitedEarly(Throwable cause) {
      super(cause);
    }
  }
}
