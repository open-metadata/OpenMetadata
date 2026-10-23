package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.github.dockerjava.api.command.InspectContainerResponse;
import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.Ports;
import java.io.IOException;
import java.net.Authenticator;
import java.net.PasswordAuthentication;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.sparql.core.Quad;
import org.apache.jena.sparql.exec.http.QueryExecutionHTTP;
import org.apache.jena.sparql.exec.http.UpdateExecutionHTTP;
import org.apache.jena.sparql.modify.request.QuadDataAcc;
import org.apache.jena.sparql.modify.request.Target;
import org.apache.jena.sparql.modify.request.UpdateDataInsert;
import org.apache.jena.sparql.modify.request.UpdateDrop;
import org.apache.jena.update.UpdateRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.openmetadata.service.rdf.SanitizedModelBuilder.KnowledgeSource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * Reruns the sanitized-model experiment with every retrieval sent to an isolated, throwaway Fuseki
 * container. Opt in with {@code -DrdfAuthorizationFusekiImage=<image built from docker/rdf-store>};
 * the server must report Jena 6.2.0.
 *
 * <p>The container is capped at 1 GiB without swap. The heap stays well below the cap because
 * TDB2 memory-maps its indexes outside the heap and the tmpfs data directory is charged to the same
 * memory limit.
 */
@EnabledIfSystemProperty(named = SanitizedModelFusekiTest.IMAGE_PROPERTY, matches = ".+")
class SanitizedModelFusekiTest extends SanitizedModelExperimentTest {
  static final String IMAGE_PROPERTY = "rdfAuthorizationFusekiImage";
  private static final Pattern EXPECTED_VERSION =
      Pattern.compile("\"version\"\\s*:\\s*\"6\\.2\\.0\"");
  private static final int PORT = 3030;
  private static final long CONTAINER_MEMORY_BYTES = 1024L * 1024 * 1024;
  private static final String JVM_ARGS = "-Xms384m -Xmx384m -XX:MaxMetaspaceSize=128m";
  private static final String DATA_TMPFS = "rw,size=256m,mode=1777";
  private static final Duration STARTUP_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
  private static final long REQUEST_TIMEOUT_SECONDS = 30;
  private static GenericContainer<?> fuseki;

  @BeforeAll
  static void startFuseki() throws IOException, InterruptedException {
    fuseki =
        new GenericContainer<>(DockerImageName.parse(System.getProperty(IMAGE_PROPERTY)))
            .withExposedPorts(PORT)
            .withEnv("JVM_ARGS", JVM_ARGS)
            .withTmpFs(Map.of("/fuseki-data", DATA_TMPFS))
            .withCreateContainerCmdModifier(
                command ->
                    command
                        .getHostConfig()
                        .withMemory(CONTAINER_MEMORY_BYTES)
                        .withMemorySwap(CONTAINER_MEMORY_BYTES))
            .waitingFor(
                Wait.forHttp("/$/ping")
                    .forPort(PORT)
                    .forStatusCode(200)
                    .withStartupTimeout(STARTUP_TIMEOUT));
    fuseki.start();
    requireTestOwnedContainer();
    final String server = serverDescription();
    assertTrue(EXPECTED_VERSION.matcher(server).find(), server);
  }

  @AfterAll
  static void stopFuseki() {
    if (fuseki != null) {
      final InspectContainerResponse.ContainerState state =
          fuseki.getCurrentContainerInfo().getState();
      fuseki.stop();
      assertFalse(
          Boolean.TRUE.equals(state.getOOMKilled()), "test Fuseki container was OOM-killed");
    }
  }

  @Override
  protected KnowledgeSource source(final Dataset dataset) {
    replaceRemoteData(dataset);
    return sparql -> {
      try (QueryExecution execution =
          QueryExecutionHTTP.service(endpoint("sparql"))
              .query(sparql)
              .timeout(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
              .build()) {
        return execution.execConstruct();
      }
    };
  }

  /** Destructive updates only ever go to the capped container this class started. */
  private static void requireTestOwnedContainer() {
    final InspectContainerResponse container = fuseki.getCurrentContainerInfo();
    final Ports.Binding[] bindings =
        container.getNetworkSettings().getPorts().getBindings().get(ExposedPort.tcp(PORT));
    final String mappedPort = String.valueOf(fuseki.getMappedPort(PORT));
    assertTrue(
        Boolean.TRUE.equals(container.getState().getRunning()), "test Fuseki is not running");
    assertEquals(CONTAINER_MEMORY_BYTES, container.getHostConfig().getMemory());
    assertTrue(
        bindings != null
            && Arrays.stream(bindings).anyMatch(bind -> mappedPort.equals(bind.getHostPortSpec())),
        "port " + mappedPort + " is not bound to the test Fuseki container");
  }

  private static void replaceRemoteData(final Dataset dataset) {
    requireTestOwnedContainer();
    final List<Quad> quads = new ArrayList<>();
    dataset.asDatasetGraph().find().forEachRemaining(quads::add);
    final UpdateRequest request =
        new UpdateRequest()
            .add(new UpdateDrop(Target.ALL))
            .add(new UpdateDataInsert(new QuadDataAcc(quads)));
    UpdateExecutionHTTP.service(endpoint("update"))
        .httpClient(client("openmetadata", "openmetadata-secret"))
        .update(request)
        .timeout(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()
        .execute();
  }

  private static String serverDescription() throws IOException, InterruptedException {
    final HttpRequest request =
        HttpRequest.newBuilder(URI.create(base() + "/$/server"))
            .timeout(Duration.ofSeconds(REQUEST_TIMEOUT_SECONDS))
            .build();
    return client("admin", "admin").send(request, BodyHandlers.ofString()).body();
  }

  private static HttpClient client(final String user, final String password) {
    return HttpClient.newBuilder()
        .connectTimeout(CONNECT_TIMEOUT)
        .authenticator(
            new Authenticator() {
              @Override
              protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(user, password.toCharArray());
              }
            })
        .build();
  }

  private static String endpoint(final String service) {
    return base() + "/openmetadata/" + service;
  }

  private static String base() {
    return "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(PORT);
  }
}
