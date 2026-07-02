/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * Reproduces the production "failed to parse field [pipelineStatuses.config.appConfig.actions.
 * customProperties] of type [text]" reindex failure against a real OpenSearch node and proves that
 * {@code "dynamic": false} on the mapping fixes it. Uncontrolled dynamic mapping auto-typed the field
 * as {@code text} from a string value; a later object value then failed to parse. With
 * {@code dynamic:false} the unmapped config sub-tree is stored in {@code _source} but never
 * auto-typed, so both string and object values index cleanly.
 */
class DynamicMappingTypeConflictTest {

  private static final Logger LOG = LoggerFactory.getLogger(DynamicMappingTypeConflictTest.class);

  // Match the OpenSearch image the rest of the test/dev infra ships with
  // (TestSuiteBootstrap.DEFAULT_OPENSEARCH_IMAGE, integration-tests pom, dev docker-compose) so the
  // mapping behaviour exercised here matches production and failures reproduce locally.
  private static final String OPENSEARCH_IMAGE = "opensearchproject/opensearch:3.4.0";
  private static final String INGESTION_PIPELINE_MAPPING =
      "elasticsearch/en/ingestion_pipeline_index_mapping.json";
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private static final String STRING_DOC =
      "{\"pipelineStatuses\":{\"config\":{\"appConfig\":{\"actions\":"
          + "{\"customProperties\":\"jointure\"}}}}}";
  private static final String OBJECT_DOC =
      "{\"pipelineStatuses\":{\"config\":{\"appConfig\":{\"actions\":"
          + "{\"customProperties\":{\"columndatepivot\":\"jointure\"}}}}}}";

  private static GenericContainer<?> opensearch;
  private static String baseUrl;

  @BeforeAll
  static void startOpenSearch() {
    assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "Docker is required");
    opensearch =
        new GenericContainer<>(DockerImageName.parse(OPENSEARCH_IMAGE))
            .withEnv("discovery.type", "single-node")
            .withEnv("DISABLE_SECURITY_PLUGIN", "true")
            .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
            .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m")
            .withExposedPorts(9200)
            .waitingFor(Wait.forHttp("/").forPort(9200).forStatusCode(200))
            .withStartupTimeout(Duration.ofMinutes(3));
    opensearch.start();
    baseUrl = "http://" + opensearch.getHost() + ":" + opensearch.getMappedPort(9200);
  }

  @AfterAll
  static void stopOpenSearch() {
    if (opensearch != null) {
      opensearch.stop();
    }
  }

  @Test
  void dynamicMapping_textThenObject_reproducesTypeConflict() throws Exception {
    String openMapping =
        "{\"mappings\":{\"properties\":{\"pipelineStatuses\":{\"properties\":"
            + "{\"runId\":{\"type\":\"keyword\"}}}}}}";
    assertEquals(200, put("/dyn_raw", openMapping).statusCode());
    assertEquals(201, put("/dyn_raw/_doc/1?refresh=true", STRING_DOC).statusCode());

    HttpResponse<String> conflict = put("/dyn_raw/_doc/2?refresh=true", OBJECT_DOC);
    LOG.info("dynamic-mapping object doc: [{}] {}", conflict.statusCode(), conflict.body());
    assertEquals(400, conflict.statusCode(), "object value must fail against the text-typed field");
    assertTrue(
        conflict.body().contains("failed to parse field")
            || conflict.body().contains("mapper_parsing"),
        "must be the type-conflict parse error, got: " + conflict.body());
  }

  @Test
  void dynamicFalse_acceptsBothStringAndObjectValues() throws Exception {
    String fixedMapping =
        "{\"mappings\":{\"dynamic\":false,\"properties\":{\"pipelineStatuses\":{\"properties\":"
            + "{\"runId\":{\"type\":\"keyword\"}}}}}}";
    assertEquals(200, put("/dyn_fixed", fixedMapping).statusCode());

    assertEquals(201, put("/dyn_fixed/_doc/1?refresh=true", STRING_DOC).statusCode());
    assertEquals(
        201,
        put("/dyn_fixed/_doc/2?refresh=true", OBJECT_DOC).statusCode(),
        "dynamic:false must accept both string and object values");
  }

  @Test
  void realIngestionPipelineMapping_acceptsObjectConfigValue() throws Exception {
    String mapping;
    try (InputStream is =
        getClass().getClassLoader().getResourceAsStream(INGESTION_PIPELINE_MAPPING)) {
      assertNotNull(is, "Mapping resource not found on classpath: " + INGESTION_PIPELINE_MAPPING);
      mapping = new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }
    assertEquals(200, put("/ingestion_pipeline_real", mapping).statusCode());

    assertEquals(201, put("/ingestion_pipeline_real/_doc/1?refresh=true", STRING_DOC).statusCode());
    HttpResponse<String> response = put("/ingestion_pipeline_real/_doc/2?refresh=true", OBJECT_DOC);
    LOG.info("real ingestion-pipeline object doc: [{}]", response.statusCode());
    assertEquals(
        201, response.statusCode(), "real mapping (dynamic:false) must accept the object config");
  }

  private HttpResponse<String> put(String path, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(baseUrl + path))
            .timeout(REQUEST_TIMEOUT)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
