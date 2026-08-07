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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.teams.UserPreferences;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * IT tests for the lightweight {@code user_preferences} resource: {@code GET/PATCH
 * /v1/users/{userId}/preferences}, the self-or-admin auth rule, and the delete cascade wired via
 * {@code UserRepository#postDelete}.
 */
@Execution(ExecutionMode.CONCURRENT)
public class UserPreferencesIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void getPreferences_default_returnsEmptyMap() throws Exception {
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
  void patchPreferences_add_persists() throws Exception {
    User user = createUser("prefs-add");
    try {
      OpenMetadataClient self = clientFor(user);

      UserPreferences patched = patchPreferences(self, user.getId(), addOp("/appMode", "ai"));
      assertEquals("ai", patched.getPreferences().get("appMode"));

      UserPreferences fetched = getPreferences(self, user.getId());
      assertEquals("ai", fetched.getPreferences().get("appMode"));
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void patchPreferences_replace_persists() throws Exception {
    User user = createUser("prefs-replace");
    try {
      OpenMetadataClient self = clientFor(user);
      patchPreferences(self, user.getId(), addOp("/appMode", "ai"));

      UserPreferences patched =
          patchPreferences(self, user.getId(), replaceOp("/appMode", "classic"));
      assertEquals("classic", patched.getPreferences().get("appMode"));

      UserPreferences fetched = getPreferences(self, user.getId());
      assertEquals("classic", fetched.getPreferences().get("appMode"));
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void patchPreferences_remove_clearsKey() throws Exception {
    User user = createUser("prefs-remove");
    try {
      OpenMetadataClient self = clientFor(user);
      patchPreferences(self, user.getId(), addOp("/appMode", "ai"));

      UserPreferences patched = patchPreferences(self, user.getId(), removeOp("/appMode"));
      assertFalse(patched.getPreferences().containsKey("appMode"));

      UserPreferences fetched = getPreferences(self, user.getId());
      assertFalse(fetched.getPreferences().containsKey("appMode"));
    } finally {
      deleteUser(user);
    }
  }

  @Test
  void deleteUser_cascadesToPreferences() throws Exception {
    User user = createUser("prefs-cascade");
    OpenMetadataClient self = clientFor(user);
    patchPreferences(self, user.getId(), addOp("/appMode", "ai"));
    UserPreferences beforeDelete = getPreferences(self, user.getId());
    assertEquals("ai", beforeDelete.getPreferences().get("appMode"));

    deleteUser(user);

    // The user row is gone, so only an admin can still read the (now-orphaned) preferences path.
    UserPreferences afterDelete = getPreferences(SdkClients.adminClient(), user.getId());
    assertTrue(
        afterDelete.getPreferences().isEmpty(),
        "Cascade delete should have purged the user_preferences row");
  }

  @Test
  void patchPreferences_nonAdminOtherUser_returns403() throws Exception {
    User userA = createUser("prefs-a");
    User userB = createUser("prefs-b");
    try {
      OpenMetadataClient clientA = clientFor(userA);

      assertThrows(
          ForbiddenException.class,
          () -> patchPreferences(clientA, userB.getId(), addOp("/appMode", "ai")),
          "A non-admin user must not be able to patch another user's preferences");
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

  private static UserPreferences patchPreferences(
      OpenMetadataClient client, UUID userId, JsonNode patchOps) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PATCH,
            "/v1/users/" + userId + "/preferences",
            patchOps,
            UserPreferences.class);
  }

  private static JsonNode addOp(String path, String value) {
    return singleOp("add", path, value);
  }

  private static JsonNode replaceOp(String path, String value) {
    return singleOp("replace", path, value);
  }

  private static JsonNode removeOp(String path) {
    ArrayNode ops = MAPPER.createArrayNode();
    ObjectNode op = MAPPER.createObjectNode();
    op.put("op", "remove");
    op.put("path", path);
    ops.add(op);
    return ops;
  }

  private static JsonNode singleOp(String opName, String path, String value) {
    ArrayNode ops = MAPPER.createArrayNode();
    ObjectNode op = MAPPER.createObjectNode();
    op.put("op", opName);
    op.put("path", path);
    op.put("value", value);
    ops.add(op);
    return ops;
  }
}
