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
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
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
