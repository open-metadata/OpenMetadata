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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.Entity.SEPARATOR;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.JsonObject;
import javax.json.JsonPatch;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.eclipse.jetty.http.HttpStatus;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.security.CatalogOpenIdAuthorizationRequestFilter;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.services.connections.dashboard.SupersetConnection;
import org.openmetadata.catalog.services.connections.database.BigQueryConnection;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.services.connections.database.RedshiftConnection;
import org.openmetadata.catalog.services.connections.database.SnowflakeConnection;
import org.openmetadata.catalog.services.connections.messaging.KafkaConnection;
import org.openmetadata.catalog.type.DashboardConnection;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MessagingConnection;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.Source;

@Slf4j
public final class TestUtils {
  // Entity name length allowed is 128 characters
  public static final int ENTITY_NAME_MAX_LEN = 128;
  public static final String LONG_ENTITY_NAME = "1".repeat(ENTITY_NAME_MAX_LEN + 1);
  public static final String ENTITY_NAME_LENGTH_ERROR =
      String.format("[name size must be between 1 and %d]", ENTITY_NAME_MAX_LEN);

  public static final String ADMIN_USER_NAME = "admin";
  public static final Map<String, String> ADMIN_AUTH_HEADERS = authHeaders(ADMIN_USER_NAME + "@open-metadata.org");
  public static final String TEST_USER_NAME = "test";
  public static final Map<String, String> TEST_AUTH_HEADERS = authHeaders(TEST_USER_NAME + "@open-metadata.org");

  public static final UUID NON_EXISTENT_ENTITY = UUID.randomUUID();

  public static final DatabaseConnection MYSQL_DATABASE_CONNECTION;
  public static final DatabaseConnection SNOWFLAKE_DATABASE_CONNECTION;
  public static final DatabaseConnection BIGQUERY_DATABASE_CONNECTION;
  public static final DatabaseConnection REDSHIFT_DATABASE_CONNECTION;

  public static MessagingConnection KAFKA_CONNECTION;
  public static DashboardConnection SUPERSET_CONNECTION;

  public static URI PIPELINE_URL;

  public enum UpdateType {
    CREATED, // Not updated instead entity was created
    NO_CHANGE, // PUT/PATCH made no change
    MINOR_UPDATE, // PUT/PATCH made backward compatible minor version change
    MAJOR_UPDATE // PUT/PATCH made backward incompatible minor version change
  }

  static {
    MYSQL_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(new MysqlConnection().withHostPort("localhost:3306").withUsername("test").withPassword("test"));
    REDSHIFT_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(
                new RedshiftConnection().withHostPort("localhost:5002").withUsername("test").withPassword("test"));
    BIGQUERY_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(new BigQueryConnection().withHostPort("localhost:1000").withUsername("bigquery"));
    SNOWFLAKE_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(
                new SnowflakeConnection()
                    .withHostPort("snowflake:1000")
                    .withUsername("snowflake")
                    .withPassword("snowflake"));
  }

  static {
    try {
      KAFKA_CONNECTION =
          new MessagingConnection()
              .withConfig(
                  new KafkaConnection()
                      .withBootstrapServers("localhost:9092")
                      .withSchemaRegistryURL(new URI("http://localhost:8081")));
    } catch (URISyntaxException e) {
      KAFKA_CONNECTION = null;
      e.printStackTrace();
    }
  }

  static {
    try {
      SUPERSET_CONNECTION =
          new DashboardConnection()
              .withConfig(
                  new SupersetConnection()
                      .withSupersetURL(new URI("http://localhost:8080"))
                      .withUsername("admin")
                      .withPassword("admin"));
    } catch (URISyntaxException e) {
      SUPERSET_CONNECTION = null;
      e.printStackTrace();
    }
  }

  static {
    try {
      PIPELINE_URL = new URI("http://localhost:8080");
    } catch (URISyntaxException e) {
      PIPELINE_URL = null;
      e.printStackTrace();
    }
  }

  private TestUtils() {}

