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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;

/**
 * Integration tests verifying that non-admin users cannot manage other users via the REST API.
 *
 * <p>Covers the vulnerability where the default DataConsumerPolicy granted broad edit permissions
 * on all resources (including the user resource), allowing any authenticated user to PATCH or
 * DELETE other users.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class UserManagementRbacIT {

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final long TOKEN_TTL_SECONDS = 3600;

  /**
   * A non-admin user must not be able to PATCH (update the description of) another user.
   * Before the fix, the DataConsumerPolicy granted EditDescription on all resources,
   * allowing this to succeed with HTTP 200. After the fix, this must return HTTP 403.
   */
  @Test
  void test_nonAdminCannotPatchOtherUser(TestNamespace ns) throws Exception {
    User victim = createTestUser(ns, "victim");
    String attackerEmail = ns.prefix("attacker") + "@test.openmetadata.org";
    String attackerName = ns.prefix("attacker");

    String attackerToken =
        JwtAuthProvider.tokenFor(attackerName, attackerEmail, new String[] {}, TOKEN_TTL_SECONDS);

    String patchBody = "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"hacked\"}]";

    HttpResponse<String> response =
        patchWithToken("/v1/users/" + victim.getId(), patchBody, attackerToken);

    assertEquals(
        403,
        response.statusCode(),
        "Non-admin user should not be able to PATCH another user's profile, got: "
            + response.statusCode()
            + " body: "
            + response.body());
  }

  /**
   * A non-admin user must not be able to DELETE another user.
   * Before the fix, certain policy conditions could allow this. After the fix, this must return
   * HTTP 403.
   */
  @Test
  void test_nonAdminCannotDeleteOtherUser(TestNamespace ns) throws Exception {
    User victim = createTestUser(ns, "del_victim");
    String attackerEmail = ns.prefix("del_attacker") + "@test.openmetadata.org";
    String attackerName = ns.prefix("del_attacker");

    String attackerToken =
        JwtAuthProvider.tokenFor(attackerName, attackerEmail, new String[] {}, TOKEN_TTL_SECONDS);

    HttpResponse<String> response = deleteWithToken("/v1/users/" + victim.getId(), attackerToken);

    assertEquals(
        403,
        response.statusCode(),
        "Non-admin user should not be able to DELETE another user, got: "
            + response.statusCode()
            + " body: "
            + response.body());
  }

  /**
   * An admin user must still be able to PATCH any user's profile.
   */
  @Test
  void test_adminCanPatchOtherUser(TestNamespace ns) throws Exception {
    User victim = createTestUser(ns, "admin_patch_target");

    String patchBody =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"admin update\"}]";

    HttpResponse<String> response =
        patchWithToken("/v1/users/" + victim.getId(), patchBody, SdkClients.getAdminToken());

    assertEquals(
        200,
        response.statusCode(),
        "Admin should be able to PATCH another user's profile, got: "
            + response.statusCode()
            + " body: "
            + response.body());
  }

  /**
   * A non-admin user must be able to PATCH their own profile.
   * This verifies the self-patch case still works after the fix.
   */
  @Test
  void test_nonAdminCanPatchOwnProfile(TestNamespace ns) throws Exception {
    String selfName = ns.prefix("self_patcher");
    String selfEmail = selfName + "@test.openmetadata.org";

    User self = createTestUserWithCredentials(ns, selfName, selfEmail);

    String selfToken =
        JwtAuthProvider.tokenFor(selfName, selfEmail, new String[] {}, TOKEN_TTL_SECONDS);

    String patchBody =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"my own description\"}]";

    HttpResponse<String> response =
        patchWithToken("/v1/users/" + self.getId(), patchBody, selfToken);

    assertEquals(
        200,
        response.statusCode(),
        "Non-admin user should be able to PATCH their own profile, got: "
            + response.statusCode()
            + " body: "
            + response.body());
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private User createTestUser(TestNamespace ns, String suffix) {
    String name = ns.prefix(suffix);
    String email = name + "@test.openmetadata.org";
    return createTestUserWithCredentials(ns, name, email);
  }

  private User createTestUserWithCredentials(TestNamespace ns, String name, String email) {
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDescription("Test user for RBAC verification");
    return SdkClients.adminClient().users().create(createUser);
  }

  private HttpResponse<String> patchWithToken(String path, String body, String token)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> deleteWithToken(String path, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .DELETE()
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
