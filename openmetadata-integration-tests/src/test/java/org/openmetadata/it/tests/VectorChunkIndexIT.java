package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
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
import org.openmetadata.service.search.vector.utils.EmbeddedEntityTypes;
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
    private volatile boolean failing;

    @Override
    protected float[] doEmbed(String text) {
      if (failing) {
        throw new IllegalStateException("provider rate limit");
      }
      textsEmbedded.incrementAndGet();
      return new float[] {0.5f, 0.25f, 0.125f};
    }

    void failing(boolean failing) {
      this.failing = failing;
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
    void aMissedChunkWriteStillPromotesAndTheNextWriteHealsIt() {
      assertAMissedChunkWriteStillPromotesAndTheNextWriteHealsIt(service);
    }

    @Test
    void aProviderOutageOnAFirstRebuildStillPromotes() {
      assertAProviderOutageOnAFirstRebuildStillPromotes(service, provider);
    }

    @Test
    void aFailedDeleteKeepsTheLiveChunks() {
      assertAFailedDeleteKeepsTheLiveChunks(service);
    }

    @Test
    void aGrowthWhoseHeaderFailedLeavesNoChunkBehind() {
      assertAGrowthWhoseHeaderFailedLeavesNoChunkBehind(service);
    }

    @Test
    void aRetriedEmbeddingMergesIntoTheIndexedEntityDocument() {
      assertARetriedEmbeddingMergesIntoTheIndexedEntityDocument(service);
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
    void aMissedChunkWriteStillPromotesAndTheNextWriteHealsIt() {
      assertAMissedChunkWriteStillPromotesAndTheNextWriteHealsIt(service);
    }

    @Test
    void aProviderOutageOnAFirstRebuildStillPromotes() {
      assertAProviderOutageOnAFirstRebuildStillPromotes(service, provider);
    }

    @Test
    void aFailedDeleteKeepsTheLiveChunks() {
      assertAFailedDeleteKeepsTheLiveChunks(service);
    }

    @Test
    void aGrowthWhoseHeaderFailedLeavesNoChunkBehind() {
      assertAGrowthWhoseHeaderFailedLeavesNoChunkBehind(service);
    }

    @Test
    void aRetriedEmbeddingMergesIntoTheIndexedEntityDocument() {
      assertARetriedEmbeddingMergesIntoTheIndexedEntityDocument(service);
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

    EmbeddedEntityTypes.ALL.forEach(type -> service.markEntityTypeReindexed(type, true, staged));

    assertEquals(ids(List.of(embeddedAgain, unchanged)), parentsFound(service));
    assertOnePassage(service, embeddedAgain, "Orders placed online");
    assertOnePassage(service, unchanged, "Customers who ordered");
    assertEquals(
        List.of(), service.searchChunksByParent(id(deletedWithoutAnEvent), QUESTION, 5, null));
    assertEquals(
        Set.of(service.getChunkIndexName(), service.getIndexAlias()), aliasesOf(service, staged));
  }

  /**
   * The cluster rejects one entity's chunk bulk while every entity index is promoted. The miss is
   * reported to the caller, the generation still goes live with the entity indexes, and the
   * entity's next chunk write gives it its chunks again.
   */
  private static void assertAMissedChunkWriteStillPromotesAndTheNextWriteHealsIt(
      AbstractVectorIndexService service) {
    Table invoices = table("invoices", "Invoices sent");
    Table payments = table("payments", "Payments received");
    try {
      writeChunks(service, invoices, null);
      refresh(service, service.getChunkIndexName());

      String staged = service.beginStagedChunkRecreate();
      assertNotNull(staged, "A reachable embedding provider stages a generation");
      writeChunks(service, payments, staged);
      assertFalse(
          service.writeEntityChunks(id(invoices), unindexableChunks(service, invoices), staged),
          "The caller is told about the miss");
      refresh(service, staged);
      EmbeddedEntityTypes.ALL.forEach(type -> service.markEntityTypeReindexed(type, true, staged));

      assertEquals(
          Set.of(service.getChunkIndexName(), service.getIndexAlias()), aliasesOf(service, staged));
      assertEquals(Set.of(id(payments)), parentsFound(service));

      writeChunks(service, invoices, null);
      refresh(service, service.getChunkIndexName());
      assertOnePassage(service, invoices, "Invoices sent");
    } finally {
      service.deleteEntityChunks(id(invoices));
      service.deleteEntityChunks(id(payments));
      refresh(service, service.getChunkIndexName());
    }
  }

  /**
   * A first rebuild on a catalog with no chunks yet: the provider fails for one entity, which had
   * nothing live to lose, so the generation still goes live with every other entity's chunks.
   */
  private static void assertAProviderOutageOnAFirstRebuildStillPromotes(
      AbstractVectorIndexService service, CountingProvider provider) {
    Table carriers = table("carriers", "Carriers we ship with");
    Table shipments = table("shipments", "Shipments in transit");
    try {
      String staged = service.beginStagedChunkRecreate();
      assertNotNull(staged, "A reachable embedding provider stages a generation");
      writeChunks(service, carriers, staged);
      provider.failing(true);
      assertFalse(service.backfillEntityChunks(shipments, staged), "The miss is reported");
      provider.failing(false);
      refresh(service, staged);
      EmbeddedEntityTypes.ALL.forEach(type -> service.markEntityTypeReindexed(type, true, staged));

      assertEquals(
          Set.of(service.getChunkIndexName(), service.getIndexAlias()), aliasesOf(service, staged));
      assertEquals(Set.of(id(carriers)), parentsFound(service));
    } finally {
      provider.failing(false);
      service.deleteEntityChunks(id(carriers));
      service.deleteEntityChunks(id(shipments));
      refresh(service, service.getChunkIndexName());
    }
  }

  /**
   * An entity is deleted while a rebuild runs, and the delete from the staged generation fails. The
   * generation would bring the deleted entity's chunks back, so it is flagged and never promoted;
   * the live chunks, from which the entity is already gone, stay.
   */
  private static void assertAFailedDeleteKeepsTheLiveChunks(AbstractVectorIndexService service) {
    Table orders = table("orders", "Orders placed online");
    Table refunds = table("refunds", "Refunds issued");
    String staged = null;
    try {
      writeChunks(service, orders, null);
      writeChunks(service, refunds, null);
      refresh(service, service.getChunkIndexName());
      Set<String> liveAfterTheDelete = new HashSet<>(parentsFound(service));
      liveAfterTheDelete.remove(id(refunds));
      staged = service.beginStagedChunkRecreate();
      assertNotNull(staged, "A reachable embedding provider stages a generation");
      writeChunks(service, orders, staged);
      writeChunks(service, refunds, staged);
      refresh(service, staged);
      writeBlock(service, staged, true);

      service.deleteEntityChunks(id(refunds));
      refresh(service, service.getChunkIndexName());
      String generation = staged;
      EmbeddedEntityTypes.ALL.forEach(
          type -> service.markEntityTypeReindexed(type, true, generation));

      assertEquals(Set.of(), aliasesOf(service, staged), "The generation is not promoted");
      assertEquals(liveAfterTheDelete, parentsFound(service), "The live chunks stay");
      assertTrue(missedDeleteFlag(service, staged), "The generation is flagged");
    } finally {
      if (staged != null) {
        writeBlock(service, staged, false);
      }
      service.deleteEntityChunks(id(orders));
      service.deleteEntityChunks(id(refunds));
      refresh(service, service.getChunkIndexName());
    }
  }

  /**
   * An entity grows from one chunk to three and the write of its header fails, so chunks 1 and 2
   * are stored past the count the old header recorded. A shrink back to one chunk keeps only chunk
   * 0, and a delete of the entity leaves none, in the live index and in a staged generation. Stored
   * ids are read in real time, so no refresh hides a chunk left behind.
   */
  private static void assertAGrowthWhoseHeaderFailedLeavesNoChunkBehind(
      AbstractVectorIndexService service) {
    Table orders = table("orders", "Orders placed online");
    String live = service.getChunkIndexName();
    String staged = null;
    try {
      staged = service.beginStagedChunkRecreate();
      assertNotNull(staged, "A reachable embedding provider stages a generation");
      for (String target : Arrays.asList(null, staged)) {
        String index = target == null ? live : target;
        growWithTheHeaderFailing(service, orders, target, index);
        writeChunks(service, orders.withDescription("Orders placed online"), target);
        assertEquals(Set.of(id(orders) + "_0"), storedChunkIds(service, index, orders));
        growWithTheHeaderFailing(service, orders, target, index);
      }

      service.deleteEntityChunks(id(orders));

      assertEquals(Set.of(), storedChunkIds(service, live, orders));
      assertEquals(Set.of(), storedChunkIds(service, staged, orders));
    } finally {
      if (staged != null) {
        service.clearStagedChunkState(staged);
      }
      // Refreshed first, so the delete's query also reaches what a failed assertion left behind.
      refresh(service, live);
      service.deleteEntityChunks(id(orders));
      refresh(service, live);
    }
  }

  /**
   * A reindex that could not embed an entity indexes its document without an embedding and retries
   * it when the partition ends. The retry merges chunk 0's embedding fields into that document, so
   * the entity ends as a first attempt that succeeded would have left it. A document the bulk never
   * indexed is reported as a miss, not created.
   */
  private static void assertARetriedEmbeddingMergesIntoTheIndexedEntityDocument(
      AbstractVectorIndexService service) {
    Table orders = table("orders", "Orders placed online");
    String entityIndex = "table_search_index_retry";
    String document = "/" + entityIndex + "/_doc/" + id(orders);
    try {
      service.executeGenericRequest(
          "PUT", document + "?refresh=true", JsonUtils.pojoToJson(Map.of("name", "orders")));
      Map<String, Object> fields =
          VectorDocBuilder.legacyEmbeddingFields(
              VectorDocBuilder.fromEntity(orders, service.getEmbeddingClient()).getFirst());

      assertTrue(service.writeEntityEmbedding(entityIndex, id(orders), fields));
      JsonNode source =
          JsonUtils.readTree(
                  service.executeGenericRequest(
                      "GET", document + "?_source_includes=name,fingerprint,embedding", null))
              .path("_source");
      assertEquals("orders", source.path("name").asText());
      assertEquals(
          VectorDocBuilder.computeFingerprintForEntity(orders),
          source.path("fingerprint").asText());
      assertEquals(3, source.path("embedding").size());
      assertFalse(
          service.writeEntityEmbedding(entityIndex, UUID.randomUUID().toString(), fields),
          "A document the bulk never indexed is a miss");
    } finally {
      service.executeGenericRequest("DELETE", "/" + entityIndex, null);
    }
  }

  private static void growWithTheHeaderFailing(
      AbstractVectorIndexService service, Table table, String target, String index) {
    writeChunks(service, table.withDescription("Orders placed online"), target);
    List<Map<String, Object>> threeChunks =
        VectorDocBuilder.fromEntity(
            table.withDescription("word ".repeat(940)), service.getEmbeddingClient());
    assertEquals(3, threeChunks.size(), "The description spans three chunks");
    List<Map<String, Object>> brokenHeader = new ArrayList<>(threeChunks);
    brokenHeader.set(0, withUnindexableFingerprint(threeChunks.getFirst()));

    assertFalse(
        service.writeEntityChunks(id(table), brokenHeader, target), "The header write fails");
    assertEquals(
        Set.of(id(table) + "_0", id(table) + "_1", id(table) + "_2"),
        storedChunkIds(service, index, table),
        "Chunks 1 and 2 are stored past the old count");
  }

  // A keyword field holding an object fails that bulk item on both engines. The reservation that
  // precedes the other chunks carries no fingerprint, so only the final header fails.
  private static Map<String, Object> withUnindexableFingerprint(Map<String, Object> chunk) {
    Map<String, Object> broken = new HashMap<>(chunk);
    broken.put("fingerprint", Map.of("not", "a keyword"));
    return broken;
  }

  // A multi-get is real time, so it sees writes no refresh has made searchable yet.
  private static Set<String> storedChunkIds(
      AbstractVectorIndexService service, String index, Table table) {
    List<String> ids = IntStream.range(0, 5).mapToObj(i -> id(table) + "_" + i).toList();
    JsonNode docs =
        JsonUtils.readTree(
                service.executeGenericRequest(
                    "POST",
                    "/" + index + "/_mget?_source=false",
                    JsonUtils.pojoToJson(Map.of("ids", ids))))
            .path("docs");
    Set<String> stored = new HashSet<>();
    docs.forEach(
        doc -> {
          if (doc.path("found").asBoolean(false)) {
            stored.add(doc.path("_id").asText());
          }
        });
    return stored;
  }

  private static void writeBlock(AbstractVectorIndexService service, String index, boolean on) {
    service.executeGenericRequest(
        "PUT", "/" + index + "/_settings", "{\"index.blocks.write\":" + on + "}");
  }

  private static boolean missedDeleteFlag(AbstractVectorIndexService service, String index) {
    return JsonUtils.readTree(service.executeGenericRequest("GET", "/" + index + "/_mapping", null))
        .path(index)
        .path("mappings")
        .path("_meta")
        .path("incompleteChunkWrites")
        .asBoolean(false);
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
