package org.openmetadata.it.search;

import com.github.dockerjava.api.DockerClient;
import java.time.Duration;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;

/**
 * Toggles the embedded search engine container's runtime state to validate
 * retry / failure semantics in the indexing pipeline.
 *
 * <p>Pause uses Docker's {@code pauseContainer} (SIGSTOP-equivalent), which freezes
 * the engine without tearing down its TCP connections — the OM live-index path sees
 * timeouts rather than connection refused. Unpause resumes the engine in-place; no
 * state is lost.
 *
 * <p>Only meaningful for embedded backend ITs (the bootstrap exposes the testcontainer);
 * UIIT scenarios that boot the OM Docker image use a separate ContainerizedServer
 * helper not covered here.
 */
public final class EsOutageInjector {

  private EsOutageInjector() {}

  /**
   * Pauses the search engine for {@code duration}, then unpauses on a daemon thread.
   * Returns immediately so the caller can run the workload that should observe the
   * outage in parallel.
   */
  public static void pauseFor(final Duration duration) {
    final String containerId = requireContainerId();
    final DockerClient docker = DockerClientFactory.lazyClient();
    docker.pauseContainerCmd(containerId).exec();
    final Thread resumer =
        new Thread(
            () -> {
              try {
                Thread.sleep(duration.toMillis());
              } catch (final InterruptedException e) {
                Thread.currentThread().interrupt();
              } finally {
                try {
                  docker.unpauseContainerCmd(containerId).exec();
                } catch (final RuntimeException ignored) {
                  // container already unpaused — best-effort cleanup
                }
              }
            },
            "es-outage-resumer");
    resumer.setDaemon(true);
    resumer.start();
  }

  /** Synchronous unpause for tests that want to control the resume themselves. */
  public static void unpause() {
    DockerClientFactory.lazyClient().unpauseContainerCmd(requireContainerId()).exec();
  }

  private static String requireContainerId() {
    final GenericContainer<?> container = TestSuiteBootstrap.getSearchContainer();
    if (container == null || container.getContainerId() == null) {
      throw new IllegalStateException(
          "Search container is not running — EsOutageInjector requires the embedded bootstrap");
    }
    return container.getContainerId();
  }
}
