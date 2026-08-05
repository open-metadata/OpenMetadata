package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for GitHub issue #24180 — domain isolation for multi-tenant setups.
 *
 * <p>A user holding the seeded {@code DomainOnlyAccessRole} must only see lineage nodes within their
 * accessible domains (own domains, sub-domains, and domainless entities) and must only see their own
 * domains in domain listings/hierarchy/search. Admins and users without the role are unaffected.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
public class DomainIsolationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);

  @Test
  void test_lineage_restrictedUserSeesOnlyOwnDomainNodes(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain d1 = createDomain(admin, p + "_d1", cleanup);
      Domain d2 = createDomain(admin, p + "_d2", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);

      // Chain: t0(no domain) -> t1(d1) -> t2(d2) -> t3(d1)
      Table t0 = createTable(admin, p + "_t0", schema, null, cleanup);
      Table t1 = createTable(admin, p + "_t1", schema, d1, cleanup);
      Table t2 = createTable(admin, p + "_t2", schema, d2, cleanup);
      Table t3 = createTable(admin, p + "_t3", schema, d1, cleanup);
      addLineage(admin, t0, t1);
      addLineage(admin, t1, t2);
      addLineage(admin, t2, t3);

      String t1Fqn = t1.getFullyQualifiedName();
      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, d1, cleanup);

      // Wait until the admin view of the full chain is fully indexed before checking the prune.
      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Set<String> adminNodes = nodeFqns(searchLineage(admin, t1Fqn));
                assertTrue(
                    adminNodes.containsAll(
                        List.of(
                            t0.getFullyQualifiedName(),
                            t1Fqn,
                            t2.getFullyQualifiedName(),
                            t3.getFullyQualifiedName())),
                    "Admin should see the full lineage chain. Saw: " + adminNodes);
              });

      Set<String> restrictedNodes = nodeFqns(searchLineage(restricted, t1Fqn));
      assertTrue(restrictedNodes.contains(t1Fqn), "Restricted user sees own-domain root");
      assertTrue(
          restrictedNodes.contains(t0.getFullyQualifiedName()),
          "Restricted user sees domainless neighbor");
      assertFalse(
          restrictedNodes.contains(t2.getFullyQualifiedName()),
          "Restricted user must NOT see foreign-domain node t2");
      assertFalse(
          restrictedNodes.contains(t3.getFullyQualifiedName()),
          "Restricted user must NOT see t3 reachable only via foreign t2 (severed)");

      // DB-graph endpoint is filtered too.
      Set<String> dbGraphNodes = dbGraphNodeFqns(restricted, "table", t1.getId().toString());
      assertFalse(
          dbGraphNodes.contains(t2.getFullyQualifiedName()),
          "DB-graph lineage must NOT expose foreign-domain node");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_lineage_userWithoutRoleSeesFullChain(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain d1 = createDomain(admin, p + "_d1", cleanup);
      Domain d2 = createDomain(admin, p + "_d2", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table t1 = createTable(admin, p + "_t1", schema, d1, cleanup);
      Table t2 = createTable(admin, p + "_t2", schema, d2, cleanup);
      addLineage(admin, t1, t2);

      String t1Fqn = t1.getFullyQualifiedName();
      OpenMetadataClient plainUser = createPlainUserClient(admin, p, cleanup);

      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Set<String> nodes = nodeFqns(searchLineage(plainUser, t1Fqn));
                assertTrue(
                    nodes.contains(t1Fqn) && nodes.contains(t2.getFullyQualifiedName()),
                    "A user WITHOUT DomainOnlyAccessRole must see the full lineage. Saw: " + nodes);
              });
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_domainListing_restrictedUserSeesOnlyOwnDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain d1 = createDomain(admin, p + "_d1", cleanup);
      Domain d2 = createDomain(admin, p + "_d2", cleanup);
      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, d1, cleanup);

      Set<String> listNames = domainNames(restricted, "/v1/domains?limit=1000");
      assertTrue(listNames.contains(d1.getFullyQualifiedName()), "Own domain visible in list");
      assertFalse(listNames.contains(d2.getFullyQualifiedName()), "Foreign domain hidden in list");

      Set<String> hierarchyNames = hierarchyNames(restricted);
      assertTrue(hierarchyNames.contains(d1.getName()), "Own domain visible in hierarchy");
      assertFalse(hierarchyNames.contains(d2.getName()), "Foreign domain hidden in hierarchy");

      Set<String> adminList = domainNames(admin, "/v1/domains?limit=1000");
      assertTrue(
          adminList.contains(d1.getFullyQualifiedName())
              && adminList.contains(d2.getFullyQualifiedName()),
          "Admin sees all domains");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_domainSearch_restrictedUserSeesOnlyOwnDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain d1 = createDomain(admin, p + "_d1", cleanup);
      Domain d2 = createDomain(admin, p + "_d2", cleanup);
      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, d1, cleanup);

      // Domain-index search isolation is driven through search RBAC, which is gated on the global
      // enableAccessControl setting.
      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      String d2Fqn = d2.getFullyQualifiedName();
      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Set<String> searchNames = domainSearchFqns(restricted);
                assertTrue(
                    searchNames.contains(d1.getFullyQualifiedName()),
                    "Own domain visible in search. Saw: " + searchNames);
                assertFalse(
                    searchNames.contains(d2Fqn),
                    "Foreign domain hidden in search. Saw: " + searchNames);
              });
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Issue #30023 — a bot identity must be domain-scoped in search like any other non-admin subject.
   * A bot created with domains is given {@code DomainOnlyAccessRole} by the bot-creation flow, but
   * search RBAC used to skip every bot, so a bot-authenticated caller (how MCP clients normally
   * connect) read every domain.
   */
  @Test
  void test_botSearch_domainScopedBotSeesOnlyOwnDomain(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain d1 = createDomain(admin, p + "_d1", cleanup);
      Domain d2 = createDomain(admin, p + "_d2", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table own = createTable(admin, p + "_own", schema, d1, cleanup);
      Table foreign = createTable(admin, p + "_foreign", schema, d2, cleanup);

      OpenMetadataClient bot = createDomainScopedBotClient(admin, p, d1, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      String ownFqn = own.getFullyQualifiedName();
      String foreignFqn = foreign.getFullyQualifiedName();
      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Set<String> adminFqns = tableSearchFqns(admin, p);
                assertTrue(
                    adminFqns.containsAll(List.of(ownFqn, foreignFqn)),
                    "Admin should see both tables once indexed. Saw: " + adminFqns);
              });

      Set<String> botFqns = tableSearchFqns(bot, p);
      assertTrue(botFqns.contains(ownFqn), "Bot sees own-domain table. Saw: " + botFqns);
      assertFalse(
          botFqns.contains(foreignFqn), "Bot must NOT see foreign-domain table. Saw: " + botFqns);

      // A bot that was never declared domain-scoped keeps full visibility. Guards the regression
      // this fix has to avoid: a system bot's policy may grant only a resource-scoped ViewAll,
      // which
      // compiles to an _index filter that would zero out every unrelated search.
      Set<String> systemBotFqns = tableSearchFqns(SdkClients.ingestionBotClient(), p);
      assertTrue(
          systemBotFqns.containsAll(List.of(ownFqn, foreignFqn)),
          "A bot without DomainOnlyAccessRole must stay unfiltered. Saw: " + systemBotFqns);
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Issue #30023 — the lineage prune is gated on {@code DomainOnlyAccessRole} and used to skip bots,
   * so a domain-scoped bot could traverse into a domain that {@code authorize()} already refuses to
   * let it read directly. Unlike the search assertions above, this needs no search-RBAC setting: the
   * prune is unconditional for a subject holding the role.
   */
  @Test
  void test_botLineage_domainScopedBotSeesOnlyOwnDomainNodes(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain d1 = createDomain(admin, p + "_d1", cleanup);
      Domain d2 = createDomain(admin, p + "_d2", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table own = createTable(admin, p + "_own", schema, d1, cleanup);
      Table foreign = createTable(admin, p + "_foreign", schema, d2, cleanup);
      addLineage(admin, own, foreign);

      OpenMetadataClient bot = createDomainScopedBotClient(admin, p, d1, cleanup);

      String ownFqn = own.getFullyQualifiedName();
      String foreignFqn = foreign.getFullyQualifiedName();
      Awaitility.await()
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Set<String> adminNodes = nodeFqns(searchLineage(admin, ownFqn));
                assertTrue(
                    adminNodes.containsAll(List.of(ownFqn, foreignFqn)),
                    "Admin should see both lineage nodes once indexed. Saw: " + adminNodes);
              });

      Set<String> botNodes = nodeFqns(searchLineage(bot, ownFqn));
      assertTrue(botNodes.contains(ownFqn), "Bot sees own-domain root. Saw: " + botNodes);
      assertFalse(
          botNodes.contains(foreignFqn),
          "Bot must NOT see foreign-domain lineage node. Saw: " + botNodes);
    } finally {
      drain(cleanup);
    }
  }

  // Task /v1/tasks domain isolation is covered comprehensively by
  // TaskResourceIT.testDomainOnlyUserCanOnlyListTasksFromAllowedDomains (a domain-only user there
  // also carries a baseline role, which the bare DomainOnlyAccessRole strips). The UI task list is
  // additionally exercised by playwright DomainIsolation/DomainTaskIsolation.spec.ts.

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Domain isolation test domain");
    Domain domain = admin.domains().create(create);
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    return domain;
  }

  private DatabaseSchema createSchema(TestNamespace ns, Deque<Runnable> cleanup) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    cleanup.push(
        () ->
            SdkClients.adminClient()
                .databaseServices()
                .delete(
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private Table createTable(
      OpenMetadataClient admin,
      String name,
      DatabaseSchema schema,
      Domain domain,
      Deque<Runnable> cleanup) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(COLUMN));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    Table table = admin.tables().create(create);
    cleanup.push(() -> admin.tables().delete(table.getId()));
    return table;
  }

  private void addLineage(OpenMetadataClient admin, Table from, Table to) {
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference()));
    Awaitility.await("Add lineage edge")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              admin.lineage().addLineage(addLineage);
              return true;
            });
  }

  /**
   * Creates a bot user carrying {@code allowedDomain} and returns a client authenticated as it. Goes
   * through {@code PUT /v1/users} — the bot-creation flow that attaches {@code DomainOnlyAccessRole}
   * to a bot with domains — so the role wiring is exercised rather than assumed.
   */
  private OpenMetadataClient createDomainScopedBotClient(
      OpenMetadataClient admin, String prefix, Domain allowedDomain, Deque<Runnable> cleanup)
      throws Exception {
    String name = prefix + "_bot";
    String email = name + "@test.openmetadata.org";
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withIsBot(true)
            .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.JWT)
                    .withConfig(
                        new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));
    String created =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/users",
                MAPPER.writeValueAsString(request),
                RequestOptions.builder().build());
    JsonNode botUser = MAPPER.readTree(created);
    UUID botId = UUID.fromString(botUser.path("id").asText());
    cleanup.push(() -> admin.users().delete(botId));

    Set<String> roleNames = new HashSet<>();
    for (JsonNode role : botUser.path("roles")) {
      roleNames.add(role.path("name").asText());
    }
    assertTrue(
        roleNames.contains("DomainOnlyAccessRole"),
        "A bot with domains must be given DomainOnlyAccessRole. Roles: " + roleNames);

    return SdkClients.createClient(name, email, new String[] {"bot"});
  }

  private OpenMetadataClient createRestrictedUserClient(
      OpenMetadataClient admin, String prefix, Domain allowedDomain, Deque<Runnable> cleanup) {
    Role domainOnlyRole = admin.roles().getByName("DomainOnlyAccessRole");
    String name = prefix + "_restricted";
    String email = name + "@test.openmetadata.org";
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
            .withRoles(List.of(domainOnlyRole.getId()));
    org.openmetadata.schema.entity.teams.User user = admin.users().create(request);
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private OpenMetadataClient createPlainUserClient(
      OpenMetadataClient admin, String prefix, Deque<Runnable> cleanup) {
    String name = prefix + "_plain";
    String email = name + "@test.openmetadata.org";
    CreateUser request = new CreateUser().withName(name).withEmail(email);
    org.openmetadata.schema.entity.teams.User user = admin.users().create(request);
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private JsonNode searchLineage(OpenMetadataClient client, String fqn) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("fqn", fqn)
            .queryParam("upstreamDepth", "3")
            .queryParam("downstreamDepth", "3")
            .queryParam("includeDeleted", "false")
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/getLineage", null, options);
    return MAPPER.readTree(response);
  }

  private Set<String> nodeFqns(JsonNode lineage) {
    Set<String> fqns = new HashSet<>();
    JsonNode nodes = lineage.get("nodes");
    if (nodes != null) {
      nodes.fieldNames().forEachRemaining(fqns::add);
    }
    return fqns;
  }

  private Set<String> dbGraphNodeFqns(OpenMetadataClient client, String type, String id)
      throws Exception {
    String response = client.lineage().getEntityLineage(type, id, "3", "3");
    JsonNode lineage = MAPPER.readTree(response);
    Set<String> fqns = new HashSet<>();
    for (JsonNode node : lineage.path("nodes")) {
      if (node.hasNonNull("fullyQualifiedName")) {
        fqns.add(node.get("fullyQualifiedName").asText());
      }
    }
    return fqns;
  }

  private Set<String> domainNames(OpenMetadataClient client, String path) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    JsonNode root = MAPPER.readTree(response);
    Set<String> names = new HashSet<>();
    for (JsonNode domain : root.path("data")) {
      if (domain.hasNonNull("fullyQualifiedName")) {
        names.add(domain.get("fullyQualifiedName").asText());
      }
    }
    return names;
  }

  private Set<String> hierarchyNames(OpenMetadataClient client) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/domains/hierarchy?limit=1000",
                null,
                RequestOptions.builder().build());
    JsonNode root = MAPPER.readTree(response);
    Set<String> names = new HashSet<>();
    for (JsonNode domain : root.path("data")) {
      if (domain.hasNonNull("name")) {
        names.add(domain.get("name").asText());
      }
    }
    return names;
  }

  private Set<String> domainSearchFqns(OpenMetadataClient client) throws Exception {
    String response = client.search().query("*").index("domain_search_index").size(1000).execute();
    JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
    Set<String> fqns = new HashSet<>();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (source.hasNonNull("fullyQualifiedName")) {
        fqns.add(source.get("fullyQualifiedName").asText());
      }
    }
    return fqns;
  }

  /** FQNs of tables in this test's namespace, as the given client is allowed to see them. */
  private Set<String> tableSearchFqns(OpenMetadataClient client, String prefix) throws Exception {
    String response =
        client.search().query(prefix + "*").index("table_search_index").size(1000).execute();
    JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
    Set<String> fqns = new HashSet<>();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (source.hasNonNull("fullyQualifiedName")
          && source.get("fullyQualifiedName").asText().contains(prefix)) {
        fqns.add(source.get("fullyQualifiedName").asText());
      }
    }
    return fqns;
  }

  private boolean enableSearchAccessControl(OpenMetadataClient admin) throws Exception {
    String settingsJson =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    boolean original =
        Boolean.TRUE.equals(searchConfig.getGlobalSettings().getEnableAccessControl());
    searchConfig.getGlobalSettings().setEnableAccessControl(true);
    Settings updated =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(updated),
            RequestOptions.builder().build());
    return original;
  }

  private void restoreSearchAccessControl(OpenMetadataClient admin, boolean original) {
    if (!original) {
      try {
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
      } catch (Exception ignored) {
        // Best-effort restore.
      }
    }
  }

  private void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown; concurrent namespaces keep tests isolated regardless.
      }
    }
  }
}
