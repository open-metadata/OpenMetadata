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
package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.apache.commons.lang3.tuple.Pair;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch.core.UpdateByQueryRequest;
import os.org.opensearch.client.opensearch.core.UpdateByQueryResponse;

/**
 * Reproduces the production {@code SocketTimeoutException} raised when inherited-field propagation
 * ({@link OpenSearchEntityManager#updateChildren}) ran a <b>blocking</b> update-by-query over a
 * large child set (a test suite completing with thousands of test cases) and outran
 * {@code socketTimeoutSecs}.
 *
 * <p>Against a real OpenSearch node this proves the fix: the child propagation is now submitted as
 * a background task ({@code wait_for_completion=false}), so the client call returns a task id
 * immediately instead of holding the socket open for the whole scan — and the propagation still
 * lands (the async task's {@code refresh=true} makes the children visible).
 */
class UpdateChildrenAsyncPropagationTest {

  private static final int CHILD_COUNT = 50;

  private static GenericContainer<?> opensearch;
  private static OpenSearchClient osClient;

  @BeforeAll
  static void startOpenSearch() {
    assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "Docker is required");
    opensearch =
        new GenericContainer<>(DockerImageName.parse("opensearchproject/opensearch:2.13.0"))
            .withEnv("discovery.type", "single-node")
            .withEnv("DISABLE_SECURITY_PLUGIN", "true")
            .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
            .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms1g -Xmx1g")
            .withExposedPorts(9200)
            .waitingFor(Wait.forHttp("/").forPort(9200).forStatusCode(200))
            .withStartupTimeout(Duration.ofMinutes(3));
    opensearch.start();
    ElasticSearchConfiguration cfg =
        new ElasticSearchConfiguration()
            .withHost(opensearch.getHost())
            .withPort(opensearch.getMappedPort(9200))
            .withScheme("http")
            .withConnectionTimeoutSecs(10)
            .withSocketTimeoutSecs(60)
            .withBatchSize(10)
            .withClusterAlias("")
            .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    osClient = new OpenSearchClient(cfg);
  }

  @AfterAll
  static void stopOpenSearch() {
    if (osClient != null) {
      osClient.close();
    }
    if (opensearch != null) {
      opensearch.stop();
    }
  }

  @Test
  void updateChildrenSubmitsAsyncTaskAndPropagates() throws Exception {
    var lowLevel = osClient.getNewClient();
    String index = "repro_children";
    String parentId = UUID.randomUUID().toString();
    String ownerId = UUID.randomUUID().toString();

    for (int i = 0; i < CHILD_COUNT; i++) {
      String id = String.valueOf(i);
      lowLevel.index(
          idx ->
              idx.index(index)
                  .id(id)
                  .document(Map.of("name", "child-" + id, "entityType", Map.of("id", parentId))));
    }
    lowLevel.indices().refresh(r -> r.index(index));

    UpdateByQueryRequest request =
        new OpenSearchEntityManager(lowLevel)
            .buildUpdateChildrenRequest(
                List.of(index),
                Pair.of("entityType.id", parentId),
                Pair.of(
                    "ctx._source.owners = params.owners;",
                    Map.of("owners", List.of(Map.of("id", ownerId, "type", "user")))));

    UpdateByQueryResponse response = lowLevel.updateByQuery(request);

    // The crux of the fix: wait_for_completion=false makes OpenSearch return a task id up front
    // instead of holding the socket open for the whole scan. A synchronous (reverted) request
    // returns a null task with the counts populated instead, which fails this assertion.
    assertNotNull(
        response.task(),
        "child propagation must be submitted as an async task (wait_for_completion=false) so a "
            + "large child set cannot trip socketTimeoutSecs; got a synchronous response instead");

    Awaitility.await()
        .atMost(60, TimeUnit.SECONDS)
        .pollInterval(Duration.ofMillis(500))
        .until(
            () ->
                lowLevel
                        .count(
                            c ->
                                c.index(index)
                                    .query(
                                        q ->
                                            q.term(
                                                t ->
                                                    t.field("owners.id.keyword")
                                                        .value(FieldValue.of(ownerId)))))
                        .count()
                    == CHILD_COUNT);

    lowLevel.indices().delete(d -> d.index(index));
  }
}
