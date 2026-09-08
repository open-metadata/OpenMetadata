package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ColumnLineageReconciliationIT {

  @Test
  void sequentialChangesRemainSearchable(TestNamespace ns) throws Exception {
    try (LineageIndex index = new LineageIndex(ns)) {
      index.client.updateColumnsInUpstreamLineage(
          index.name, new HashMap<>(Map.of("source.rename", "source.RENAME")));
      index.client.deleteColumnsInUpstreamLineage(index.name, List.of("source.delete"));
      index.client.updateColumnsInUpstreamLineage(
          index.name, new HashMap<>(Map.of("source.RENAME", "source.Rename")));

      JsonNode source = index.readSource();
      assertEquals(
          JsonUtils.readTree("[\"source.Rename\",\"source.keep\"]"),
          source.at("/upstreamLineage/0/columns/0/fromColumns"));
      assertEquals("unrelated", source.path("description").asText());
    }
  }

  @Test
  void sequentialRenamesMatchTheNewFqn(TestNamespace ns) throws Exception {
    try (LineageIndex index = new LineageIndex(ns)) {
      index.client.updateColumnsInUpstreamLineage(
          index.name, new HashMap<>(Map.of("source.rename", "source.RENAME")));
      index.client.updateColumnsInUpstreamLineage(
          index.name, new HashMap<>(Map.of("source.RENAME", "source.Rename")));

      assertEquals(
          JsonUtils.readTree("[\"source.Rename\",\"source.delete\",\"source.keep\"]"),
          index.readSource().at("/upstreamLineage/0/columns/0/fromColumns"));
    }
  }

  @Test
  void deletionMatchesTheNewlyRenamedFqn(TestNamespace ns) throws Exception {
    try (LineageIndex index = new LineageIndex(ns)) {
      index.client.updateColumnsInUpstreamLineage(
          index.name, new HashMap<>(Map.of("source.rename", "source.RENAME")));
      index.client.deleteColumnsInUpstreamLineage(index.name, List.of("source.RENAME"));

      assertEquals(
          JsonUtils.readTree("[\"source.delete\",\"source.keep\"]"),
          index.readSource().at("/upstreamLineage/0/columns/0/fromColumns"));
    }
  }

  @Test
  void deletionDoesNotForceARefresh(TestNamespace ns) throws Exception {
    try (LineageIndex index = new LineageIndex(ns)) {
      JsonNode refreshCount =
          index
              .request("GET", "/_stats/refresh", null)
              .at("/_all/primaries/refresh/external_total");
      assertTrue(refreshCount.isIntegralNumber());
      index.client.deleteColumnsInUpstreamLineage(index.name, List.of("source.delete"));

      assertEquals(
          refreshCount,
          index
              .request("GET", "/_stats/refresh", null)
              .at("/_all/primaries/refresh/external_total"));
      assertEquals(
          JsonUtils.readTree("[\"source.rename\",\"source.keep\"]"),
          index.readSource().at("/upstreamLineage/0/columns/0/fromColumns"));
    }
  }

  @Test
  void retriesConflictsFromAnUnrefreshedWrite(TestNamespace ns) throws Exception {
    try (LineageIndex index = new LineageIndex(ns)) {
      // The search snapshot sees the original version until an explicit refresh. This models
      // another request updating the same downstream document before lineage cleanup starts.
      index.request("POST", "/_update/target", "{\"doc\":{\"description\":\"concurrent edit\"}}");
      index.client.deleteColumnsInUpstreamLineage(index.name, List.of("source.delete"));

      JsonNode source = index.readSource();
      assertEquals(
          JsonUtils.readTree("[\"source.rename\",\"source.keep\"]"),
          source.at("/upstreamLineage/0/columns/0/fromColumns"));
      assertEquals("concurrent edit", source.path("description").asText());
    }
  }

  @Test
  void combinedChangesRewriteBothSidesAndKeepOtherMappings(TestNamespace ns) throws Exception {
    try (LineageIndex index = new LineageIndex(ns)) {
      index.request(
          "PUT",
          "/_doc/target?refresh=true",
          """
          {"description":"unrelated","upstreamLineage":[{"doc_id":"source-target","columns":[
            {"fromColumns":["source.rename","source.delete","source.keep"],"toColumn":"target.rename"},
            {"fromColumns":["source.delete"],"toColumn":"target.empty"},
            {"fromColumns":["source.keep"],"toColumn":"target.delete"},
            {"fromColumns":["other.source"],"toColumn":"target.keep"}
          ]}]}
          """);
      index.client.reconcileColumnsInUpstreamLineage(
          index.name + "," + index.name + "_missing",
          Map.of("source.rename", "source.RENAME", "target.rename", "target.RENAME"),
          List.of("source.delete", "target.delete"));
      JsonNode expected =
          JsonUtils.readTree(
              """
          [{"fromColumns":["source.RENAME","source.keep"],"toColumn":"target.RENAME"},
           {"fromColumns":["other.source"],"toColumn":"target.keep"}]
          """);
      assertEquals(expected, index.readSource().at("/upstreamLineage/0/columns"));
      assertEquals("source-target", index.readSource().at("/upstreamLineage/0/doc_id").asText());
      assertEquals("unrelated", index.readSource().path("description").asText());
    }
  }

  private static final class LineageIndex implements AutoCloseable {
    private final Rest5Client httpClient;
    private final SearchClient client;
    private final String name;

    private LineageIndex(TestNamespace ns) throws IOException {
      SdkClients.adminClient();
      client = Entity.getSearchRepository().getSearchClient();
      name = Entity.getSearchRepository().getIndexOrAliasName(ns.shortPrefix("column_lineage"));
      httpClient = TestSuiteBootstrap.createSearchClient();
      request(
          "PUT",
          "",
          """
          {"settings":{"number_of_shards":1,"number_of_replicas":0,"refresh_interval":"-1"}}
          """);
      request(
          "PUT",
          "/_doc/target?refresh=true",
          """
          {"description":"unrelated","upstreamLineage":[{"doc_id":"source-target","columns":[
            {"fromColumns":["source.rename","source.delete","source.keep"],"toColumn":"target.keep"}
          ]}]}
          """);
    }

    private JsonNode readSource() throws IOException {
      return request("GET", "/_doc/target", null).path("_source");
    }

    private JsonNode request(String method, String suffix, String body) throws IOException {
      Request request = new Request(method, "/" + name + suffix);
      if (body != null) {
        request.setJsonEntity(body);
      }
      try (InputStream content = httpClient.performRequest(request).getEntity().getContent()) {
        return JsonUtils.readTree(new String(content.readAllBytes(), StandardCharsets.UTF_8));
      }
    }

    @Override
    public void close() throws IOException {
      try {
        request("DELETE", "", null);
      } finally {
        httpClient.close();
      }
    }
  }
}
