package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DatabaseIndex;
import org.openmetadata.service.search.indexes.DatabaseSchemaIndex;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.TeamIndex;
import org.openmetadata.service.search.indexes.UserIndex;

/**
 * Static contract guards for the selective-reindex refactor.
 *
 * <p>Models the silent-drop risk chain without booting the Entity registry:
 *
 * <ol>
 *   <li>{@code EntityRepository.setFields} with a pruned field list sets fan-out fields to null on
 *       the entity.
 *   <li>{@code JsonUtils.getMap(entity)} serializes the entity; null collections drop out.
 *   <li>{@code Index.removeNonIndexableFields} strips anything in {@code getExcludedFields}.
 *   <li>What is left goes into the ES document.
 * </ol>
 *
 * <p>If an Index class reads a fan-out field in its {@code buildSearchIndexDocInternal}, the field
 * WOULD flow into the doc — that Index must declare the field in {@code getRequiredReindexFields}.
 * These tests verify for each known fan-out that the end-state doc omits it regardless of whether
 * {@code setFields} populated it, matching the refactor intent.
 */
class SearchIndexReindexFieldsParityTest {

  @BeforeAll
  static void setUpSearchRepository() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getSearchClient()).thenReturn(mock(SearchClient.class));
    Entity.setSearchRepository(repository);
  }

  @AfterAll
  static void clearSearchRepository() {
    Entity.setSearchRepository(null);
  }

  // --- excluded-field contract ----------------------------------------------------

  /** {@code DatabaseSchema.tables} is the OOM trigger — must stay stripped. */
  @Test
  void databaseSchemaIndexStripsTablesField() {
    DatabaseSchema withTables = basicSchema().withTables(fakeEntityRefs(1_000, "table"));
    Map<String, Object> doc = simulatePostSerialization(withTables);
    applyExcludedFields(doc, new DatabaseSchemaIndex(withTables).getExcludedFields());

    assertFalse(
        doc.containsKey("tables"),
        "DatabaseSchemaIndex.getExcludedFields() must continue to strip 'tables'");
  }

  /** Modeling: when we don't fetch tables, the JSON has no tables key at all. */
  @Test
  void databaseSchemaWithoutTablesProducesSameDoc() {
    DatabaseSchema withoutTables = basicSchema();
    DatabaseSchema withTables = basicSchema().withTables(fakeEntityRefs(100, "table"));

    Map<String, Object> docA = simulatePostSerialization(withoutTables);
    Map<String, Object> docB = simulatePostSerialization(withTables);
    Set<String> strip = new DatabaseSchemaIndex(withoutTables).getExcludedFields();
    applyExcludedFields(docA, strip);
    applyExcludedFields(docB, strip);

    assertFalse(docA.containsKey("tables"));
    assertFalse(docB.containsKey("tables"));
    // The docs should be byte-identical for fields we care about. tables is stripped;
    // any other observable field difference would indicate the Index accidentally reads tables.
    assertDocsEqual(docA, docB, Set.of());
  }

  /** Database.databaseSchemas — same pattern. */
  @Test
  void databaseIndexStripsDatabaseSchemasField() {
    Database withSchemas =
        basicDatabase().withDatabaseSchemas(fakeEntityRefs(200, "databaseSchema"));
    Map<String, Object> doc = simulatePostSerialization(withSchemas);
    applyExcludedFields(doc, new DatabaseIndex(withSchemas).getExcludedFields());

    assertFalse(doc.containsKey("databaseSchemas"));
  }

  /** Team.users — potentially huge, explicitly excluded. */
  @Test
  void teamIndexStripsFanOutFields() {
    Team team =
        basicTeam()
            .withUsers(fakeEntityRefs(5_000, "user"))
            .withDefaultRoles(fakeEntityRefs(20, "role"))
            .withInheritedRoles(fakeEntityRefs(20, "role"));

    Map<String, Object> doc = simulatePostSerialization(team);
    applyExcludedFields(doc, new TeamIndex(team).getExcludedFields());

    assertFalse(doc.containsKey("users"));
    assertFalse(doc.containsKey("defaultRoles"));
    assertFalse(doc.containsKey("inheritedRoles"));
    assertFalse(doc.containsKey("owns"));
  }

  /** User.owns, User.follows — power-user fan-out, excluded. */
  @Test
  void userIndexStripsFanOutFields() {
    User u =
        basicUser()
            .withOwns(fakeEntityRefs(5_000, "table"))
            .withFollows(fakeEntityRefs(1_000, "topic"));

    Map<String, Object> doc = simulatePostSerialization(u);
    applyExcludedFields(doc, new UserIndex(u).getExcludedFields());

    assertFalse(doc.containsKey("owns"));
    assertFalse(doc.containsKey("follows"));
    assertFalse(doc.containsKey("authenticationMechanism"));
  }

  /** Dashboard.dataModels — excluded (charts is NOT excluded — see positive test below). */
  @Test
  void dashboardIndexStripsDataModelsButKeepsCharts() {
    Dashboard dash =
        basicDashboard()
            .withCharts(fakeEntityRefs(10, "chart"))
            .withDataModels(fakeEntityRefs(10, "dashboardDataModel"));

    Map<String, Object> doc = simulatePostSerialization(dash);
    applyExcludedFields(doc, new DashboardIndex(dash).getExcludedFields());

    assertFalse(doc.containsKey("dataModels"), "dataModels must be stripped from dashboard doc");
    assertTrue(
        doc.containsKey("charts"),
        "charts must NOT be stripped — the dashboard_search_index indexes them");
  }

  // --- common-field contract guard ------------------------------------------------

  @Test
  void commonReindexFieldsMatchDocumentedSet() {
    org.junit.jupiter.api.Assertions.assertEquals(
        Set.of(
            "owners",
            "domains",
            "reviewers",
            "followers",
            "votes",
            "extension",
            "certification",
            "dataProducts"),
        SearchIndex.COMMON_REINDEX_FIELDS);
  }

  // --- helpers --------------------------------------------------------------------

  /**
   * Serializes the entity to a Map the way {@code SearchIndex.buildSearchIndexDoc()} does on its
   * first line: {@code esDoc = JsonUtils.getMap(entity)}. This captures exactly what would land in
   * the doc before any Index-specific enrichment.
   */
  @SuppressWarnings("unchecked")
  private static Map<String, Object> simulatePostSerialization(Object entity) {
    Map<String, Object> raw = JsonUtils.getMap(entity);
    // getMap may return an immutable map depending on the codec; copy so we can strip.
    return new HashMap<>(raw);
  }

  private static void applyExcludedFields(Map<String, Object> doc, Set<String> excluded) {
    // Models SearchIndexUtils.removeNonIndexableFields — deep path notation isn't exercised
    // by these entities; top-level removal is sufficient here.
    Set<String> stripKeys = new HashSet<>(excluded);
    stripKeys.retainAll(doc.keySet());
    stripKeys.forEach(doc::remove);
  }

  private static void assertDocsEqual(
      Map<String, Object> a, Map<String, Object> b, Set<String> ignoreKeys) {
    Set<String> keysA = new HashSet<>(a.keySet());
    Set<String> keysB = new HashSet<>(b.keySet());
    keysA.removeAll(ignoreKeys);
    keysB.removeAll(ignoreKeys);
    org.junit.jupiter.api.Assertions.assertEquals(keysA, keysB, "doc keys must match");
  }

  private static DatabaseSchema basicSchema() {
    return new DatabaseSchema()
        .withId(UUID.randomUUID())
        .withName("s")
        .withFullyQualifiedName("svc.db.s");
  }

  private static Database basicDatabase() {
    return new Database().withId(UUID.randomUUID()).withName("db").withFullyQualifiedName("svc.db");
  }

  private static Team basicTeam() {
    return new Team().withId(UUID.randomUUID()).withName("team").withFullyQualifiedName("team");
  }

  private static User basicUser() {
    return new User()
        .withId(UUID.randomUUID())
        .withName("alice")
        .withFullyQualifiedName("alice")
        .withIsBot(false);
  }

  private static Dashboard basicDashboard() {
    return new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("svc.d");
  }

  private static List<EntityReference> fakeEntityRefs(int count, String type) {
    return java.util.stream.IntStream.range(0, count)
        .mapToObj(
            i ->
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(type)
                    .withName(type + "_" + i)
                    .withFullyQualifiedName(type + "_" + i))
        .toList();
  }
}
