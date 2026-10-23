package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.search.SearchSettingsTestHelper;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorSearchParameters;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Vector search applies the caller's search access policies to entity documents and to vector chunk
 * documents, on a real OpenSearch engine (ADR:2026-10-23-search-access-policies-apply-to-vector-chunks).
 *
 * <p>Subjects, policies and the access-control setting are the embedded server's; the documents
 * live in a dedicated container, so no other test's index is touched. Chunk documents are written
 * by the vector service itself and so carry the real chunk mapping. Embedded only: subjects are
 * resolved in-process.
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
class VectorSearchAccessFilterIT {

  private static final int DIMENSION = 8;
  private static final float[] VECTOR = new float[DIMENSION];
  private static final String LATE_PHRASE = "zephyrquasar lattice reconciliation";

  static {
    Arrays.fill(VECTOR, 0.1f);
  }

  private static final EmbeddingClient EMBEDDINGS =
      new EmbeddingClient() {
        @Override
        protected float[] doEmbed(String text) {
          return VECTOR.clone();
        }

        @Override
        public int getDimension() {
          return DIMENSION;
        }

        @Override
        public String getModelId() {
          return "access-filter";
        }
      };

  @Container
  private static final OpensearchContainer<?> OPENSEARCH =
      new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private final TestNamespace namespace = new TestNamespace("vector_access");
  private final ServerHandle server = OssTestServer.defaultHandle();
  private OpenSearchVectorService vectorService;
  private SearchSettings originalSettings;

  private String deniedTables;
  private String tableOwner;
  private String otherOwnerOnly;
  private String dataConsumer;

  private final Table ownedTable = table("owned_ledger");
  private final Table otherTable = table("other_ledger");
  private final GlossaryTerm stampedTerm = term("stamped_revenue");
  private final GlossaryTerm preUpgradeTerm = term("legacy_revenue");

