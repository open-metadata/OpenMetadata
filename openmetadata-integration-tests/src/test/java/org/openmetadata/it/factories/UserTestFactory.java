package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.Users;
import org.openmetadata.service.Entity;

/**
 * Factory for creating User entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link Users}. Ensure
 * fluent APIs are initialized before using these methods.
 */
public class UserTestFactory {

  private static final int HTTP_NOT_FOUND = 404;
  private static final int HTTP_CONFLICT = 409;

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
      return ns.trackRoot(
          Entity.USER,
          Users.create().name(name).withEmail(email).withDescription("Test user").execute());
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Failed to create user: " + email, e);
    }
  }

  /**
   * Get or create a user by email using fluent API. The User entity's FQN is its name (the
   * email's local part), not the email itself — so we look up by the derived name. The create
   * path tolerates a 409 conflict from a parallel caller by re-fetching, since multiple test
   * classes may invoke this concurrently from their {@code @BeforeAll}. Any other status code
   * propagates immediately so misconfigured setups fail fast rather than masking later 404s.
   */
  public static User getOrCreateUser(String email) {
    String name = email.split("@")[0];
    try {
      return Users.findByName(name).fetch().get();
    } catch (OpenMetadataException notFound) {
      if (notFound.getStatusCode() != HTTP_NOT_FOUND) {
        throw notFound;
      }
      try {
        return Users.create().name(name).withEmail(email).withDescription("Test user").execute();
      } catch (OpenMetadataException conflict) {
        if (conflict.getStatusCode() != HTTP_CONFLICT) {
          throw conflict;
        }
        return Users.findByName(name).fetch().get();
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
