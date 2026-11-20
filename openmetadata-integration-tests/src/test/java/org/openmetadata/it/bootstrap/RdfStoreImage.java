package org.openmetadata.it.bootstrap;

import java.nio.file.Path;
import org.testcontainers.images.builder.ImageFromDockerfile;

/**
 * The Fuseki image built from {@code docker/rdf-store}, shared by every test in the JVM.
 *
 * <p>Each RDF test used to build its own copy under a random name, deleted on exit. In the parallel
 * lane those concurrent builds of one Dockerfile raced, and a build failed with "parent snapshot
 * ... does not exist". One named image, kept after the run, is built once and reused.
 */
public final class RdfStoreImage {
  private static final String NAME = "openmetadata-it/rdf-store:local";
  private static ImageFromDockerfile image;

  private RdfStoreImage() {}

  /** {@code dockerContext} is the {@code docker/rdf-store} directory of this checkout. */
  public static synchronized ImageFromDockerfile get(final Path dockerContext) {
    if (image == null) {
      image = new ImageFromDockerfile(NAME, false).withFileFromPath(".", dockerContext);
    }
    return image;
  }
}
