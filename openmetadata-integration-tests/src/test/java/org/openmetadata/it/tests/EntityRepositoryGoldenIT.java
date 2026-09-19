package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.EntityGoldenSnapshot;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.AsyncService.DatabaseOperation;

@Isolated("Captures lifecycle state and events without concurrent catalog mutation")
@ExtendWith(TestNamespaceExtension.class)
class EntityRepositoryGoldenIT {
  private enum Kind {
    // renameAllowed mirrors the repository flag of the same name. It is declared here rather than
    // read from the repository because that field is protected, and the point of this suite is to
    // freeze the extension surface rather than widen it for a test. Asserted on every run, so a
    // kind that starts or stops honouring renames fails here instead of silently changing what the
    // rename fixtures mean.
    TABLE(Entity.TABLE, "/v1/tables", "table_search_index", false),
    GLOSSARY_TERM(Entity.GLOSSARY_TERM, "/v1/glossaryTerms", "glossary_term_search_index", true),
    USER(Entity.USER, "/v1/users", "user_search_index", false),
    TEST_CASE(Entity.TEST_CASE, "/v1/dataQuality/testCases", "test_case_search_index", false);

    private final String type;
    private final String path;
    private final String index;
    private final boolean renameAllowed;

    Kind(String type, String path, String index, boolean renameAllowed) {
      this.type = type;
      this.path = path;
      this.index = index;
      this.renameAllowed = renameAllowed;
    }
  }

  @ParameterizedTest
  @EnumSource(Kind.class)
  void createIsSearchableWhenApiReturns(Kind kind, TestNamespace ns) {
    final JsonNode created =
        call(HttpMethod.POST, kind.path, request(kind, ns, new LinkedHashMap<>()));
    ns.trackRoot(kind.type, UUID.fromString(created.path("id").asText()));
    final JsonNode hits = search(kind, "id:" + created.path("id").asText());
    assertEquals(1, hits.size());
    assertEquals(created.path("fullyQualifiedName"), hits.get(0).path("fullyQualifiedName"));
    assertEquals(created.path("description"), hits.get(0).path("description"));
  }

  @ParameterizedTest
  @EnumSource(value = Kind.class, names = "GLOSSARY_TERM")
  void renameIsSearchableWhenApiReturns(Kind kind, TestNamespace ns) {
    final JsonNode created =
        call(HttpMethod.POST, kind.path, request(kind, ns, new LinkedHashMap<>()));
    final String id = created.path("id").asText();
    ns.trackRoot(kind.type, UUID.fromString(id));
    final JsonNode renamed = patch(kind.path + "/" + id, "name", ns.shortPrefix("renamed"));
    final JsonNode hits = search(kind, "name.keyword:" + renamed.path("name").asText());
    assertEquals(1, hits.size());
    assertEquals(renamed.path("fullyQualifiedName"), hits.get(0).path("fullyQualifiedName"));
    assertEquals(id, hits.get(0).path("id").asText());
    assertEquals(0, search(kind, "name.keyword:" + created.path("name").asText()).size());
  }

  private JsonNode search(Kind kind, String query) {
    final String response =
        SdkClients.adminClient().search().query(query).index(kind.index).execute();
    final var sources = JsonUtils.getObjectMapper().createArrayNode();
    JsonUtils.readTree(response)
        .path("hits")
        .path("hits")
        .forEach(hit -> sources.add(hit.path("_source")));
    return sources;
  }

  @ParameterizedTest
  @EnumSource(Kind.class)
  void lifecycleMatchesMain(Kind kind, TestNamespace ns) throws IOException {
    final var aliases = new LinkedHashMap<String, String>();
    aliases.put(ns.shortPrefix(), "golden");
    final ObjectNode request = request(kind, ns, aliases);
    final JsonNode created = call(HttpMethod.POST, kind.path, request);
    final UUID id = UUID.fromString(created.path("id").asText());
    ns.trackRoot(kind.type, id);
    final var scenario = new Scenario(kind, id, request, new EntityGoldenSnapshot(id, aliases));
    scenario.capture("create");
    scenario.putDescription("put");
    scenario.patchDescription("first", "patch");
    scenario.patchDescription("second", "patch-in-session");
    scenario.patchDescription("second", "patch-noop");
    scenario.rename(ns.shortPrefix("renamed"));
    scenario.patchDescription("after rename", "patch-after-rename");
    scenario.importDescription();
    scenario.importCsv();
    scenario.replayPatch();
    scenario.delete(false);
    scenario.restore();
    final var child = cascadeChild(kind, id, ns, aliases);
    scenario.delete(true);
    if (child != null) {
      child.capture("cascade-after");
    }
  }

