package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

public class UserTestFactory {
  public static User createUser(OpenMetadataClient client, TestNamespace ns, String baseName) {
    // Use shorter UUID to avoid name length issues
    String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
    String name = baseName + "_" + uniqueSuffix;
    String email = name + "@test.om.org";

    // Check if user already exists
    try {
      return client.users().getByName(email);
    } catch (OpenMetadataException e) {
      // User doesn't exist, create it
    }

    CreateUser req = new CreateUser();
    req.setName(name);
    req.setEmail(email);
    req.setDescription("Test user");

    try {
      return client.users().create(req);
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Failed to create user: " + email, e);
    }
  }

  public static User getOrCreateUser(OpenMetadataClient client, String email) {
    try {
      return client.users().getByName(email);
    } catch (OpenMetadataException e) {
      // User doesn't exist, create it
      String name = email.split("@")[0];
      CreateUser req = new CreateUser();
      req.setName(name);
      req.setEmail(email);
      req.setDescription("Test user");
      try {
        return client.users().create(req);
      } catch (OpenMetadataException ex) {
        throw new RuntimeException("Failed to create user: " + email, ex);
      }
    }
  }
}
