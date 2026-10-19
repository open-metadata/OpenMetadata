package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.search.vector.VectorSearchQueryBuilder;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Executes both production visibility renderers on the real engine, including nested owner queries. */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ContextMemorySearchMatrixIT {
  private static final int LIMIT = 200;
  private static final float[] VECTOR = {1.0f, 0.0f, 0.0f};
  private final String index = "memory_matrix_" + UUID.randomUUID().toString().replace("-", "");
  private final User owner = user("owner", false);
  private final User reader = user("reader", false);
  private final User stranger = user("stranger", false);
  private final User admin = user("admin", true);
  private final EntityReference team = reference(Entity.TEAM);
  private final EntityReference domain = reference(Entity.DOMAIN);
  private final List<ContextMemory> memories = new ArrayList<>();
  private SearchClient search;
  private boolean openSearch;

  @BeforeAll
  void indexEveryLifecycleAndVisibility() {
    assumeFalse(
        OssTestServer.isExternalMode(),
        "The private engine index requires the embedded search stack");
    search = new SearchClient(OssTestServer.defaultHandle());
    openSearch = "opensearch".equalsIgnoreCase(System.getProperty("searchType"));
    reader.withTeams(List.of(team)).withDomains(List.of(domain));
    search.put("/" + index, mapping());
    for (ContextMemoryStatus status : ContextMemoryStatus.values()) {
      indexScopes(status);
      indexMemory(status, ContextMemoryScope.USER_GLOBAL, MemoryVisibility.SHARED, owner, team);
      indexMemory(status, ContextMemoryScope.USER_GLOBAL, MemoryVisibility.SHARED, owner, domain);
      indexMemory(status, ContextMemoryScope.USER_GLOBAL, MemoryVisibility.PRIVATE, admin, null);
    }
    indexMemory(null, ContextMemoryScope.USER_GLOBAL, MemoryVisibility.ENTITY, owner, null);
    search.get("/" + index + "/_refresh");
  }

  private void indexScopes(ContextMemoryStatus status) {
    for (ContextMemoryScope scope : ContextMemoryScope.values()) {
      for (MemoryVisibility visibility : MemoryVisibility.values()) {
        indexMemory(status, scope, visibility, owner, reader.getEntityReference());
      }
    }
  }

  @AfterAll
  void removePrivateIndex() {
    if (search != null) {
      search.delete("/" + index);
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"Approved", "Pending", "All"})
  void lexicalSearchAdmitsExactlyTheRequestedOwnersPendingMemories(String selection) {
    List<ContextMemoryStatus> statuses = statuses(selection);
    for (SubjectContext subject : subjects()) {
      assertEquals(
          expected(subject, statuses),
          hits(lexicalQuery(subject, statuses)),
          description(subject, selection));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"Approved", "Pending", "All"})
  void vectorSearchAdmitsExactlyTheRequestedOwnersPendingMemories(String selection) {
    List<ContextMemoryStatus> statuses = statuses(selection);
    Map<String, List<String>> filters =
        Map.of("entityStatus", statuses.stream().map(ContextMemoryStatus::value).toList());
    for (SubjectContext subject : subjects()) {
      String query =
          openSearch
              ? VectorSearchQueryBuilder.build(VECTOR, LIMIT, 0, LIMIT, filters, 0.0, subject)
              : VectorSearchQueryBuilder.buildNativeESQuery(
                  VECTOR, LIMIT, 0, LIMIT, filters, 2, subject);
      assertEquals(expected(subject, statuses), hits(query), description(subject, selection));
    }
  }

  private String lexicalQuery(SubjectContext subject, List<ContextMemoryStatus> statuses) {
    ContextMemorySearchVisibility visibility =
        new ContextMemorySearchVisibility(
            openSearch ? new OpenSearchQueryBuilderFactory() : new ElasticQueryBuilderFactory());
    OMQueryBuilder filter =
        subject == null
            ? visibility.buildOrgWideOnlyFilter()
            : visibility.buildVisibilityFilter(
                subject,
                List.of(ContextMemoryStatus.APPROVED),
                List.of(),
                statuses.stream()
                    .filter(
                        status ->
                            status == ContextMemoryStatus.DRAFT
                                || status == ContextMemoryStatus.UNPROCESSED)
                    .toList());
    String statusClause =
        JsonUtils.pojoToJson(
            Map.of(
                "terms",
                Map.of(
                    "entityStatus", statuses.stream().map(ContextMemoryStatus::value).toList())));
    return "{\"size\":"
        + LIMIT
        + ",\"query\":{\"bool\":{\"filter\":["
        + serialize(filter)
        + ","
        + statusClause
        + "]}}}";
  }

  private Set<String> expected(SubjectContext subject, List<ContextMemoryStatus> statuses) {
    Set<String> result = new HashSet<>();
    for (ContextMemory memory : memories) {
      boolean own = owns(subject, memory);
      boolean approved = memory.getEntityStatus() == ContextMemoryStatus.APPROVED;
      boolean pending =
          memory.getEntityStatus() == ContextMemoryStatus.UNPROCESSED
              || memory.getEntityStatus() == ContextMemoryStatus.DRAFT;
      if (memory.getEntityStatus() != null
          && statuses.contains(memory.getEntityStatus())
          && ((approved && visibleTo(subject, memory)) || (pending && own))) {
        result.add(memory.getId().toString());
      }
    }
    return result;
  }

  private boolean owns(SubjectContext subject, ContextMemory memory) {
    return subject != null && memory.getOwners().getFirst().getId().equals(subject.user().getId());
  }

  private boolean visibleTo(SubjectContext subject, ContextMemory memory) {
    MemoryVisibility visibility = memory.getShareConfig().getVisibility();
    return owns(subject, memory)
        || (subject != null && subject.isAdmin())
        || visibility == MemoryVisibility.ENTITY
        || visibility == MemoryVisibility.PUBLIC
        || (visibility == MemoryVisibility.SHARED && subject != null && subject.user() == reader);
  }

  private Set<String> hits(String query) {
    JsonNode response = search.search(index, query);
    Set<String> ids = new HashSet<>();
    response.path("hits").path("hits").forEach(hit -> ids.add(hit.path("_id").asText()));
    assertEquals(
        response.path("hits").path("total").path("value").asInt(),
        ids.size(),
        "the fixture must fit in one result window");
    return ids;
  }

  private void indexMemory(
      ContextMemoryStatus status,
      ContextMemoryScope scope,
      MemoryVisibility visibility,
      User author,
      EntityReference principal) {
    String name = UUID.randomUUID().toString();
    MemoryShareConfig sharing = new MemoryShareConfig().withVisibility(visibility);
    if (principal != null) {
      sharing.withSharedWith(List.of(new MemorySharedPrincipal().withPrincipal(principal)));
    }
    ContextMemory memory =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withTitle("Memory matrix")
            .withQuestion("Who qualifies?")
            .withAnswer("Seven orders")
            .withMemoryScope(scope)
            .withMemoryType(ContextMemoryType.NOTE)
            .withEntityStatus(status)
            .withOwners(List.of(author.getEntityReference()))
            .withShareConfig(sharing);
    Map<String, Object> document = new ContextMemoryIndex(memory).buildSearchIndexDoc();
    if (status == null) document.remove("entityStatus");
    document.put("embedding", VECTOR);
    search.put("/" + index + "/_doc/" + memory.getId(), JsonUtils.pojoToJson(document));
    memories.add(memory);
  }

  private String mapping() {
    String embedding =
        openSearch
            ? "{\"type\":\"knn_vector\",\"dimension\":3,\"method\":{\"name\":\"hnsw\",\"engine\":\"lucene\",\"space_type\":\"cosinesimil\"}}"
            : "{\"type\":\"dense_vector\",\"dims\":3,\"index\":true,\"similarity\":\"cosine\"}";
    return "{\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0"
        + (openSearch ? ",\"index.knn\":true" : "")
        + "},\"mappings\":{\"dynamic\":false,\"properties\":{\"embedding\":"
        + embedding
        + ",\"deleted\":{\"type\":\"boolean\"},\"entityType\":{\"type\":\"keyword\"},\"entityStatus\":{\"type\":\"keyword\"},\"visibility\":{\"type\":\"keyword\"},"
        + "\"anchorId\":{\"type\":\"keyword\"},\"sharedWithIds\":{\"type\":\"keyword\"},\"owners\":{\"type\":\"nested\",\"properties\":{\"id\":{\"type\":\"keyword\"}}}}}}";
  }

  private static String serialize(OMQueryBuilder filter) {
    if (filter instanceof OpenSearchQueryBuilder query) {
      return query.build().toJsonString();
    }
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = mapper.jsonProvider().createGenerator(writer)) {
      ((ElasticQueryBuilder) filter).build().serialize(generator, mapper);
    }
    return writer.toString();
  }

  private List<SubjectContext> subjects() {
    List<SubjectContext> subjects = new ArrayList<>();
    for (User user : List.of(owner, reader, stranger, admin)) {
      subjects.add(new SubjectContext(user, null));
    }
    subjects.add(null);
    return subjects;
  }

  private static List<ContextMemoryStatus> statuses(String selection) {
    return switch (selection) {
      case "Approved" -> List.of(ContextMemoryStatus.APPROVED);
      case "Pending" -> List.of(ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.DRAFT);
      default -> List.of(ContextMemoryStatus.values());
    };
  }

  private static User user(String name, boolean admin) {
    return new User().withId(UUID.randomUUID()).withName(name).withIsAdmin(admin);
  }

  private static EntityReference reference(String type) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type);
  }

  private static String description(SubjectContext subject, String selection) {
    return selection
        + " for "
        + (subject == null ? "unidentified caller" : subject.user().getName());
  }
}
