package org.openmetadata.it.drive;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.services.teams.UserService;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;

final class DriveTestUsers {

  private DriveTestUsers() {}

  static User createUser(TestNamespace ns, String suffix) {
    return createUser(ns, suffix, List.of());
  }

  static User createUser(TestNamespace ns, String suffix, List<UUID> teams) {
    String base = (ns.shortPrefix("drive") + suffix).replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    String name = base.substring(0, Math.min(base.length(), 48));
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withDisplayName(name)
            .withEmail(name + "@test.openmetadata.org")
            .withTeams(teams);
    return new UserService(SdkClients.adminClient().getHttpClient()).create(createUser);
  }
}
