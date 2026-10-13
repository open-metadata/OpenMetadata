package org.openmetadata.it.server;

import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.utility.DockerImageName;

/**
 * Builds the OpenSearch test image with the language-analysis plugins baked in, so the
 * multi-language search IT can exercise every non-English mapping language: {@code analysis-kuromoji}
 * for Japanese and {@code analysis-ik} ({@code ik_max_word}/{@code ik_smart}) for Chinese.
 *
 * <p>Two suites share this image: {@code SearchConsumerFieldBehaviorIT}, which creates the {@code
 * jp}/{@code zh} indexes whose text fields reference those analyzers — that is what lets it catch
 * per-language mapping/analyzer drift (the jp mappings referencing undefined analyzers went unnoticed
 * because CI only ever ran English on a vanilla image) — and {@code FieldNamesAggregationIT}. The
 * rest of the IT suite is pinned to the English mappings and stays on the vanilla base image.
 *
 * <p>{@code analysis-ik} is third-party and ships only as a version-matched release URL. That URL is
 * <em>not</em> fetched at test time: the archive is committed under {@code
 * src/test/resources/opensearch-plugins} and copied into the Docker build context, because {@code
 * release.infinilabs.com} intermittently accepts the connection, returns HTTP 200, and then stalls
 * mid-body. Downloading it during the build put a third-party CDN on the critical path of the whole
 * backend IT suite: it failed the {@code parallel} lane and {@code search-it-nightly} for a week and
 * blocked the merge queue (issue #33822, after the bounded-download attempt in #33422). See that
 * directory's {@code README.md} for provenance and the re-vendoring procedure.
 *
 * <p>{@code analysis-kuromoji} is still installed over the network — it is an official OpenSearch
 * plugin resolved by name from the same host the base image comes from, and has never been the flaky
 * one. Its install stays time-bounded because a docker {@code RUN} has no time budget of its own and
 * {@code opensearch-plugin install} fetches over a {@code URLConnection} with no read timeout, so a
 * host that accepts the connection and then stalls would hang the build forever.
 */
public final class SearchTestImages {

  /**
   * The OpenSearch image both suites build on. Single-sourced here because the vendored {@code
   * analysis-ik} archive is version-matched to it — {@code SearchTestImagesTest} asserts the two stay
   * in step so a bump fails in {@code mvn test} rather than 30 minutes into an IT lane.
   */
  public static final String OPENSEARCH_IMAGE = "opensearchproject/opensearch:3.4.0";

  private static final String OPENSEARCH_BASE_REFERENCE = "opensearchproject/opensearch";
  private static final String PLUGIN_INSTALL =
      "/usr/share/opensearch/bin/opensearch-plugin install --batch ";
  private static final String IK_ARCHIVE_DIRECTORY = "opensearch-plugins";
  private static final String IK_ARCHIVE_RESOURCE_TEMPLATE =
      IK_ARCHIVE_DIRECTORY + "/opensearch-analysis-ik-%s.zip";
  private static final String IK_SOURCE_URL_TEMPLATE =
      "https://release.infinilabs.com/analysis-ik/stable/opensearch-analysis-ik-%s.zip";
  private static final String IK_BUILD_CONTEXT_PATH = "analysis-ik.zip";
  private static final String IK_CONTAINER_PATH = "/tmp/analysis-ik.zip";

  /** Bounds the one step that still resolves an artifact over the network. */
  private static final String KUROMOJI_INSTALL_TIMEOUT_SECONDS = "300";

  private SearchTestImages() {}

  /**
   * Returns a {@link DockerImageName} for {@code baseImage} with the analysis plugins installed. The
   * image is built once per run and reused via Docker's layer cache.
   */
  public static DockerImageName openSearchWithAnalysisPlugins(String baseImage) {
    String ikArchiveResource = requireIkArchiveResource(baseImage);
    String builtImage =
        new ImageFromDockerfile()
            .withFileFromClasspath(IK_BUILD_CONTEXT_PATH, ikArchiveResource)
            .withDockerfileFromBuilder(
                builder ->
                    builder
                        .from(baseImage)
                        .run(kuromojiInstallCommand())
                        .copy(IK_BUILD_CONTEXT_PATH, IK_CONTAINER_PATH)
                        .run(ikInstallCommand())
                        .build())
            .get();
    return DockerImageName.parse(builtImage).asCompatibleSubstituteFor(OPENSEARCH_BASE_REFERENCE);
  }

  /**
   * Resolves the vendored archive matching {@code baseImage}'s version, failing fast when it is
   * absent. {@code opensearch-plugin} also rejects an archive whose descriptor declares a different
   * {@code opensearch.version}, so the two checks together make a version bump impossible to miss.
   */
  static String requireIkArchiveResource(String baseImage) {
    String version = versionOf(baseImage);
    String resource = String.format(IK_ARCHIVE_RESOURCE_TEMPLATE, version);
    if (SearchTestImages.class.getClassLoader().getResource(resource) == null) {
      throw new IllegalStateException(missingArchiveMessage(version, resource));
    }
    return resource;
  }

  private static String missingArchiveMessage(String version, String resource) {
    return "Vendored analysis-ik archive not found on the test classpath: "
        + resource
        + ". The OpenSearch image is pinned to "
        + version
        + " but no matching plugin archive is committed. Download "
        + String.format(IK_SOURCE_URL_TEMPLATE, version)
        + " into openmetadata-integration-tests/src/test/resources/"
        + IK_ARCHIVE_DIRECTORY
        + " and follow that directory's README.md.";
  }

  private static String versionOf(String baseImage) {
    return baseImage.substring(baseImage.lastIndexOf(':') + 1);
  }

  private static String kuromojiInstallCommand() {
    return "timeout "
        + KUROMOJI_INSTALL_TIMEOUT_SECONDS
        + " "
        + PLUGIN_INSTALL
        + "analysis-kuromoji";
  }

  /**
   * Installs from the copied archive, so no fetch happens inside {@code opensearch-plugin}. The
   * archive is deliberately left in place: {@code COPY} writes it as root while the image runs as
   * {@code opensearch}, so {@code rm} fails with {@code Operation not permitted} and takes the build
   * with it. Deleting it would not shrink the image anyway — the copy is already its own layer.
   */
  private static String ikInstallCommand() {
    return PLUGIN_INSTALL + "file://" + IK_CONTAINER_PATH;
  }
}
