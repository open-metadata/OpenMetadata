package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration test for GitHub Issue #26381: hasDomain() search filter AND/OR logic bug.
 *
 * <p>When a group (team) is assigned to multiple domains and a policy using the hasDomain()
 * condition is applied, users should be able to see assets from ANY of their domains in search.
 *
 * <p>The bug was that RBACConditionEvaluator.hasDomain() used addMust() for each user domain,
 * producing AND logic in the Elasticsearch query. Since entities typically belong to only one
 * domain, the AND query returned zero results for multi-domain users.
 *
 * <p>The fix combines all domain term queries with should (OR) semantics, consistent with
 * how isOwner() handles multiple teams.
 */
@Execution(ExecutionMode.CONCURRENT)
@ResourceLock("SEARCH_SETTINGS")
@ExtendWith(TestNamespaceExtension.class)
public class MultiDomainHasDomainIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_searchWithMultipleDomains_hasDomainPolicy(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String p = ns.shortPrefix();

    Domain domain1 = createDomain(adminClient, p + "_d1");
    try {
      Domain domain2 = createDomain(adminClient, p + "_d2");
      try {
        Policy policy = createHasDomainPolicy(adminClient, p + "_pol");
        try {
          Role role = createRole(adminClient, p + "_role", policy.getFullyQualifiedName());
          try {
            Team team =
                createTeam(
                    adminClient,
                    p + "_team",
                    role,
                    List.of(domain1.getFullyQualifiedName(), domain2.getFullyQualifiedName()));
            try {
              String userEmail = p + "_user@test.openmetadata.org";
              User testUser = createUser(adminClient, p + "_user", userEmail, team);
              try {
                DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
                try {
                  DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
                  Column column = new Column().withName("id").withDataType(ColumnDataType.INT);

                  Table tableInDomain1 =
                      createTableInDomain(
                          adminClient,
                          p + "_t1",
                          schema.getFullyQualifiedName(),
                          domain1.getFullyQualifiedName(),
                          column);
                  try {
                    Table tableInDomain2 =
                        createTableInDomain(
                            adminClient,
                            p + "_t2",
                            schema.getFullyQualifiedName(),
                            domain2.getFullyQualifiedName(),
                            column);
                    try {
                      boolean originalAccessControl = enableSearchAccessControl(adminClient);
                      try {
                        OpenMetadataClient testUserClient =
                            SdkClients.createClient(userEmail, userEmail, new String[] {});

                        Table fetched1 =
                            testUserClient.tables().get(tableInDomain1.getId().toString());
                        assertNotNull(
                            fetched1, "Test user should be able to GET table in domain1 via API");

                        Table fetched2 =
                            testUserClient.tables().get(tableInDomain2.getId().toString());
                        assertNotNull(
                            fetched2, "Test user should be able to GET table in domain2 via API");

                        String domain1TableId = tableInDomain1.getId().toString();
                        String domain2TableId = tableInDomain2.getId().toString();

                        Awaitility.await()
                            .atMost(Duration.ofSeconds(30))
                            .pollInterval(Duration.ofSeconds(2))
                            .untilAsserted(
                                () -> {
                                  assertSearchReturnsTable(
                                      testUserClient,
                                      domain1TableId,
                                      "Search should return tableInDomain1 for multi-domain user");
                                  assertSearchReturnsTable(
                                      testUserClient,
                                      domain2TableId,
                                      "Search should return tableInDomain2 for multi-domain user");
                                });

                      } finally {
                        restoreSearchAccessControl(adminClient, originalAccessControl);
                      }
                    } finally {
                      adminClient.tables().delete(tableInDomain2.getId());
                    }
                  } finally {
                    adminClient.tables().delete(tableInDomain1.getId());
                  }
                } finally {
                  adminClient
                      .databaseServices()
                      .delete(
                          dbService.getId().toString(),
                          Map.of("recursive", "true", "hardDelete", "true"));
                }
              } finally {
                adminClient.users().delete(testUser.getId());
              }
            } finally {
              adminClient.teams().delete(team.getId());
            }
          } finally {
            adminClient.roles().delete(role.getId());
          }
        } finally {
          adminClient.policies().delete(policy.getId());
        }
      } finally {
        adminClient.domains().delete(domain2.getId().toString());
      }
    } finally {
      adminClient.domains().delete(domain1.getId().toString());
    }
  }

  @Test
  void test_searchWithSingleDomain_hasDomainPolicy(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String p = ns.shortPrefix();

    Domain domain = createDomain(adminClient, p + "_d1");
    try {
      Policy policy = createHasDomainPolicy(adminClient, p + "_pol");
      try {
        Role role = createRole(adminClient, p + "_role", policy.getFullyQualifiedName());
        try {
          Team team =
              createTeam(adminClient, p + "_team", role, List.of(domain.getFullyQualifiedName()));
          try {
            String userEmail = p + "_user@test.openmetadata.org";
            User testUser = createUser(adminClient, p + "_user", userEmail, team);
            try {
              DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
              try {
                DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
                Column column = new Column().withName("id").withDataType(ColumnDataType.INT);

                Table tableInDomain =
                    createTableInDomain(
                        adminClient,
                        p + "_t1",
                        schema.getFullyQualifiedName(),
                        domain.getFullyQualifiedName(),
                        column);
                try {
                  boolean originalAccessControl = enableSearchAccessControl(adminClient);
                  try {
                    OpenMetadataClient testUserClient =
                        SdkClients.createClient(userEmail, userEmail, new String[] {});

                    String domainTableId = tableInDomain.getId().toString();

                    Awaitility.await()
                        .atMost(Duration.ofSeconds(30))
                        .pollInterval(Duration.ofSeconds(2))
                        .untilAsserted(
                            () -> {
                              assertSearchReturnsTable(
                                  testUserClient,
                                  domainTableId,
                                  "Search should return tableInDomain for single-domain user");
                            });

                  } finally {
                    restoreSearchAccessControl(adminClient, originalAccessControl);
                  }
                } finally {
                  adminClient.tables().delete(tableInDomain.getId());
                }
              } finally {
                adminClient
                    .databaseServices()
                    .delete(
                        dbService.getId().toString(),
                        Map.of("recursive", "true", "hardDelete", "true"));
              }
            } finally {
              adminClient.users().delete(testUser.getId());
            }
          } finally {
            adminClient.teams().delete(team.getId());
          }
        } finally {
          adminClient.roles().delete(role.getId());
        }
      } finally {
        adminClient.policies().delete(policy.getId());
      }
    } finally {
      adminClient.domains().delete(domain.getId().toString());
    }
  }

  @Test
  void test_searchWithDomain_canSeeNoDomainAssets(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String p = ns.shortPrefix();

    Domain domain = createDomain(adminClient, p + "_d1");
    try {
      Policy policy = createHasDomainPolicy(adminClient, p + "_pol");
      try {
        Role role = createRole(adminClient, p + "_role", policy.getFullyQualifiedName());
        try {
          Team team =
              createTeam(adminClient, p + "_team", role, List.of(domain.getFullyQualifiedName()));
          try {
            String userEmail = p + "_user@test.openmetadata.org";
            User testUser = createUser(adminClient, p + "_user", userEmail, team);
            try {
              DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
              try {
                DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
                Column column = new Column().withName("id").withDataType(ColumnDataType.INT);

                Table tableNoDomain =
                    createTableWithoutDomain(
                        adminClient, p + "_t_nodomain", schema.getFullyQualifiedName(), column);
                try {
                  boolean originalAccessControl = enableSearchAccessControl(adminClient);
                  try {
                    OpenMetadataClient testUserClient =
                        SdkClients.createClient(userEmail, userEmail, new String[] {});

                    Table fetched = testUserClient.tables().get(tableNoDomain.getId().toString());
                    assertNotNull(
                        fetched, "Test user should be able to GET no-domain table via API");

                    String noDomainTableId = tableNoDomain.getId().toString();

                    Awaitility.await()
                        .atMost(Duration.ofSeconds(30))
                        .pollInterval(Duration.ofSeconds(2))
                        .untilAsserted(
                            () -> {
                              assertSearchReturnsTable(
                                  testUserClient,
                                  noDomainTableId,
                                  "User with domains should see assets that have no domain assigned");
                            });

                  } finally {
                    restoreSearchAccessControl(adminClient, originalAccessControl);
                  }
                } finally {
                  adminClient.tables().delete(tableNoDomain.getId());
                }
              } finally {
                adminClient
                    .databaseServices()
                    .delete(
                        dbService.getId().toString(),
                        Map.of("recursive", "true", "hardDelete", "true"));
              }
            } finally {
              adminClient.users().delete(testUser.getId());
            }
          } finally {
            adminClient.teams().delete(team.getId());
          }
        } finally {
          adminClient.roles().delete(role.getId());
        }
      } finally {
        adminClient.policies().delete(policy.getId());
      }
    } finally {
      adminClient.domains().delete(domain.getId().toString());
    }
  }

  /**
   * Verifies that search-RBAC honors sub-domain hierarchy and sibling-domain boundaries. A user
   * assigned to parent Domain A must be able to search for entities under any descendant of A
   * (A.B, A.B.C — Tables, DataProducts, Domains themselves), and must NOT see entities in
   * unrelated sibling domains. This mirrors SubjectContext.isDomainParentOrEqual in the REST API.
   */
  @Test
  void test_searchRespectsDomainHierarchyAndSiblingBoundary(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String p = ns.shortPrefix();

    Domain parent = createDomain(adminClient, p + "_parent");
    try {
      Domain child = createDomain(adminClient, p + "_child", parent.getFullyQualifiedName());
      try {
        Domain sibling = createDomain(adminClient, p + "_sibling");
        try {
          Policy policy = createHasDomainPolicy(adminClient, p + "_pol");
          try {
            Role role = createRole(adminClient, p + "_role", policy.getFullyQualifiedName());
            try {
              Team team =
                  createTeam(
                      adminClient, p + "_team", role, List.of(parent.getFullyQualifiedName()));
              try {
                String userEmail = p + "_user@test.openmetadata.org";
                User testUser = createUser(adminClient, p + "_user", userEmail, team);
                try {
                  DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
                  try {
                    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
                    Column column = new Column().withName("id").withDataType(ColumnDataType.INT);

                    Table parentTable =
                        createTableInDomain(
                            adminClient,
                            p + "_t_parent",
                            schema.getFullyQualifiedName(),
                            parent.getFullyQualifiedName(),
                            column);
                    Table childTable =
                        createTableInDomain(
                            adminClient,
                            p + "_t_child",
                            schema.getFullyQualifiedName(),
                            child.getFullyQualifiedName(),
                            column);
                    Table siblingTable =
                        createTableInDomain(
                            adminClient,
                            p + "_t_sibling",
                            schema.getFullyQualifiedName(),
                            sibling.getFullyQualifiedName(),
                            column);

                    DataProduct parentDp =
                        createDataProduct(
                            adminClient, p + "_dp_parent", parent.getFullyQualifiedName());
                    DataProduct childDp =
                        createDataProduct(
                            adminClient, p + "_dp_child", child.getFullyQualifiedName());
                    DataProduct siblingDp =
                        createDataProduct(
                            adminClient, p + "_dp_sibling", sibling.getFullyQualifiedName());
                    try {
                      boolean originalAccessControl = enableSearchAccessControl(adminClient);
                      try {
                        OpenMetadataClient testUserClient =
                            SdkClients.createClient(userEmail, userEmail, new String[] {});

                        Awaitility.await()
                            .atMost(Duration.ofSeconds(30))
                            .pollInterval(Duration.ofSeconds(2))
                            .untilAsserted(
                                () -> {
                                  assertVisible(
                                      testUserClient,
                                      "table_search_index",
                                      parentTable.getId().toString(),
                                      "parent-domain table");
                                  assertVisible(
                                      testUserClient,
                                      "table_search_index",
                                      childTable.getId().toString(),
                                      "sub-domain table (hierarchy)");
                                  assertHidden(
                                      testUserClient,
                                      "table_search_index",
                                      siblingTable.getId().toString(),
                                      "sibling-domain table");

                                  assertVisible(
                                      testUserClient,
                                      "domain_search_index",
                                      parent.getId().toString(),
                                      "parent Domain doc");
                                  assertVisible(
                                      testUserClient,
                                      "domain_search_index",
                                      child.getId().toString(),
                                      "sub-Domain doc (hierarchy)");
                                  assertHidden(
                                      testUserClient,
                                      "domain_search_index",
                                      sibling.getId().toString(),
                                      "sibling Domain doc");

                                  assertVisible(
                                      testUserClient,
                                      "data_product_search_index",
                                      parentDp.getId().toString(),
                                      "parent-domain DataProduct");
                                  assertVisible(
                                      testUserClient,
                                      "data_product_search_index",
                                      childDp.getId().toString(),
                                      "sub-domain DataProduct (hierarchy)");
                                  assertHidden(
                                      testUserClient,
                                      "data_product_search_index",
                                      siblingDp.getId().toString(),
                                      "sibling-domain DataProduct");
                                });
                      } finally {
                        restoreSearchAccessControl(adminClient, originalAccessControl);
                      }
                    } finally {
                      adminClient.dataProducts().delete(siblingDp.getId());
                      adminClient.dataProducts().delete(childDp.getId());
                      adminClient.dataProducts().delete(parentDp.getId());
                      adminClient.tables().delete(siblingTable.getId());
                      adminClient.tables().delete(childTable.getId());
                      adminClient.tables().delete(parentTable.getId());
                    }
                  } finally {
                    adminClient
                        .databaseServices()
                        .delete(
                            dbService.getId().toString(),
                            Map.of("recursive", "true", "hardDelete", "true"));
                  }
                } finally {
                  adminClient.users().delete(testUser.getId());
                }
              } finally {
                adminClient.teams().delete(team.getId());
              }
            } finally {
              adminClient.roles().delete(role.getId());
            }
          } finally {
            adminClient.policies().delete(policy.getId());
          }
        } finally {
          adminClient.domains().delete(sibling.getId().toString());
        }
      } finally {
        adminClient.domains().delete(child.getId().toString());
      }
    } finally {
      adminClient.domains().delete(parent.getId().toString());
    }
  }

  private Domain createDomain(OpenMetadataClient adminClient, String name) {
    return createDomain(adminClient, name, null);
  }

  private Domain createDomain(OpenMetadataClient adminClient, String name, String parentFqn) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for hasDomain() search filter test");
    if (parentFqn != null) {
      createDomain.withParent(parentFqn);
    }
    return adminClient.domains().create(createDomain);
  }

  private DataProduct createDataProduct(
      OpenMetadataClient adminClient, String name, String domainFqn) {
    CreateDataProduct createDp = new CreateDataProduct();
    createDp.setName(name);
    createDp.setDomains(List.of(domainFqn));
    createDp.setDescription("Test data product for hasDomain() search filter test");
    return adminClient.dataProducts().create(createDp);
  }

  private Policy createHasDomainPolicy(OpenMetadataClient adminClient, String name) {
    Rule allowRule = new Rule();
    allowRule.setName("AllowHasDomain");
    allowRule.setResources(List.of("All"));
    allowRule.setOperations(List.of(MetadataOperation.VIEW_ALL));
    allowRule.setEffect(Rule.Effect.ALLOW);
    allowRule.setCondition("hasDomain()");

    Rule denyRule = new Rule();
    denyRule.setName("DenyNoHasDomain");
    denyRule.setResources(List.of("All"));
    denyRule.setOperations(List.of(MetadataOperation.VIEW_ALL));
    denyRule.setEffect(Rule.Effect.DENY);
    denyRule.setCondition("!hasDomain()");

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(name);
    createPolicy.setRules(List.of(allowRule, denyRule));
    return adminClient.policies().create(createPolicy);
  }

  private Role createRole(OpenMetadataClient adminClient, String name, String policyFqn) {
    CreateRole createRole = new CreateRole();
    createRole.setName(name);
    createRole.setPolicies(List.of(policyFqn));
    return adminClient.roles().create(createRole);
  }

  private Team createTeam(
      OpenMetadataClient adminClient, String name, Role role, List<String> domainFqns) {
    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(name);
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    createTeam.setDefaultRoles(List.of(role.getId()));
    createTeam.setDomains(domainFqns);
    return adminClient.teams().create(createTeam);
  }

  private User createUser(OpenMetadataClient adminClient, String name, String email, Team team) {
    CreateUser createUser = new CreateUser();
    createUser.setName(name);
    createUser.setEmail(email);
    createUser.setTeams(List.of(team.getId()));
    return adminClient.users().create(createUser);
  }

  private Table createTableInDomain(
      OpenMetadataClient adminClient,
      String name,
      String schemaFqn,
      String domainFqn,
      Column column) {
    CreateTable createTable = new CreateTable();
    createTable.setName(name);
    createTable.setDatabaseSchema(schemaFqn);
    createTable.setColumns(List.of(column));
    createTable.setDomains(List.of(domainFqn));
    return adminClient.tables().create(createTable);
  }

  private Table createTableWithoutDomain(
      OpenMetadataClient adminClient, String name, String schemaFqn, Column column) {
    CreateTable createTable = new CreateTable();
    createTable.setName(name);
    createTable.setDatabaseSchema(schemaFqn);
    createTable.setColumns(List.of(column));
    return adminClient.tables().create(createTable);
  }

  private boolean enableSearchAccessControl(OpenMetadataClient adminClient) throws Exception {
    String settingsJson =
        adminClient
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
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    adminClient
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(updatedSettings),
            RequestOptions.builder().build());
    return original;
  }

  private void restoreSearchAccessControl(OpenMetadataClient adminClient, boolean original)
      throws Exception {
    if (!original) {
      adminClient
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT,
              "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
              null,
              RequestOptions.builder().build());
    }
  }

  private void assertSearchReturnsTable(
      OpenMetadataClient client, String tableId, String failureMessage) throws Exception {
    String searchResponse =
        client.search().query("id:" + tableId).index("table_search_index").size(1).execute();
    assertTrue(
        searchResponse.contains("\"id\":\"" + tableId + "\""),
        failureMessage + ". Response: " + searchResponse);
  }

  private void assertVisible(OpenMetadataClient client, String index, String id, String label)
      throws Exception {
    String response = client.search().query("id:" + id).index(index).size(1).execute();
    assertTrue(
        response.contains("\"id\":\"" + id + "\""),
        "Expected " + label + " (" + id + ") to be visible. Response: " + response);
  }

  private void assertHidden(OpenMetadataClient client, String index, String id, String label)
      throws Exception {
    String response = client.search().query("id:" + id).index(index).size(1).execute();
    assertFalse(
        response.contains("\"id\":\"" + id + "\""),
        "Expected " + label + " (" + id + ") to be hidden. Response: " + response);
  }
}
