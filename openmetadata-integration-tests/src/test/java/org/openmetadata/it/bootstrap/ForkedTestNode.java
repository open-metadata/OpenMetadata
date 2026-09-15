package org.openmetadata.it.bootstrap;

import static org.awaitility.Awaitility.await;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/** A separate JVM keeps an additional server's repository graph and caches out of the test JVM. */
public final class ForkedTestNode implements AutoCloseable {
  private final Process process;
  private final Path directory;

  private ForkedTestNode(final Process process, final Path directory) {
    this.process = process;
    this.directory = directory;
  }

  static ForkedTestNode start(final OpenMetadataApplicationConfig config) {
    try {
      final Path directory =
          Files.createTempDirectory(Path.of("target"), "session-node-").toAbsolutePath();
      // Only annotated configuration properties belong on the wire, not runtime-service getters.
      Jackson.newObjectMapper()
          .addMixIn(OpenMetadataApplicationConfig.class, ConfigurationProperties.class)
          .writeValue(directory.resolve("config.json").toFile(), config);
      final ForkedTestNode node = new ForkedTestNode(launch(directory), directory);
      try {
        node.awaitStartup();
        return node;
      } catch (RuntimeException failure) {
        node.close();
        throw failure;
      }
    } catch (IOException failure) {
      throw new IllegalStateException("Failed to start additional OpenMetadata node", failure);
    }
  }

  @JsonAutoDetect(getterVisibility = Visibility.NONE, isGetterVisibility = Visibility.NONE)
  private abstract static class ConfigurationProperties {}

  private static Process launch(final Path directory) throws IOException {
    final Path temporary = Files.createDirectory(directory.resolve("tmp"));
    return new ProcessBuilder(
            Path.of(System.getProperty("java.home"), "bin", "java").toString(),
            "-Xmx1024m",
            "-XX:ActiveProcessorCount=2",
            "-Duser.timezone=UTC",
            "-Djava.io.tmpdir=" + temporary,
            "-cp",
            System.getProperty("java.class.path"),
            ForkedTestNode.class.getName(),
            directory.toString())
        .redirectErrorStream(true)
        .redirectOutput(directory.resolve("server.log").toFile())
        .start();
  }

  private void awaitStartup() {
    await("Additional node startup; see " + directory.resolve("server.log"))
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofMillis(100))
        .until(
            () -> {
              if (!process.isAlive()) {
                throw new IllegalStateException(
                    "Additional node exited with " + process.exitValue() + "; see " + directory);
              }
              return Files.exists(directory.resolve("port"));
            });
  }

  String baseUrl() {
    try {
      return "http://localhost:" + Integer.parseInt(Files.readString(directory.resolve("port")));
    } catch (IOException failure) {
      throw new IllegalStateException(
          "Cannot read additional node address from " + directory, failure);
    }
  }

  @Override
  public void close() {
    try {
      process.getOutputStream().close();
      if (!process.waitFor(30, TimeUnit.SECONDS)) {
        process.destroy();
        if (!process.waitFor(5, TimeUnit.SECONDS)) {
          process.destroyForcibly();
        }
      }
    } catch (IOException failure) {
      process.destroyForcibly();
      throw new IllegalStateException("Cannot stop additional node " + directory, failure);
    } catch (InterruptedException interrupted) {
      process.destroyForcibly();
      Thread.currentThread().interrupt();
      throw new IllegalStateException(
          "Interrupted stopping additional node " + directory, interrupted);
    }
  }

  public static void main(final String[] args) throws Exception {
    final Path directory = Path.of(args[0]);
    final OpenMetadataApplicationConfig config =
        TestSuiteBootstrap.readTestAppConfig(directory.resolve("config.json").toString());
    final var app = new DropwizardAppExtension<>(OpenMetadataApplication.class, config);
    try {
      app.before();
      final Path pending = directory.resolve("port.pending");
      Files.writeString(pending, Integer.toString(app.getLocalPort()));
      Files.move(pending, directory.resolve("port"), StandardCopyOption.ATOMIC_MOVE);
      // EOF also stops the child if the test JVM exits unexpectedly.
      System.in.read();
    } finally {
      app.after();
    }
    System.exit(0);
  }
}
