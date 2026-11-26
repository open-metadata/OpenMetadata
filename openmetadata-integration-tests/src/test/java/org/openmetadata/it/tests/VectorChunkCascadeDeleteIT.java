package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.apache.hc.core5.http.HttpHost;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorEmbeddingHandler;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * A recursive delete sends its descendants no delete event, so the vector handler must remove
 * their chunks itself: those of a hard delete from the prepare hook every hard-deleted entity
 * passes through, those of a soft delete from the update that marks each descendant deleted.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
class VectorChunkCascadeDeleteIT {

  // A server registers each entity type as its repository starts, and the vector handler skips an
  // entity whose type it cannot read. This JVM starts no repository, so the table type is
  // registered here.
  static {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(Entity.TABLE, Entity.TABLE);
  }

  private static final EmbeddingClient PROVIDER =
      new EmbeddingClient() {
        @Override
        protected float[] doEmbed(String text) {
          return new float[] {0.5f, 0.25f, 0.125f};
        }

        @Override
        public int getDimension() {
          return 3;
        }

        @Override
        public String getModelId() {
          return "vector-chunk-cascade-delete";
        }
      };

  private final OpensearchContainer<?> container =
      new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");
  private OpenSearchClient client;
  private OpenSearchVectorService service;
  private VectorEmbeddingHandler handler;

  @BeforeAll
  void start() {
    container.start();
    HttpHost host = new HttpHost("http", container.getHost(), container.getMappedPort(9200));
    client =
        new OpenSearchClient(
            ApacheHttpClient5TransportBuilder.builder(host)
                .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
                .build());
    service = new OpenSearchVectorService(client, PROVIDER);
    handler = new VectorEmbeddingHandler(service);
  }

  @AfterAll
  void stop() throws Exception {
    client._transport().close();
    container.stop();
  }

  @Test
  void theDescendantsOfAHardDeleteLoseTheirChunks() {
    List<Table> descendants =
        IntStream.range(0, 40)
            .mapToObj(
                i -> table("t" + i, i % 2 == 0 ? "Orders placed online" : "word ".repeat(940)))
            .toList();
    try {
      descendants.forEach(this::writeChunks);
      assertEquals(3, storedChunkIds(descendants.get(1)).size());

      descendants.forEach(table -> handler.prepareHardDelete(table).run());

      Awaitility.await("the descendants' chunks are deleted")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofMillis(200))
          .until(() -> descendants.stream().allMatch(t -> storedChunkIds(t).isEmpty()));
    } finally {
      descendants.forEach(table -> service.deleteEntityChunks(id(table)));
    }
  }

  @Test
  void aDescendantOfASoftDeleteLosesItsChunks() {
    Table ledger = table("ledger", "word ".repeat(940));
    try {
      writeChunks(ledger);
      assertEquals(3, storedChunkIds(ledger).size());

      handler.onEntityUpdated(
          table("ledger", "word ".repeat(940)).withId(ledger.getId()).withDeleted(true),
          null,
          null);

      assertEquals(Set.of(), storedChunkIds(ledger));
    } finally {
      service.deleteEntityChunks(id(ledger));
    }
  }

  private void writeChunks(Table table) {
    service.writeEntityChunks(id(table), VectorDocBuilder.fromEntity(table, PROVIDER));
  }

  // A multi-get is real time, so it sees writes no refresh has made searchable yet.
  private Set<String> storedChunkIds(Table table) {
    List<String> ids = IntStream.range(0, 5).mapToObj(i -> id(table) + "_" + i).toList();
    JsonNode docs =
        JsonUtils.readTree(
                service.executeGenericRequest(
                    "POST",
                    "/" + service.getChunkIndexName() + "/_mget?_source=false",
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
}
