package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.search.ScriptedDeleteRetryBase;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import os.org.opensearch.client.opensearch._types.BulkByScrollFailure;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;

@Execution(ExecutionMode.CONCURRENT)
class OpenSearchEntityManagerDeleteByScriptRetryIT extends ScriptedDeleteRetryBase {
  @BeforeAll
  static void onlyOnOpenSearch() {
    assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "needs the opensearch client");
  }

  private OpenSearchClient connection;
  private os.org.opensearch.client.opensearch.OpenSearchClient client;
  private OpenSearchEntityManager manager;

  @Override
  protected String engineUrl() {
    return "http://"
        + TestSuiteBootstrap.getSearchHost()
        + ":"
        + TestSuiteBootstrap.getSearchPort();
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
