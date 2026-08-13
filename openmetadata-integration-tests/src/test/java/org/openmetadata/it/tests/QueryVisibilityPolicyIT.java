package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration test for GitHub Issue #22551: Query Visibility Issue with Table Policies
 *
 * <p>When a user has a policy that grants VIEW_ALL on entities with a specific tag, they should be
 * able to:
 * <ul>
 *   <li>View tables that have that tag
 *   <li>View queries that are associated with those tables (via queryUsedIn relationship)
 * </ul>
 *
 * <p>The bug was that queries for a tagged table were not visible because the authorization check
 * was only done on the Query entity's own tags, not considering the table's tags.
 *
 * <p>The fix allows users with VIEW_QUERIES permission on a table to see queries associated with
 * that table.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class QueryVisibilityPolicyIT {

  private static final String PII_SENSITIVE_TAG = "PII.Sensitive";
  private static final String TIER1_TAG = "Tier.Tier1";
  private static final String GOLD_CERTIFICATION = "Certification.Gold";

  @Test
  void test_queryVisibilityWithTableTagPolicy(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String testPrefix = ns.prefix("qvp");

    // Step 1: Create a policy that allows VIEW_ALL on entities with PII.Sensitive tag
    Rule viewAllWithTagRule = new Rule();
    viewAllWithTagRule.setName("ViewAllWithTag");
    viewAllWithTagRule.setResources(List.of("All"));
    viewAllWithTagRule.setOperations(List.of(MetadataOperation.VIEW_ALL));
    viewAllWithTagRule.setEffect(Rule.Effect.ALLOW);
    viewAllWithTagRule.setCondition("matchAnyTag('PII.Sensitive')");

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(testPrefix + "_policy");
    createPolicy.setDescription("Policy to allow VIEW_ALL on entities with PII.Sensitive tag");
    createPolicy.setRules(List.of(viewAllWithTagRule));

    Policy policy = adminClient.policies().create(createPolicy);
    assertNotNull(policy, "Policy should be created");

    try {
      // Step 2: Create a role with that policy
      CreateRole createRole = new CreateRole();
      createRole.setName(testPrefix + "_role");
      createRole.setPolicies(List.of(policy.getFullyQualifiedName()));

      Role role = adminClient.roles().create(createRole);
      assertNotNull(role, "Role should be created");

      try {
        // Step 3: Create a team with that role as default
        CreateTeam createTeam = new CreateTeam();
        createTeam.setName(testPrefix + "_team");
        createTeam.setDefaultRoles(List.of(role.getId()));
        createTeam.setTeamType(CreateTeam.TeamType.GROUP);

        Team team = adminClient.teams().create(createTeam);
        assertNotNull(team, "Team should be created");

        try {
          // Step 4: Create a user in that team
          // Use a simpler name for the user to avoid email validation issues
          String uniqueId = java.util.UUID.randomUUID().toString().substring(0, 8);
          String userName = "qvptest_" + uniqueId;
          String userEmail = userName + "@test.openmetadata.org";
          CreateUser createUser = new CreateUser();
          createUser.setName(userName);
          createUser.setEmail(userEmail);
          createUser.setTeams(List.of(team.getId()));

          User testUser = adminClient.users().create(createUser);
          assertNotNull(testUser, "User should be created");

          try {
            // Step 5: Create database service and schema using factories
            DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
            assertNotNull(dbService, "Database service should be created");

            try {
              DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
              assertNotNull(schema, "Database schema should be created");

              // Step 6: Create a table WITH the PII.Sensitive tag using fluent API
              TagLabel piiTag = new TagLabel();
              piiTag.setTagFQN(PII_SENSITIVE_TAG);
              piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
              piiTag.setLabelType(TagLabel.LabelType.MANUAL);
              piiTag.setState(TagLabel.State.CONFIRMED);

              Column column = new Column();
              column.setName("id");
              column.setDataType(ColumnDataType.INT);

              Table taggedTable =
                  Tables.create()
                      .name(testPrefix + "_table")
                      .inSchema(schema.getFullyQualifiedName())
                      .withColumns(List.of(column))
                      .withTags(List.of(piiTag))
                      .execute();
              assertNotNull(taggedTable, "Table should be created");

              try {
                // Step 7: Create a query that references the table (query does NOT have the tag)
                CreateQuery createQuery = new CreateQuery();
                createQuery.setName(testPrefix + "_query");
                createQuery.setQuery("SELECT * FROM " + taggedTable.getFullyQualifiedName());
                EntityReference tableRef = new EntityReference();
                tableRef.setId(taggedTable.getId());
                tableRef.setType("table");
                createQuery.setQueryUsedIn(List.of(tableRef));
                createQuery.setDuration(0.0);
                createQuery.setQueryDate(System.currentTimeMillis());
                createQuery.setService(dbService.getFullyQualifiedName());

                Query queryForTable = adminClient.queries().create(createQuery);
                assertNotNull(queryForTable, "Query should be created");

                try {
                  // Create client for the test user
                  OpenMetadataClient testUserClient =
                      SdkClients.createClient(userEmail, userEmail, new String[] {});

                  // Step 8: Verify the test user CAN view the table (due to tag-based policy)
                  Table retrievedTable =
                      testUserClient.tables().get(taggedTable.getId().toString(), "tags");
                  assertNotNull(retrievedTable, "User should be able to view the tagged table");
                  assertTrue(
                      retrievedTable.getTags().stream()
                          .anyMatch(t -> PII_SENSITIVE_TAG.equals(t.getTagFQN())),
                      "Table should have the PII.Sensitive tag");

                  // Step 9: Verify the test user CAN view queries for that table
                  // This is the key test - with the bug, this would fail with FORBIDDEN
                  // After the fix, this should succeed because user has VIEW_ALL (which includes
                  // VIEW_QUERIES) on the table
                  ListParams listParams = new ListParams();
                  listParams.addQueryParam("entityId", taggedTable.getId().toString());
                  listParams.addQueryParam("entityType", "table");
                  listParams.setFields("*");

                  ListResponse<Query> queriesForTable = testUserClient.queries().list(listParams);

                  assertNotNull(queriesForTable, "Query response should not be null");
                  assertNotNull(queriesForTable.getData(), "Query data should not be null");
                  assertFalse(
                      queriesForTable.getData().isEmpty(),
                      "User with VIEW_ALL on table should be able to see queries for that table");

                  boolean foundQuery =
                      queriesForTable.getData().stream()
                          .anyMatch(q -> q.getId().equals(queryForTable.getId()));
                  assertTrue(foundQuery, "The query for the tagged table should be visible");

                } finally {
                  adminClient.queries().delete(queryForTable.getId());
                }
              } finally {
                adminClient.tables().delete(taggedTable.getId());
              }
            } finally {
              adminClient
                  .databaseServices()
                  .delete(
                      dbService.getId().toString(),
                      java.util.Map.of("recursive", "true", "hardDelete", "true"));
            }
          } finally {
            adminClient.users().delete(testUser.getId());
          }
        } finally {
          // Cleanup team
          adminClient.teams().delete(team.getId());
        }
      } finally {
        // Cleanup role
        adminClient.roles().delete(role.getId());
      }
    } finally {
      // Cleanup policy
      adminClient.policies().delete(policy.getId());
    }
  }

  /**
   * Regression test for NPE in matchAnyCertification policy evaluation.
   *
   * <p>The bug: {@code matchAnyCertification} called {@code
   * resourceContext.getEntity().getCertification()} without null-checking {@code getEntity()}.
   * When {@code ResourceContext.getEntity()} returned null (e.g. Settings, Team, or list
   * operations), the chained call threw a NullPointerException (500) before any certification
   * logic could run.
   *
   * <p>Uses a single DENY rule with matchAnyCertification condition. For an uncertified entity the
   * condition is false, so the deny rule does not fire and the entity remains viewable. Before the
   * fix, evaluating the condition itself threw NPE (500 server error).
   */
  @Test
  void test_matchAnyCertification_nullEntityInResourceContext(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String p = ns.shortPrefix();

    // Single DENY rule: deny viewing Gold/Silver certified entities.
    // For an uncertified entity, matchAnyCertification returns false,
    // so the deny rule does NOT fire and the entity is still viewable.
    Rule denyCertifiedRule =
        new Rule()
            .withName("DenyCertified")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY)
            .withCondition("matchAnyCertification('Certification.Gold', 'Certification.Silver')");

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(p + "_certPol");
    createPolicy.setRules(List.of(denyCertifiedRule));

    Policy policy = adminClient.policies().create(createPolicy);
    assertNotNull(policy, "Policy should be created");
    try {
      CreateRole createRole = new CreateRole();
      createRole.setName(p + "_certRole");
      createRole.setPolicies(List.of(policy.getFullyQualifiedName()));
      Role role = adminClient.roles().create(createRole);
      assertNotNull(role, "Role should be created");
      try {
        CreateTeam createTeam = new CreateTeam();
        createTeam.setName(p + "_certTeam");
        createTeam.setTeamType(CreateTeam.TeamType.GROUP);
        createTeam.setDefaultRoles(List.of(role.getId()));
        Team team = adminClient.teams().create(createTeam);
        assertNotNull(team, "Team should be created");
        try {
          String userEmail = p + "_certuser@test.openmetadata.org";
          CreateUser createUser = new CreateUser();
          createUser.setName(p + "_certuser");
          createUser.setEmail(userEmail);
          createUser.setTeams(List.of(team.getId()));
          User testUser = adminClient.users().create(createUser);
          assertNotNull(testUser, "User should be created");
          try {
            DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
            assertNotNull(dbService, "Database service should be created");
            try {
              DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
              assertNotNull(schema, "Database schema should be created");
              Column column = new Column().withName("id").withDataType(ColumnDataType.INT);

              Table tableNoCert =
                  Tables.create()
                      .name(p + "_nocert")
                      .inSchema(schema.getFullyQualifiedName())
                      .withColumns(List.of(column))
                      .execute();
              try {
                OpenMetadataClient testUserClient =
                    SdkClients.createClient(userEmail, userEmail, new String[] {});

                // Before the fix, this threw NPE (500) in matchAnyCertification because the
                // entity in the resource context (resourceContext.getEntity()) was null.
                // After the fix, the null entity is handled, the condition evaluates to false,
                // the deny rule does not fire, and the GET succeeds.
                Table fetched = testUserClient.tables().get(tableNoCert.getId().toString());
                assertNotNull(fetched, "GET should return the table, not fail with NPE");
                assertEquals(
                    tableNoCert.getId(),
                    fetched.getId(),
                    "Returned table should match the requested table");
              } finally {
                adminClient.tables().delete(tableNoCert.getId());
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
  }

  /**
   * A tag-based DENY rule must be enforced regardless of the {@code fields} query parameter. The
   * authorization entity load previously reused the caller-supplied projection, so omitting {@code
   * fields=tags} left the policy engine with no tags and matchAnyTag evaluated to false, silently
   * allowing the request.
   */
  @Test
  void test_tagDenyPolicy_enforcedWhenFieldsParamOmitted(TestNamespace ns) throws Exception {
    DatabaseSchema schema = fieldPolicySchema(ns);
    OpenMetadataClient denied = userDeniedBy("tag", "matchAnyTag('" + PII_SENSITIVE_TAG + "')", ns);
    String p = ns.shortPrefix();

    Table tagged =
        tableWith(schema, p + "_tagged", c -> c.setTags(List.of(tagLabel(PII_SENSITIVE_TAG))));
    Table untagged = tableWith(schema, p + "_untagged", c -> {});
    Table columnTagged =
        tableWith(
            schema,
            p + "_coltagged",
            c ->
                c.setColumns(
                    List.of(
                        new Column()
                            .withName("id")
                            .withDataType(ColumnDataType.INT)
                            .withTags(List.of(tagLabel(PII_SENSITIVE_TAG))))));

    String taggedId = tagged.getId().toString();
    String taggedFqn = tagged.getFullyQualifiedName();
    String columnTaggedId = columnTagged.getId().toString();

    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(taggedId),
        "GET by id without fields must be denied for a tag matched by a DENY rule");
    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().getByName(taggedFqn),
        "GET by name without fields must be denied for a tag matched by a DENY rule");
    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(taggedId, "tags"),
        "GET with fields=tags must remain denied");
    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(taggedId, "owners"),
        "A projection without tags must not bypass the DENY rule");

    // Column-level enforcement is projection-dependent (column tags hydrate only when columns and
    // tags are both loaded). The authorization field set must therefore union the caller's
    // projection rather than replace it, or this case silently regresses.
    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(columnTaggedId, "columns,tags"),
        "A column-level tag must stay enforced when the caller requests columns and tags");

    assertNotNull(
        denied.tables().get(untagged.getId().toString()),
        "An untagged table must remain viewable — the rule must not over-block");
  }

  /**
   * A certified entity resolved during authorization must not leak its certification into a
   * response that never projected it. The authorization load always requests certification so
   * matchAnyCertification cannot fail open, and reuseAuthorizedEntity hands that same entity back as
   * the response; without resetting certification a non-admin GET omitting {@code
   * fields=certification} returned it while an admin GET (which bypasses policy and loads normally)
   * did not, so the payload differed by principal.
   */
  @Test
  void test_certification_notLeakedWhenFieldsParamOmitted(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseSchema schema = fieldPolicySchema(ns);
    OpenMetadataClient viewer = userWithViewRule("certview", Rule.Effect.ALLOW, null, ns);

    Table table = tableWith(schema, ns.shortPrefix() + "_certified", c -> {});
    long now = System.currentTimeMillis();
    table.setCertification(
        new AssetCertification()
            .withTagLabel(tagLabel(GOLD_CERTIFICATION))
            .withAppliedDate(now)
            .withExpiryDate(now + Duration.ofDays(30).toMillis()));
    admin.tables().update(table.getId().toString(), table);
    String id = table.getId().toString();

    assertNotNull(
        viewer.tables().get(id, "certification").getCertification(),
        "certification must be present for a non-admin when explicitly requested");
    assertNull(
        viewer.tables().get(id).getCertification(),
        "certification must not leak into a non-admin GET that did not request it");
    assertNull(
        admin.tables().get(id).getCertification(),
        "admin GET without fields must also omit certification — payload must not differ by principal");
  }

  /**
   * A tag-based DENY on {@code EDIT_ALL} must be enforced on the bulk upsert path. Bulk
   * authorization batch-hydrates tags for the whole request; this verifies the DENY fires for the
   * tagged table (whose tags load in that batch) while an untagged table the principal may edit
   * still passes — i.e. the batch hydration feeds policy evaluation correctly.
   */
  @Test
  void test_tagDenyPolicy_enforcedOnBulkUpdate(TestNamespace ns) throws Exception {
    DatabaseSchema schema = fieldPolicySchema(ns);
    String p = ns.shortPrefix();

    tableWith(schema, p + "_bulktagged", c -> c.setTags(List.of(tagLabel(PII_SENSITIVE_TAG))));
    tableWith(schema, p + "_bulkuntagged", c -> {});

    Rule allowEdit =
        new Rule()
            .withName(p + "bulkAllow")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.EDIT_ALL, MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyTagged =
        new Rule()
            .withName(p + "bulkDeny")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withEffect(Rule.Effect.DENY)
            .withCondition("matchAnyTag('" + PII_SENSITIVE_TAG + "')");
    String email = principalWithRules("bulk", List.of(allowEdit, denyTagged), ns);
    String token = JwtAuthProvider.tokenFor(email, email, new String[] {}, 86400L);

    List<CreateTable> updates =
        List.of(
            updateRequest(schema, p + "_bulktagged"), updateRequest(schema, p + "_bulkuntagged"));
    BulkOperationResult result = bulkUpdateTables(updates, token);

    assertEquals(
        1, result.getNumberOfRowsPassed(), "the untagged table the principal may edit must pass");
    assertEquals(
        1,
        result.getNumberOfRowsFailed(),
        "the tagged table must be denied by the tag policy on the bulk path");
  }

  private CreateTable updateRequest(DatabaseSchema schema, String name) {
    CreateTable create = new CreateTable();
    create.setName(name);
    create.setDatabaseSchema(schema.getFullyQualifiedName());
    create.setColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    return create;
  }

  private BulkOperationResult bulkUpdateTables(List<CreateTable> tables, String token)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/bulk"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(tables)))
            .build();
    HttpResponse<String> response =
        HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "bulk endpoint returns 200 with per-entity results");
    return JsonUtils.readValue(response.body(), BulkOperationResult.class);
  }

  private final Deque<Runnable> fixtureCleanups = new ArrayDeque<>();

  @AfterEach
  void removeFieldPolicyFixtures() {
    while (!fixtureCleanups.isEmpty()) {
      try {
        fixtureCleanups.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown: a cleanup failure must not mask the assertion result.
      }
    }
  }

  /** Principal carrying exactly one conditional DENY {@code VIEW_ALL} rule. */
  private OpenMetadataClient userDeniedBy(String label, String condition, TestNamespace ns) {
    return userWithViewRule(label, Rule.Effect.DENY, condition, ns);
  }

  /**
   * Creates a principal carrying exactly one {@code VIEW_ALL} rule with the given effect and
   * optional condition (null for an unconditional rule). Roles are assigned directly on the user:
   * a role granted only through a team's defaultRoles is not applied to the subject during policy
   * evaluation, which would leave the principal with no policy and make every assertion pass
   * vacuously.
   */
  private OpenMetadataClient userWithViewRule(
      String label, Rule.Effect effect, String condition, TestNamespace ns) {
    Rule viewRule =
        new Rule()
            .withName(ns.shortPrefix() + label + "Rule")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(effect)
            .withCondition(condition);
    String email = principalWithRules(label, List.of(viewRule), ns);
    return SdkClients.createClient(email, email, new String[] {});
  }

  /**
   * Creates a policy carrying {@code rules}, a role holding it, and a user with that role assigned
   * directly (not via a team's defaultRoles, which is not applied during policy evaluation).
   * Returns the user's email, which is also the JWT subject for {@link JwtAuthProvider}.
   */
  private String principalWithRules(String label, List<Rule> rules, TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String p = ns.shortPrefix() + label;

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(p + "_pol");
    createPolicy.setRules(rules);
    Policy policy = admin.policies().create(createPolicy);
    fixtureCleanups.push(() -> admin.policies().delete(policy.getId()));

    CreateRole createRole = new CreateRole();
    createRole.setName(p + "_role");
    createRole.setPolicies(List.of(policy.getFullyQualifiedName()));
    Role role = admin.roles().create(createRole);
    fixtureCleanups.push(() -> admin.roles().delete(role.getId()));

    String email = p + "_u@test.openmetadata.org";
    CreateUser createUser = new CreateUser();
    createUser.setName(p + "_u");
    createUser.setEmail(email);
    createUser.setRoles(List.of(role.getId()));
    User user = admin.users().create(createUser);
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));

    return email;
  }

  private DatabaseSchema fieldPolicySchema(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    fixtureCleanups.push(
        () ->
            admin
                .databaseServices()
                .delete(
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private Table tableWith(
      DatabaseSchema schema, String name, java.util.function.Consumer<CreateTable> customizer) {
    CreateTable create = new CreateTable();
    create.setName(name);
    create.setDatabaseSchema(schema.getFullyQualifiedName());
    create.setColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    customizer.accept(create);
    return SdkClients.adminClient().tables().create(create);
  }

  private static TagLabel tagLabel(String fqn) {
    TagLabel label = new TagLabel();
    label.setTagFQN(fqn);
    label.setSource(TagLabel.TagSource.CLASSIFICATION);
    label.setLabelType(TagLabel.LabelType.MANUAL);
    label.setState(TagLabel.State.CONFIRMED);
    return label;
  }

  /** isOwner() reads owners; unloaded owners made this Deny fail open. */
  @Test
  void test_isOwnerDenyPolicy_enforcedWhenFieldsParamOmitted(TestNamespace ns) throws Exception {
    DatabaseSchema schema = fieldPolicySchema(ns);
    OpenMetadataClient denied = userDeniedBy("own", "isOwner()", ns);
    User self = SdkClients.adminClient().users().getByName(ns.shortPrefix() + "own_u");

    Table owned =
        tableWith(
            schema,
            ns.shortPrefix() + "_owned",
            c -> c.setOwners(List.of(new EntityReference().withId(self.getId()).withType("user"))));
    Table unowned = tableWith(schema, ns.shortPrefix() + "_unowned", c -> {});

    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(owned.getId().toString()),
        "isOwner DENY must fire without fields=owners");
    assertNotNull(
        denied.tables().get(unowned.getId().toString()),
        "isOwner DENY must not block a table the user does not own");
  }

  /** noOwner() reads owners; unloaded owners made this Deny over-block owned entities. */
  @Test
  void test_noOwnerDenyPolicy_doesNotOverBlockOwnedEntities(TestNamespace ns) throws Exception {
    DatabaseSchema schema = fieldPolicySchema(ns);
    OpenMetadataClient denied = userDeniedBy("noown", "noOwner()", ns);
    User self = SdkClients.adminClient().users().getByName(ns.shortPrefix() + "noown_u");

    Table owned =
        tableWith(
            schema,
            ns.shortPrefix() + "_hasowner",
            c -> c.setOwners(List.of(new EntityReference().withId(self.getId()).withType("user"))));
    Table unowned = tableWith(schema, ns.shortPrefix() + "_noowner", c -> {});

    assertNotNull(
        denied.tables().get(owned.getId().toString()),
        "noOwner DENY must not fire on an entity that has an owner");
    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(unowned.getId().toString()),
        "noOwner DENY must fire on an entity with no owner");
  }

  /** noDomain() reads domains; unloaded domains made this Deny over-block entities in a domain. */
  @Test
  void test_noDomainDenyPolicy_doesNotOverBlockEntitiesInADomain(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseSchema schema = fieldPolicySchema(ns);

    CreateDomain createDomain = new CreateDomain();
    createDomain.setName(ns.shortPrefix() + "_dom");
    createDomain.setDescription("field policy coverage");
    createDomain.setDomainType(CreateDomain.DomainType.AGGREGATE);
    Domain domain = admin.domains().create(createDomain);
    fixtureCleanups.push(() -> admin.domains().delete(domain.getId()));

    OpenMetadataClient denied = userDeniedBy("nodom", "noDomain()", ns);
    Table inDomain =
        tableWith(
            schema,
            ns.shortPrefix() + "_indomain",
            c -> c.setDomains(List.of(domain.getFullyQualifiedName())));
    Table noDomain = tableWith(schema, ns.shortPrefix() + "_nodomain", c -> {});

    assertNotNull(
        denied.tables().get(inDomain.getId().toString()),
        "noDomain DENY must not fire on an entity that has a domain");
    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(noDomain.getId().toString()),
        "noDomain DENY must fire on an entity with no domain");
  }

  /** matchAllTags() reads tags; it must fire only when every listed tag is present. */
  @Test
  void test_matchAllTagsDenyPolicy_enforcedWhenFieldsParamOmitted(TestNamespace ns)
      throws Exception {
    DatabaseSchema schema = fieldPolicySchema(ns);
    OpenMetadataClient denied =
        userDeniedBy("allt", "matchAllTags('" + PII_SENSITIVE_TAG + "', '" + TIER1_TAG + "')", ns);

    Table bothTags =
        tableWith(
            schema,
            ns.shortPrefix() + "_bothtags",
            c -> c.setTags(List.of(tagLabel(PII_SENSITIVE_TAG), tagLabel(TIER1_TAG))));
    Table oneTag =
        tableWith(
            schema,
            ns.shortPrefix() + "_onetag",
            c -> c.setTags(List.of(tagLabel(PII_SENSITIVE_TAG))));

    assertThrows(
        ForbiddenException.class,
        () -> denied.tables().get(bothTags.getId().toString()),
        "matchAllTags DENY must fire when all listed tags are present");
    assertNotNull(
        denied.tables().get(oneTag.getId().toString()),
        "matchAllTags DENY must not fire when only some listed tags are present");
  }
}
