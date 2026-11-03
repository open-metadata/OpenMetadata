package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
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
