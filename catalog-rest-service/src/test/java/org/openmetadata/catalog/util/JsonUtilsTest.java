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

package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.UUID;
import javax.json.Json;
import javax.json.JsonArrayBuilder;
import javax.json.JsonException;
import javax.json.JsonObject;
import javax.json.JsonObjectBuilder;
import javax.json.JsonPatchBuilder;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.entity.teams.Team;

/** This test provides examples of how to use applyPatch */
public class JsonUtilsTest {
  /** Test apply patch method with different operations. */
  @Test
  void applyPatch() throws IOException {
    JsonObjectBuilder teamJson = Json.createObjectBuilder();
    JsonObjectBuilder user1 = Json.createObjectBuilder();
    JsonObjectBuilder user2 = Json.createObjectBuilder();
    String teamId = UUID.randomUUID().toString();
    user1.add("id", UUID.randomUUID().toString()).add("name", "alex_watts");
    user2.add("id", UUID.randomUUID().toString()).add("name", "amanda_dickson");
    JsonArrayBuilder users = Json.createArrayBuilder();
    users.add(user1);
    users.add(user2);
    teamJson.add("id", teamId).add("name", "finance").add("users", users);

    Team original = EntityUtil.validate(teamId, teamJson.build().toString(), Team.class);
    JsonPatchBuilder patchBuilder = Json.createPatchBuilder();

    // Add two users to the team
    JsonObjectBuilder newUser1Builder = Json.createObjectBuilder();
    JsonObjectBuilder newUser2Builder = Json.createObjectBuilder();

    String newUserId1 = UUID.randomUUID().toString();
    String newUserId2 = UUID.randomUUID().toString();
    newUser1Builder.add("id", newUserId1).add("type", "user").add("name", "alice_schmidt");
    newUser2Builder.add("id", newUserId2).add("type", "user").add("name", "adam_wong");
    JsonObject newUser1 = newUser1Builder.build();
    JsonObject newUser2 = newUser2Builder.build();
    patchBuilder.add("/users/3", newUser2);
    patchBuilder.add("/users/2", newUser1);
    Team updated = JsonUtils.applyPatch(original, patchBuilder.build(), Team.class);

    assertEquals(4, updated.getUsers().size());
    assertTrue(
        updated.getUsers().stream()
            .anyMatch(
                entry ->
                    entry.getName().equals(newUser1.getString("name")) && entry.getId().toString().equals(newUserId1)));
    assertTrue(
        updated.getUsers().stream()
            .anyMatch(
                entry ->
                    entry.getName().equals(newUser2.getString("name")) && entry.getId().toString().equals(newUserId2)));

    // Add a user with an out of index path
    final JsonPatchBuilder jsonPatchBuilder = Json.createPatchBuilder();
    jsonPatchBuilder.add("/users/4", newUser1);
    JsonException jsonException =
        assertThrows(JsonException.class, () -> JsonUtils.applyPatch(original, jsonPatchBuilder.build(), Team.class));
    assertTrue(jsonException.getMessage().contains("contains no element for index 4"));

    // Delete the two users from the team
    patchBuilder = Json.createPatchBuilder();
    patchBuilder.remove("/users/0");
    patchBuilder.remove("/users/1");
    updated = JsonUtils.applyPatch(original, patchBuilder.build(), Team.class);
    // Assert if both the users were removed
    assertTrue(updated.getUsers().isEmpty());

    // Delete a non-existent user
    final JsonPatchBuilder jsonPatchBuilder2 = Json.createPatchBuilder();
    jsonPatchBuilder2.remove("/users/3");
    jsonException =
        assertThrows(JsonException.class, () -> JsonUtils.applyPatch(original, jsonPatchBuilder2.build(), Team.class));
    assertTrue(jsonException.getMessage().contains("contains no element for index 3"));
  }
}
