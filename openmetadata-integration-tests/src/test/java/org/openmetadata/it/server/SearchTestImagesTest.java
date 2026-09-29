package org.openmetadata.it.server;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Properties;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;

/**
 * Guards the coupling between the pinned OpenSearch image and the vendored {@code analysis-ik}
 * archive. Bumping {@link SearchTestImages#OPENSEARCH_IMAGE} without committing the matching plugin
 * archive is otherwise only discovered when an integration-test lane builds the container — 30
 * minutes into CI — because {@code opensearch-plugin} is what rejects the mismatch. These tests need
 * no Docker.
 */
class SearchTestImagesTest {

  private static final String PLUGIN_DESCRIPTOR = "plugin-descriptor.properties";

  @Test
  void vendoredArchiveExistsForThePinnedImage() {
    assertDoesNotThrow(
        () -> SearchTestImages.requireIkArchiveResource(SearchTestImages.OPENSEARCH_IMAGE),
        "The pinned OpenSearch image has no matching vendored analysis-ik archive. Re-vendor it per "
            + "openmetadata-integration-tests/src/test/resources/opensearch-plugins/README.md.");
  }

  /**
   * The descriptor is what {@code opensearch-plugin install} validates at container-build time. A
   * correctly named but wrong-version archive passes the existence check above and still breaks the
   * build, so assert the engine version the archive actually targets.
   */
  @Test
  void vendoredArchiveTargetsThePinnedOpenSearchVersion() throws Exception {
    Properties descriptor = readPluginDescriptor();

    assertEquals("analysis-ik", descriptor.getProperty("name"));
    assertEquals(pinnedOpenSearchVersion(), descriptor.getProperty("opensearch.version"));
  }

  @Test
  void missingArchiveFailsFastWithAnActionableMessage() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> SearchTestImages.requireIkArchiveResource("opensearchproject/opensearch:0.0.0"));

    assertTrue(
        failure.getMessage().contains("opensearch-analysis-ik-0.0.0.zip")
            && failure.getMessage().contains("README.md"),
        "The failure must name the archive to add and where the procedure lives, got: "
            + failure.getMessage());
  }

  private static String pinnedOpenSearchVersion() {
    String image = SearchTestImages.OPENSEARCH_IMAGE;
    return image.substring(image.lastIndexOf(':') + 1);
  }

  private Properties readPluginDescriptor() throws Exception {
    String resource = SearchTestImages.requireIkArchiveResource(SearchTestImages.OPENSEARCH_IMAGE);
    InputStream archive = getClass().getClassLoader().getResourceAsStream(resource);
    assertNotNull(archive, "Vendored archive is on the classpath but not readable: " + resource);
    try (ZipInputStream entries = new ZipInputStream(archive)) {
      return descriptorFrom(entries, resource);
    }
  }

  private Properties descriptorFrom(ZipInputStream entries, String resource) throws Exception {
    for (ZipEntry entry = entries.getNextEntry(); entry != null; entry = entries.getNextEntry()) {
      if (PLUGIN_DESCRIPTOR.equals(entry.getName())) {
        Properties descriptor = new Properties();
        descriptor.load(new ByteArrayInputStream(entries.readAllBytes()));
        return descriptor;
      }
    }
    throw new IllegalStateException(PLUGIN_DESCRIPTOR + " is missing from " + resource);
  }
}
