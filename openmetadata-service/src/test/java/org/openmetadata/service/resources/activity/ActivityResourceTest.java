/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.activity;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ActivityResourceTest extends OpenMetadataApplicationTest {

  private static Table TABLE;
  private static User USER;
  private static Map<String, String> USER_AUTH_HEADERS;
  private static UUID testActivityId;

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);

    TABLE =
        tableResourceTest.createEntity(tableResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);

    UserResourceTest userResourceTest = new UserResourceTest();
    USER =
        userResourceTest.createEntity(userResourceTest.createRequest(test, 10), ADMIN_AUTH_HEADERS);
    USER_AUTH_HEADERS = SecurityUtil.authHeaders(USER.getName());
  }

  @Test
  @Order(1)
  void test_insertActivityForTesting() throws HttpResponseException {
    ActivityEvent event = createTestActivityEvent();
    ActivityEvent created = insertActivityEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(event.getEventType(), created.getEventType());
    assertEquals(event.getSummary(), created.getSummary());

    testActivityId = created.getId();
  }

  @Test
  @Order(2)
  void test_listActivityEvents() throws HttpResponseException {
    ResultList<ActivityEvent> result =
        listActivityEvents(null, null, null, null, 7, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getData());
    assertTrue(result.getData().size() > 0);
  }

  @Test
  @Order(3)
  void test_listActivityEventsByEntityType() throws HttpResponseException {
    ResultList<ActivityEvent> result =
        listActivityEvents("table", null, null, null, 7, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
  }

  @Test
  @Order(4)
  void test_getEntityActivityById() throws HttpResponseException {
    ResultList<ActivityEvent> result =
        getEntityActivityById("table", TABLE.getId(), 30, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getData());
  }

  @Test
  @Order(5)
  void test_getEntityActivityByFqn() throws HttpResponseException {
    ResultList<ActivityEvent> result =
        getEntityActivityByFqn("table", TABLE.getFullyQualifiedName(), 30, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getData());
  }

  @Test
  @Order(6)
  void test_getEntityActivityByFqn_404_nonExistentEntity() {
    assertResponse(
        () -> getEntityActivityByFqn("table", "nonexistent.table.name", 30, 50, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "table instance for nonexistent.table.name not found");
  }

  @Test
  @Order(7)
  void test_getUserActivity() throws HttpResponseException {
    ResultList<ActivityEvent> result = getUserActivity(USER.getId(), 30, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getData());
  }

  @Test
  @Order(8)
  void test_getMyFeed() throws HttpResponseException {
    ResultList<ActivityEvent> result = getMyFeed(7, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getData());
  }

  @Test
  @Order(9)
  void test_getActivityByEntityLink() throws HttpResponseException {
    String entityLink = String.format("<#E::table::%s>", TABLE.getFullyQualifiedName());
    ResultList<ActivityEvent> result =
        getActivityByEntityLink(entityLink, 30, 50, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getData());
  }

  @Test
  @Order(10)
  void test_getActivityCount() throws HttpResponseException {
    int count = getActivityCount(7, ADMIN_AUTH_HEADERS);
    assertTrue(count >= 0);
  }

  @Test
  @Order(11)
  void test_addReaction() throws HttpResponseException {
    if (testActivityId == null) {
      ActivityEvent event = createTestActivityEvent();
      ActivityEvent created = insertActivityEvent(event, ADMIN_AUTH_HEADERS);
      testActivityId = created.getId();
    }

    ActivityEvent updated = addReaction(testActivityId, ReactionType.THUMBS_UP, ADMIN_AUTH_HEADERS);

    assertNotNull(updated);
    assertNotNull(updated.getReactions());
    assertTrue(updated.getReactions().size() > 0);
    assertTrue(
        updated.getReactions().stream()
            .anyMatch(r -> r.getReactionType() == ReactionType.THUMBS_UP));
  }

  @Test
  @Order(12)
  void test_removeReaction() throws HttpResponseException {
    if (testActivityId == null) {
      ActivityEvent event = createTestActivityEvent();
      ActivityEvent created = insertActivityEvent(event, ADMIN_AUTH_HEADERS);
      testActivityId = created.getId();
      addReaction(testActivityId, ReactionType.THUMBS_UP, ADMIN_AUTH_HEADERS);
    }

    ActivityEvent updated =
        removeReaction(testActivityId, ReactionType.THUMBS_UP, ADMIN_AUTH_HEADERS);

    assertNotNull(updated);
    assertFalse(
        updated.getReactions().stream()
            .anyMatch(
                r ->
                    r.getReactionType() == ReactionType.THUMBS_UP
                        && r.getUser().getName().equals("admin")));
  }

  @Test
  @Order(13)
  void test_listWithLimitAndDays() throws HttpResponseException {
    ResultList<ActivityEvent> result =
        listActivityEvents(null, null, null, null, 1, 5, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertTrue(result.getData().size() <= 5);
  }

  private ActivityEvent createTestActivityEvent() {
    EntityReference entityRef =
        new EntityReference()
            .withId(TABLE.getId())
            .withType("table")
            .withName(TABLE.getName())
            .withFullyQualifiedName(TABLE.getFullyQualifiedName());

    EntityReference actorRef =
        new EntityReference()
            .withId(USER.getId())
            .withType("user")
            .withName(USER.getName())
            .withFullyQualifiedName(USER.getFullyQualifiedName());

    return new ActivityEvent()
        .withId(UUID.randomUUID())
        .withEventType(ActivityEventType.ENTITY_UPDATED)
        .withEntity(entityRef)
        .withActor(actorRef)
        .withSummary("Test activity event")
        .withAbout(String.format("<#E::table::%s>", TABLE.getFullyQualifiedName()))
        .withTimestamp(Instant.now().toEpochMilli())
        .withReactions(List.of());
  }

  public static ResultList<ActivityEvent> listActivityEvents(
      String entityType,
      UUID entityId,
      UUID actorId,
      String domains,
      int days,
      int limit,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("activity");
    if (entityType != null) {
      target = target.queryParam("entityType", entityType);
    }
    if (entityId != null) {
      target = target.queryParam("entityId", entityId);
    }
    if (actorId != null) {
      target = target.queryParam("actorId", actorId);
    }
    if (domains != null) {
      target = target.queryParam("domains", domains);
    }
    target = target.queryParam("days", days).queryParam("limit", limit);

    return TestUtils.get(target, ActivityEventList.class, authHeaders);
  }

  public static ResultList<ActivityEvent> getEntityActivityById(
      String entityType, UUID entityId, int days, int limit, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(String.format("activity/entity/%s/%s", entityType, entityId))
            .queryParam("days", days)
            .queryParam("limit", limit);
    return TestUtils.get(target, ActivityEventList.class, authHeaders);
  }

  public static ResultList<ActivityEvent> getEntityActivityByFqn(
      String entityType, String fqn, int days, int limit, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(String.format("activity/entity/%s/name/%s", entityType, fqn))
            .queryParam("days", days)
            .queryParam("limit", limit);
    return TestUtils.get(target, ActivityEventList.class, authHeaders);
  }

  public static ResultList<ActivityEvent> getUserActivity(
      UUID userId, int days, int limit, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(String.format("activity/user/%s", userId))
            .queryParam("days", days)
            .queryParam("limit", limit);
    return TestUtils.get(target, ActivityEventList.class, authHeaders);
  }

  public static ResultList<ActivityEvent> getMyFeed(
      int days, int limit, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target =
        getResource("activity/my-feed").queryParam("days", days).queryParam("limit", limit);
    return TestUtils.get(target, ActivityEventList.class, authHeaders);
  }

  public static ResultList<ActivityEvent> getActivityByEntityLink(
      String entityLink, int days, int limit, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource("activity/about")
            .queryParam("entityLink", entityLink)
            .queryParam("days", days)
            .queryParam("limit", limit);
    return TestUtils.get(target, ActivityEventList.class, authHeaders);
  }

  public static int getActivityCount(int days, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("activity/count").queryParam("days", days);
    return TestUtils.get(target, Integer.class, authHeaders);
  }

  public static ActivityEvent insertActivityEvent(
      ActivityEvent event, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("activity/test-insert");
    Response response =
        SecurityUtil.addHeaders(target, authHeaders)
            .post(Entity.entity(event, MediaType.APPLICATION_JSON));
    return TestUtils.readResponse(response, ActivityEvent.class, OK.getStatusCode());
  }

  public static ActivityEvent addReaction(
      UUID activityId, ReactionType reactionType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(String.format("activity/%s/reaction/%s", activityId, reactionType));
    Response response =
        SecurityUtil.addHeaders(target, authHeaders)
            .put(Entity.entity("", MediaType.APPLICATION_JSON));
    return TestUtils.readResponse(response, ActivityEvent.class, OK.getStatusCode());
  }

  public static ActivityEvent removeReaction(
      UUID activityId, ReactionType reactionType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(String.format("activity/%s/reaction/%s", activityId, reactionType));
    Response response = SecurityUtil.addHeaders(target, authHeaders).delete();
    return TestUtils.readResponse(response, ActivityEvent.class, OK.getStatusCode());
  }

  private static class ActivityEventList extends ResultList<ActivityEvent> {
    public ActivityEventList() {
      super();
    }
  }
}
