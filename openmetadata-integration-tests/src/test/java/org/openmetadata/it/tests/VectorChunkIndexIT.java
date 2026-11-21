package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.AbstractVectorIndexService;
import org.openmetadata.service.search.vector.ElasticSearchVectorService;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorSearchParameters;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * The chunk index is one implementation for both engines, and an engine supplies only its request
 * dialect. A mocked transport cannot tell whether a real engine accepts that dialect, so each
 * scenario runs here against OpenSearch and against Elasticsearch. The scenarios of one engine
 * share its cluster and its staged-recreate state, so they run one at a time.
 */
class VectorChunkIndexIT {

  private static final String QUESTION = "which table holds online orders";

  /** Returns one vector for any text and counts the texts it is asked to embed. */
  private static final class CountingProvider extends EmbeddingClient {
    private final AtomicInteger textsEmbedded = new AtomicInteger();

    @Override
    protected float[] doEmbed(String text) {
      textsEmbedded.incrementAndGet();
      return new float[] {0.5f, 0.25f, 0.125f};
    }

    @Override
    public int getDimension() {
      return 3;
    }

    @Override
    public String getModelId() {
      return "vector-chunk-index";
    }

    int textsEmbedded() {
      return textsEmbedded.get();
    }
  }

  @Nested
  @TestInstance(TestInstance.Lifecycle.PER_CLASS)
  @Execution(ExecutionMode.SAME_THREAD)
  class OnOpenSearch {
    private final CountingProvider provider = new CountingProvider();
    private final OpensearchContainer<?> container =
        new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
            .withStartupTimeout(Duration.ofMinutes(5))
            .withEnv("DISABLE_SECURITY_PLUGIN", "true")
            .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
            .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
            .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");
    private OpenSearchClient client;
    private OpenSearchVectorService service;

    @BeforeAll
    void start() {
      container.start();
      HttpHost host = new HttpHost("http", container.getHost(), container.getMappedPort(9200));
      client =
          new OpenSearchClient(
              ApacheHttpClient5TransportBuilder.builder(host)
                  .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
                  .build());
      service = new OpenSearchVectorService(client, provider);
    }

    @AfterAll
    void stop() throws Exception {
      client._transport().close();
      container.stop();
    }

    @Test
    void aFullRecreateServesOnlyTheEntitiesItIndexed() {
      assertAFullRecreateServesOnlyTheEntitiesItIndexed(service, provider);
    }

    @Test
    void aGenerationThatMissedAChunkWriteIsNeverPromoted() {
      assertAGenerationThatMissedAChunkWriteIsNeverPromoted(service);
    }
  }

  @Nested
  @TestInstance(TestInstance.Lifecycle.PER_CLASS)
  @Execution(ExecutionMode.SAME_THREAD)
  class OnElasticsearch {
    private final CountingProvider provider = new CountingProvider();
    private final ElasticsearchContainer container =
        new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:9.3.0")
            .withEnv("discovery.type", "single-node")
            .withEnv("xpack.security.enabled", "false")
            .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
            .withStartupTimeout(Duration.ofMinutes(5));
    private Rest5Client restClient;
    private ElasticSearchVectorService service;

    @BeforeAll
    void start() {
      container.start();
      restClient =
          Rest5Client.builder(
                  new HttpHost("http", container.getHost(), container.getMappedPort(9200)))
              .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
              .build();
      service =
          new ElasticSearchVectorService(
              new ElasticsearchClient(
                  new Rest5ClientTransport(restClient, new JacksonJsonpMapper())),
              provider);
    }

    @AfterAll
    void stop() throws Exception {
      restClient.close();
      container.stop();
    }

    @Test
    void aFullRecreateServesOnlyTheEntitiesItIndexed() {
      assertAFullRecreateServesOnlyTheEntitiesItIndexed(service, provider);
    }

    @Test
    void aGenerationThatMissedAChunkWriteIsNeverPromoted() {
      assertAGenerationThatMissedAChunkWriteIsNeverPromoted(service);
    }
  }

  /**
   * A full recreate writes into a staged generation and swaps it in once every entity type has
   * finished. An entity whose text is unchanged keeps its stored vectors, so it costs no provider
   * call. An entity the run did not index was deleted without a delete event, so its chunks go with
   * the generation the swap removes.
   */
  private static void assertAFullRecreateServesOnlyTheEntitiesItIndexed(
      AbstractVectorIndexService service, CountingProvider provider) {
    Table embeddedAgain = table("orders", "Orders placed online");
    Table unchanged = table("customers", "Customers who ordered");
    Table deletedWithoutAnEvent = table("refunds", "Refunds issued");
    List<Table> seeded = List.of(embeddedAgain, unchanged, deletedWithoutAnEvent);
    seeded.forEach(table -> writeChunks(service, table, null));
    refresh(service, service.getChunkIndexName());
    assertOnePassage(service, deletedWithoutAnEvent, "Refunds issued");
    assertEquals(ids(seeded), parentsFound(service));

    String staged = service.beginStagedChunkRecreate();
    assertNotNull(staged, "A reachable embedding provider stages a generation");
    writeChunks(service, embeddedAgain, staged);
    int embeddedBeforeTheCopy = provider.textsEmbedded();
    service.backfillEntityChunks(unchanged, staged);
    assertEquals(
        embeddedBeforeTheCopy,
        provider.textsEmbedded(),
        "The stored vectors of an unchanged entity are copied, not embedded again");
    refresh(service, staged);
    assertEquals(ids(seeded), parentsFound(service), "Reads keep the old chunks until the swap");

    AvailableEntityTypes.SET.forEach(type -> service.markEntityTypeReindexed(type, true, staged));

    assertEquals(ids(List.of(embeddedAgain, unchanged)), parentsFound(service));
    assertOnePassage(service, embeddedAgain, "Orders placed online");
    assertOnePassage(service, unchanged, "Customers who ordered");
    assertEquals(
        List.of(), service.searchChunksByParent(id(deletedWithoutAnEvent), QUESTION, 5, null));
    assertEquals(
        Set.of(service.getChunkIndexName(), service.getIndexAlias()), aliasesOf(service, staged));
  }

