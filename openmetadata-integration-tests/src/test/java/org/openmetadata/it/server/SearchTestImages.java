package org.openmetadata.it.server;

import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.utility.DockerImageName;

/**
 * Builds the OpenSearch test image with the language-analysis plugins baked in, so the integration
 * tests can exercise non-English mapping languages (e.g. {@code analysis-kuromoji} for Japanese).
 *
 * <p>The plugins are installed unconditionally: a run that only uses the English mappings never
 * references them, while a run configured for {@code jp} can create indexes whose text fields use
 * {@code kuromoji_tokenizer}. This is what lets the search IT suite catch per-language
 * mapping/analyzer drift — the jp mappings referencing undefined analyzers went unnoticed precisely
 * because CI only ever ran English on a vanilla image.
 *
 * <p>Chinese ({@code zh}) uses the third-party IK plugin ({@code analysis-ik}); it is intentionally
 * not installed here because it ships only as a version-matched release URL that would break the
 * image build if it became unavailable. Add it separately when zh coverage is needed.
 */
public final class SearchTestImages {

  private static final String OPENSEARCH_BASE_REFERENCE = "opensearchproject/opensearch";
  private static final String ANALYSIS_PLUGINS = "analysis-kuromoji";

  private SearchTestImages() {}

  /**
   * Returns a {@link DockerImageName} for {@code baseImage} with the analysis plugins installed. The
   * image is built once per run and reused via Docker's layer cache.
   */
  public static DockerImageName openSearchWithAnalysisPlugins(String baseImage) {
    String builtImage =
        new ImageFromDockerfile()
            .withDockerfileFromBuilder(
                builder ->
                    builder
                        .from(baseImage)
                        .run(
                            "/usr/share/opensearch/bin/opensearch-plugin install --batch "
                                + ANALYSIS_PLUGINS)
                        .build())
            .get();
    return DockerImageName.parse(builtImage).asCompatibleSubstituteFor(OPENSEARCH_BASE_REFERENCE);
  }
}
