/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespaceExtension;

/**
 * Verifies the authorization split on glossary term relation settings (issue #31070): every
 * authenticated user can read the configured relation types — the Related Terms dropdown and the
 * ontology explorer need them — while creating, updating and deleting them stays admin-only.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRelationSettingsPermissionsIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private static final String SETTINGS_PATH = "/v1/system/settings/glossaryTermRelationSettings";
  private static final String RELATION_TYPES_PATH = SETTINGS_PATH + "/relationTypes";
  private static final String ADMIN_ONLY_SETTINGS_PATH = "/v1/system/settings/searchSettings";
  private static final String JSON_PATCH_MEDIA_TYPE = "application/json-patch+json";
  private static final String SYSTEM_RELATION_TYPE = "relatedTo";

  // Jersey runs @Valid bean validation before the resource method body, so a payload missing any
  // @NotNull field of GlossaryTermRelationType (name, displayName, category) is rejected with 400
  // and never reaches authorizeAdmin. These bodies must stay schema-valid or the write tests below
  // silently stop proving anything about authorization.
  private static final String NEW_RELATION_TYPE_BODY =
      """
      {"name":"itRelationTypeForbidden","displayName":"IT Relation Type",\
      "description":"created by a non-admin, must never be persisted",\
      "category":"associative"}\
      """;

  private static final String EXISTING_RELATION_TYPE_BODY =
      """
      {"name":"relatedTo","displayName":"Renamed By A Non-Admin",\
      "description":"edited by a non-admin, must never be persisted",\
      "category":"associative"}\
      """;

  // The dataConsumer JWT is resolved through SubjectCache during authorization; if the user has not
  // been materialized in this JVM session the lookup throws EntityNotFound (404) and short-circuits
  // the authorizer before it can return the expected 403.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ)
  void test_getSettings_dataConsumer_returns200() throws Exception {
    HttpResponse<String> response = get(SETTINGS_PATH, dataConsumerToken());

    assertEquals(
        200, response.statusCode(), "DataConsumer should be able to read the relation settings");
    JsonNode relationTypes =
        MAPPER.readTree(response.body()).path("config_value").path("relationTypes");
    assertTrue(relationTypes.isArray(), "relationTypes should be an array");
    assertFalse(relationTypes.isEmpty(), "DataConsumer should see the configured relation types");
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ)
  void test_listRelationTypes_dataConsumer_returns200() throws Exception {
    HttpResponse<String> response = get(RELATION_TYPES_PATH + "?limit=100", dataConsumerToken());

    assertEquals(
        200, response.statusCode(), "DataConsumer should be able to list the relation types");
    JsonNode relationTypes = MAPPER.readTree(response.body()).path("data");
    assertTrue(relationTypes.isArray(), "data should be an array");
    assertFalse(relationTypes.isEmpty(), "DataConsumer should see the configured relation types");
  }

  @Test
  void test_getAdminOnlySetting_dataConsumer_returns403() throws Exception {
    HttpResponse<String> response = get(ADMIN_ONLY_SETTINGS_PATH, dataConsumerToken());

    assertEquals(
        403, response.statusCode(), "Only glossary/lineage settings are readable by non-admins");
  }

  @Test
  void test_getSettings_noAuth_returns401() throws Exception {
    HttpResponse<String> response = get(SETTINGS_PATH, null);

    assertEquals(401, response.statusCode(), "Unauthenticated reads must still be rejected");
  }

  @Test
  void test_listRelationTypes_noAuth_returns401() throws Exception {
    HttpResponse<String> response = get(RELATION_TYPES_PATH, null);

    assertEquals(401, response.statusCode(), "Unauthenticated reads must still be rejected");
  }

  // The write-attempt tests below take the lock in READ_WRITE mode even though they expect a 403:
  // if the admin gate ever regresses the request lands, and an exclusive lock keeps that mutation
  // from corrupting shared settings under tests that hold the READ lock.
  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void test_createRelationType_dataConsumer_returns403() throws Exception {
    HttpResponse<String> response =
        send("POST", RELATION_TYPES_PATH, NEW_RELATION_TYPE_BODY, "application/json");

    assertEquals(
        403,
        response.statusCode(),
        "DataConsumer should not be able to add relation types: " + response.body());
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void test_updateRelationType_dataConsumer_returns403() throws Exception {
    HttpResponse<String> response =
        send(
            "PUT",
            RELATION_TYPES_PATH + "/" + SYSTEM_RELATION_TYPE,
            EXISTING_RELATION_TYPE_BODY,
            "application/json");

    assertEquals(
        403,
        response.statusCode(),
        "DataConsumer should not be able to edit relation types: " + response.body());
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void test_deleteRelationType_dataConsumer_returns403() throws Exception {
    HttpResponse<String> response =
        send("DELETE", RELATION_TYPES_PATH + "/" + SYSTEM_RELATION_TYPE, null, "application/json");

    assertEquals(
        403,
        response.statusCode(),
        "DataConsumer should not be able to delete relation types: " + response.body());
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void test_putSettings_dataConsumer_returns403() throws Exception {
    String body =
        """
        {"config_type":"glossaryTermRelationSettings","config_value":{"relationTypes":[]}}\
        """;

    HttpResponse<String> response = send("PUT", "/v1/system/settings", body, "application/json");

    assertEquals(
        403,
        response.statusCode(),
        "DataConsumer should not be able to overwrite the settings: " + response.body());
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void test_patchSettings_dataConsumer_returns403() throws Exception {
    String patch = "[{\"op\":\"remove\",\"path\":\"/relationTypes/0\"}]";

    HttpResponse<String> response = send("PATCH", SETTINGS_PATH, patch, JSON_PATCH_MEDIA_TYPE);

    assertEquals(
        403,
        response.statusCode(),
        "DataConsumer should not be able to patch the settings: " + response.body());
  }

  private static String dataConsumerToken() {
    return JwtAuthProvider.tokenFor(
        "data-consumer@open-metadata.org",
        "data-consumer@open-metadata.org",
        new String[] {"DataConsumer"},
        3600);
  }

  private static HttpResponse<String> get(String path, String token) throws Exception {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder().uri(URI.create(SdkClients.getServerUrl() + path)).GET();
    if (token != null) {
      builder.header("Authorization", "Bearer " + token);
    }

    return HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }

  private static HttpResponse<String> send(
      String method, String path, String body, String contentType) throws Exception {
    HttpRequest.BodyPublisher publisher =
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + dataConsumerToken())
            .header("Content-Type", contentType)
            .method(method, publisher)
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
