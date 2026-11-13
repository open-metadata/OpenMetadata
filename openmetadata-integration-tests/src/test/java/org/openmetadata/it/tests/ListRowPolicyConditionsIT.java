package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * A listing whose caller's policies decide rows by owner, domain or team returns the rows the item
 * endpoint lets that caller read, and counts only those
 * (ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies). Each test
 * builds its own users, teams, domains and policies, and its deny rules name only the type it
 * lists.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ListRowPolicyConditionsIT {
  // A team's policies reach callers outside it through a snapshot that a policy change replaces
  // and that otherwise expires after two minutes (SubjectCache.POLICIES_TTL).
  private static final Duration TEAM_POLICY_REFRESH = Duration.ofMinutes(3);

  private record Member(User user, OpenMetadataClient client) {
    EntityReference reference() {
      return user.getEntityReference();
    }
  }

  private record Listing(List<String> names, int total, String after) {}

  /** Tables owned directly, through their schema or through their database, by a caller. */
  private record OwnedTables(Member caller, DatabaseSchema inOwnedDatabase, List<Table> tables) {}

  /**
   * A listing within a parent is authorized on that parent as if it were a listed row, so the
   * caller lists the schema they own through its database; their tables elsewhere are read singly.
   */
  @Test
  void anOwnerConditionListsTheTablesTheCallerOrTheirTeamOwnsDirectlyOrThroughAParent(
      TestNamespace ns) throws Exception {
    OwnedTables owned = ownedTables(ns);

    Listing inOwnedDatabase = listTables(owned.caller(), owned.inOwnedDatabase());

    assertEquals(List.of("a_inherits_owner", "b_owned_by_team"), inOwnedDatabase.names());
    assertEquals(2, inOwnedDatabase.total());
    assertEquals(
        List.of("a_inherits_owner", "b_owned_by_team", "e_owned_by_caller"),
        readable(owned.caller(), owned.tables()));
  }

  @Test
  void aListingOfEveryTableReturnsAndCountsOnlyTheOwnedOnesPageByPage(TestNamespace ns)
      throws Exception {
    OwnedTables owned = ownedTables(ns);

    Listing first = list(owned.caller(), "/v1/tables?limit=2");
    Listing second =
        list(
            owned.caller(),
            "/v1/tables?limit=2&after=" + URLEncoder.encode(first.after(), StandardCharsets.UTF_8));

    assertEquals(List.of("a_inherits_owner", "b_owned_by_team"), first.names());
    assertEquals(3, first.total());
    assertNotNull(first.after());
    assertEquals(List.of("e_owned_by_caller"), second.names());
    assertEquals(3, second.total());
    assertNull(second.after());
  }

  @Test
  void aDomainConditionListsTablesWithoutADomainOrUnderTheCallersDomain(TestNamespace ns)
      throws Exception {
    Domain finance = domain(ns, "finance", null);
    Domain payroll = domain(ns, "payroll", finance);
    Domain sales = domain(ns, "sales", null);
    Role role = denyRole(ns, "outsideDomain", Entity.TABLE, "!hasDomain()");
    Member caller =
        member(
            ns,
            "domain",
            List.of(role.getId()),
            List.of(),
            List.of(finance.getFullyQualifiedName()));
    Database database = database(ns, "domainDb", List.of());
    DatabaseSchema financeSchema =
        schema(database, "finance_schema", List.of(), List.of(finance.getFullyQualifiedName()));
    DatabaseSchema plainSchema = schema(database, "plain_schema", List.of(), List.of());
    List<Table> tables =
        List.of(
            table(financeSchema, "a_inherits_domain", List.of(), List.of()),
            table(
                financeSchema,
                "b_in_sub_domain",
                List.of(),
                List.of(payroll.getFullyQualifiedName())),
            table(
                financeSchema,
                "c_in_other_domain",
                List.of(),
                List.of(sales.getFullyQualifiedName())),
            table(plainSchema, "d_without_domain", List.of(), List.of()),
            table(
                plainSchema,
                "e_in_other_domain",
                List.of(),
                List.of(sales.getFullyQualifiedName())));

    Listing inFinance = listTables(caller, financeSchema);
    Listing plain = listTables(caller, plainSchema);

    assertEquals(List.of("a_inherits_domain", "b_in_sub_domain"), inFinance.names());
    assertEquals(2, inFinance.total());
    assertEquals(List.of("d_without_domain"), plain.names());
    assertEquals(1, plain.total());
    assertEquals(
        List.of("a_inherits_domain", "b_in_sub_domain", "d_without_domain"),
        readable(caller, tables));
  }

  /**
   * The rule reaches members of the department through their group, and reaches rows owned by a
   * group under the department for every caller outside it. A department cannot own rows, so a
   * sibling group stands for the rest of the department. Each caller lists a schema whose owner
   * passes the rule.
   */
  @Test
  void aTeamRuleListsTablesOwnedUnderItsTeamAndHidesThemFromCallersOutsideIt(TestNamespace ns)
      throws Exception {
    Team department = team(ns, "department", CreateTeam.TeamType.DEPARTMENT, null);
    Team group = team(ns, "group", CreateTeam.TeamType.GROUP, department.getId());
    Team sibling = team(ns, "sibling", CreateTeam.TeamType.GROUP, department.getId());
    attachTeamOnlyPolicy(ns, department);
    Member member = member(ns, "member", List.of(), List.of(group.getId()), List.of());
    Member colleague = member(ns, "colleague", List.of(), List.of(group.getId()), List.of());
    Member outsider = member(ns, "outsider", List.of(), List.of(), List.of());
    Database database = database(ns, "teamDb", List.of());
    DatabaseSchema groupSchema =
        schema(database, "group_schema", List.of(group.getEntityReference()), List.of());
    DatabaseSchema outsiderSchema =
        schema(database, "outsider_schema", List.of(outsider.reference()), List.of());
    List<Table> tables =
        List.of(
            table(
                groupSchema,
                "a_owned_by_sibling",
                List.of(sibling.getEntityReference()),
                List.of()),
            table(groupSchema, "b_owned_by_group", List.of(group.getEntityReference()), List.of()),
            table(groupSchema, "c_owned_by_colleague", List.of(colleague.reference()), List.of()),
            table(groupSchema, "d_inherits_group", List.of(), List.of()),
            table(groupSchema, "e_owned_by_outsider", List.of(outsider.reference()), List.of()),
            table(
                outsiderSchema,
                "g_owned_by_sibling",
                List.of(sibling.getEntityReference()),
                List.of()),
            table(
                outsiderSchema, "h_owned_by_colleague", List.of(colleague.reference()), List.of()),
            table(outsiderSchema, "i_inherits_outsider", List.of(), List.of()));
    List<String> underDepartment =
        List.of(
            "a_owned_by_sibling",
            "b_owned_by_group",
            "c_owned_by_colleague",
            "d_inherits_group",
            "g_owned_by_sibling",
            "h_owned_by_colleague");

    Listing everyTable = list(member, "/v1/tables?limit=100");

    assertEquals(
        List.of(
            "a_owned_by_sibling", "b_owned_by_group", "c_owned_by_colleague", "d_inherits_group"),
        listTables(member, groupSchema).names());
    assertEquals(underDepartment, everyTable.names());
    assertEquals(underDepartment.size(), everyTable.total());
    assertEquals(underDepartment, readable(member, tables));
    Awaitility.await()
        .atMost(TEAM_POLICY_REFRESH)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              assertEquals(
                  List.of("h_owned_by_colleague", "i_inherits_outsider"),
                  listTables(outsider, outsiderSchema).names());
              assertEquals(
                  List.of(
                      "c_owned_by_colleague",
                      "e_owned_by_outsider",
                      "h_owned_by_colleague",
                      "i_inherits_outsider"),
                  readable(outsider, tables));
            });
  }

  /** Root containers come from a query of their own, which applies the condition as well. */
  @Test
  void aRootContainerListingReturnsAndCountsOnlyTheContainersTheCallerOwns(TestNamespace ns)
      throws Exception {
    Role role = denyRole(ns, "notContainerOwner", Entity.CONTAINER, "!isOwner()");
    Member caller = member(ns, "containerOwner", List.of(role.getId()), List.of(), List.of());
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container owned = container(service, "a_owned_by_caller", null, List.of(caller.reference()));
    container(service, "b_without_owner", null, List.of());
    container(service, "c_child_owned_by_caller", owned, List.of(caller.reference()));

    Listing roots = list(caller, "/v1/containers?root=true&limit=100");
    Listing everyContainer = list(caller, "/v1/containers?limit=100");

    assertEquals(List.of("a_owned_by_caller"), roots.names());
    assertEquals(1, roots.total());
    assertEquals(List.of("a_owned_by_caller", "c_child_owned_by_caller"), everyContainer.names());
    assertEquals(2, everyContainer.total());
  }

  private static OwnedTables ownedTables(TestNamespace ns) {
    Team team = team(ns, "owners", CreateTeam.TeamType.GROUP, null);
    Role role = denyRole(ns, "notOwner", Entity.TABLE, "!isOwner()");
    Member caller = member(ns, "owner", List.of(role.getId()), List.of(team.getId()), List.of());
    Member other = member(ns, "other", List.of(), List.of(), List.of());
    Database ownedDatabase = database(ns, "ownedDb", List.of(caller.reference()));
    Database plainDatabase = database(ns, "plainDb", List.of());
    DatabaseSchema inOwnedDatabase = schema(ownedDatabase, "inherits", List.of(), List.of());
    DatabaseSchema plain = schema(plainDatabase, "plain", List.of(), List.of());
    List<Table> tables =
        List.of(
            table(inOwnedDatabase, "a_inherits_owner", List.of(), List.of()),
            table(
                inOwnedDatabase, "b_owned_by_team", List.of(team.getEntityReference()), List.of()),
            table(inOwnedDatabase, "c_owned_by_other", List.of(other.reference()), List.of()),
            table(plain, "d_without_owner", List.of(), List.of()),
            table(plain, "e_owned_by_caller", List.of(caller.reference()), List.of()));
    return new OwnedTables(caller, inOwnedDatabase, tables);
  }

  private static Role denyRole(TestNamespace ns, String name, String resource, String condition) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix(name))
                        .withDescription("Hides the rows the condition refuses")
                        .withRules(List.of(deny(resource, condition)))));
    return ns.trackRoot(
        Entity.ROLE,
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix(name + "Role"))
                    .withDescription("Role hiding the rows the condition refuses")
                    .withPolicies(List.of(policy.getFullyQualifiedName()))));
  }

  /**
   * Attaches a policy shaped like the seeded TeamOnlyPolicy to {@code team} through a team update,
   * which replaces the snapshot of team policies that callers outside the team are checked against.
   */
  private static void attachTeamOnlyPolicy(TestNamespace ns, Team team) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix("teamOnly"))
                        .withDescription("Hides tables owned outside the team")
                        .withRules(List.of(deny(Entity.TABLE, "!matchTeam()")))));
    admin
        .teams()
        .patch(
            team.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"add\",\"path\":\"/policies\",\"value\":[{\"id\":\"%s\",\"type\":\"policy\"}]}]"
                    .formatted(policy.getId())));
  }

  private static Rule deny(String resource, String condition) {
    return new Rule()
        .withName("deny")
        .withResources(List.of(resource))
        .withOperations(List.of(MetadataOperation.ALL))
        .withEffect(Rule.Effect.DENY)
        .withCondition(condition);
  }

  private static Team team(TestNamespace ns, String name, CreateTeam.TeamType type, UUID parent) {
    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix(name))
            .withTeamType(type)
            .withParents(parent == null ? null : List.of(parent));
    return ns.trackRoot(Entity.TEAM, SdkClients.adminClient().teams().create(create));
  }

  private static Member member(
      TestNamespace ns, String name, List<UUID> roles, List<UUID> teams, List<String> domains) {
    String userName = "lrp_" + name + "_" + UUID.randomUUID().toString().substring(0, 8);
    String email = userName + "@test.openmetadata.org";
    User user =
        ns.trackRoot(
            Entity.USER,
            SdkClients.adminClient()
                .users()
                .create(
                    new CreateUser()
                        .withName(userName)
                        .withEmail(email)
                        .withRoles(roles)
                        .withTeams(teams)
                        .withDomains(domains)));
    return new Member(user, SdkClients.createClient(email, email, new String[] {}));
  }

  private static Domain domain(TestNamespace ns, String name, Domain parent) {
    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix(name))
            .withDescription("Domain for row authorization tests")
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withParent(parent == null ? null : parent.getFullyQualifiedName());
    return ns.trackRoot(Entity.DOMAIN, SdkClients.adminClient().domains().create(create));
  }

  private static Database database(TestNamespace ns, String name, List<EntityReference> owners) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return SdkClients.adminClient()
        .databases()
        .create(
            new CreateDatabase()
                .withName(name)
                .withService(service.getFullyQualifiedName())
                .withOwners(owners));
  }

  private static DatabaseSchema schema(
      Database database, String name, List<EntityReference> owners, List<String> domains) {
    return SdkClients.adminClient()
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(name)
                .withDatabase(database.getFullyQualifiedName())
                .withOwners(owners)
                .withDomains(domains));
  }

  private static Table table(
      DatabaseSchema schema, String name, List<EntityReference> owners, List<String> domains) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withOwners(owners)
                .withDomains(domains)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.INT))));
  }

  private static Container container(
      StorageService service, String name, Container parent, List<EntityReference> owners) {
    return SdkClients.adminClient()
        .containers()
        .create(
            new CreateContainer()
                .withName(name)
                .withService(service.getFullyQualifiedName())
                .withParent(parent == null ? null : parent.getEntityReference())
                .withOwners(owners));
  }

  /** The names of {@code tables} the caller's GET returns, in listing order. */
  private static List<String> readable(Member caller, List<Table> tables) {
    return tables.stream()
        .filter(table -> canRead(caller, table))
        .map(Table::getName)
        .sorted()
        .toList();
  }

  private static boolean canRead(Member caller, Table table) {
    try {
      caller.client().tables().get(table.getId().toString());
      return true;
    } catch (ForbiddenException refused) {
      return false;
    }
  }

  private static Listing listTables(Member caller, DatabaseSchema schema) throws Exception {
    return list(
        caller,
        "/v1/tables?limit=100&databaseSchema="
            + URLEncoder.encode(schema.getFullyQualifiedName(), StandardCharsets.UTF_8));
  }

  private static Listing list(Member caller, String path) throws Exception {
    JsonNode page =
        JsonUtils.readTree(
            caller.client().getHttpClient().executeForString(HttpMethod.GET, path, null));
    List<String> names = new ArrayList<>();
    page.path("data").forEach(row -> names.add(row.path("name").asText()));
    JsonNode paging = page.path("paging");
    return new Listing(names, paging.path("total").asInt(-1), paging.path("after").asText(null));
  }
}
