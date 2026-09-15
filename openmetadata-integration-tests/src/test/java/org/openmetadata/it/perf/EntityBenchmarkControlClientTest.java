package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.it.perf.EntityBenchmarkControl.Environment;
import org.openmetadata.schema.utils.JsonUtils;

class EntityBenchmarkControlClientTest {
  @TempDir Path directory;

  @Test
  void capturesTheRuntimeOfTheControlledServer() throws Exception {
    final Path endpoint = directory.resolve("endpoint.json");
    final Path output = directory.resolve("environment.json");
    try (final var control = new EntityBenchmarkControl(endpoint)) {
      EntityBenchmarkControlClient.main(
          new String[] {endpoint.toString(), "environment", output.toString()});
      final var environment = JsonUtils.readValue(Files.readString(output), Environment.class);
      assertEquals(System.getProperty("java.runtime.version"), environment.javaRuntime());
      assertEquals(System.getProperty("os.arch"), environment.architecture());
      assertEquals(Runtime.getRuntime().availableProcessors(), environment.processors());
      assertFalse(environment.containersSession().isBlank());
    }
  }

  @Test
  void failedCommandsDoNotProduceMeasurementFiles() throws Exception {
    final Path endpointFile = directory.resolve("endpoint.json");
    final Path output = directory.resolve("heap.json");
    try (final var control = new EntityBenchmarkControl(endpointFile)) {
      final var endpoint = JsonUtils.readValue(Files.readString(endpointFile), Endpoint.class);
      Files.writeString(
          endpointFile, JsonUtils.pojoToJson(new Endpoint(endpoint.uri(), "incorrect-token")));
      final var failure =
          assertThrows(
              IOException.class,
              () ->
                  EntityBenchmarkControlClient.main(
                      new String[] {endpointFile.toString(), "heap", output.toString()}));
      assertTrue(failure.getMessage().contains("403"));
      assertFalse(Files.exists(output));
    }
  }

  @Test
  void refusesToSendTheControlTokenOutsideTheServerNamespace() throws Exception {
    final Path endpoint = directory.resolve("endpoint.json");
    Files.writeString(
        endpoint,
        JsonUtils.pojoToJson(new Endpoint(URI.create("https://example.invalid"), "private-token")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            EntityBenchmarkControlClient.main(
                new String[] {
                  endpoint.toString(), "heap", directory.resolve("heap.json").toString()
                }));
  }
}
