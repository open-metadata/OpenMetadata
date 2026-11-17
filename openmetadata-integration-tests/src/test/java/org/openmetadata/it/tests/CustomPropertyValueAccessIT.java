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
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A caller denied ViewCustomFields on an asset still reads the asset, but never its custom
 * property values: not in the entity, its change description, a list row or a stored version.
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
    String property = propertyName();
    CustomPropertyTestSupport.registerStringProperty(admin, Entity.TABLE, property);
    try {
      OpenMetadataClient denied = userDenied(ns, "all", null);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      Table table = tableWithValue(admin, schema, "cpv_all", property, "FIN-042", List.of());
      updateValue(admin, table, property, "FIN-043");
      String id = table.getId().toString();

      for (String path :
          List.of(
              "/v1/tables/" + id + "?fields=extension",
              "/v1/tables/name/" + table.getFullyQualifiedName() + "?fields=extension",
              "/v1/tables?databaseSchema=" + schema.getFullyQualifiedName() + "&fields=extension",
              "/v1/tables/" + id + "/versions",
              "/v1/tables/" + id + "/versions/0.1")) {
        String body = get(denied, path);
        assertFalse(body.contains("FIN-04"), path + " returned a custom property value: " + body);
      }
      assertEquals(
          table.getName(),
          JsonUtils.readTree(get(denied, "/v1/tables/" + id)).path("name").asText());
      assertTrue(get(admin, "/v1/tables/" + id + "?fields=extension").contains("FIN-043"));
    } finally {
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, property);
    }
  }

  @Test
  void aConditionalDenyLeavesOutOnlyTheValuesOfTheRowsItMatches(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String property = propertyName();
    CustomPropertyTestSupport.registerStringProperty(admin, Entity.TABLE, property);
    try {
      String secret = secretTag(ns);
      OpenMetadataClient denied = userDenied(ns, "tagged", "matchAnyTag('" + secret + "')");
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      TagLabel tag =
          new TagLabel().withTagFQN(secret).withSource(TagLabel.TagSource.CLASSIFICATION);
      tableWithValue(admin, schema, "cpv_hidden", property, "SECRET-1", List.of(tag));
      tableWithValue(admin, schema, "cpv_shown", property, "PUBLIC-1", List.of());

      JsonNode rows =
          JsonUtils.readTree(
                  get(
                      denied,
                      "/v1/tables?databaseSchema="
                          + schema.getFullyQualifiedName()
                          + "&fields=extension&limit=10"))
              .path("data");
      assertEquals(2, rows.size(), rows.toString());
      assertFalse(rows.toString().contains("SECRET-1"), rows.toString());
      assertTrue(rows.toString().contains("PUBLIC-1"), rows.toString());
    } finally {
      CustomPropertyTestSupport.removeProperty(admin, Entity.TABLE, property);
    }
  }

  private static String propertyName() {
    return "cpv" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
  }

  private static Table tableWithValue(
      OpenMetadataClient admin,
      DatabaseSchema schema,
      String name,
      String property,
      String value,
      List<TagLabel> tags) {
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTags(tags)
                .withExtension(Map.of(property, value))
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.INT))));
  }

  private static void updateValue(
      OpenMetadataClient admin, Table table, String property, String value) throws Exception {
    String patch =
        JsonUtils.pojoToJson(
            List.of(Map.of("op", "replace", "path", "/extension/" + property, "value", value)));
    admin
        .getHttpClient()
        .executeForString(HttpMethod.PATCH, "/v1/tables/" + table.getId(), patch, JSON_PATCH);
  }

  private static String get(OpenMetadataClient client, String path) throws Exception {
    return client.getHttpClient().executeForString(HttpMethod.GET, path, null);
  }

  private static String secretTag(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        admin
            .classifications()
            .create(
                new CreateClassification()
                    .withName("cpv_" + UUID.randomUUID().toString().substring(0, 8))
                    .withDescription("Classification for custom property value tests"));
    ns.trackRoot(Entity.CLASSIFICATION, classification);
    return admin
        .tags()
        .create(
            new CreateTag()
                .withName("secret")
                .withDescription("Tag whose assets hide their custom property values")
                .withClassification(classification.getFullyQualifiedName()))
        .getFullyQualifiedName();
  }

  private static OpenMetadataClient userDenied(TestNamespace ns, String suffix, String condition) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Rule deny =
        new Rule()
            .withName("denyCustomPropertyValues")
            .withResources(List.of(Entity.TABLE))
            .withOperations(List.of(MetadataOperation.VIEW_CUSTOM_FIELDS))
            .withEffect(Rule.Effect.DENY)
            .withCondition(condition);
    Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix(suffix + "CpvDeny"))
                        .withDescription("Denies custom property values")
                        .withRules(List.of(deny))));
    Role role =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(ns.prefix(suffix + "CpvDenyRole"))
                        .withDescription("Role denying custom property values")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    String name = "cpv_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@test.openmetadata.org";
    ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId()))));
    return SdkClients.createClient(email, email, new String[] {});
  }
}