  /**
   * The cluster rejects one bulk item while the run's entity types all finalize successfully. The
   * old chunks stay live, and a clean retry promotes its own generation.
   */
  private static void assertAGenerationThatMissedAChunkWriteIsNeverPromoted(
      AbstractVectorIndexService service) {
    Table invoices = table("invoices", "Invoices sent");
    try {
      writeChunks(service, invoices, null);
      refresh(service, service.getChunkIndexName());
      Set<String> liveBefore = parentsFound(service);
      assertTrue(liveBefore.contains(id(invoices)), liveBefore::toString);

      String rejected = service.beginStagedChunkRecreate();
      assertNotNull(rejected, "A reachable embedding provider stages a generation");
      service.writeEntityChunks(id(invoices), unindexableChunks(service, invoices), rejected);
      AvailableEntityTypes.SET.forEach(
          type -> service.markEntityTypeReindexed(type, true, rejected));

      assertEquals(Set.of(), aliasesOf(service, rejected), "The generation is not promoted");
      assertEquals(liveBefore, parentsFound(service), "Reads keep the old chunks");

      String retry = service.beginStagedChunkRecreate();
      writeChunks(service, invoices, retry);
      refresh(service, retry);
      AvailableEntityTypes.SET.forEach(type -> service.markEntityTypeReindexed(type, true, retry));

      assertEquals(
          Set.of(service.getChunkIndexName(), service.getIndexAlias()), aliasesOf(service, retry));
      assertEquals(Set.of(id(invoices)), parentsFound(service));
      assertOnePassage(service, invoices, "Invoices sent");
    } finally {
      service.deleteEntityChunks(id(invoices));
      refresh(service, service.getChunkIndexName());
    }
  }

  // An integer field holding text fails that bulk item on both engines.
  private static List<Map<String, Object>> unindexableChunks(
      AbstractVectorIndexService service, Table table) {
    return VectorDocBuilder.fromEntity(table, service.getEmbeddingClient()).stream()
        .map(VectorChunkIndexIT::withTextChunkCount)
        .toList();
  }

  private static Map<String, Object> withTextChunkCount(Map<String, Object> chunk) {
    Map<String, Object> broken = new HashMap<>(chunk);
    broken.put("chunkCount", "not a number");
    return broken;
  }

  private static void writeChunks(
      AbstractVectorIndexService service, Table table, String stagedChunkTarget) {
    service.writeEntityChunks(
        id(table),
        VectorDocBuilder.fromEntity(table, service.getEmbeddingClient()),
        stagedChunkTarget);
  }

  // The service does not refresh after a write, so the scenario does before it reads.
  private static void refresh(AbstractVectorIndexService service, String index) {
    service.executeGenericRequest("POST", "/" + index + "/_refresh", null);
  }

  private static void assertOnePassage(
      AbstractVectorIndexService service, Table parent, String description) {
    List<String> passages = service.searchChunksByParent(id(parent), QUESTION, 5, null);

    assertEquals(1, passages.size(), passages::toString);
    assertTrue(passages.getFirst().contains(description), passages::toString);
  }

  private static Set<String> parentsFound(AbstractVectorIndexService service) {
    VectorSearchParameters anyTen =
        new VectorSearchParameters(QUESTION, Map.of(), 10, 0, 10, 0.0, null, null, null);
    return service.search(anyTen).getHits().stream()
        .map(hit -> (String) hit.get("parentId"))
        .collect(Collectors.toSet());
  }

  private static Set<String> aliasesOf(AbstractVectorIndexService service, String index) {
    JsonNode aliases =
        JsonUtils.readTree(service.executeGenericRequest("GET", "/" + index + "/_alias", null))
            .path(index)
            .path("aliases");
    Set<String> names = new HashSet<>();
    aliases.fieldNames().forEachRemaining(names::add);
    return names;
  }

  private static Table table(String name, String description) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc.db.schema." + name)
        .withDescription(description)
        .withDeleted(false)
        .withUpdatedAt(1_700_000_000_000L);
  }

  private static String id(Table table) {
    return table.getId().toString();
  }

  private static Set<String> ids(List<Table> tables) {
    return tables.stream().map(VectorChunkIndexIT::id).collect(Collectors.toSet());
  }
}
