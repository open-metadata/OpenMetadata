/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.bootstrap;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * The published {@code openmetadata/fuseki} image, configured through its environment contract
 * the way OpenMetadata deployments run it. It is the image of record; {@code -DrdfContainerImage}
 * substitutes another build of the same image, such as {@code openmetadata-fuseki:local} from the
 * fork.
 *
 * <p>ADR:2026-10-14-fuseki-image-of-record
 */
public final class FusekiTestImage {
  /**
   * Built from open-metadata/jena release/6.2.0 at 600514c9. The tag is the workflow's immutable
   * {@code <version>-<commit>} tag; its index digest is
   * sha256:5db427d91c1fcd4482b0d10d372699aeeda45cf019867791a31a81d968ceab7e.
   */
  public static final String DEFAULT_IMAGE = "openmetadata/fuseki:6.2.0-600514c";

  public static final String IMAGE_PROPERTY = "rdfContainerImage";
  public static final int PORT = 3030;
  public static final String ADMIN_USER = "admin";
  public static final String ADMIN_PASSWORD = "test-admin";

  /** The serving dataset and the two blue/green rebuild targets OpenMetadata promotes between. */
  public static final List<String> DATASETS =
      List.of("openmetadata", "openmetadata_a", "openmetadata_b");

  /** TDB2 data lives here; FUSEKI_BASE is /fuseki. */
  public static final String DATABASES_PATH = "/fuseki/databases";

  public static final String FUSEKI_BASE = "/fuseki";
  public static final String FUSEKI_SERVER_JAR = "/jena-fuseki/fuseki-server.jar";

  // Below OpenMetadata's 60-second client deadline: releasing an OpenMetadata thread does not
  // cancel server work holding TDB2's writer, so Fuseki must stop it first.
  private static final String SERVER_TIMEOUT_MS = "50000";

  private FusekiTestImage() {}

  public static String image() {
    final String image = System.getProperty(IMAGE_PROPERTY);
    return image == null || image.isBlank() ? DEFAULT_IMAGE : image;
  }

  /** A container with the image's own defaults only, for tests that configure it differently. */
  public static GenericContainer<?> bare() {
    return new GenericContainer<>(DockerImageName.parse(image())).withExposedPorts(PORT);
  }

  /**
   * A container configured as OpenMetadata needs it: the three datasets, the union default graph,
   * server-side query and update deadlines, and the bounded Graph Store extension.
   */
  public static GenericContainer<?> forOpenMetadata(final String jvmArgs) {
    return bare()
        .withEnv("ADMIN_PASSWORD", ADMIN_PASSWORD)
        .withEnv("FUSEKI_DATASETS", String.join(",", DATASETS))
        .withEnv("FUSEKI_UNION_DEFAULT_GRAPH", "true")
        .withEnv("FUSEKI_QUERY_TIMEOUT_MS", SERVER_TIMEOUT_MS)
        .withEnv("FUSEKI_UPDATE_TIMEOUT_MS", SERVER_TIMEOUT_MS)
        .withEnv("OPENMETADATA_EXTENSION_ENABLED", "true")
        .withEnv("JVM_ARGS", jvmArgs)
        .waitingFor(
            Wait.forHttp("/$/ping")
                .forPort(PORT)
                .forStatusCode(200)
                .withStartupTimeout(Duration.ofMinutes(2)));
  }

  /** Every path but /$/ping requires the admin account in the image's rendered shiro.ini. */
  public static String adminAuthorization() {
    return "Basic "
        + Base64.getEncoder()
            .encodeToString((ADMIN_USER + ":" + ADMIN_PASSWORD).getBytes(StandardCharsets.UTF_8));
  }

  public static String serverUrl(final GenericContainer<?> fuseki) {
    return "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(PORT);
  }
}
