package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * A data contract has no domain of its own, so it is in the domains of the entity it governs. A
 * member of one domain who holds the DomainOnlyAccessRole is refused another domain's contract as
 * they are refused its table, while contracts of their own domain and of domainless tables stay as
 * they were.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataContractDomainAccessIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);
  private static final String CONTRACTS = "/v1/dataContracts";
  private static final String FOREIGN_DESCRIPTION = "Contract of another domain's table";

  private record Fixture(
      OpenMetadataClient member,
      DataContract own,
      DataContract domainless,
      DataContract foreign,
      DataContract inheritedForeign,
      Table foreignTableWithoutContract,
      Table ownTableWithoutContract) {}

  @Test
  void contractOfAnotherDomainsTableIsRefusedOnEveryItemRead(TestNamespace ns) {
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Fixture fixture = createFixture(ns, cleanup);
      assertAll(
          Stream.of(fixture.foreign(), fixture.inheritedForeign())
              .flatMap(contract -> itemReadPaths(contract).stream())
              .map(
                  path ->
                      (Executable)
                          () -> assertRefused(() -> get(fixture.member(), path), "GET " + path)));
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void contractOfAnotherDomainsTableIsLeftOutOfListAndSearch(TestNamespace ns) throws Exception {
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Fixture fixture = createFixture(ns, cleanup);
      OpenMetadataClient member = fixture.member();
      String prefix = ns.shortPrefix();
      Set<String> visible = Set.of(fixture.own().getName(), fixture.domainless().getName());

      assertAll(
          () -> assertEquals(visible, listedNames(member, prefix), "GET " + CONTRACTS),
          () ->
              assertEquals(
                  visible,
                  names(get(member, CONTRACTS + "/search?limit=100&q=" + prefix)),
                  "GET " + CONTRACTS + "/search"));
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void contractOfAnotherDomainsTableCannotBeChanged(TestNamespace ns) {
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Fixture fixture = createFixture(ns, cleanup);
      OpenMetadataClient member = fixture.member();
      String path = CONTRACTS + "/" + fixture.foreign().getId();

      assertAll(
          () ->
              assertRefused(
                  () -> patchDescription(member, path, "Changed from another domain"),
                  "PATCH " + path),
          () ->
              assertRefused(
                  () -> member.getHttpClient().executeForString(HttpMethod.DELETE, path, null),
                  "DELETE " + path),
          () ->
              assertRefused(
                  () ->
                      member
                          .dataContracts()
                          .create(contractFor(fixture.foreignTableWithoutContract())),
                  "POST " + CONTRACTS),
          () ->
              assertRefused(
                  () ->
                      member
                          .dataContracts()
                          .createOrUpdate(
                              new CreateDataContract()
                                  .withName(fixture.foreign().getName())
                                  .withEntity(fixture.foreign().getEntity())
                                  .withDescription("Replaced from another domain")),
                  "PUT " + CONTRACTS));

      DataContract stored =
          SdkClients.adminClient().dataContracts().get(fixture.foreign().getId().toString());
      assertEquals(FOREIGN_DESCRIPTION, stored.getDescription());
      assertFalse(stored.getDeleted());
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void ownContractCannotBeMovedOntoAnotherDomainsTable(TestNamespace ns) {
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Fixture fixture = createFixture(ns, cleanup);
      String foreignTable =
          JsonUtils.pojoToJson(fixture.foreignTableWithoutContract().getEntityReference());
      String patch = "[{\"op\":\"replace\",\"path\":\"/entity\",\"value\":%s}]";

      fixture
          .member()
          .getHttpClient()
          .executeForString(
              HttpMethod.PATCH,
              CONTRACTS + "/" + fixture.own().getId(),
              JsonUtils.readTree(patch.formatted(foreignTable)));

      assertEquals(
          fixture.own().getEntity().getId(),
          SdkClients.adminClient()
              .dataContracts()
              .get(fixture.own().getId().toString())
              .getEntity()
              .getId());
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void contractsOfOwnDomainAndDomainlessTablesStayOpenToTheMember(TestNamespace ns)
      throws Exception {
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Fixture fixture = createFixture(ns, cleanup);
      for (DataContract contract : List.of(fixture.own(), fixture.domainless())) {
        String path = CONTRACTS + "/" + contract.getId();
        assertEquals(
            contract.getName(), MAPPER.readTree(get(fixture.member(), path)).get("name").asText());
        String changed = "Edited by a member of " + contract.getName();
        patchDescription(fixture.member(), path, changed);
        assertEquals(
            changed,
            SdkClients.adminClient()
                .dataContracts()
                .get(contract.getId().toString())
                .getDescription());
      }
      Table ownTable = fixture.ownTableWithoutContract();
      assertEquals(
          ownTable.getId(),
          fixture.member().dataContracts().create(contractFor(ownTable)).getEntity().getId());
    } finally {
      drain(cleanup);
    }
  }

  private static void assertRefused(Executable request, String description) {
    assertThrows(
        ForbiddenException.class,
        request,
        description + " must be refused to a member of another domain");
  }

  private static List<String> itemReadPaths(DataContract contract) {
    String byId = CONTRACTS + "/" + contract.getId();
    String byName = CONTRACTS + "/name/" + contract.getFullyQualifiedName();
    return List.of(
        byId,
        byName,
        byId + "/odcs",
        byId + "/odcs/yaml",
        byName + "/odcs",
        byId + "/versions",
        byId + "/versions/0.1",
        byId + "/results");
  }

  private Fixture createFixture(TestNamespace ns, Deque<Runnable> cleanup) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = ns.shortPrefix();
    Domain ownDomain = createDomain(admin, prefix + "_a", cleanup);
    Domain foreignDomain = createDomain(admin, prefix + "_b", cleanup);
    DatabaseSchema schema = createSchema(admin, prefix, null, cleanup);
    DatabaseSchema foreignSchema = createSchema(admin, prefix + "_f", foreignDomain, cleanup);
    OpenMetadataClient member = createDomainMember(admin, prefix, ownDomain, cleanup);
    return new Fixture(
        member,
        createContract(admin, createTable(admin, prefix + "_own", schema, ownDomain), "Own"),
        createContract(admin, createTable(admin, prefix + "_none", schema, null), "Domainless"),
        createContract(
            admin, createTable(admin, prefix + "_for", schema, foreignDomain), FOREIGN_DESCRIPTION),
        createContract(
            admin, createTable(admin, prefix + "_inh", foreignSchema, null), FOREIGN_DESCRIPTION),
        createTable(admin, prefix + "_new", schema, foreignDomain),
        createTable(admin, prefix + "_add", schema, ownDomain));
  }

  /** As in the report: a Group team in one domain whose default roles every member gets. */
  private OpenMetadataClient createDomainMember(
      OpenMetadataClient admin, String prefix, Domain domain, Deque<Runnable> cleanup) {
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(prefix + "_team")
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withDefaultRoles(
                        List.of(
                            admin.roles().getByName("DataConsumer").getId(),
                            admin.roles().getByName("DomainOnlyAccessRole").getId())));
    cleanup.push(() -> admin.teams().delete(team.getId().toString(), Map.of("hardDelete", "true")));
    String email = prefix + "_member@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(prefix + "_member")
                    .withEmail(email)
                    .withTeams(List.of(team.getId())));
    cleanup.push(() -> admin.users().delete(user.getId().toString(), Map.of("hardDelete", "true")));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(name)
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Data contract domain access test domain"));
    cleanup.push(
        () -> admin.domains().delete(domain.getId().toString(), Map.of("hardDelete", "true")));
    return domain;
  }

  private DatabaseSchema createSchema(
      OpenMetadataClient admin, String prefix, Domain domain, Deque<Runnable> cleanup) {
    Database database =
        admin
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "_db")
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    cleanup.push(
        () ->
            admin
                .databases()
                .delete(
                    database.getId().toString(),
                    Map.of("recursive", "true", "hardDelete", "true")));
    CreateDatabaseSchema create =
        new CreateDatabaseSchema()
            .withName(prefix + "_sch")
            .withDatabase(database.getFullyQualifiedName());
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return admin.databaseSchemas().create(create);
  }

  private static Table createTable(
      OpenMetadataClient admin, String name, DatabaseSchema schema, Domain domain) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(COLUMN));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return admin.tables().create(create);
  }

  private static DataContract createContract(
      OpenMetadataClient admin, Table table, String description) {
    return admin.dataContracts().create(contractFor(table).withDescription(description));
  }

  private static CreateDataContract contractFor(Table table) {
    return new CreateDataContract()
        .withName(table.getName() + "_contract")
        .withEntity(table.getEntityReference());
  }

  private static String get(OpenMetadataClient client, String path) {
    return client.getHttpClient().executeForString(HttpMethod.GET, path, null);
  }

  private static void patchDescription(OpenMetadataClient client, String path, String description) {
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"%s\"}]".formatted(description);
    client.getHttpClient().executeForString(HttpMethod.PATCH, path, JsonUtils.readTree(patch));
  }

  private static Set<String> names(String resultList) throws Exception {
    Set<String> names = new HashSet<>();
    for (JsonNode contract : MAPPER.readTree(resultList).path("data")) {
      names.add(contract.get("name").asText());
    }
    return names;
  }

  /** The names under {@code prefix} across every page of the listing, which has no name filter. */
  private static Set<String> listedNames(OpenMetadataClient client, String prefix)
      throws Exception {
    Set<String> names = new HashSet<>();
    String after = null;
    do {
      String page = CONTRACTS + "?limit=100" + (after == null ? "" : "&after=" + after);
      JsonNode response = MAPPER.readTree(get(client, page));
      for (JsonNode contract : response.path("data")) {
        names.add(contract.get("name").asText());
      }
      JsonNode next = response.path("paging").path("after");
      after = next.isTextual() ? URLEncoder.encode(next.asText(), StandardCharsets.UTF_8) : null;
    } while (after != null);
    names.removeIf(name -> !name.startsWith(prefix));
    return names;
  }

  private static void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown; each test method works in its own namespace.
      }
    }
  }
}
