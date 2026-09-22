package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Teams and users gained custom-property support by getting the {@code @om-entity-type} annotation
 * (which seeds a {@code Type} of category {@code Entity} they can hang properties off) and an
 * {@code extension} field. Everything downstream — validation against the registered property,
 * persistence in {@code entity_extension}, and hydration on read — is the generic machinery, so
 * what actually needs guarding is that the two entities are wired into it at all.
 *
 * <p>Each test registers its own namespace-prefixed property on the shared built-in type, so
 * concurrent runs add disjoint properties rather than racing over one name.
 */
@Slf4j
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TeamUserCustomPropertyIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String EXTENSION_FIELD = "extension";

  /**
   * Properties are registered on the shared built-in types, which TestNamespaceExtension does not
   * clean up — it only reaps tracked entity roots. Left behind, every run would add another field
   * relationship to `team` and `user` and show up on their custom-property settings pages.
   */
  private record RegisteredProperty(String entityType, String propertyName) {}

  private static final List<RegisteredProperty> REGISTERED_PROPERTIES =
      new CopyOnWriteArrayList<>();

  @AfterAll
  static void removeRegisteredProperties() {
    OpenMetadataClient client = SdkClients.adminClient();
    for (RegisteredProperty property : REGISTERED_PROPERTIES) {
      try {
        Type owningType = getTypeByName(client, property.entityType());
        client
            .getHttpClient()
            .execute(
                HttpMethod.DELETE,
                "/v1/metadata/types/" + owningType.getId() + "/" + property.propertyName(),
                null,
                Void.class);
      } catch (Exception cleanupFailure) {
        log.warn(
            "Failed to remove custom property '{}' from type '{}'",
            property.propertyName(),
            property.entityType(),
            cleanupFailure);
      }
    }
    REGISTERED_PROPERTIES.clear();
  }

  @Test
  void teamCarriesACustomPropertyValueThroughCreatePatchAndRead(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String property = registerStringProperty(client, "team", ns.prefix("teamCostCentre"));

    Team team =
        client
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("cpTeam"))
                    .withTeamType(TeamType.GROUP)
                    .withDescription("Team carrying a custom property")
                    .withExtension(Map.of(property, "cc-100")));

    assertEquals(
        "cc-100",
        extensionValue(client.teams().get(team.getId().toString(), EXTENSION_FIELD), property),
        "extension supplied on create must survive the round trip");

    Team toPatch = client.teams().get(team.getId().toString(), EXTENSION_FIELD);
    toPatch.setChildrenCount(null);
    toPatch.setUserCount(null);
    toPatch.setExtension(Map.of(property, "cc-200"));
    client.teams().update(team.getId().toString(), toPatch);

    assertEquals(
        "cc-200",
        extensionValue(client.teams().get(team.getId().toString(), EXTENSION_FIELD), property),
        "PATCHing the extension must replace the stored value");
  }

  @Test
  void userCarriesACustomPropertyValueThroughCreatePatchAndRead(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String property = registerStringProperty(client, "user", ns.prefix("userDeskLocation"));

    String name = ns.prefix("cpUser").replaceAll("[^a-zA-Z0-9._-]", "");
    User user =
        client
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@open-metadata.org")
                    .withDescription("User carrying a custom property")
                    .withExtension(Map.of(property, "desk-7")));

    assertEquals(
        "desk-7",
        extensionValue(client.users().get(user.getId().toString(), EXTENSION_FIELD), property),
        "extension supplied on create must survive the round trip");

    User toPatch = client.users().get(user.getId().toString(), EXTENSION_FIELD);
    toPatch.setExtension(Map.of(property, "desk-9"));
    client.users().update(user.getId().toString(), toPatch);

    assertEquals(
        "desk-9",
        extensionValue(client.users().get(user.getId().toString(), EXTENSION_FIELD), property),
        "PATCHing the extension must replace the stored value");
  }

  @Test
  void teamAndUserTypesAreRegisteredAsCustomPropertyTargets() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (String entityType : new String[] {"team", "user"}) {
      Type type = getTypeByName(client, entityType);
      assertNotNull(type.getId(), entityType + " must have a Type entity to hang properties off");
      assertTrue(
          "Entity".equalsIgnoreCase(type.getCategory().value()),
          entityType + " Type must be of category Entity, got " + type.getCategory());
    }
  }

  /** Adds a string custom property to the given built-in entity type and returns its name. */
  private static String registerStringProperty(
      OpenMetadataClient client, String entityType, String propertyName) throws Exception {
    Type stringType = getTypeByName(client, "string");
    Type entityTypeEntity = getTypeByName(client, entityType);
    addCustomProperty(
        client,
        entityTypeEntity.getId(),
        new CustomProperty()
            .withName(propertyName)
            .withDescription("Added by TeamUserCustomPropertyIT")
            .withPropertyType(
                new EntityReference()
                    .withId(stringType.getId())
                    .withType("type")
                    .withName("string")));
    REGISTERED_PROPERTIES.add(new RegisteredProperty(entityType, propertyName));
    return propertyName;
  }

  private static Object extensionValue(Object entity, String propertyName) {
    Object extension =
        entity instanceof Team team ? team.getExtension() : ((User) entity).getExtension();
    assertNotNull(extension, "entity was read back without its extension");
    return OBJECT_MAPPER.convertValue(extension, Map.class).get(propertyName);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private static void addCustomProperty(
      OpenMetadataClient client, UUID typeId, CustomProperty customProperty) throws Exception {
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + typeId, customProperty, Type.class);
  }
}