  @BeforeAll
  void setUp() {
    assumeFalse(server.isExternal(), "subjects are resolved in-process");
    originalSettings = SearchSettingsTestHelper.currentSettings(server);
    createPrincipals();
    ownedTable
        .withOwners(List.of(userReference(tableOwner)))
        .withDescription(lateChunkDescription());
    vectorService =
        new OpenSearchVectorService(
            new OpenSearchClient(
                    new ElasticSearchConfiguration()
                        .withHost(OPENSEARCH.getHost())
                        .withPort(OPENSEARCH.getMappedPort(9200))
                        .withScheme("http")
                        .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH)
                        .withConnectionTimeoutSecs(10)
                        .withSocketTimeoutSecs(30)
                        .withKeepAliveTimeoutSecs(600)
                        .withBatchSize(10))
                .getNewClient(),
            EMBEDDINGS);
    seedDocuments();
  }

  @AfterAll
  void tearDown() {
    if (originalSettings != null) {
      SearchSettingsTestHelper.putSettings(server, originalSettings);
    }
  }

  private void createPrincipals() {
    deniedTables = deniedUser("deny", null);
    tableOwner = deniedUser("owner", "!isOwner()");
    otherOwnerOnly = deniedUser("other", "!isOwner()");
    CreateUser consumer = new CreateUser();
    consumer.setName(namespace.prefix("consumer"));
    consumer.setEmail(namespace.prefix("consumer") + "@test.openmetadata.org");
    consumer.setRoles(List.of(SdkClients.adminClient().roles().getByName("DataConsumer").getId()));
    dataConsumer = SdkClients.adminClient().users().create(consumer).getName();
  }

  private String deniedUser(String role, String condition) {
    String prefix = namespace.prefix(role);
    DenyPolicyPrincipals.clientDeniedWhen(
        prefix, Entity.TABLE, MetadataOperation.VIEW_ALL, condition);
    return prefix + "_user";
  }

  private static EntityReference userReference(String userName) {
    User user = SdkClients.adminClient().users().getByName(userName);
    return new EntityReference().withId(user.getId()).withType(Entity.USER).withName(userName);
  }

  private static Table table(String name) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc.db.sch." + name)
        .withDescription("ledger of fulfilment events");
  }

  private static GlossaryTerm term(String name) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("finance." + name)
        .withDescription("recognised revenue");
  }

  private static String lateChunkDescription() {
    String filler = "This ledger tracks order fulfilment across regional warehouses. ".repeat(200);
    List<String> words = new ArrayList<>(List.of(filler.split(" ")));
    List<String> description = new ArrayList<>(words.subList(0, 820));
    description.addAll(List.of(LATE_PHRASE.split(" ")));
    description.addAll(words.subList(0, 200));
    return String.join(" ", description);
  }

  private void seedDocuments() {
    String tableIndex = Entity.getSearchRepository().getIndexOrAliasName(Entity.TABLE);
    vectorService.executeGenericRequest("PUT", "/" + tableIndex, entityIndexBody());
    for (Table table : List.of(ownedTable, otherTable)) {
      writeEntityDocument(tableIndex, table);
      vectorService.writeEntityChunks(
          table.getId().toString(), VectorDocBuilder.fromEntity(table, EMBEDDINGS));
    }
    vectorService.writeEntityChunks(
        stampedTerm.getId().toString(), VectorDocBuilder.fromEntity(stampedTerm, EMBEDDINGS));
    writePreUpgradeChunk(preUpgradeTerm);
    vectorService.executeGenericRequest("POST", "/_refresh", null);
  }

  private String entityIndexBody() {
    Map<String, Object> embedding =
        Map.of(
            "type",
            "knn_vector",
            "dimension",
            DIMENSION,
            "method",
            Map.of("name", "hnsw", "engine", "lucene", "space_type", "cosinesimil"));
    Map<String, Object> properties = new HashMap<>();
    properties.put("embedding", embedding);
    properties.put(
        "id", Map.of("type", "text", "fields", Map.of("keyword", Map.of("type", "keyword"))));
    properties.put("entityType", Map.of("type", "keyword"));
    properties.put(
        "owners", Map.of("type", "nested", "properties", Map.of("id", Map.of("type", "keyword"))));
    return JsonUtils.pojoToJson(
        Map.of(
            "settings",
            Map.of("index", Map.of("knn", true, "number_of_replicas", 0)),
            "mappings",
            Map.of("properties", properties),
            "aliases",
            Map.of(vectorService.getIndexAlias(), Map.of())));
  }

  private void writeEntityDocument(String index, Table table) {
    Map<String, Object> document = new HashMap<>();
    document.put("id", table.getId().toString());
    document.put("entityType", Entity.TABLE);
    document.put("fullyQualifiedName", table.getFullyQualifiedName());
    document.put("embedding", VECTOR);
    document.put(
        "owners",
        table.getOwners() == null
            ? List.of()
            : table.getOwners().stream()
                .map(owner -> Map.of("id", owner.getId().toString()))
                .toList());
    vectorService.executeGenericRequest(
        "PUT", "/" + index + "/_doc/" + table.getId(), JsonUtils.pojoToJson(document));
  }

  /** A chunk as written before chunks carried access fields: no stamp to evaluate. */
  private void writePreUpgradeChunk(GlossaryTerm term) {
    List<Map<String, Object>> chunks = new ArrayList<>();
    for (Map<String, Object> chunk : VectorDocBuilder.fromEntity(term, EMBEDDINGS)) {
      Map<String, Object> legacy = new HashMap<>(chunk);
      legacy.remove(VectorDocBuilder.FIELD_ACCESS_STAMP);
      legacy.put("docVersion", 8);
      chunks.add(legacy);
    }
    vectorService.writeEntityChunks(term.getId().toString(), chunks);
  }

  private void accessControl(boolean enabled) {
    SearchSettings settings = SearchSettingsTestHelper.copyOf(originalSettings);
    settings.getGlobalSettings().setEnableAccessControl(enabled);
    SearchSettingsTestHelper.putSettings(server, settings);
  }

  private List<Map<String, Object>> hits(String userName) {
    VectorSearchParameters parameters =
        new VectorSearchParameters(
            "ledger revenue",
            Map.of(),
            50,
            0,
            100,
            0.0,
            null,
            SubjectContext.getSubjectContext(userName),
            null);
    return vectorService.search(parameters).hits;
  }

  private Set<String> parents(String userName) {
    return hits(userName).stream()
        .map(hit -> String.valueOf(hit.get("parentId")))
        .collect(Collectors.toSet());
  }

  private static String id(Object entity) {
    return entity instanceof Table table
        ? table.getId().toString()
        : ((GlossaryTerm) entity).getId().toString();
  }

  @Test
  void deniedTypeHiddenFromEntityAndChunkDocs() {
    accessControl(true);

    Set<String> parents = parents(deniedTables);

    assertFalse(parents.contains(id(ownedTable)), parents.toString());
    assertFalse(parents.contains(id(otherTable)), parents.toString());
    assertTrue(parents.contains(id(stampedTerm)), parents.toString());
  }

  @Test
  void dataConsumerSeesPreUpgradeChunks() {
    accessControl(true);

    Set<String> parents = parents(dataConsumer);

    assertTrue(
        parents.containsAll(
            Set.of(id(ownedTable), id(otherTable), id(stampedTerm), id(preUpgradeTerm))),
        parents.toString());
  }

  @Test
  void restrictedCallerSkipsPreUpgradeChunks() {
    accessControl(true);

    Set<String> parents = parents(deniedTables);

    assertFalse(parents.contains(id(preUpgradeTerm)), parents.toString());
    assertTrue(parents.contains(id(stampedTerm)), parents.toString());
  }

  @Test
  void ownerOnlySeesOwnLateChunk() {
    accessControl(true);

    List<Object> ownedChunks =
        hits(tableOwner).stream()
            .filter(hit -> id(ownedTable).equals(hit.get("parentId")))
            .map(hit -> hit.get("chunkIndex"))
            .collect(Collectors.toList());

    assertTrue(
        ownedChunks.stream().anyMatch(index -> "2".equals(String.valueOf(index))),
        ownedChunks.toString());
    assertFalse(parents(tableOwner).contains(id(otherTable)));
    Set<String> other = parents(otherOwnerOnly);
    assertFalse(other.contains(id(ownedTable)), other.toString());
    assertFalse(other.contains(id(otherTable)), other.toString());
  }

  @Test
  void accessDisabledMatchesAdmin() {
    accessControl(false);

    Set<String> admin = parents("admin");

    assertTrue(admin.contains(id(ownedTable)), admin.toString());
    assertEquals(admin, parents(deniedTables));
  }
}