  private Scenario cascadeChild(
      Kind kind, UUID parentId, TestNamespace ns, Map<String, String> aliases) throws IOException {
    if (kind != Kind.TABLE && kind != Kind.GLOSSARY_TERM) {
      return null;
    }
    final Object request;
    final Kind childKind;
    if (kind == Kind.TABLE) {
      childKind = Kind.TEST_CASE;
      request =
          TestCaseBuilder.create(SdkClients.adminClient())
              .name(ns.shortPrefix("child"))
              .description("cascade child")
              .forTable(SdkClients.adminClient().tables().get(parentId.toString()))
              .testDefinition("tableRowCountToEqual")
              .parameter("value", "100")
              .build();
    } else {
      childKind = Kind.GLOSSARY_TERM;
      final var parent =
          SdkClients.adminClient().glossaryTerms().get(parentId.toString(), "glossary");
      request =
          new CreateGlossaryTerm()
              .withName(ns.shortPrefix("child"))
              .withDescription("cascade child")
              .withGlossary(parent.getGlossary().getFullyQualifiedName())
              .withParent(parent.getFullyQualifiedName());
    }
    final ObjectNode body = (ObjectNode) JsonUtils.valueToTree(request);
    final UUID id =
        UUID.fromString(call(HttpMethod.POST, childKind.path, body).path("id").asText());
    ns.trackRoot(childKind.type, id);
    final var child = new Scenario(childKind, id, body, new EntityGoldenSnapshot(id, aliases));
    child.capture("cascade-before");
    return child;
  }

  @ParameterizedTest
  @EnumSource(Kind.class)
  void bulkCreateMatchesMain(Kind kind, TestNamespace ns) throws IOException {
    final var aliases = new LinkedHashMap<String, String>();
    aliases.put(ns.shortPrefix(), "golden");
    final JsonNode created = call(HttpMethod.POST, kind.path, request(kind, ns, aliases));
    final UUID id = UUID.fromString(created.path("id").asText());
    ns.trackRoot(kind.type, id);
    bulkCreate(Entity.getEntityRepository(kind.type), id, ns, aliases);
  }

  private <T extends EntityInterface> void bulkCreate(
      EntityRepository<T> repository, UUID source, TestNamespace ns, Map<String, String> aliases)
      throws IOException {
    final List<T> batch = new ArrayList<>();
    for (int index = 0; index < 2; index++) {
      final T entity =
          repository.get(null, source, repository.getFields("*"), Include.NON_DELETED, false);
      entity.setId(UUID.randomUUID());
      entity.setName(ns.shortPrefix("bulk" + index));
      entity.setDescription("bulk");
      entity.setFullyQualifiedName(null);
      entity.setHref(null);
      if (entity instanceof User user) {
        user.setEmail(entity.getName() + "@example.test");
      }
      batch.add(entity);
      ns.trackRoot(repository.getEntityType(), entity.getId());
    }
    repository.createMany(null, batch);
    for (int index = 0; index < batch.size(); index++) {
      final UUID id = batch.get(index).getId();
      new EntityGoldenSnapshot(id, aliases)
          .assertMatches("bulk-create-" + index, repository.getEntityType(), id);
    }
  }

