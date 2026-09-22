package org.openmetadata.it.server;

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
 * to the English mappings, so it stays on the vanilla base image with no plugin dependency at all.
 *
 * <p>{@code analysis-ik} is third-party and ships only as a version-matched release archive. It is
 * <b>vendored</b> under {@code src/test/resources/search-plugins/} and {@code COPY}'d into the build
 * context rather than downloaded during the build. It used to be fetched from
 * {@code release.infinilabs.com} at image-build time, and that CDN intermittently accepts the
 * connection and then stalls mid-body: every curl attempt burned its full {@code --max-time 120},
 * the four attempts totalled ~500s, and the class's static initializer failed with
 * {@code ExceptionInInitializerError} — blocking the merge queue for a network problem no product
 * code caused (#33822). Bundling the 4.4 MB Apache-2.0 archive makes the build hermetic; this image
 * can now only fail for product reasons.
 *
 * <p>Bumping the OpenSearch base image: download the matching archive from {@link
 * #IK_PLUGIN_URL_TEMPLATE}, check its {@code plugin-descriptor.properties} carries the same
 * {@code opensearch.version}, and commit it alongside the old one is removed. There is deliberately
 * no fallback to the CDN when the vendored file is missing — a bump that forgets the archive should
 * fail immediately with the message below, not rediscover the stall in CI.
 *
 * <p>{@code analysis-kuromoji} is an official OpenSearch plugin resolved by name from the project's
 * own artifact host, which has not shown this behaviour; it stays as a bounded install. Vendor it too
 * if it ever does.
 */
public final class SearchTestImages {

  private static final String OPENSEARCH_BASE_REFERENCE = "opensearchproject/opensearch";
  private static final String PLUGIN_INSTALL =
      "/usr/share/opensearch/bin/opensearch-plugin install --batch ";

  /** Provenance only — where the vendored archive comes from. Never fetched at build time. */
  private static final String IK_PLUGIN_URL_TEMPLATE =
      "https://release.infinilabs.com/analysis-ik/stable/opensearch-analysis-ik-%s.zip";

  private static final String IK_PLUGIN_RESOURCE_TEMPLATE =
      "search-plugins/opensearch-analysis-ik-%s.zip";
  private static final String IK_CONTEXT_FILE = "opensearch-analysis-ik.zip";
  private static final String IK_ARCHIVE = "/tmp/" + IK_CONTEXT_FILE;

  /** Bounds the one step that still resolves an artifact by name rather than from disk. */
  private static final String KUROMOJI_INSTALL_TIMEOUT_SECONDS = "300";

  private SearchTestImages() {}

  /**
   * Returns a {@link DockerImageName} for {@code baseImage} with the analysis plugins installed. The
   * image is built once per run and reused via Docker's layer cache.
   */
  public static DockerImageName openSearchWithAnalysisPlugins(final String baseImage) {
    final String version = baseImage.substring(baseImage.lastIndexOf(':') + 1);
    final String resource = requireVendoredIkPlugin(version);
    final String builtImage =
        new ImageFromDockerfile()
            .withFileFromClasspath(IK_CONTEXT_FILE, resource)
            .withDockerfileFromBuilder(
                builder ->
                    builder
                        .from(baseImage)
                        .run(kuromojiInstallCommand())
                        .copy(IK_CONTEXT_FILE, IK_ARCHIVE)
                        .run(ikInstallCommand())
                        .build())
            .get();
    return DockerImageName.parse(builtImage).asCompatibleSubstituteFor(OPENSEARCH_BASE_REFERENCE);
  }

  /** Fails fast, with the fix spelled out, when the archive for this OpenSearch version is absent. */
  private static String requireVendoredIkPlugin(final String version) {
    final String resource = String.format(IK_PLUGIN_RESOURCE_TEMPLATE, version);
    if (SearchTestImages.class.getClassLoader().getResource(resource) == null) {
      throw new IllegalStateException(
          String.format(
              "No vendored analysis-ik plugin for OpenSearch %s at src/test/resources/%s. Download %s,"
                  + " confirm plugin-descriptor.properties says opensearch.version=%s, and commit it."
                  + " The image build is hermetic on purpose (#33822) — there is no CDN fallback.",
              version, resource, String.format(IK_PLUGIN_URL_TEMPLATE, version), version));
    }
    return resource;
  }

  private static String kuromojiInstallCommand() {
    return "timeout "
        + KUROMOJI_INSTALL_TIMEOUT_SECONDS
        + " "
        + PLUGIN_INSTALL
        + "analysis-kuromoji";
  }

  /**
   * Installs from the copied archive, so nothing inside the build reaches out to a third party.
   *
   * <p>No {@code rm -f} afterwards, deliberately. {@code COPY} writes the file as root while the base
   * image runs its {@code RUN} steps as {@code opensearch} (uid 1000), and {@code /tmp} carries the
   * sticky bit, so a non-owner cannot delete it — {@code rm: cannot remove ... Operation not
   * permitted}. Chained with {@code &&}, that turned a successful install into a failed build. The
   * 4.4 MB left behind sits in a throwaway test image; not worth a {@code --chown} and a hardcoded uid.
   */
  private static String ikInstallCommand() {
    return PLUGIN_INSTALL + "file://" + IK_ARCHIVE;
  }
}
