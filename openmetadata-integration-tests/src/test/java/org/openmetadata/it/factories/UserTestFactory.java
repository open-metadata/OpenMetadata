package org.openmetadata.it.factories;

import java.util.List;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.Users;

/**
 * Factory for creating User entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link Users}. Ensure
 * fluent APIs are initialized before using these methods.
 */
public class UserTestFactory {

  /**
   * Create a user with unique name using fluent API.
   */
  public static User createUser(TestNamespace ns, String baseName) {
    // Use shorter UUID to avoid name length issues
    String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
    String name = baseName + "_" + uniqueSuffix;
    String email = name + "@test.om.org";

    // Check if user already exists
    try {
      return Users.findByName(email).fetch().get();
    } catch (OpenMetadataException e) {
      // User doesn't exist, create it
    }

    try {
      return Users.create().name(name).withEmail(email).withDescription("Test user").execute();
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Failed to create user: " + email, e);
    }
  }

  /**
   * Create a user with the DataConsumer role assigned.
   * This creates a unique user for testing DataConsumer permissions.
   */
  public static User createDataConsumerUser(TestNamespace ns, String baseName) {
    String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix(baseName + "_" + uniqueSuffix);
    String email = name + "@test.om.org";

    OpenMetadataClient adminClient = SdkClients.adminClient();

    Role dataConsumerRole = adminClient.roles().getByName("DataConsumer");

    CreateUser createUser = new CreateUser();
    createUser.setName(name);
    createUser.setEmail(email);
    createUser.setDescription("Test DataConsumer user for permission testing");
    createUser.setRoles(
        List.of(new EntityReference().withId(dataConsumerRole.getId()).withType("role")));

    return adminClient.users().create(createUser);
  }

  /**
   * Get or create a user by email using fluent API.
   */
  public static User getOrCreateUser(String email) {
    try {
      return Users.findByName(email).fetch().get();
    } catch (OpenMetadataException e) {
      // User doesn't exist, create it
      String name = email.split("@")[0];
      try {
        return Users.create().name(name).withEmail(email).withDescription("Test user").execute();
      } catch (OpenMetadataException ex) {
        throw new RuntimeException("Failed to create user: " + email, ex);
      }
    }
  }

  /**
   * Get the DataConsumer user (predefined in the system).
   */
  public static User getDataConsumer(TestNamespace ns) {
    return getOrCreateUser("data-consumer@open-metadata.org");
  }

  /**
   * Get the DataSteward user (predefined in the system).
   */
  public static User getDataSteward(TestNamespace ns) {
    return getOrCreateUser("data-steward@open-metadata.org");
  }
}
