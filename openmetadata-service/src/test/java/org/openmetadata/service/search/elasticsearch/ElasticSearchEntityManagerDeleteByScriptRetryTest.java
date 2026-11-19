package org.openmetadata.service.search.elasticsearch;

import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.BulkIndexByScrollFailure;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch._types.Script;
import es.co.elastic.clients.elasticsearch._types.ScriptLanguage;
import es.co.elastic.clients.elasticsearch.core.BulkRequest;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import es.co.elastic.clients.elasticsearch.core.UpdateRequest;
import es.co.elastic.clients.elasticsearch.core.UpdateResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.EntityManagementClient;
import org.openmetadata.service.search.ScriptedDeleteRetryTestBase;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Isolated
@Testcontainers
class ElasticSearchEntityManagerDeleteByScriptRetryTest extends ScriptedDeleteRetryTestBase {
  @Container
  static final GenericContainer<?> ENGINE =
      new GenericContainer<>("docker.elastic.co/elasticsearch/elasticsearch:9.3.0")
          .withEnv("discovery.type", "single-node")
          .withEnv("xpack.security.enabled", "false")
          .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
          .withExposedPorts(9200)
          .waitingFor(Wait.forHttp("/_cluster/health").forStatusCode(200))
          .withStartupTimeout(Duration.ofMinutes(3));

  private static final long STALE_SEQ_NO = 1_000_000L;
  private static final Script BROKEN_SCRIPT =
      Script.of(
          s -> s.source(src -> src.scriptString("ctx._source.")).lang(ScriptLanguage.Painless));

  private ElasticSearchClient connection;
  private ElasticsearchClient client;
  private ElasticSearchEntityManager manager;

  @Override
  protected String engineUrl() {
    return "http://" + ENGINE.getHost() + ":" + ENGINE.getMappedPort(9200);
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

          @Override
          @SuppressWarnings("unchecked")
          public <T, P> UpdateResponse<T> update(UpdateRequest<T, P> request, Class<T> type)
              throws IOException {
            return !failThisWrite()
                ? super.update(request, type)
                : super.update((UpdateRequest<T, P>) failing(request.index(), request.id()), type);
          }

          @Override
          public BulkResponse bulk(BulkRequest request) throws IOException {
            return !failThisWrite()
                ? super.bulk(request)
                : super.bulk(
                    BulkRequest.of(
                        b ->
                            b.refresh(Refresh.True)
                                .operations(
                                    request.operations().stream()
                                        .map(
                                            op ->
                                                failingBulk(op.update().index(), op.update().id()))
                                        .toList())));
          }
        };
    manager = new ElasticSearchEntityManager(client);
  }

  private UpdateRequest<Map<String, Object>, Map<String, Object>> failing(String index, String id) {
    return UpdateRequest.of(
        u -> {
          u.index(index).id(id);
          return writeFailure == WriteFailure.CONFLICT
              ? u.ifSeqNo(STALE_SEQ_NO).ifPrimaryTerm(1L).doc(Map.of("value", 0))
              : u.script(BROKEN_SCRIPT);
        });
  }

  private BulkOperation failingBulk(String index, String id) {
    return BulkOperation.of(
        o ->
            o.update(
                u -> {
                  u.index(index).id(id);
                  return writeFailure == WriteFailure.CONFLICT
                      ? u.ifSeqNo(STALE_SEQ_NO)
                          .ifPrimaryTerm(1L)
                          .action(a -> a.doc(Map.of("value", 0)))
                      : u.action(a -> a.script(BROKEN_SCRIPT));
                }));
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
  protected EntityManagementClient manager() {
    return manager;
  }

  @Override
  protected void deleteOnce() throws Exception {
    client.deleteByQuery(manager.buildDeleteByScriptRequest(index, SCRIPT, PARAMS));
  }
}
