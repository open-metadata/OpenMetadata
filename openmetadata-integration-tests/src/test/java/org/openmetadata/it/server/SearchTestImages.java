package org.openmetadata.it.server;

import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.opensearch.testcontainers.OpensearchContainer;
import org.opentest4j.TestAbortedException;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.utility.DockerImageName;

/**
 * Builds the OpenSearch test image with the language-analysis plugins baked in, so the
 * multi-language search IT can exercise every non-English mapping language: {@code analysis-kuromoji}
 * for Japanese and {@code analysis-ik} ({@code ik_max_word}/{@code ik_smart}) for Chinese.
 *
 * <p>Only {@code SearchConsumerFieldBehaviorIT} uses this image — it is the one suite that creates
 * {@code jp}/{@code zh} indexes whose text fields reference those analyzers, which is what lets it
 * catch per-language mapping/analyzer drift (the jp mappings referencing undefined analyzers went
 * unnoticed because CI only ever ran English on a vanilla image). The rest of the IT suite is pinned
 * to the English mappings, so it stays on the vanilla base image with no plugin-download dependency.
 *
 * <p>{@code analysis-ik} is third-party and ships only as a version-matched release URL; the URL is
 * derived from the base image tag so it always matches the OpenSearch version being tested. Because
 * the image build downloads the plugin from {@code release.infinilabs.com}, scoping it to this single
 * suite keeps that network dependency off the critical path of every other OpenSearch IT.
 *
 * <p>Both install steps are explicitly time-bounded. A docker {@code RUN} has no time budget of its
 * own and {@code opensearch-plugin install <url>} fetches over a {@code URLConnection} with no read
 * timeout, so a CDN that accepts the connection and then stalls hangs the build forever. That is not
 * hypothetical: when release.infinilabs.com stalled, the build wedged until the lane's own 65-minute
 * {@code timeout} killed maven (exit 124) and a third-party CDN took out the entire suite rather
 * than this one test.
 */
@Slf4j
public final class SearchTestImages {

  private static final String OPENSEARCH_BASE_REFERENCE = "opensearchproject/opensearch";
  private static final String PLUGIN_INSTALL =
      "/usr/share/opensearch/bin/opensearch-plugin install --batch ";
  private static final String IK_PLUGIN_URL_TEMPLATE =
      "https://release.infinilabs.com/analysis-ik/stable/opensearch-analysis-ik-%s.zip";
  private static final String IK_ARCHIVE = "/tmp/opensearch-analysis-ik.zip";

  /** Bounds the one step that resolves an official artifact by name rather than by URL. */
  private static final String KUROMOJI_INSTALL_TIMEOUT_SECONDS = "300";

  /**
   * Caps a single attempt at two minutes and rides out transient CDN errors. {@code
   * --retry-all-errors} is what makes the retry cover connection resets and 5xx, not just curl's
   * default transient set. Worst case is roughly 6 minutes, then the build fails with the HTTP
   * status instead of hanging.
   */
  private static final String IK_DOWNLOAD =
      "curl --fail --silent --show-error --location"
          + " --connect-timeout 15 --max-time 120"
          + " --retry 3 --retry-delay 5 --retry-all-errors";

  private SearchTestImages() {}

  /**
   * Builds the analysis-plugin image and starts a single-node OpenSearch on it.
   *
   * <p>Every suite that needs the language analyzers goes through here rather than resolving the
   * image in a {@code @Container} field initializer. A throw from a field initializer surfaces as
   * {@link ExceptionInInitializerError} before any assumption can run, so an unreachable CDN fails
   * the suite; resolving it inside {@code @BeforeAll} lets that same failure abort instead.
   *
   * <p>Only the image build aborts. Starting the container, and everything after it, still fails
   * loudly -- those are the outcomes the suites exist to report. Callers own {@code stop()}.
   */
  public static OpensearchContainer<?> startWithAnalysisPlugins(String baseImage) {
    DockerImageName image;
    try {
      image = openSearchWithAnalysisPlugins(baseImage);
    } catch (RuntimeException e) {
      // An aborted @BeforeAll reports as "Tests run: 0" with no reason recorded in the surefire
      // report, so this marker is the only durable record that the suite stopped running.
      log.error(
          "SKIPPED-ANALYSIS-PLUGIN-IMAGE: language-analyzer coverage did not run because the "
              + "OpenSearch analysis-plugin image could not be built",
          e);
      throw new TestAbortedException(
          "Skipping: the OpenSearch analysis-plugin image could not be built. analysis-ik is "
              + "fetched from release.infinilabs.com, which is outside this repository's control. "
              + "Cause: "
              + e.getMessage(),
          e);
    }
    OpensearchContainer<?> container =
        new OpensearchContainer<>(image)
            .withStartupTimeout(Duration.ofMinutes(5))
            .withEnv("discovery.type", "single-node")
            .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
            .withEnv("DISABLE_SECURITY_PLUGIN", "true")
            .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
            .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");
    container.start();

    return container;
  }

  /**
   * Returns a {@link DockerImageName} for {@code baseImage} with the analysis plugins installed. The
   * image is built once per run and reused via Docker's layer cache.
   */
  public static DockerImageName openSearchWithAnalysisPlugins(String baseImage) {
    String version = baseImage.substring(baseImage.lastIndexOf(':') + 1);
    String builtImage =
        new ImageFromDockerfile()
            .withDockerfileFromBuilder(
                builder ->
                    builder
                        .from(baseImage)
                        .run(kuromojiInstallCommand())
                        .run(ikInstallCommand(version))
                        .build())
            .get();
    return DockerImageName.parse(builtImage).asCompatibleSubstituteFor(OPENSEARCH_BASE_REFERENCE);
  }

  private static String kuromojiInstallCommand() {
    return "timeout "
        + KUROMOJI_INSTALL_TIMEOUT_SECONDS
        + " "
        + PLUGIN_INSTALL
        + "analysis-kuromoji";
  }

  /**
   * Downloads the version-matched archive under curl's timeout and retry budget, then installs it
   * from disk so the unbounded fetch inside {@code opensearch-plugin} is never used.
   */
  private static String ikInstallCommand(String version) {
    String pluginUrl = String.format(IK_PLUGIN_URL_TEMPLATE, version);
    return IK_DOWNLOAD
        + " --output "
        + IK_ARCHIVE
        + " "
        + pluginUrl
        + " && "
        + PLUGIN_INSTALL
        + "file://"
        + IK_ARCHIVE
        + " && rm -f "
        + IK_ARCHIVE;
  }
}
