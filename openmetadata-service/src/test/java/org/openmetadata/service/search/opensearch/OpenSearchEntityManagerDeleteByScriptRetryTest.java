package org.openmetadata.service.search.opensearch;

import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.ScriptedDeleteRetryTestBase;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import os.org.opensearch.client.opensearch._types.BulkByScrollFailure;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;

@Isolated
@Testcontainers
class OpenSearchEntityManagerDeleteByScriptRetryTest extends ScriptedDeleteRetryTestBase {
  @Container
  static final GenericContainer<?> ENGINE =
      new GenericContainer<>("opensearchproject/opensearch:3.4.0")
          .withEnv("discovery.type", "single-node")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m")
          .withExposedPorts(9200)
          .waitingFor(Wait.forHttp("/_cluster/health").forStatusCode(200))
          .withStartupTimeout(Duration.ofMinutes(3));

  private OpenSearchClient connection;
  private os.org.opensearch.client.opensearch.OpenSearchClient client;
  private OpenSearchEntityManager manager;

  @Override
  protected String engineUrl() {
    return "http://" + ENGINE.getHost() + ":" + ENGINE.getMappedPort(9200);
  }

  @Override
  protected void connect(ElasticSearchConfiguration config) {
    connection = new OpenSearchClient(config);
    client =
        new os.org.opensearch.client.opensearch.OpenSearchClient(
            connection.getNewClient()._transport()) {
          @Override
          public DeleteByQueryResponse deleteByQuery(DeleteByQueryRequest request)
              throws IOException {
            if (keepConflicting) {
              try {
                rewriteWithoutRefresh();
              } catch (Exception e) {
                throw new IOException(e);
              }
            }
            DeleteByQueryResponse response = super.deleteByQuery(request);
            conflicts.add(response.versionConflicts());
            if (reportTimeout || reportShardFailure) {
              response = spy(response);
              if (reportTimeout) doReturn(true).when(response).timedOut();
              if (reportShardFailure)
                doReturn(List.of(mock(BulkByScrollFailure.class))).when(response).failures();
            }
            return response;
          }
        };
    manager = new OpenSearchEntityManager(client);
  }

  @Override
  protected void closeClient() throws Exception {
    if (connection != null) connection.close();
  }

  @Override
  protected void deleteByScript() throws Exception {
    manager.deleteByScript(index, SCRIPT, PARAMS);
  }

  @Override
  protected void deleteOnce() throws Exception {
    client.deleteByQuery(manager.buildDeleteByScriptRequest(index, SCRIPT, PARAMS));
  }
}
