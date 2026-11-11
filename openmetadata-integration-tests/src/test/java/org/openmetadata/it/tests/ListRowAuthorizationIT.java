package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateLogicalTestCases;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.drives.FolderService;
import org.openmetadata.service.Entity;

/**
 * A listing returns only the rows its caller may read, and a tag condition sees the tags of an
 * entity's inline children (columns, tasks). Each test restricts its own user with a deny rule on
 * a tag of its own classification, so nothing else in the run is affected.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ListRowAuthorizationIT {

  @Test
  void aTableListingLeavesOutRowsADenyRuleRefusesAndStillFillsThePage(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String secret = secretTag(ns, "listing");
    OpenMetadataClient restricted = restrictedUser(ns, "listing", secret, Entity.TABLE);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    List<String> hidden = new ArrayList<>();
    for (int i = 1; i <= 3; i++) {
      hidden.add(
          createTable(admin, schema, "a_hidden_" + i, List.of(tag(secret)), List.of()).getName());
    }
    for (int i = 1; i <= 3; i++) {
      createTable(admin, schema, "b_visible_" + i, List.of(), List.of());
    }

    JsonNode firstPage = listTables(restricted, schema, "&limit=2");
    assertEquals(List.of("b_visible_1", "b_visible_2"), names(firstPage));
    // Nothing lies before the first page, so it offers no way back.
    assertNull(firstPage.path("paging").path("before").asText(null), firstPage.toString());
    String after = firstPage.path("paging").path("after").asText(null);
    assertNotNull(after, firstPage.toString());
    for (String name : hidden) {
      assertFalse(cursorText(after).contains(name), "cursor names a hidden row: " + after);
    }
    JsonNode secondPage =
        listTables(
            restricted,
            schema,
            "&limit=2&after=" + URLEncoder.encode(after, StandardCharsets.UTF_8));
    assertEquals(List.of("b_visible_3"), names(secondPage));
  }

  @Test
  void aFileListingOrderedByUpdateTimeLeavesOutAndDoesNotCountRowsADenyRuleRefuses(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String secret = secretTag(ns, "files");
    OpenMetadataClient restricted = restrictedUser(ns, "files", secret, Entity.CONTEXT_FILE);
    Folder folder =
        new FolderService(admin.getHttpClient())
            .create(new CreateFolder().withName(ns.prefix("lraFiles")));
    admin
        .contextFiles()
        .create(
            new CreateContextFile()
                .withName(ns.prefix("hiddenFile"))
                .withFolder(folder.getFullyQualifiedName())
                .withTags(List.of(tag(secret))));
    ContextFile visible =
        admin
            .contextFiles()
            .create(
                new CreateContextFile()
                    .withName(ns.prefix("visibleFile"))
                    .withFolder(folder.getFullyQualifiedName()));

    JsonNode ordered =
        list(
            restricted,
            "/v1/contextCenter/drive/files?orderBy=DESC&limit=10&folderId=" + folder.getId());
    assertEquals(List.of(visible.getName()), names(ordered));
    assertEquals(1, ordered.path("paging").path("total").asInt(), ordered.toString());
  }

  @Test
  void aColumnTagDeniesTheTableWhateverFieldsAreRequested(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String secret = secretTag(ns, "column");
    OpenMetadataClient restricted = restrictedUser(ns, "column", secret, Entity.TABLE);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table table = createTable(admin, schema, "column_tagged", List.of(), List.of(tag(secret)));

    assertThrows(ForbiddenException.class, () -> restricted.tables().get(table.getId().toString()));
    assertThrows(
        ForbiddenException.class,
        () -> restricted.tables().get(table.getId().toString(), "owners"));
    assertEquals(List.of(), names(listTables(restricted, schema, "&limit=10")));
  }

  @Test
  void aTaskTagDeniesThePipeline(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String secret = secretTag(ns, "task");
    OpenMetadataClient restricted = restrictedUser(ns, "task", secret, Entity.PIPELINE);
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    Pipeline pipeline =
        admin
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(ns.prefix("taskTagged"))
                    .withService(service.getFullyQualifiedName())
                    .withTasks(
                        List.of(new Task().withName("extract").withTags(List.of(tag(secret))))));

    assertThrows(
        ForbiddenException.class, () -> restricted.pipelines().get(pipeline.getId().toString()));
  }

  @Test
  void aTestSuiteListingLeavesOutTestCasesTheirItemEndpointRefuses(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String secret = secretTag(ns, "suite");
    OpenMetadataClient restricted = cleanedUpRestrictedUser(ns, "suite", secret, Entity.TABLE);
    // A table's basic suite is named after its FQN, which the namespace prefix pushes past the
    // column limit.
    String shortId = ns.uniqueShortId();
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName(
            "s_" + shortId,
            ns,
            DatabaseServiceTestFactory.createPostgresWithName("lra_" + shortId, ns));
    TestCase hidden =
        tableTest(ns, createTable(admin, schema, "suite_secret", List.of(tag(secret)), List.of()));
    TestCase shown = tableTest(ns, createTable(admin, schema, "suite_open", List.of(), List.of()));
    TestSuite suite =
        ns.trackRoot(
            Entity.TEST_SUITE,
            admin
                .testSuites()
                .create(new CreateTestSuite().withName("lra_suite_" + ns.uniqueShortId())));
    admin
        .testCases()
        .addToLogicalTestSuite(
            new CreateLogicalTestCases()
                .withTestSuiteId(suite.getId())
                .withTestCaseIds(List.of(hidden.getId(), shown.getId())));

    assertThrows(
        ForbiddenException.class, () -> restricted.testCases().get(hidden.getId().toString()));
    assertEquals(
        List.of(shown.getName()),
        names(
            list(
                restricted,
                "/v1/dataQuality/testCases?testSuiteId="
                    + suite.getId()
                    + "&fields=testCaseResult&limit=10")));
  }

  @Test
  void aQueryListingOfATableLeavesOutQueriesTheirItemEndpointRefuses(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String secret = secretTag(ns, "query");
    OpenMetadataClient restricted = cleanedUpRestrictedUser(ns, "query", secret, Entity.QUERY);
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Table table =
        createTable(
            admin,
            DatabaseSchemaTestFactory.createSimple(ns, service),
            "queried",
            List.of(),
            List.of());
    Query hidden = queryOn(ns, service, table, List.of(tag(secret)));
    Query shown = queryOn(ns, service, table, List.of());

    assertThrows(
        ForbiddenException.class, () -> restricted.queries().get(hidden.getId().toString()));
    assertEquals(
        List.of(shown.getName()),
        names(
            list(
                restricted,
                "/v1/queries?entityId=" + table.getId() + "&entityType=table&limit=10")));
  }

  private static TestCase tableTest(TestNamespace ns, Table table) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name("lra_test_" + ns.uniqueShortId())
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private static Query queryOn(
      TestNamespace ns, DatabaseService service, Table table, List<TagLabel> tags) {
    String name = "lra_query_" + ns.uniqueShortId();
    return SdkClients.adminClient()
        .queries()
        .create(
            new CreateQuery()
                .withName(name)
                .withQuery("SELECT id FROM " + table.getFullyQualifiedName() + " -- " + name)
                .withService(service.getFullyQualifiedName())
                .withQueryUsedIn(List.of(table.getEntityReference()))
                .withQueryDate(System.currentTimeMillis())
                .withTags(tags));
  }

  private static JsonNode list(OpenMetadataClient client, String path) throws Exception {
    return JsonUtils.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

  private static String secretTag(TestNamespace ns, String suffix) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        admin
            .classifications()
            .create(
                new CreateClassification()
                    .withName("lra_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8))
                    .withDescription("Classification for row authorization tests"));
    ns.trackRoot(Entity.CLASSIFICATION, classification);
    Tag tag =
        admin
            .tags()
            .create(
                new CreateTag()
                    .withName("secret")
                    .withDescription("Tag a deny rule hides")
                    .withClassification(classification.getFullyQualifiedName()));
    return tag.getFullyQualifiedName();
  }

  private static OpenMetadataClient restrictedUser(
      TestNamespace ns, String suffix, String secretTag, String resource) {
    return userWithRole(ns, suffix, denySecretRole(ns, suffix, secretTag, resource).role());
  }

  /** {@link #restrictedUser} whose policy and role are deleted after the test as well. */
  private static OpenMetadataClient cleanedUpRestrictedUser(
      TestNamespace ns, String suffix, String secretTag, String resource) {
    DenySecretRole denySecret = denySecretRole(ns, suffix, secretTag, resource);
    ns.trackRoot(Entity.POLICY, denySecret.policy());
    ns.trackRoot(Entity.ROLE, denySecret.role());
    return userWithRole(ns, suffix, denySecret.role());
  }

  private record DenySecretRole(Policy policy, Role role) {}

  private static DenySecretRole denySecretRole(
      TestNamespace ns, String suffix, String secretTag, String resource) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix(suffix + "DenySecret"))
                    .withDescription("Hides what carries the secret tag")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("denySecret")
                                .withResources(List.of(resource))
                                .withOperations(List.of(MetadataOperation.ALL))
                                .withEffect(Rule.Effect.DENY)
                                .withCondition("matchAnyTag('" + secretTag + "')"))));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix(suffix + "DenySecretRole"))
                    .withDescription("Role hiding the secret tag")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    return new DenySecretRole(policy, role);
  }

  private static OpenMetadataClient userWithRole(TestNamespace ns, String suffix, Role role) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = "lra_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@test.openmetadata.org";
    ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId()))));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static Table createTable(
      OpenMetadataClient admin,
      DatabaseSchema schema,
      String name,
      List<TagLabel> tableTags,
      List<TagLabel> columnTags) {
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTags(tableTags)
                .withColumns(
                    List.of(
                        new Column()
                            .withName("id")
                            .withDataType(ColumnDataType.INT)
                            .withTags(columnTags))));
  }

  private static TagLabel tag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static JsonNode listTables(OpenMetadataClient client, DatabaseSchema schema, String query)
      throws Exception {
    String path =
        "/v1/tables?databaseSchema="
            + URLEncoder.encode(schema.getFullyQualifiedName(), StandardCharsets.UTF_8)
            + query;
    return JsonUtils.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

  private static List<String> names(JsonNode page) {
    List<String> names = new ArrayList<>();
    page.path("data").forEach(row -> names.add(row.path("name").asText()));
    return names;
  }

  /** The text a cursor carries: a sealed cursor carries none. */
  private static String cursorText(String cursor) {
    try {
      return new String(java.util.Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
    } catch (IllegalArgumentException sealed) {
      return "";
    }
  }
}
