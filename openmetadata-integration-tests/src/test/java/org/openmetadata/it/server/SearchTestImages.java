package org.openmetadata.it.server;

import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.utility.DockerImageName;

/**
 * Builds the OpenSearch test image with the language-analysis plugins baked in, so the integration
 * tests can exercise every non-English mapping language: {@code analysis-kuromoji} for Japanese and
 * {@code analysis-ik} ({@code ik_max_word}/{@code ik_smart}) for Chinese.
 *
 * <p>The plugins are installed unconditionally: a run that only uses the English mappings never
 * references them, while a run configured for {@code jp}/{@code zh} can create indexes whose text
 * fields use those analyzers. This is what lets the search IT suite catch per-language
 * mapping/analyzer drift — the jp mappings referencing undefined analyzers went unnoticed precisely
 * because CI only ever ran English on a vanilla image.
 *
 * <p>{@code analysis-ik} is third-party and ships only as a version-matched release URL; the URL is
 * derived from the base image tag so it always matches the OpenSearch version being tested.
 */
public final class SearchTestImages {

  private static final String OPENSEARCH_BASE_REFERENCE = "opensearchproject/opensearch";
  private static final String PLUGIN_INSTALL =
      "/usr/share/opensearch/bin/opensearch-plugin install --batch ";
  private static final String IK_PLUGIN_URL_TEMPLATE =
      "https://release.infinilabs.com/analysis-ik/stable/opensearch-analysis-ik-%s.zip";

  private SearchTestImages() {}

  /**
   * Returns a {@link DockerImageName} for {@code baseImage} with the analysis plugins installed. The
   * image is built once per run and reused via Docker's layer cache.
   */
  public static DockerImageName openSearchWithAnalysisPlugins(String baseImage) {
    String version = baseImage.substring(baseImage.lastIndexOf(':') + 1);
    String ikPluginUrl = String.format(IK_PLUGIN_URL_TEMPLATE, version);
    String builtImage =
        new ImageFromDockerfile()
            .withDockerfileFromBuilder(
                builder ->
                    builder
                        .from(baseImage)
                        .run(PLUGIN_INSTALL + "analysis-kuromoji")
                        .run(PLUGIN_INSTALL + ikPluginUrl)
                        .build())
            .get();
    return DockerImageName.parse(builtImage).asCompatibleSubstituteFor(OPENSEARCH_BASE_REFERENCE);
  }
}
