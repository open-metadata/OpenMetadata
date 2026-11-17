package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * A hard delete removes the FQN-keyed rows of the deleted entity only. FQNs are unique within a
 * type, so an entity of another type that shares the name keeps its tags and custom properties.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class HardDeleteCleanupIT {
  private static final String PERSONAL_TAG = "PersonalData.Personal";

  @Test
  void deletingAUserNamedLikeAServiceKeepsTheServicesTags(TestNamespace ns) {
    String sharedName = "hd_svc_" + UUID.randomUUID().toString().substring(0, 8);
    Table table = createTaggedTable(ns, sharedName);
    User namesake = createUserNamed(sharedName);

    SdkClients.adminClient()
        .users()
        .delete(namesake.getId().toString(), Map.of("hardDelete", "true"));

    assertKeepsItsTags(table);
  }

  @Test
  void deletingATypeNamedLikeAServiceKeepsTheServicesTags(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String sharedName = "hdType" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    Table table = createTaggedTable(ns, sharedName);
    Type namesake =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/metadata/types",
                new CreateType()
                    .withName(sharedName)
                    .withCategory(Category.Field)
                    .withDescription("Field type named like a service")
                    .withSchema(typeByName(admin, "integer").getSchema()),
                Type.class);

    admin
        .getHttpClient()
        .execute(HttpMethod.DELETE, "/v1/metadata/types/" + namesake.getId(), null, Type.class);

    assertKeepsItsTags(table);
  }

  @Test
  void deletingAUserNamedLikeAnEntityTypeKeepsItsCustomProperties() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String typeName = Entity.CHART;
    String propertyName = "hdKeep" + UUID.randomUUID().toString().substring(0, 8);
    Type chartType = typeByName(admin, typeName);
    admin
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metadata/types/" + chartType.getId(),
            new CustomProperty()
                .withName(propertyName)
                .withDescription("Custom property that must survive")
                .withPropertyType(typeByName(admin, "string").getEntityReference()),
            Type.class);
    User namesake = createUserNamed(typeName);

    admin.users().delete(namesake.getId().toString(), Map.of("hardDelete", "true"));

    String chartWithProperties =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/" + typeName + "?fields=customProperties",
                null);
    assertTrue(
        JsonUtils.readValue(chartWithProperties, Type.class).getCustomProperties().stream()
            .anyMatch(property -> propertyName.equals(property.getName())),
        "The chart custom property must survive deleting a user named " + typeName);
  }

  private static Table createTaggedTable(TestNamespace ns, String serviceName) {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseService service =
        ns.trackRoot(
            Entity.DATABASE_SERVICE,
            admin
                .databaseServices()
                .create(
                    new CreateDatabaseService()
                        .withName(serviceName)
                        .withServiceType(DatabaseServiceType.Postgres)
                        .withConnection(
                            new DatabaseConnection()
                                .withConfig(
                                    new PostgresConnection()
                                        .withHostPort("localhost:5432")
                                        .withUsername("reader")))));
    Database database =
        admin
            .databases()
            .create(
                new CreateDatabase().withName("db").withService(service.getFullyQualifiedName()));
    DatabaseSchema schema =
        admin
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("sch")
                    .withDatabase(database.getFullyQualifiedName()));
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName("customers")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTags(List.of(classificationTag(PERSONAL_TAG)))
                .withColumns(
                    List.of(
                        new Column()
                            .withName("email")
                            .withDataType(ColumnDataType.STRING)
                            .withTags(List.of(classificationTag(PERSONAL_TAG))))));
  }

  private static void assertKeepsItsTags(Table table) {
    Table reloaded =
        SdkClients.adminClient().tables().get(table.getId().toString(), "tags,columns");
    assertEquals(List.of(PERSONAL_TAG), tagFqns(reloaded.getTags()));
    assertEquals(List.of(PERSONAL_TAG), tagFqns(reloaded.getColumns().get(0).getTags()));
  }

  private static User createUserNamed(String name) {
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(
                    name + "_" + UUID.randomUUID().toString().substring(0, 6) + "@test.org"));
  }

  private static Type typeByName(OpenMetadataClient client, String name) {
    return JsonUtils.readValue(
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null),
        Type.class);
  }

  private static TagLabel classificationTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<String> tagFqns(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).toList();
  }
}
