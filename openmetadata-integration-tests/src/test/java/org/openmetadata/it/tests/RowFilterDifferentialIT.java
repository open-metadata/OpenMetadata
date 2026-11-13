package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.listaccess.ListAccess;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * For every type whose rows SQL filters, a listing names exactly the rows that the item endpoint
 * lets the same caller read, and counts exactly those
 * (ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies). Each type
 * has rows whose owner and domain are the row's own, inherited from a parent and absent, and rows
 * a rule refuses.
 *
 * <p>The count of a listing covers every row of the type, so a row another class creates between
 * two reads would change it. The class is {@code @Isolated}: JUnit runs no other test class beside
 * it, and the fixture is built once for all cases.
 */
@Isolated("Compares a listing's total with every row of the type, which other classes would change")
public class RowFilterDifferentialIT {
  private static final Logger LOG = LoggerFactory.getLogger(RowFilterDifferentialIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int PAGE_SIZE = 25;
  private static final int UNIVERSE_PAGE_SIZE = 1000;
  private static final int MAX_PAGES = 10_000;
  // A team policy reaches callers outside the team through a snapshot that a team change replaces.
  private static final Duration TEAM_POLICY_REFRESH = Duration.ofSeconds(30);

  /**
   * Types whose owners or domains SQL does not compute. Their listing checks each row after the
   * query, so it names the right rows while its total counts every row the query selects.
   */
  private static final Set<String> TOTAL_COUNTS_UNCHECKED_ROWS =
      Set.of(
          Entity.USER + "/" + Scenario.DOMAIN,
          Entity.DOMAIN + "/" + Scenario.OWNER,
          Entity.DOMAIN + "/" + Scenario.TEAM_MEMBER,
          Entity.DOMAIN + "/" + Scenario.TEAM_OUTSIDER);

  /** A user owns itself, and a team's rules refuse only rows a team owns, so no user row is refused. */
  private static final Set<String> NOTHING_TO_REFUSE =
      Set.of(Entity.USER + "/" + Scenario.TEAM_OUTSIDER);

  private static final Map<String, String> COLLECTIONS =
      Map.ofEntries(
          Map.entry(Entity.DATABASE_SERVICE, "/v1/services/databaseServices"),
          Map.entry(Entity.DASHBOARD_SERVICE, "/v1/services/dashboardServices"),
          Map.entry(Entity.PIPELINE_SERVICE, "/v1/services/pipelineServices"),
          Map.entry(Entity.MESSAGING_SERVICE, "/v1/services/messagingServices"),
          Map.entry(Entity.MLMODEL_SERVICE, "/v1/services/mlmodelServices"),
          Map.entry(Entity.STORAGE_SERVICE, "/v1/services/storageServices"),
          Map.entry(Entity.SEARCH_SERVICE, "/v1/services/searchServices"),
          Map.entry(Entity.API_SERVICE, "/v1/services/apiServices"),
          Map.entry(Entity.GLOSSARY, "/v1/glossaries"),
          Map.entry(Entity.CLASSIFICATION, "/v1/classifications"),
          Map.entry(Entity.DATABASE, "/v1/databases"),
          Map.entry(Entity.DATABASE_SCHEMA, "/v1/databaseSchemas"),
          Map.entry(Entity.TABLE, "/v1/tables"),
          Map.entry(Entity.STORED_PROCEDURE, "/v1/storedProcedures"),
          Map.entry(Entity.DASHBOARD, "/v1/dashboards"),
          Map.entry(Entity.CHART, "/v1/charts"),
          Map.entry(Entity.DASHBOARD_DATA_MODEL, "/v1/dashboard/datamodels"),
          Map.entry(Entity.PIPELINE, "/v1/pipelines"),
          Map.entry(Entity.TOPIC, "/v1/topics"),
          Map.entry(Entity.MLMODEL, "/v1/mlmodels"),
          Map.entry(Entity.CONTAINER, "/v1/containers"),
          Map.entry(Entity.SEARCH_INDEX, "/v1/searchIndexes"),
          Map.entry(Entity.API_COLLECTION, "/v1/apiCollections"),
          Map.entry(Entity.API_ENDPOINT, "/v1/apiEndpoints"),
          Map.entry(Entity.USER, "/v1/users"),
          Map.entry(Entity.DOMAIN, "/v1/domains"));

  /** The three conditions the cases exercise, and the caller each one is checked as. */
  enum Scenario {
    OWNER("!isOwner()"),
    DOMAIN("!hasDomain()"),
    TEAM_MEMBER("!matchTeam()"),
    TEAM_OUTSIDER("!matchTeam()");

    private final String condition;

    Scenario(String condition) {
      this.condition = condition;
    }
  }

  private record Row(String type, UUID id, String fqn, String name) {}

  /** The owner and domain a row is created with; either may be absent. */
  private record Own(ObjectNode owner, String domain) {}

  private record Caller(String name, OpenMetadataClient client) {}

  private record Ref(UUID id, String type) {
    ObjectNode json() {
      return MAPPER.createObjectNode().put("id", id.toString()).put("type", type);
    }
  }

  /** How to create a row that inherits from a parent row. */
  private record Child(
      String type,
      String path,
      String parentField,
      boolean inheritsOwners,
      Consumer<ObjectNode> required) {}

  private static final Child DATABASE =
      new Child(Entity.DATABASE, "/v1/databases", "service", false, body -> {});
  private static final Child SCHEMA =
      new Child(Entity.DATABASE_SCHEMA, "/v1/databaseSchemas", "database", true, body -> {});
  private static final Child TABLE =
      new Child(
          Entity.TABLE,
          "/v1/tables",
          "databaseSchema",
          true,
          body ->
              body.putArray("columns")
                  .add(MAPPER.createObjectNode().put("name", "id").put("dataType", "INT")));
  private static final Child STORED_PROCEDURE =
      new Child(
          Entity.STORED_PROCEDURE,
          "/v1/storedProcedures",
          "databaseSchema",
          true,
          body ->
              body.set(
                  "storedProcedureCode",
                  MAPPER.createObjectNode().put("code", "select 1").put("language", "SQL")));
  private static final Child DASHBOARD =
      new Child(Entity.DASHBOARD, "/v1/dashboards", "service", false, body -> {});
  private static final Child CHART =
      new Child(Entity.CHART, "/v1/charts", "service", false, body -> {});
  private static final Child DATA_MODEL =
      new Child(
          Entity.DASHBOARD_DATA_MODEL,
          "/v1/dashboard/datamodels",
          "service",
          false,
          body -> {
            body.put("dataModelType", "MetabaseDataModel");
            body.putArray("columns")
                .add(MAPPER.createObjectNode().put("name", "id").put("dataType", "INT"));
          });
  private static final Child PIPELINE =
      new Child(Entity.PIPELINE, "/v1/pipelines", "service", false, body -> {});
  private static final Child TOPIC =
      new Child(Entity.TOPIC, "/v1/topics", "service", false, body -> body.put("partitions", 1));
  private static final Child MLMODEL =
      new Child(Entity.MLMODEL, "/v1/mlmodels", "service", false, body -> {});
  private static final Child CONTAINER =
      new Child(Entity.CONTAINER, "/v1/containers", "service", false, body -> {});
  private static final Child SEARCH_INDEX =
      new Child(
          Entity.SEARCH_INDEX,
          "/v1/searchIndexes",
          "service",
          false,
          body ->
              body.putArray("fields")
                  .add(MAPPER.createObjectNode().put("name", "title").put("dataType", "TEXT")));
  private static final Child API_COLLECTION =
      new Child(
          Entity.API_COLLECTION,
          "/v1/apiCollections",
          "service",
          false,
          body -> body.put("endpointURL", "http://localhost:8585/api"));
  private static final Child API_ENDPOINT =
      new Child(Entity.API_ENDPOINT, "/v1/apiEndpoints", "apiCollection", true, body -> {});

  private static TestNamespace ns;
  private static Fixture fixture;

  @BeforeAll
  static void buildFixture() {
    ns = new TestNamespace("RowFilterDifferentialIT");
    ns.setMethodId("fixture");
    fixture = new Fixture(ns).build();
  }

  @AfterAll
  static void deleteFixture() {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  static Stream<Arguments> cases() {
    return new TreeSet<>(ListAccess.coveredTypes())
        .stream()
            .flatMap(type -> Stream.of(Scenario.values()).map(rule -> Arguments.of(type, rule)));
  }

  @Test
  void everyTypeTheListingFiltersInSqlHasAFixture() {
    Set<String> declared = ListAccess.coveredTypes();

    assertEquals(
        new TreeSet<>(declared),
        new TreeSet<>(fixture.rowsByType.keySet()),
        "add a fixture to RowFilterDifferentialIT for each declared type, and a collection path");
    declared.forEach(type -> assertTrue(COLLECTIONS.containsKey(type), "no list path: " + type));
  }

  @ParameterizedTest(name = "{0} {1}")
  @MethodSource("cases")
  void aListingNamesExactlyTheRowsItsItemEndpointReads(String type, Scenario rule)
      throws Exception {
    assertTrue(fixture.rowsByType.containsKey(type), "no fixture for declared type " + type);
    assertFalse(fixture.rowsByType.get(type).isEmpty(), "no rows in the fixture of " + type);
    Caller caller = fixture.callers.get(rule);
    String collection = COLLECTIONS.get(type);

    Map<UUID, String> everyRow = adminListing(collection);
    Set<String> readable = rowsReadAs(caller, collection, everyRow);
    Set<String> mineReadable = mine(type, readable);
    Set<String> mineRefused = mine(type, new HashSet<>(everyRow.values()));
    mineRefused.removeAll(mineReadable);
    Listed listed = listAll(caller, collection);

    assertEquals(
        new TreeSet<>(readable),
        new TreeSet<>(listed.forward()),
        "forward cursors list the rows the item endpoint reads");
    assertEquals(readable.size(), listed.forward().size(), "a row came back on two pages");
    assertEquals(
        new TreeSet<>(readable),
        new TreeSet<>(listed.viaBefore()),
        "backward cursors list the same rows");
    if (TOTAL_COUNTS_UNCHECKED_ROWS.contains(type + "/" + rule)) {
      listed.totals().forEach(total -> assertTrue(total >= readable.size(), "total " + total));
    } else {
      assertEquals(Set.of(readable.size()), new HashSet<>(listed.totals()), "paging.total");
    }
    assertFalse(mineReadable.isEmpty(), type + " has no row the " + rule + " caller reads");
    if (!NOTHING_TO_REFUSE.contains(type + "/" + rule)) {
      assertFalse(mineRefused.isEmpty(), type + " has no row the " + rule + " caller is refused");
    }
  }

  private static Set<String> mine(String type, Set<String> fqns) {
    Set<String> own =
        fixture.rowsByType.get(type).stream().map(Row::fqn).collect(Collectors.toSet());
    return fqns.stream().filter(own::contains).collect(Collectors.toCollection(TreeSet::new));
  }

  /** Every row of the type as the administrator sees it, by id. */
  private static Map<UUID, String> adminListing(String collection) throws Exception {
    Map<UUID, String> rows = new LinkedHashMap<>();
    String after = null;
    int pages = 0;
    do {
      JsonNode page = get(SdkClients.adminClient(), pageUrl(collection, UNIVERSE_PAGE_SIZE, after));
      page.path("data")
          .forEach(
              row ->
                  rows.put(
                      UUID.fromString(row.path("id").asText()),
                      row.path("fullyQualifiedName").asText()));
      after = page.path("paging").path("after").asText(null);
      assertTrue(++pages < MAX_PAGES);
    } while (after != null);
    return rows;
  }

  private static Set<String> rowsReadAs(Caller caller, String collection, Map<UUID, String> rows) {
    return rows.entrySet().parallelStream()
        .filter(row -> canRead(caller, collection, row.getKey()))
        .map(Map.Entry::getValue)
        .collect(Collectors.toCollection(TreeSet::new));
  }

  private static boolean canRead(Caller caller, String collection, UUID id) {
    boolean readable = true;
    try {
      get(caller.client(), collection + "/" + id);
    } catch (ForbiddenException refused) {
      readable = false;
    } catch (Exception e) {
      throw new IllegalStateException("GET " + collection + "/" + id, e);
    }
    return readable;
  }

  /** What a caller's listing returned, walked forward by `after` and then backward by `before`. */
  private record Listed(List<String> forward, List<String> viaBefore, List<Integer> totals) {}

  private static Listed listAll(Caller caller, String collection) throws Exception {
    List<String> forward = new ArrayList<>();
    List<Integer> totals = new ArrayList<>();
    List<String> lastPage = new ArrayList<>();
    String before = null;
    String after = null;
    int pages = 0;
    try {
      do {
        JsonNode page = get(caller.client(), pageUrl(collection, PAGE_SIZE, after));
        lastPage = names(page);
        forward.addAll(lastPage);
        totals.add(page.path("paging").path("total").asInt(-1));
        before = page.path("paging").path("before").asText(null);
        after = page.path("paging").path("after").asText(null);
        assertTrue(lastPage.size() <= PAGE_SIZE, "page of " + lastPage.size());
        assertTrue(++pages < MAX_PAGES);
      } while (after != null);
    } catch (ForbiddenException refused) {
      return new Listed(List.of(), List.of(), List.of(0));
    }
    List<String> viaBefore = new ArrayList<>(lastPage);
    while (before != null) {
      JsonNode page =
          get(
              caller.client(),
              collection
                  + "?limit="
                  + PAGE_SIZE
                  + "&before="
                  + URLEncoder.encode(before, StandardCharsets.UTF_8));
      viaBefore.addAll(names(page));
      totals.add(page.path("paging").path("total").asInt(-1));
      before = page.path("paging").path("before").asText(null);
      assertTrue(++pages < MAX_PAGES);
    }
    return new Listed(forward, viaBefore, totals);
  }

  private static String pageUrl(String collection, int limit, String after) {
    return collection
        + "?limit="
        + limit
        + (after == null ? "" : "&after=" + URLEncoder.encode(after, StandardCharsets.UTF_8));
  }

  private static List<String> names(JsonNode page) {
    List<String> names = new ArrayList<>();
    page.path("data").forEach(row -> names.add(row.path("fullyQualifiedName").asText()));
    return names;
  }

  private static JsonNode get(OpenMetadataClient client, String path) throws Exception {
    return JsonUtils.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

  /**
   * Every type gets eight rows for the owner and domain combinations in {@link #profiles()}, and
   * the types that inherit get one row per parent with nothing of its own, plus two that override
   * the parent. The values are the row's own, inherited from a parent, or absent.
   */
  private static final class Fixture {
    private static final Set<String> TYPES = new TreeSet<>(ListAccess.coveredTypes());

    private final TestNamespace ns;
    private final OpenMetadataClient admin = SdkClients.adminClient();
    private final Map<String, List<Row>> rowsByType = new LinkedHashMap<>();
    private final Map<Scenario, Caller> callers = new LinkedHashMap<>();
    private final Map<String, UUID> domainIds = new LinkedHashMap<>();
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private Ref callerUser;
    private Ref callerTeam;
    private Ref group;
    private Ref groupMember;
    private Ref otherUser;
    private String domain;
    private String subDomain;
    private String otherDomain;
    private List<Own> profiles;
    private Row sentinel;

    Fixture(TestNamespace ns) {
      this.ns = ns;
    }

    Fixture build() {
      domain = domain("finance", null);
      subDomain = domain("payroll", domain);
      otherDomain = domain("sales", null);
      Ref department = team("department", "Department", null);
      group = team("group", "Group", department.id());
      callerTeam = team("callerTeam", "Group", null);
      attachTeamPolicy(department.id());
      callerUser = user("owner", List.of(callerTeam.id()), null, role(Scenario.OWNER));
      groupMember = user("groupMember", List.of(group.id()), null, null);
      otherUser = user("other", List.of(), null, null);
      profiles = profiles();
      callers.put(Scenario.OWNER, caller(callerUser));
      callers.put(
          Scenario.DOMAIN, caller(user("domainCaller", List.of(), domain, role(Scenario.DOMAIN))));
      callers.put(
          Scenario.TEAM_MEMBER, caller(user("teamMember", List.of(group.id()), null, null)));
      callers.put(Scenario.TEAM_OUTSIDER, caller(user("outsider", List.of(), null, null)));
      rootTypes();
      databaseChain();
      siblingServices();
      users();
      awaitTeamPolicy();
      return this;
    }

    /** Owner and domain combinations: the caller, its team, a team under the department, and so on. */
    private List<Own> profiles() {
      ObjectNode caller = callerUser.json();
      ObjectNode callersTeam = callerTeam.json();
      ObjectNode groupOwner = group.json();
      ObjectNode member = groupMember.json();
      ObjectNode other = otherUser.json();
      return List.of(
          new Own(caller, domain),
          new Own(callersTeam, subDomain),
          new Own(groupOwner, otherDomain),
          new Own(member, null),
          new Own(other, domain),
          new Own(null, otherDomain),
          new Own(null, null),
          new Own(other, otherDomain));
    }

    private void rootTypes() {
      for (int k = 0; k < profiles.size(); k++) {
        Own own = profiles.get(k);
        ObjectNode glossary = named(ns.prefix("glossary" + k), own).put("description", "d");
        record(Entity.GLOSSARY, root(Entity.GLOSSARY, "/v1/glossaries", glossary));
        ObjectNode classification =
            named(ns.prefix("classification" + k), own).put("description", "d");
        record(
            Entity.CLASSIFICATION,
            root(Entity.CLASSIFICATION, "/v1/classifications", classification));
        ObjectNode owned = named(ns.prefix("owned" + k), new Own(own.owner(), null));
        record(Entity.DOMAIN, root(Entity.DOMAIN, "/v1/domains", domainBody(owned, null)));
      }
    }

    private void databaseChain() {
      List<Row> services =
          services(
              Entity.DATABASE_SERVICE,
              k ->
                  created(
                      DatabaseServiceTestFactory.createPostgresWithName(
                          "rfd_" + suffix + "_" + k, ns)),
              "/v1/services/databaseServices");
      List<Row> databases = children(DATABASE, services);
      List<Row> schemas = children(SCHEMA, databases);
      children(TABLE, schemas);
      children(STORED_PROCEDURE, schemas);
    }

    private void siblingServices() {
      List<Row> dashboards =
          services(
              Entity.DASHBOARD_SERVICE,
              k -> created(DashboardServiceTestFactory.createMetabase(ns)),
              "/v1/services/dashboardServices");
      List.of(DASHBOARD, CHART, DATA_MODEL).forEach(child -> children(child, dashboards));
      children(
          PIPELINE,
          services(
              Entity.PIPELINE_SERVICE,
              k -> created(PipelineServiceTestFactory.createAirflow(ns)),
              "/v1/services/pipelineServices"));
      children(
          TOPIC,
          services(
              Entity.MESSAGING_SERVICE,
              k -> created(MessagingServiceTestFactory.createKafka(ns)),
              "/v1/services/messagingServices"));
      children(
          MLMODEL,
          services(
              Entity.MLMODEL_SERVICE,
              k -> created(MlModelServiceTestFactory.createMlflow(ns)),
              "/v1/services/mlmodelServices"));
      children(
          CONTAINER,
          services(
              Entity.STORAGE_SERVICE,
              k -> created(StorageServiceTestFactory.createS3(ns)),
              "/v1/services/storageServices"));
      children(
          SEARCH_INDEX,
          services(
              Entity.SEARCH_SERVICE,
              k -> created(SearchServiceTestFactory.createElasticSearch(ns)),
              "/v1/services/searchServices"));
      List<Row> apiServices =
          services(
              Entity.API_SERVICE,
              k -> created(APIServiceTestFactory.createRest(ns)),
              "/v1/services/apiServices");
      children(API_ENDPOINT, children(API_COLLECTION, apiServices));
    }

    private void users() {
      for (int k = 0; k < profiles.size(); k++) {
        List<UUID> teams =
            k % 3 == 0 ? List.of(group.id()) : k % 3 == 1 ? List.of(callerTeam.id()) : List.of();
        user("profile" + k, teams, profiles.get(k).domain(), null);
      }
      Ref leaver = user("leaver", List.of(group.id()), domain, null);
      admin.users().delete(leaver.id());
    }

    /** Creates the eight rows of a service type, each with the owner and domain of one profile. */
    private List<Row> services(String type, Function<Integer, Created> make, String path) {
      List<Row> rows = new ArrayList<>();
      for (int k = 0; k < profiles.size(); k++) {
        Created created = make.apply(k);
        Row row = new Row(type, created.id(), created.fqn(), created.name());
        patchOwnership(path, row, profiles.get(k));
        record(type, row);
        rows.add(row);
      }
      return rows;
    }

    /**
     * One row per parent that inherits what its type inherits, and two rows that override their
     * parent. The first eight rows are returned, as the parents of the next level.
     */
    private List<Row> children(Child spec, List<Row> parents) {
      List<Row> rows = new ArrayList<>();
      for (int k = 0; k < parents.size(); k++) {
        Own own = spec.inheritsOwners() ? null : new Own(profiles.get(k).owner(), null);
        rows.add(child(spec, "inherits_" + k, parents.get(k), own));
      }
      Own overridesDomainAndOwner = new Own(profiles.get(0).owner(), domain);
      Own overridesOther = new Own(profiles.get(4).owner(), otherDomain);
      List<Row> overrides =
          List.of(
              child(spec, "overrides_a", parents.get(5), overridesDomainAndOwner),
              child(spec, "overrides_b", parents.get(0), overridesOther));
      rows.forEach(row -> record(spec.type(), row));
      overrides.forEach(row -> record(spec.type(), row));
      return rows;
    }

    private Row child(Child spec, String name, Row parent, Own own) {
      ObjectNode body = named(name, own);
      body.put(spec.parentField(), parent.fqn());
      spec.required().accept(body);
      return row(spec.type(), post(spec.path(), body));
    }

    private Row root(String type, String path, ObjectNode body) {
      Row row = row(type, post(path, body));
      ns.trackRoot(type, row.id());
      return row;
    }

    private void record(String type, Row row) {
      rowsByType.computeIfAbsent(type, ignored -> new ArrayList<>()).add(row);
    }

    private static Row row(String type, JsonNode json) {
      return new Row(
          type,
          UUID.fromString(json.path("id").asText()),
          json.path("fullyQualifiedName").asText(),
          json.path("name").asText());
    }

    private ObjectNode named(String name, Own own) {
      ObjectNode body = MAPPER.createObjectNode().put("name", name);
      if (own != null && own.owner() != null) {
        body.putArray("owners").add(own.owner());
      }
      if (own != null && own.domain() != null) {
        body.putArray("domains").add(own.domain());
      }
      return body;
    }

    private void patchOwnership(String path, Row row, Own own) {
      ArrayNode operations = MAPPER.createArrayNode();
      if (own.owner() != null) {
        operations.add(add("/owners", MAPPER.createArrayNode().add(own.owner())));
      }
      if (own.domain() != null) {
        ObjectNode ref =
            MAPPER
                .createObjectNode()
                .put("id", domainIds.get(own.domain()).toString())
                .put("type", Entity.DOMAIN);
        operations.add(add("/domains", MAPPER.createArrayNode().add(ref)));
      }
      if (!operations.isEmpty()) {
        send(HttpMethod.PATCH, path + "/" + row.id(), operations);
      }
    }

    private static ObjectNode add(String path, JsonNode value) {
      ObjectNode operation = MAPPER.createObjectNode().put("op", "add").put("path", path);
      operation.set("value", value);
      return operation;
    }

    private JsonNode post(String path, ObjectNode body) {
      return send(HttpMethod.POST, path, body);
    }

    private JsonNode send(HttpMethod method, String path, JsonNode body) {
      try {
        return JsonUtils.readTree(admin.getHttpClient().executeForString(method, path, body));
      } catch (Exception e) {
        throw new IllegalStateException(method + " " + path + " " + body, e);
      }
    }

    private String domain(String name, String parent) {
      ObjectNode body = domainBody(MAPPER.createObjectNode().put("name", ns.prefix(name)), parent);
      JsonNode created = post("/v1/domains", body);
      if (parent == null) {
        ns.trackRoot(Entity.DOMAIN, UUID.fromString(created.path("id").asText()));
      }
      String fqn = created.path("fullyQualifiedName").asText();
      domainIds.put(fqn, UUID.fromString(created.path("id").asText()));
      record(Entity.DOMAIN, row(Entity.DOMAIN, created));
      return fqn;
    }

    private static ObjectNode domainBody(ObjectNode body, String parent) {
      body.put("description", "Domain for row filter tests").put("domainType", "Aggregate");
      if (parent != null) {
        body.put("parent", parent);
      }
      return body;
    }

    private Ref team(String name, String type, UUID parent) {
      ObjectNode body =
          MAPPER.createObjectNode().put("name", ns.prefix(name)).put("teamType", type);
      if (parent != null) {
        body.putArray("parents").add(parent.toString());
      }
      JsonNode created = post("/v1/teams", body);
      UUID id = UUID.fromString(created.path("id").asText());
      ns.trackRoot(Entity.TEAM, id);
      return new Ref(id, Entity.TEAM);
    }

    private void attachTeamPolicy(UUID team) {
      Policy policy = denyPolicy("teamOnly", Scenario.TEAM_MEMBER.condition);
      ArrayNode ref =
          MAPPER
              .createArrayNode()
              .add(
                  MAPPER
                      .createObjectNode()
                      .put("id", policy.getId().toString())
                      .put("type", "policy"));
      send(
          HttpMethod.PATCH,
          "/v1/teams/" + team,
          MAPPER.createArrayNode().add(add("/policies", ref)));
    }

    private Policy denyPolicy(String name, String condition) {
      Rule deny =
          new Rule()
              .withName("deny")
              .withResources(new ArrayList<>(TYPES))
              .withOperations(List.of(MetadataOperation.ALL))
              .withEffect(Rule.Effect.DENY)
              .withCondition(condition);
      return ns.trackRoot(
          Entity.POLICY,
          admin
              .policies()
              .create(
                  new CreatePolicy()
                      .withName(ns.prefix(name))
                      .withDescription("Refuses the rows the condition names")
                      .withRules(List.of(deny))));
    }

    private Role role(Scenario scenario) {
      Policy policy = denyPolicy(scenario.name() + "Policy", scenario.condition);
      return ns.trackRoot(
          Entity.ROLE,
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName(ns.prefix(scenario.name() + "Role"))
                      .withDescription("Refuses the rows the condition names")
                      .withPolicies(List.of(policy.getFullyQualifiedName()))));
    }

    private Ref user(String label, List<UUID> teams, String domainFqn, Role role) {
      String name = "rfd_" + label + "_" + suffix;
      ObjectNode body =
          MAPPER.createObjectNode().put("name", name).put("email", name + "@test.openmetadata.org");
      ArrayNode teamIds = body.putArray("teams");
      teams.forEach(team -> teamIds.add(team.toString()));
      if (domainFqn != null) {
        body.putArray("domains").add(domainFqn);
      }
      if (role != null) {
        body.putArray("roles").add(role.getId().toString());
      }
      Row row = root(Entity.USER, "/v1/users", body);
      record(Entity.USER, row);
      return new Ref(row.id(), Entity.USER);
    }

    private Caller caller(Ref user) {
      String email = admin.users().get(user.id().toString()).getEmail();
      return new Caller(email, SdkClients.createClient(email, email, new String[] {}));
    }

    /** Waits until the outsider is refused a row the department's team policy refuses it. */
    private void awaitTeamPolicy() {
      sentinel = rowsByType.get(Entity.DATABASE_SERVICE).get(2);
      Caller outsider = callers.get(Scenario.TEAM_OUTSIDER);
      long started = System.nanoTime();
      Awaitility.await()
          .atMost(TEAM_POLICY_REFRESH)
          .pollInterval(Duration.ofMillis(250))
          .until(() -> !canRead(outsider, COLLECTIONS.get(Entity.DATABASE_SERVICE), sentinel.id()));
      LOG.info(
          "team policy reached the outsider after {} ms",
          (System.nanoTime() - started) / 1_000_000);
    }
  }

  /** A service as a factory created it. */
  private record Created(UUID id, String fqn, String name) {}

  private static Created created(EntityInterface<?> service) {
    return new Created(service.getId(), service.getFullyQualifiedName(), service.getName());
  }
}
