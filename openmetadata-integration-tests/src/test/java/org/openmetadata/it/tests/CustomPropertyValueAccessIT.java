package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.CustomPropertyTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A caller denied ViewCustomFields on an asset still reads the asset, but never its custom
 * property values: not in the entity, its change description, a list row, a stored version or a
 * write response. A write from such a caller keeps the values it was not shown.
 * ADR:2026-11-17-custom-property-values-need-view-custom-fields
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class CustomPropertyValueAccessIT {

  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @Test
  void aViewCustomFieldsDenyLeavesTheValuesOutOfEveryRead(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String property = registerProperty(admin);
    try {
      OpenMetadataClient denied = clientOf(user(ns, "all", denyValues(null)));
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      Table table = table(admin, schema, "cpv_all", Map.of(property, "FIN-042"), List.of(), null);
      patch(admin, table, "replace", "/extension/" + property, "FIN-043");

      for (String path : readsOf(table, schema)) {
        assertNoValue(get(denied, path), path);
      }
      assertEquals(table.getName(), readTree(get(denied, byId(table, ""))).path("name").asText());
      assertTrue(get(admin, byId(table, "?fields=extension")).contains("FIN-043"));
    } finally {
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, property);
    }
  }

  @Test
  void aConditionalDenyLeavesOutOnlyTheValuesOfTheRowsItMatches(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String property = registerProperty(admin);
    try {
      String secret = secretTag(ns);
      OpenMetadataClient denied =
          clientOf(user(ns, "tagged", denyValues("matchAnyTag('" + secret + "')")));
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      table(admin, schema, "cpv_hidden", Map.of(property, "SECRET-1"), List.of(tag(secret)), null);
      table(admin, schema, "cpv_shown", Map.of(property, "PUBLIC-1"), List.of(), null);

      JsonNode rows = readTree(get(denied, listOf(schema, "&limit=10"))).path("data");
      assertEquals(2, rows.size(), rows.toString());
      assertFalse(rows.toString().contains("SECRET-1"), rows.toString());
      assertTrue(rows.toString().contains("PUBLIC-1"), rows.toString());
    } finally {
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, property);
    }
  }

  /** The deny reads the asset's owners, which a GET that did not ask for them never returns. */
  @Test
  void anOwnershipDenyLeavesOutTheValuesOfAnOwnedAssetOnASingleRead(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String property = registerProperty(admin);
    try {
      OpenMetadataClient denied = clientOf(user(ns, "owned", denyValues("!noOwner()")));
      EntityReference owner = user(ns, "owner").getEntityReference();
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      Table table = table(admin, schema, "cpv_owned", Map.of(property, "OWN-1"), List.of(), owner);

      assertNoValue(get(denied, byId(table, "?fields=extension")), "GET by id");
      assertNoValue(get(denied, byName(table, "?fields=extension")), "GET by name");
      assertTrue(get(admin, byId(table, "?fields=extension")).contains("OWN-1"));
    } finally {
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, property);
    }
  }

  /** A caller shown no values sends only the one it sets; the others are kept, not deleted. */
  @Test
  void aWriteFromACallerShownNoValuesKeepsTheValuesItWasNotShown(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String hidden = registerProperty(admin);
    String written = registerProperty(admin);
    try {
      OpenMetadataClient editor = clientOf(user(ns, "editor", denyValues(null), allowEdits()));
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      Table table = table(admin, schema, "cpv_kept", Map.of(hidden, "KEEP-1"), List.of(), null);

      assertNoValue(patch(editor, table, "add", "/extension", Map.of(written, "SET-1")), "PATCH");
      assertValues(admin, table, "KEEP-1", "SET-1");

      CreateTable put = create(schema, "cpv_kept", Map.of(written, "SET-2"), List.of(), null);
      assertNoValue(send(editor, HttpMethod.PUT, "/v1/tables", JsonUtils.pojoToJson(put)), "PUT");
      assertValues(admin, table, "KEEP-1", "SET-2");
    } finally {
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, hidden);
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, written);
    }
  }

  private static List<String> readsOf(Table table, DatabaseSchema schema) {
    return List.of(
        byId(table, "?fields=extension"),
        byName(table, "?fields=extension"),
        listOf(schema, ""),
        byId(table, "/versions"),
        byId(table, "/versions/0.1"));
  }

  private static String byId(Table table, String suffix) {
    return "/v1/tables/" + table.getId() + suffix;
  }

  private static String byName(Table table, String suffix) {
    return "/v1/tables/name/" + table.getFullyQualifiedName() + suffix;
  }

  private static String listOf(DatabaseSchema schema, String suffix) {
    return "/v1/tables?databaseSchema="
        + schema.getFullyQualifiedName()
        + "&fields=extension"
        + suffix;
  }

  private static void assertNoValue(String body, String read) {
    assertFalse(
        body.contains("FIN-04") || body.contains("OWN-1") || body.contains("KEEP-1"),
        read + " returned a custom property value: " + body);
  }

  private static void assertValues(OpenMetadataClient admin, Table table, String... values)
      throws Exception {
    String body = get(admin, byId(table, "?fields=extension"));
    for (String value : values) {
      assertTrue(body.contains(value), value + " missing: " + body);
    }
  }

  private static String registerProperty(OpenMetadataClient admin) throws Exception {
    String property = "cpv" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    CustomPropertyTestSupport.registerStringProperty(admin, Entity.TABLE, property);
    return property;
  }

  private static Table table(
      OpenMetadataClient admin,
      DatabaseSchema schema,
      String name,
      Map<String, String> extension,
      List<TagLabel> tags,
      EntityReference owner) {
    return admin.tables().create(create(schema, name, extension, tags, owner));
  }

  private static CreateTable create(
      DatabaseSchema schema,
      String name,
      Map<String, String> extension,
      List<TagLabel> tags,
      EntityReference owner) {
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withTags(tags)
        .withOwners(owner == null ? null : List.of(owner))
        .withExtension(extension)
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
  }

  private static String patch(
      OpenMetadataClient client, Table table, String op, String path, Object value)
      throws Exception {
    String patch = JsonUtils.pojoToJson(List.of(Map.of("op", op, "path", path, "value", value)));
    return client
        .getHttpClient()
        .executeForString(HttpMethod.PATCH, byId(table, ""), patch, JSON_PATCH);
  }

  private static String send(OpenMetadataClient client, HttpMethod method, String path, String body)
      throws Exception {
    return client.getHttpClient().executeForString(method, path, body);
  }

  private static String get(OpenMetadataClient client, String path) throws Exception {
    return send(client, HttpMethod.GET, path, null);
  }

  private static JsonNode readTree(String body) {
    return JsonUtils.readTree(body);
  }

  private static TagLabel tag(String fqn) {
    return new TagLabel().withTagFQN(fqn).withSource(TagLabel.TagSource.CLASSIFICATION);
  }

  private static String secretTag(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        ns.trackRoot(
            Entity.CLASSIFICATION,
            admin
                .classifications()
                .create(
                    new CreateClassification()
                        .withName("cpv_" + UUID.randomUUID().toString().substring(0, 8))
                        .withDescription("Classification for custom property value tests")));
    CreateTag secret =
        new CreateTag()
            .withName("secret")
            .withDescription("Tag whose assets hide their custom property values")
            .withClassification(classification.getFullyQualifiedName());
    return admin.tags().create(secret).getFullyQualifiedName();
  }

  private static Rule denyValues(String condition) {
    return new Rule()
        .withName("denyCustomPropertyValues")
        .withResources(List.of(Entity.TABLE))
        .withOperations(List.of(MetadataOperation.VIEW_CUSTOM_FIELDS))
        .withEffect(Rule.Effect.DENY)
        .withCondition(condition);
  }

  private static Rule allowEdits() {
    return new Rule()
        .withName("allowTableEdits")
        .withResources(List.of(Entity.TABLE))
        .withOperations(List.of(MetadataOperation.EDIT_ALL))
        .withEffect(Rule.Effect.ALLOW);
  }

  /** A user whose one role holds {@code rules}, or no role when there are none. */
  private static User user(TestNamespace ns, String suffix, Rule... rules) {
    String name = "cpv_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser user = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    if (rules.length > 0) {
      user.withRoles(List.of(role(ns, suffix, rules).getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(user));
  }

  private static Role role(TestNamespace ns, String suffix, Rule... rules) {
    CreatePolicy policy =
        new CreatePolicy()
            .withName(ns.prefix(suffix + "CpvPolicy"))
            .withDescription("Custom property value access")
            .withRules(List.of(rules));
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy created = ns.trackRoot(Entity.POLICY, admin.policies().create(policy));
    CreateRole role =
        new CreateRole()
            .withName(ns.prefix(suffix + "CpvRole"))
            .withDescription("Custom property value access")
            .withPolicies(List.of(created.getFullyQualifiedName()));
    return ns.trackRoot(Entity.ROLE, admin.roles().create(role));
  }

  private static OpenMetadataClient clientOf(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }
}
