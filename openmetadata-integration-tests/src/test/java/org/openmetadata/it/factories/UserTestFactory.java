package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.teams.User;
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
}
