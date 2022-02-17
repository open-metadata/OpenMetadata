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

package org.openmetadata.catalog.resources.feeds;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.invalidEntityLink;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.feed.CreateThread;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FeedResourceTest extends CatalogApplicationTest {
  public static Table TABLE;
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_DESCRIPTION_LINK;
  public static List<Column> COLUMNS;
  public static User USER;
  public static String USER_LINK;
  public static Team TEAM;
  public static String TEAM_LINK;
  public static Thread THREAD;
  public static Map<String, String> AUTH_HEADERS;

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    CreateTable createTable = tableResourceTest.createRequest(test);
    TABLE = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
    COLUMNS = Collections.singletonList(new Column().withName("column1").withDataType(ColumnDataType.BIGINT));
    TABLE_LINK = String.format("<#E/table/%s>", TABLE.getFullyQualifiedName());
    TABLE_COLUMN_LINK = String.format("<#E/table/%s/columns/c1/description>", TABLE.getFullyQualifiedName());
    TABLE_DESCRIPTION_LINK = String.format("<#E/table/%s/description>", TABLE.getFullyQualifiedName());

    USER = TableResourceTest.USER1;
    USER_LINK = String.format("<#E/user/%s>", USER.getName());

    TEAM = TableResourceTest.TEAM1;
    TEAM_LINK = String.format("<#E/team/%s>", TEAM.getName());

    CreateThread createThread = create();
    THREAD = createAndCheck(createThread, ADMIN_AUTH_HEADERS);

    AUTH_HEADERS = authHeaders(USER.getEmail());
  }

  @Test
  void post_feedWithoutAbout_4xx() {
    // Create thread without addressed to entity in the request
    CreateThread create = create().withFrom(USER.getName()).withAbout(null);
    assertResponse(() -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[about must not be null]");
  }

  @Test
  void post_feedWithInvalidAbout_4xx() {
    // Create thread without addressed to entity in the request
    CreateThread create = create().withFrom(USER.getName()).withAbout("<>"); // Invalid EntityLink

    assertResponseContains(
        () -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");

    create.withAbout("<#E/>"); // Invalid EntityLink - missing entityType and entityId
    assertResponseContains(
        () -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");

    create.withAbout("<#E/table/>"); // Invalid EntityLink - missing entityId
    assertResponseContains(
        () -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");

    create.withAbout("<#E/table/tableName"); // Invalid EntityLink - missing closing bracket ">"
    assertResponseContains(
        () -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");
  }

  @Test
  void post_feedWithoutMessage_4xx() {
    // Create thread without message field in the request
    CreateThread create = create().withFrom(USER.getName()).withMessage(null);
    assertResponseContains(() -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[message must not be null]");
  }

  @Test
  void post_feedWithoutFrom_4xx() {
    // Create thread without from field in the request
    CreateThread create = create().withFrom(null);
    assertResponseContains(() -> createThread(create, AUTH_HEADERS), BAD_REQUEST, "[from must not be null]");
  }

  @Test
  void post_feedWithNonExistentFrom_404() throws IOException {
    // Create thread with non-existent from
    CreateThread create = create().withFrom(NON_EXISTENT_ENTITY.toString());
    assertResponse(
        () -> createThread(create, AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_feedWithNonExistentAbout_404() {
    // Create thread with non-existent addressed To entity
    CreateThread create = create().withAbout("<#E/table/invalidTableName>");
    assertResponse(
        () -> createThread(create, AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.TABLE, "invalidTableName"));
  }

  @Test
  void post_feedWithInvalidAbout_400() throws IOException {
    // post with invalid entity link pattern
    // if entity link refers to an array member, then it should have both
    // field name and value
    CreateThread create =
        create().withAbout(String.format("<#E/table/%s/columns/description>", TABLE.getFullyQualifiedName()));
    assertResponse(() -> createThread(create, AUTH_HEADERS), BAD_REQUEST, invalidEntityLink());
  }

  @Test
  void post_validThreadAndList_200(TestInfo test) throws IOException {
    int totalThreadCount = listThreads(null, ADMIN_AUTH_HEADERS).getData().size();
    int userThreadCount = listThreads(USER_LINK, ADMIN_AUTH_HEADERS).getData().size();
    int teamThreadCount = listThreads(TEAM_LINK, ADMIN_AUTH_HEADERS).getData().size();
    int tableThreadCount = listThreads(TABLE_LINK, ADMIN_AUTH_HEADERS).getData().size();
    int tableDescriptionThreadCount = listThreads(TABLE_DESCRIPTION_LINK, ADMIN_AUTH_HEADERS).getData().size();
    int tableColumnDescriptionThreadCount = listThreads(TABLE_COLUMN_LINK, ADMIN_AUTH_HEADERS).getData().size();

    CreateThread create =
        create()
            .withMessage(
                String.format(
                    "%s mentions user %s team %s, table %s, description %s, and column description %s",
                    test.getDisplayName(),
                    USER_LINK,
                    TEAM_LINK,
                    TABLE_LINK,
                    TABLE_DESCRIPTION_LINK,
                    TABLE_COLUMN_LINK));
    // Create 10 threads
    Map<String, String> userAuthHeaders = authHeaders(USER.getEmail());
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, userAuthHeaders);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(++userThreadCount, listThreads(USER_LINK, userAuthHeaders).getData().size()); // Mentioned user
      assertEquals(++teamThreadCount, listThreads(TEAM_LINK, userAuthHeaders).getData().size()); // Mentioned team
      assertEquals(++tableThreadCount, listThreads(TABLE_LINK, userAuthHeaders).getData().size()); // About TABLE
      assertEquals(
          ++tableDescriptionThreadCount,
          listThreads(TABLE_DESCRIPTION_LINK, userAuthHeaders).getData().size()); // About TABLE Description
      assertEquals(
          ++tableColumnDescriptionThreadCount,
          listThreads(TABLE_COLUMN_LINK, userAuthHeaders).getData().size()); // About TABLE Column Description
      assertEquals(++totalThreadCount, listThreads(null, userAuthHeaders).getData().size()); // Overall threads
    }
  }

  @Test
  void post_addPostWithoutMessage_4xx() {
    // Add post to a thread without message field
    Post post = createPost().withMessage(null);

    assertResponseContains(
        () -> addPost(THREAD.getId(), post, AUTH_HEADERS), BAD_REQUEST, "[message must not be null]");
  }

  @Test
  void post_addPostWithoutFrom_4xx() {
    // Add post to a thread without from field
    Post post = createPost().withFrom(null);

    assertResponseContains(() -> addPost(THREAD.getId(), post, AUTH_HEADERS), BAD_REQUEST, "[from must not be null]");
  }

  @Test
  void post_addPostWithNonExistentFrom_404() {
    // Add post to a thread with non-existent from user

    Post post = createPost().withFrom(NON_EXISTENT_ENTITY.toString());
    assertResponse(
        () -> addPost(THREAD.getId(), post, AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_validAddPost_200() throws HttpResponseException {
    Thread thread = createAndCheck(create(), AUTH_HEADERS);
    // Add 10 posts and validate
    for (int i = 0; i < 10; i++) {
      Post post = createPost();
      thread = addPostAndCheck(thread, post, AUTH_HEADERS);
    }
  }

  public static Thread createAndCheck(CreateThread create, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Validate returned thread from POST
    Thread thread = createThread(create, authHeaders);
    validateThread(thread, create.getMessage(), create.getFrom(), create.getAbout());

    // Validate returned thread again from GET
    Thread getThread = getThread(thread.getId(), authHeaders);
    validateThread(getThread, create.getMessage(), create.getFrom(), create.getAbout());
    return thread;
  }

  private Thread addPostAndCheck(Thread thread, Post addPost, Map<String, String> authHeaders)
      throws HttpResponseException {
    Thread returnedThread = addPost(thread.getId(), addPost, authHeaders);
    // Last post is the newly added one
    validatePost(thread, returnedThread, addPost);

    Thread getThread = getThread(thread.getId(), authHeaders);
    validatePost(thread, getThread, addPost);
    return returnedThread;
  }

  private static void validateThread(Thread thread, String message, String from, String about) {
    assertNotNull(thread.getId());
    Post firstPost = thread.getPosts().get(0);
    assertEquals(message, firstPost.getMessage());
    assertEquals(from, firstPost.getFrom());
    assertEquals(about, thread.getAbout());
  }

  private static void validatePost(Thread expected, Thread actual, Post expectedPost) {
    // Make sure the post added is as expected
    Post actualPost = actual.getPosts().get(actual.getPosts().size() - 1); // Last post was newly added to the thread
    assertEquals(expectedPost.getFrom(), actualPost.getFrom());
    assertEquals(expectedPost.getMessage(), actualPost.getMessage());
    assertNotNull(actualPost.getPostTs());

    // Ensure post count increased
    assertEquals(expected.getPosts().size() + 1, actual.getPosts().size());
  }

  public static Thread createThread(CreateThread create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("feed"), create, Thread.class, authHeaders);
  }

  public static Thread addPost(UUID threadId, Post post, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("feed/" + threadId + "/posts"), post, Thread.class, authHeaders);
  }

  public static CreateThread create() {
    String about = String.format("<#E/%s/%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    return new CreateThread().withFrom(USER.getName()).withMessage("message").withAbout(about);
  }

  public static Post createPost() {
    return new Post().withFrom(USER.getName()).withMessage("message");
  }

  public static Thread getThread(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("feed/" + id);
    return TestUtils.get(target, Thread.class, authHeaders);
  }

  public static ThreadList listThreads(String entityLink, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed");
    target = entityLink != null ? target.queryParam("entityLink", entityLink) : target;
    return TestUtils.get(target, ThreadList.class, authHeaders);
  }
}
