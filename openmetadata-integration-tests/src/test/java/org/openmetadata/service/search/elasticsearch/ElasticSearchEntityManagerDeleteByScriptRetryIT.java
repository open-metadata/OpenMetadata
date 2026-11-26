package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.BulkIndexByScrollFailure;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.search.ScriptedDeleteRetryBase;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

@Execution(ExecutionMode.CONCURRENT)
class ElasticSearchEntityManagerDeleteByScriptRetryIT extends ScriptedDeleteRetryBase {
  @BeforeAll
  static void onlyOnElasticsearch() {
    assumeTrue(
        "elasticsearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "needs the elasticsearch client");
  }

  private ElasticSearchClient connection;
  private ElasticsearchClient client;
  private ElasticSearchEntityManager manager;

  @Override
  protected String engineUrl() {
    return "http://"
        + TestSuiteBootstrap.getSearchHost()
        + ":"
        + TestSuiteBootstrap.getSearchPort();
  }

  @Override
  protected void connect(ElasticSearchConfiguration config) {
    connection = new ElasticSearchClient(config);
    client =
        new ElasticsearchClient(connection.getNewClient()._transport()) {
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
                doReturn(List.of(mock(BulkIndexByScrollFailure.class))).when(response).failures();
            }
            return response;
          }
        };
    manager = new ElasticSearchEntityManager(client);
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
