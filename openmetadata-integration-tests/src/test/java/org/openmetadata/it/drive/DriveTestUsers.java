package org.openmetadata.it.drive;

import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.services.teams.UserService;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;

final class DriveTestUsers {

  private DriveTestUsers() {}

  static User createUser(TestNamespace ns, String suffix) {
    String base = (ns.shortPrefix("drive") + suffix).replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    String name = base.substring(0, Math.min(base.length(), 48));
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withDisplayName(name)
            .withEmail(name + "@test.openmetadata.org");
    return new UserService(SdkClients.adminClient().getHttpClient()).create(createUser);
  }
}
