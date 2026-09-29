/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.teams.UserPreferences;
import org.openmetadata.schema.api.teams.preferences.AppModePreference;
import org.openmetadata.schema.api.teams.preferences.Config;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * IT tests for the lightweight {@code user_preferences} resource: {@code GET/PUT/DELETE
 * /v1/users/{userId}/preferences[/{type}]}, the self-or-admin auth rule, and user lifecycle cleanup
 * wired via {@code UserRepository#postDelete}. Each preference entry is a typed discriminated union
 * {@code {type, config}} - only {@code appMode} is wired end-to-end today.
 */
@Execution(ExecutionMode.CONCURRENT)
public class UserPreferencesIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String APP_MODE = "appMode";

  @Test
  void getPreferences_default_returnsEmptyList() throws Exception {
    User user = createUser("prefs-default");
    try {
      OpenMetadataClient self = clientFor(user);

      UserPreferences preferences = getPreferences(self, user.getId());

      assertTrue(preferences.getPreferences().isEmpty(), "New user should have no preferences");
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void putPreference_appMode_persists() throws Exception {
    User user = createUser("prefs-put");
    try {
      OpenMetadataClient self = clientFor(user);

      UserPreferences putResponse = putAppMode(self, user.getId(), "ai");
      assertEquals("ai", appModeValue(putResponse));

      UserPreferences fetched = getPreferences(self, user.getId());
      assertEquals("ai", appModeValue(fetched));
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void putPreference_appMode_updatesExisting() throws Exception {
    User user = createUser("prefs-replace");
    try {
      OpenMetadataClient self = clientFor(user);
      putAppMode(self, user.getId(), "ai");

      UserPreferences updated = putAppMode(self, user.getId(), "classic");
      assertEquals("classic", appModeValue(updated));
      assertEquals(1, updated.getPreferences().size(), "PUT must replace, not duplicate, by type");

      UserPreferences fetched = getPreferences(self, user.getId());
      assertEquals("classic", appModeValue(fetched));
      assertEquals(1, fetched.getPreferences().size());
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void deletePreference_appMode_removes() throws Exception {
    User user = createUser("prefs-delete");
    try {
      OpenMetadataClient self = clientFor(user);
      putAppMode(self, user.getId(), "ai");

      UserPreferences afterDelete = deletePreference(self, user.getId(), APP_MODE);
      assertTrue(afterDelete.getPreferences().isEmpty());

      UserPreferences fetched = getPreferences(self, user.getId());
      assertTrue(fetched.getPreferences().isEmpty());
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void deleteUser_cascadesToPreferences() throws Exception {
    User user = createUser("prefs-cascade");
    OpenMetadataClient self = clientFor(user);
    UserPreferences beforeDelete = putAppMode(self, user.getId(), "ai");
    assertEquals("ai", appModeValue(beforeDelete));

    deleteUser(user);

    // The user row is gone, so only an admin can still read the (now-orphaned) preferences path.
    UserPreferences afterDelete = getPreferences(SdkClients.adminClient(), user.getId());
    assertTrue(
        afterDelete.getPreferences().isEmpty(),
        "Cascade delete should have purged the user_preferences row");
  }

  @Test
  void softDeleteAndRestore_preservesPreferences() throws Exception {
    User user = createUser("prefs-restore");
    try {
      putAppMode(clientFor(user), user.getId(), "ai");

      SdkClients.adminClient().users().delete(user.getId().toString());
      SdkClients.adminClient().users().restore(user.getId().toString());

      UserPreferences restored = getPreferences(SdkClients.adminClient(), user.getId());
      assertEquals("ai", appModeValue(restored));
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void putPreference_nonAdminOtherUser_returns403() throws Exception {
    User userA = createUser("prefs-a");
    User userB = createUser("prefs-b");
    try {
      OpenMetadataClient clientA = clientFor(userA);

      assertThrows(
          ForbiddenException.class,
          () -> putAppMode(clientA, userB.getId(), "ai"),
          "A non-admin user must not be able to put another user's preferences");
    } finally {
      deleteUser(userA);
      deleteUser(userB);
    }
  }

  private static User createUser(String label) {
    String shortId = UUID.randomUUID().toString().substring(0, 8);
    String userName = "userprefs_" + label + "_" + shortId;
    String email = userName + "@test.openmetadata.org";
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(userName).withEmail(email).withIsBot(false));
  }

  private static void deleteUser(User user) {
    Map<String, String> deleteParams = new HashMap<>();
    deleteParams.put("hardDelete", "true");
    SdkClients.adminClient().users().delete(user.getId().toString(), deleteParams);
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static UserPreferences getPreferences(OpenMetadataClient client, UUID userId) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET, "/v1/users/" + userId + "/preferences", null, UserPreferences.class);
  }

  private static UserPreferences putAppMode(OpenMetadataClient client, UUID userId, String value) {
    AppModePreference preference =
        new AppModePreference()
            .withType(AppModePreference.Type.APP_MODE)
            .withConfig(new Config().withValue(Config.Value.fromValue(value)));

    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/users/" + userId + "/preferences/" + APP_MODE,
            preference,
            UserPreferences.class);
  }

  private static UserPreferences deletePreference(
      OpenMetadataClient client, UUID userId, String type) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/users/" + userId + "/preferences/" + type,
            null,
            UserPreferences.class);
  }

  /** Pulls the {@code appMode} entry's {@code config.value} out of the typed preferences list. */
  private static String appModeValue(UserPreferences preferences) {
    return preferences.getPreferences().stream()
        .map(entry -> MAPPER.convertValue(entry, Map.class))
        .filter(entry -> APP_MODE.equals(entry.get("type")))
        .findFirst()
        .map(entry -> (Map<?, ?>) entry.get("config"))
        .map(config -> (String) config.get("value"))
        .orElse(null);
  }
}
