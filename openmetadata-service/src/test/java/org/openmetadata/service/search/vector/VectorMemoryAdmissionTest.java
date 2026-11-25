package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import os.org.opensearch.client.opensearch.OpenSearchClient;

@Isolated("Registers the context memory entity type used by the server")
class VectorMemoryAdmissionTest {
  private static String originalType;
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final UUID OWNER = UUID.randomUUID();

  @BeforeAll
  static void registerMemoryBody() {
    originalType =
        EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("contextmemory", Entity.CONTEXT_MEMORY);
    ContextMemoryBodyTextContributor.INSTANCE.register();
  }

  @AfterAll
  static void restoreType() {
    if (originalType == null) EntityInterface.CANONICAL_ENTITY_NAME_MAP.remove("contextmemory");
    else EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("contextmemory", originalType);
  }

  static Stream<Consumer<ContextMemory>> staleChanges() {
    return Stream.of(
        memory ->
            memory.withShareConfig(
                new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)),
        memory -> memory.withEntityStatus(ContextMemoryStatus.ARCHIVED),
        memory -> memory.withDeleted(true),
        memory -> memory.withAnswer("redacted answer"),
        memory -> memory.withPinned(true));
  }

  @ParameterizedTest
  @MethodSource("staleChanges")
  void currentVisibilityStatusContentAndKindOverrideTheIndexedSnapshot(
      Consumer<ContextMemory> change) {
    ContextMemory memory = memory();
    ArrayNode hits = hits(memory);
    change.accept(memory);
    assertEquals(0, admit(hits, memory, "reader", false, Map.of()).size());
  }

  @Test
  void currentApprovedMemoryRemainsVisibleAndOtherEntityTypesAreNotReloaded() {
    ContextMemory memory = memory();
    ArrayNode hits = hits(memory);
    hits.addObject().put("_id", "table").putObject("_source").put("entityType", "table");
    assertEquals(2, admit(hits, memory, "reader", false, Map.of()).size());
  }

  @Test
  void missingOrUnverifiableParentCannotReturnIndexedMemoryContent() {
    ContextMemory memory = memory();
    ArrayNode hits = hits(memory);
    assertEquals(0, admit(hits, null, "reader", false, Map.of()).size());
    ((ObjectNode) hits.get(0).path("_source")).remove("fingerprint");
    assertEquals(0, admit(hits, memory, "reader", false, Map.of()).size());
  }

  @Test
  void pendingSearchRequiresTheExplicitRequestAndActualOwnerEvenForAnAdmin() {
    ContextMemory memory = memory().withEntityStatus(ContextMemoryStatus.DRAFT);
    ArrayNode hits = hits(memory);
    Map<String, List<String>> pending = Map.of("entityStatus", List.of("Draft"));
    assertEquals(0, admit(hits, memory, "owner", false, Map.of()).size());
    assertEquals(1, admit(hits, memory, "owner", false, pending).size());
    assertEquals(0, admit(hits, memory, "reader", true, pending).size());
  }

  @Test
  void changedAnchorIsRejectedEvenForAnAdministrator() {
    ContextMemory memory = memory();
    ArrayNode hits = hits(memory);
    memory.withPrimaryEntity(
        new EntityReference().withId(UUID.randomUUID()).withType("table").withName("newAnchor"));
    assertEquals(0, admit(hits, memory, "reader", true, Map.of()).size());
  }

  @Test
  void visibleMemoryDoesNotRevealAnUnreadableSourceFile() {
    EntityReference file =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.CONTEXT_FILE)
            .withName("private-budget")
            .withDescription("secret metadata");
    ContextMemory memory = memory().withSourceFile(file);
    ArrayNode hits = hits(memory);
    ((ObjectNode) hits.get(0).path("_source")).set("sourceFile", MAPPER.valueToTree(file));
    JsonNode link =
        admit(hits, memory, "reader", false, Map.of()).get(0).path("_source").path("sourceFile");
    assertEquals(file.getId().toString(), link.path("id").asText());
    assertEquals(Entity.CONTEXT_FILE, link.path("type").asText());
    assertEquals(2, link.size(), "File metadata is independently protected");
  }

  @ParameterizedTest
  @ValueSource(strings = {"elasticsearch", "opensearch"})
  void serviceAdvancesPastAWhollyRevokedRawPageBeforePaginating(String engine) {
    ContextMemory memory = memory();
    ArrayNode revoked = hits(memory);
    for (int i = 1; i < 6; i++) revoked.add(revoked.get(0).deepCopy());
    memory.withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    AbstractVectorIndexService service = service(engine);
    List<Integer> offsets = new ArrayList<>();
    doAnswer(
            call -> {
              var query = MAPPER.readTree(call.getArgument(2, String.class));
              offsets.add(query.path("from").asInt());
              return page(offsets.size() == 1 ? revoked : tableHits(), 9);
            })
        .when(service)
        .executeGenericRequest(eq("POST"), anyString(), anyString());
    withRepository(
        memory,
        "reader",
        false,
        subject -> {
          var result =
              service.search(
                  new VectorSearchParameters(
                      "question", Map.of(), 1, 1, 10, 0, null, subject, null));
          assertEquals("second", result.hits.getFirst().get("parentId"));
          assertEquals(1, result.hits.size());
          assertTrue(result.hasMore);
          assertNull(result.totalHits);
          return result;
        });
    assertEquals(List.of(0, 6), offsets);
  }

  @ParameterizedTest
  @ValueSource(strings = {"elasticsearch", "opensearch"})
  void parentPassagesUseCurrentVisibilityOnBothEngines(String engine) {
    ContextMemory memory = memory();
    ArrayNode indexed = hits(memory);
    AbstractVectorIndexService service = service(engine);
    doAnswer(
            call ->
                call.getArgument(1, String.class).endsWith("/_search") ? page(indexed, 1) : "{}")
        .when(service)
        .executeGenericRequest(anyString(), anyString(), any());
    withRepository(
        memory,
        "reader",
        false,
        subject -> {
          assertEquals(
              1,
              service
                  .searchChunksByParent(memory.getId().toString(), "question", 5, subject)
                  .size());
          memory.withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
          assertTrue(
              service
                  .searchChunksByParent(memory.getId().toString(), "question", 5, subject)
                  .isEmpty());
          return null;
        });
  }

  private static AbstractVectorIndexService service(String engine) {
    EmbeddingClient provider = mock(EmbeddingClient.class);
    when(provider.embedQuery(anyString())).thenReturn(new float[] {1, 0, 0});
    when(provider.getDimension()).thenReturn(3);
    ElasticsearchClient elasticsearch = mock(ElasticsearchClient.class);
    when(elasticsearch._transport()).thenReturn(mock(Rest5ClientTransport.class));
    return spy(
        engine.equals("elasticsearch")
            ? new ElasticSearchVectorService(elasticsearch, provider, 2, parameters -> Set.of())
            : new OpenSearchVectorService(
                mock(OpenSearchClient.class), provider, parameters -> Set.of()));
  }

  private static String page(ArrayNode hits, int total) {
    var root = MAPPER.createObjectNode();
    var body = root.putObject("hits");
    body.putObject("total").put("value", total);
    body.set("hits", hits);
    return root.toString();
  }

  private static ArrayNode tableHits() {
    ArrayNode hits = MAPPER.createArrayNode();
    for (String id : List.of("first", "second", "third"))
      hits.addObject()
          .put("_score", 1)
          .putObject("_source")
          .put("entityType", Entity.TABLE)
          .put("parentId", id);
    return hits;
  }

  private static JsonNode admit(
      ArrayNode hits,
      ContextMemory current,
      String caller,
      boolean admin,
      Map<String, List<String>> filters) {
    return withRepository(
        current,
        caller,
        admin,
        subject ->
            VectorMemoryAdmission.retain(
                hits,
                new VectorSearchParameters(
                    "question", filters, 10, 0, 10, 0, null, subject, null)));
  }

  private static <T> T withRepository(
      ContextMemory current, String caller, boolean admin, Function<SubjectContext, T> action) {
    var allowed = Entity.getEntityFields(ContextMemory.class);
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.getOnlySupportedFields(anyString()))
        .thenAnswer(call -> new Fields(allowed, call.getArgument(0, String.class), true));
    when(repository.getFields(anyString()))
        .thenAnswer(call -> new Fields(allowed, call.getArgument(0, String.class)));
    when(repository.get(isNull(), anyList(), any(), eq(Include.NON_DELETED)))
        .thenReturn(current == null ? List.of() : List.of(current));
    SubjectContext subject =
        new SubjectContext(new User().withId(OWNER).withName(caller).withIsAdmin(admin), null);
    try (var entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY)).thenReturn(repository);
      return action.apply(subject);
    }
  }

  private static ContextMemory memory() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("memory")
        .withFullyQualifiedName("memory")
        .withAnswer("confidential answer")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PUBLIC))
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withOwners(
            List.of(new EntityReference().withId(OWNER).withName("owner").withType("user")));
  }

  private static ArrayNode hits(ContextMemory memory) {
    ArrayNode hits = MAPPER.createArrayNode();
    var source = hits.addObject().put("_id", memory.getId() + "_1").putObject("_source");
    source
        .put("entityType", Entity.CONTEXT_MEMORY)
        .put("parentId", memory.getId().toString())
        .put("fingerprint", VectorDocBuilder.computeFingerprintForEntity(memory))
        .put("entityStatus", ContextMemoryIndex.statusValue(memory))
        .put("anchorId", ContextMemoryIndex.anchorId(memory))
        .put("memoryScope", ContextMemoryIndex.memoryScopeValue(memory))
        .put("memoryType", ContextMemoryIndex.memoryTypeValue(memory))
        .put("pinned", Boolean.TRUE.equals(memory.getPinned()))
        .put("textToLLMContext", memory.getAnswer());
    return hits;
  }
}