  public static void readResponseError(Response response) throws HttpResponseException {
    JsonObject error = response.readEntity(JsonObject.class);
    throw new HttpResponseException(error.getInt("code"), error.getString("message"));
  }

  public static void readResponse(Response response, int expectedResponse) throws HttpResponseException {
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(expectedResponse, response.getStatus());
  }

  public static <T> T readResponse(Response response, Class<T> clz, int expectedResponse) throws HttpResponseException {
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(expectedResponse, response.getStatus());
    return response.readEntity(clz);
  }

  public static void assertResponse(Executable executable, Response.Status expectedStatus, String expectedReason) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, executable);
    assertEquals(expectedStatus.getStatusCode(), exception.getStatusCode());
    assertEquals(expectedReason, exception.getReasonPhrase());
  }

  public static void assertResponseContains(
      Executable executable, Response.Status expectedStatus, String expectedReason) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, executable);
    assertEquals(expectedStatus.getStatusCode(), exception.getStatusCode());
    assertTrue(
        exception.getReasonPhrase().contains(expectedReason),
        expectedReason + " not in actual " + exception.getReasonPhrase());
  }

  public static <T> void assertEntityPagination(List<T> allEntities, ResultList<T> actual, int limit, int offset) {
    assertFalse(actual.getData().isEmpty());
    if (actual.getPaging().getAfter() != null && actual.getPaging().getBefore() != null) {
      // Last page may have less than limit number of records
      assertEquals(limit, actual.getData().size());
    }
    for (int i = 0; i < actual.getData().size(); i++) {
      assertEquals(allEntities.get(offset + i), actual.getData().get(i));
    }
    // Ensure total count returned in paging is correct
    assertEquals(allEntities.size(), actual.getPaging().getTotal());
  }

  public static void post(WebTarget target, Map<String, String> headers) throws HttpResponseException {
    post(target, null, headers);
  }

  public static <K> void post(WebTarget target, K request, Map<String, String> headers) throws HttpResponseException {
    Entity<K> entity = (request == null) ? null : Entity.entity(request, MediaType.APPLICATION_JSON);
    Response response = SecurityUtil.addHeaders(target, headers).post(entity);
    readResponse(response, Status.CREATED.getStatusCode());
  }

  public static <T, K> T post(WebTarget target, K request, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).post(Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, Status.CREATED.getStatusCode());
  }

  public static <T> T patch(WebTarget target, JsonPatch patch, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .method("PATCH", Entity.entity(patch.toJsonArray().toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static <K> void put(WebTarget target, K request, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).method("PUT", Entity.entity(request, MediaType.APPLICATION_JSON));
    readResponse(response, expectedStatus.getStatusCode());
  }

  public static <T, K> T put(
      WebTarget target, K request, Class<T> clz, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).method("PUT", Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, expectedStatus.getStatusCode());
  }

  public static <T> T get(WebTarget target, Class<T> clz, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static <T> T delete(WebTarget target, Class<T> clz, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).delete();
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static void delete(WebTarget target, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).delete();
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(Status.OK.getStatusCode(), response.getStatus());
  }

  public static void assertDeleted(List<EntityReference> list, Boolean expected) {
    listOrEmpty(list).forEach(e -> assertEquals(expected, e.getDeleted()));
  }

  public static void validateEntityReference(EntityReference ref) {
    assertNotNull(ref.getId());
    assertNotNull(ref.getHref());
    assertNotNull(ref.getName());
    assertNotNull(ref.getType());
    // Ensure data entities use fully qualified name
    if (List.of("table", "database", "metrics", "dashboard", "pipeline", "report", "topic", "chart", "location")
        .contains(ref.getType())) {
      // FullyQualifiedName has "." as separator
      assertTrue(ref.getName().contains(SEPARATOR), "entity name is not fully qualified - " + ref.getName());
    }
  }

  public static void validateEntityReferences(List<EntityReference> list) {
    listOrEmpty(list).forEach(TestUtils::validateEntityReference);
  }

  public static void validateTags(List<TagLabel> expectedList, List<TagLabel> actualList) throws HttpResponseException {
    if (expectedList == null) {
      return;
    }
    actualList = listOrEmpty(actualList);
    // When tags from the expected list is added to an entity, the derived tags for those tags are automatically added
    // So add to the expectedList, the derived tags before validating the tags
    List<TagLabel> updatedExpectedList = new ArrayList<>(expectedList);
    for (TagLabel expected : expectedList) {
      if (expected.getSource() != Source.TAG) {
        continue; // TODO similar test for glossary
      }
      Tag tag = TagResourceTest.getTag(expected.getTagFQN(), ADMIN_AUTH_HEADERS);
      List<TagLabel> derived = new ArrayList<>();
      for (String fqn : listOrEmpty(tag.getAssociatedTags())) {
        Tag associatedTag = TagResourceTest.getTag(fqn, ADMIN_AUTH_HEADERS);
        derived.add(
            new TagLabel()
                .withTagFQN(fqn)
                .withState(expected.getState())
                .withDescription(associatedTag.getDescription())
                .withLabelType(TagLabel.LabelType.DERIVED));
      }
      updatedExpectedList.addAll(derived);
    }
    updatedExpectedList = updatedExpectedList.stream().distinct().collect(Collectors.toList());
    updatedExpectedList.sort(EntityUtil.compareTagLabel);
    actualList.sort(EntityUtil.compareTagLabel);
    assertEquals(updatedExpectedList, actualList);
  }

  public static void checkUserFollowing(
      UUID userId, UUID entityId, boolean expectedFollowing, Map<String, String> authHeaders)
      throws HttpResponseException {
    // GET .../users/{userId} shows user as following table
    User user = new UserResourceTest().getEntity(userId, "follows", authHeaders);
    existsInEntityReferenceList(user.getFollows(), entityId, expectedFollowing);
  }

  public static String getPrincipal(Map<String, String> authHeaders) {
    // Get username from the email address
    if (authHeaders == null) {
      return null;
    }
    String principal = authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER);
    return principal == null ? null : principal.split("@")[0];
  }

  // TODO remove this
  public static void validateUpdate(Double previousVersion, Double newVersion, UpdateType updateType) {
    if (updateType == UpdateType.CREATED) {
      assertEquals(0.1, newVersion); // New version of entity created
    } else if (updateType == UpdateType.NO_CHANGE) {
      assertEquals(previousVersion, newVersion); // No change in the version
    } else if (updateType == UpdateType.MINOR_UPDATE) {
      assertEquals(EntityUtil.nextVersion(previousVersion), newVersion); //
      // Minor version change
    } else if (updateType == UpdateType.MAJOR_UPDATE) {
      assertEquals(EntityUtil.nextMajorVersion(previousVersion), newVersion); // Major version change
    }
  }

  public static void assertEntityReferenceList(List<EntityReference> expected, List<EntityReference> actual) {
    if (expected == actual) { // Take care of both being null
      return;
    }
    validateEntityReferences(actual);
    if (expected != null) {
      assertEquals(expected.size(), actual.size());
      for (EntityReference e : expected) {
        TestUtils.existsInEntityReferenceList(actual, e.getId(), true);
      }
    }
  }

  public static void existsInEntityReferenceList(List<EntityReference> list, UUID id, boolean expectedExistsInList) {
    EntityReference ref = null;
    for (EntityReference r : list) {
      validateEntityReference(r);
      if (r.getId().equals(id)) {
        ref = r;
        break;
      }
    }
    if (expectedExistsInList) {
      assertNotNull(ref, "EntityReference does not exist for " + id);
    } else {
      if (ref != null) {
        assertTrue(ref.getDeleted(), "EntityReference is not deleted as expected " + id);
      }
    }
  }

  public static void assertListNull(Object... values) {
    int index = 0;
    for (Object value : values) {
      Assertions.assertNull(value, "Object at index " + index + " is not null");
      index++;
    }
  }

  public static void assertListNotNull(Object... values) {
    int index = 0;
    for (Object value : values) {
      Assertions.assertNotNull(value, "Object at index " + index + " is null");
      index++;
    }
  }
}
