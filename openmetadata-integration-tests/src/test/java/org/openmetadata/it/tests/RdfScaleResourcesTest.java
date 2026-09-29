package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.testcontainers.containers.Container;
import org.testcontainers.containers.GenericContainer;

class RdfScaleResourcesTest {
  @Test
  void samplingFailureSurvivesTryWithResourcesCleanup(@TempDir final Path output) {
    final AtomicReference<RuntimeException> observed = new AtomicReference<>();
    final RuntimeException failure =
        assertThrows(
            RuntimeException.class,
            () -> {
              try (var resources = new RdfScaleResources(new FailedContainer(), null, output)) {
                Awaitility.await()
                    .atMost(Duration.ofSeconds(10))
                    .untilAsserted(
                        () -> observed.set(assertThrows(RuntimeException.class, resources::check)));
                resources.check();
              }
            });

    assertInstanceOf(IllegalStateException.class, failure);
    assertEquals(observed.get().getMessage(), failure.getMessage());
    assertEquals(1, failure.getSuppressed().length);
    assertEquals(failure.getCause(), failure.getSuppressed()[0].getCause());
  }

  private static final class FailedContainer extends GenericContainer<FailedContainer> {
    private FailedContainer() {
      super("unstarted-scale-sampler");
    }

    @Override
    public Container.ExecResult execInContainer(final String... command) throws IOException {
      throw new IOException("Container metrics are unavailable");
    }
  }
}
