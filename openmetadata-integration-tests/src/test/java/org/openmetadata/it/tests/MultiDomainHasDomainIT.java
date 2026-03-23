package org.openmetadata.it.tests;

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
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
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
                                  String searchResponse =
                                      testUserClient
                                          .search()
                                          .query("*")
                                          .index("table_search_index")
                                          .size(50)
                                          .execute();
                                  assertTrue(
                                      searchResponse.contains(domain1TableId),
                                      "Search should return tableInDomain1 for multi-domain user");
                                  assertTrue(
                                      searchResponse.contains(domain2TableId),
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
                              String searchResponse =
                                  testUserClient
                                      .search()
                                      .query("*")
                                      .index("table_search_index")
                                      .size(50)
                                      .execute();
                              assertTrue(
                                  searchResponse.contains(domainTableId),
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
                              String searchResponse =
                                  testUserClient
                                      .search()
                                      .query("*")
                                      .index("table_search_index")
                                      .size(50)
                                      .execute();
                              assertTrue(
                                  searchResponse.contains(noDomainTableId),
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

  private Domain createDomain(OpenMetadataClient adminClient, String name) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for hasDomain() search filter test");
    return adminClient.domains().create(createDomain);
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
}