  private ObjectNode request(Kind kind, TestNamespace ns, Map<String, String> aliases) {
    final String name = ns.shortPrefix("entity");
    return (ObjectNode)
        JsonUtils.valueToTree(
            switch (kind) {
              case TABLE -> new CreateTable()
                  .withName(name)
                  .withDescription("created")
                  .withDatabaseSchema(schema(ns, aliases))
                  .withColumns(
                      List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
              case GLOSSARY_TERM -> new CreateGlossaryTerm()
                  .withName(name)
                  .withDescription("created")
                  .withGlossary(glossary(ns, aliases));
              case USER -> new CreateUser()
                  .withName(name)
                  .withDescription("created")
                  .withEmail(name + "@example.test")
                  .withTeams(List.of(team(ns, aliases)));
              case TEST_CASE -> TestCaseBuilder.create(SdkClients.adminClient())
                  .name(name)
                  .description("created")
                  .forTable(table(ns, aliases))
                  .testDefinition("tableRowCountToEqual")
                  .parameter("value", "100")
                  .build();
            });
  }

  private UUID team(TestNamespace ns, Map<String, String> aliases) {
    final var team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    ns.trackRoot(Entity.TEAM, team.getId());
    alias(aliases, team.getEntityReference(), "team");
    return team.getId();
  }

  private String schema(TestNamespace ns, Map<String, String> aliases) {
    final var service =
        DatabaseServiceTestFactory.createPostgresWithName(ns.shortPrefix("svc"), ns);
    final var schema =
        DatabaseSchemaTestFactory.createSimpleWithName(ns.shortPrefix("schema"), ns, service);
    alias(aliases, schema.getService(), "service");
    alias(aliases, schema.getDatabase(), "service.database");
    alias(aliases, schema.getEntityReference(), "service.database.schema");
    return schema.getFullyQualifiedName();
  }

  private Table table(TestNamespace ns, Map<String, String> aliases) {
    final var table =
        TableTestFactory.createSimpleWithName(ns.shortPrefix("table"), ns, schema(ns, aliases));
    alias(aliases, table.getEntityReference(), "service.database.schema.table");
    return table;
  }

  private String glossary(TestNamespace ns, Map<String, String> aliases) {
    final var glossary = GlossaryTestFactory.createSimple(ns);
    alias(aliases, glossary.getEntityReference(), "glossary");
    return glossary.getFullyQualifiedName();
  }

  private void alias(Map<String, String> aliases, EntityReference reference, String replacement) {
    aliases.put(reference.getFullyQualifiedName(), replacement);
    aliases.put(reference.getName(), replacement.substring(replacement.lastIndexOf('.') + 1));
  }

  private static JsonNode call(HttpMethod method, String path, JsonNode body) {
    final String result =
        SdkClients.adminClient().getHttpClient().executeForString(method, path, body);
    return result == null || result.isBlank()
        ? JsonUtils.getObjectNode()
        : JsonUtils.readTree(result);
  }

  private static JsonNode patch(String path, String field, String value) {
    final ObjectNode operation = JsonUtils.getObjectNode();
    operation.put("op", "add").put("path", "/" + field).put("value", value);
    return call(HttpMethod.PATCH, path, JsonUtils.valueToTree(List.of(operation)));
  }

  private record Scenario(Kind kind, UUID id, ObjectNode request, EntityGoldenSnapshot snapshot) {
    private String path() {
      return kind.path + "/" + id;
    }

    private void capture(String name) throws IOException {
      snapshot.assertMatches(name, kind.type, id);
    }

    private void putDescription(String description) throws IOException {
      request.put("description", description);
      call(HttpMethod.PUT, kind.path, request);
      capture("put");
    }

    private void patchDescription(String description, String name) throws IOException {
      patch(path(), "description", description);
      capture(name);
    }

    /**
     * Renames the entity, for the kinds that allow it.
     *
     * <p>Only GlossaryTerm sets {@code renameAllowed}. For Table, User and TestCase the PATCH
     * returns 200 and the new name is silently ignored, so capturing a "rename" fixture for them
     * recorded a duplicate of patch-noop that could never detect a rename regression. The
     * post-condition is asserted rather than assumed: a kind that starts honouring or rejecting a
     * rename has to be dealt with here instead of quietly changing what the baseline means.
     */
    /**
     * Renames the entity and pins the outcome, which differs by kind.
     *
     * <p>Only GlossaryTerm sets {@code renameAllowed}. For the others the PATCH still returns 200
     * and {@code EntityRepository:1325} puts the original name back, so without an assertion the
     * captured fixture is indistinguishable from patch-noop and could never detect a rename
     * regression. The fixture is still captured for every kind, because "the name was rejected"
     * does not mean "nothing was written": {@code table/rename.json} records a column whose
     * fullyQualifiedName was rebuilt from the rejected name while the table kept the old one.
     */
    private void rename(String name) throws IOException {
      final JsonNode result = patch(path(), "name", name);
      if (kind.renameAllowed) {
        assertEquals(name, result.path("name").asText(), kind.type + " did not honour the rename");
      } else {
        assertNotEquals(
            name, result.path("name").asText(), kind.type + " unexpectedly honoured a rename");
      }
      capture("rename");
    }

    private void importDescription() throws IOException {
      importEntity(Entity.getEntityRepository(kind.type), id);
      capture("import-update");
    }

    private <T extends EntityInterface> void importEntity(EntityRepository<T> repository, UUID id) {
      final T entity =
          repository.get(null, id, repository.getFields("*"), Include.NON_DELETED, false);
      entity.setDescription("import");
      repository.createOrUpdateForImport(null, entity, "admin");
    }

    private void importCsv() throws IOException {
      final EntityRepository<?> repository = Entity.getEntityRepository(kind.type);
      final JsonNode entity = call(HttpMethod.GET, path() + "?fields=*", null);
      final String scope =
          switch (kind) {
            case TABLE -> entity.path("fullyQualifiedName").asText();
            case GLOSSARY_TERM -> entity.path("glossary").path("fullyQualifiedName").asText();
            case USER -> entity.path("teams").get(0).path("fullyQualifiedName").asText();
            case TEST_CASE -> entity.path("entityFQN").asText();
          };
      final var exporter =
          kind == Kind.GLOSSARY_TERM ? Entity.getEntityRepository(Entity.GLOSSARY) : repository;
      final String csv = withCsvDescription(exporter.exportToCsv(scope, "admin", false));
      final var result =
          kind == Kind.TEST_CASE
              ? repository.importFromCsv(scope, csv, false, "admin", false, Entity.TABLE)
              : exporter.importFromCsv(scope, csv, false, "admin", false);
      assertEquals(0, result.getNumberOfRowsFailed(), result.getImportResultsCsv());
      assertEquals(1, result.getNumberOfRowsPassed(), result.getImportResultsCsv());
      // CSV currently persists its events asynchronously; snapshot the completed event contract.
      final var async = AsyncService.getInstance();
      Awaitility.await()
          .atMost(Duration.ofSeconds(10))
          .during(Duration.ofMillis(100))
          .until(
              () ->
                  async.getOperationQueuedCount(DatabaseOperation.CSV_CHANGE_EVENT) == 0
                      && async.getOperationActiveCount(DatabaseOperation.CSV_CHANGE_EVENT) == 0);
      capture("csv-import");
    }

    private String withCsvDescription(String csv) throws IOException {
      try (var parser = CSVFormat.DEFAULT.parse(new StringReader(csv));
          var output = new StringWriter();
          var printer = new CSVPrinter(output, CSVFormat.DEFAULT)) {
        final var records = parser.getRecords();
        final var headers = records.getFirst().toList();
        final int description =
            headers.indexOf(kind == Kind.TABLE ? "column.description" : "description");
        org.junit.jupiter.api.Assertions.assertTrue(
            description >= 0, "CSV has no description column");
        printer.printRecord(headers);
        for (var record : records.subList(1, records.size())) {
          final var values = new ArrayList<>(record.toList());
          // Commons CSV does not pad short records, and a row that omits trailing empty fields is
          // narrower than the header. For Kind.TABLE the description index sits well to the right,
          // so setting it without padding throws IndexOutOfBoundsException.
          while (values.size() <= description) {
            values.add("");
          }
          values.set(description, "csv");
          printer.printRecord(values);
        }
        printer.flush();
        return output.toString();
      }
    }

    private void replayPatch() throws IOException {
      final String table = Entity.getEntityRepository(kind.type).getDao().getTableName();
      try (var writes = SqlQueryCounter.deadlockOnce(Entity.getJdbi(), "update " + table)) {
        patch(path(), "description", "replayed");
        assertEquals(2, writes.count(), "One rolled-back write and one committed replay");
      }
      capture("deadlock-replay");
    }

    private void delete(boolean hard) throws IOException {
      call(HttpMethod.DELETE, path() + "?hardDelete=" + hard + "&recursive=true", null);
      capture(hard ? "hard-delete" : "soft-delete");
    }

    private void restore() throws IOException {
      final ObjectNode body = JsonUtils.getObjectNode();
      body.put("id", id.toString());
      call(HttpMethod.PUT, kind.path + "/restore", body);
      capture("restore");
    }
  }
}
