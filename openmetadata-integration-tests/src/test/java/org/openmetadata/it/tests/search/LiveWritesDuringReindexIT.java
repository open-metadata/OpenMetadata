package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * A live write made while a reindex builds a staged copy of an index goes to that copy, which the
 * reindex promotes, so the edit survives the swap instead of landing in the index being replaced.
 * Isolated: while the staged copy is registered, every table write in the server goes to it.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class LiveWritesDuringReindexIT {

  private static final Duration TIMEOUT = Duration.ofSeconds(30);

  private static HttpClient http;
  private static URI clusterBase;

  @BeforeAll
  static void setup() {
    ServerHandle server = OssTestServer.defaultHandle();
    assumeTrue(
        !server.isExternal(),
        "Creating a staged index needs direct cluster access; external mode does not expose it");
    http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    clusterBase =
        URI.create(server.searchScheme() + "://" + server.searchHost() + ":" + server.searchPort());
  }

  @Test
  void anAssetsTabEditDuringAReindexLandsInTheStagedCopy(TestNamespace ns) {
    GlossaryTerm term = createTerm(ns);
    Table table = createTable(ns);
    SearchRepository searchRepository = Entity.getSearchRepository();
    String canonical =
        searchRepository.getWriteIndexName(searchRepository.getIndexMapping(Entity.TABLE));
    String staged = canonical + "_it_live_writes_staged";
    try {
      send("PUT", "/" + staged, "{\"settings\":{\"index\":{\"refresh_interval\":\"-1\"}}}");
      searchRepository.registerStagedIndex(Entity.TABLE, staged);

      BulkOperationResult result = addTermOnTheAssetsTab(term, table);

      assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
    } finally {
      searchRepository.unregisterStagedIndex(Entity.TABLE, staged);
    }
    try {
      assertTrue(
          carries(document(staged, table), term), "the edit is in the copy the reindex promotes");
      assertFalse(
          carries(document(canonical, table), term),
          "the index being replaced does not take the edit");
    } finally {
      send("DELETE", "/" + staged, null);
    }
  }

  private static BulkOperationResult addTermOnTheAssetsTab(GlossaryTerm term, Table table) {
    return SdkClients.user1Client()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/assets/add",
            new AddGlossaryToAssetsRequest()
                .withAssets(List.of(table.getEntityReference()))
                .withDryRun(false),
            BulkOperationResult.class);
  }

  // A realtime get reads the latest write, refreshed or not.
  private static JsonNode document(String index, Table table) {
    return JsonUtils.readTree(send("GET", "/" + index + "/_doc/" + table.getId(), null))
        .path("_source");
  }

  private static boolean carries(JsonNode source, GlossaryTerm term) {
    for (JsonNode tag : source.path("tags")) {
      if (term.getFullyQualifiedName().equals(tag.path("tagFQN").asText())) {
        return true;
      }
    }
    return false;
  }

  private static GlossaryTerm createTerm(TestNamespace ns) {
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.shortPrefix("g_reindex"))
                        .withDescription("Live writes during a reindex")));
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName("term")
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Live writes during a reindex"));
  }

  private static Table createTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema =
        SdkClients.adminClient()
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.shortPrefix("schema"))
                    .withDatabase(database.getFullyQualifiedName()));
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.shortPrefix("tbl"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static String send(String method, String path, String body) {
    try {
      HttpRequest.BodyPublisher publisher =
          body == null
              ? HttpRequest.BodyPublishers.noBody()
              : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(clusterBase.resolve(path))
              .timeout(TIMEOUT)
              .header("Content-Type", "application/json")
              .method(method, publisher)
              .build();
      return http.send(request, HttpResponse.BodyHandlers.ofString()).body();
    } catch (Exception e) {
      throw new IllegalStateException("Cluster request " + method + " " + path + " failed", e);
    }
  }
}
