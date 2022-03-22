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
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.noPermission;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_USER_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.feed.CreatePost;
import org.openmetadata.catalog.api.feed.CreateThread;
import org.openmetadata.catalog.api.feed.EntityLinkThreadCount;
import org.openmetadata.catalog.api.feed.ThreadCount;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.FeedRepository.FilterType;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.feeds.FeedResource.PostList;
import org.openmetadata.catalog.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FeedResourceTest extends CatalogApplicationTest {
  public static Table TABLE;
  public static Table TABLE2;
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_DESCRIPTION_LINK;
  public static List<Column> COLUMNS;
  public static User USER;
  public static User USER2;
  public static String USER_LINK;
  public static Team TEAM;
  public static Team TEAM2;
  public static String TEAM_LINK;
  public static Thread THREAD;
  public static Map<String, String> AUTH_HEADERS;

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods

    UserResourceTest userResourceTest = new UserResourceTest();
    USER2 = userResourceTest.createEntity(userResourceTest.createRequest(test, 2), TEST_AUTH_HEADERS);

    CreateTable createTable = tableResourceTest.createRequest(test);
    createTable.withOwner(TableResourceTest.USER_OWNER1);
    TABLE = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam =
        teamResourceTest
            .createRequest(test, 2)
            .withDisplayName("Team2")
            .withDescription("Team2 description")
            .withUsers(List.of(USER2.getId()));
    TEAM2 = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);
    EntityReference TEAM2_REF = new EntityReference().withId(TEAM2.getId()).withType(Entity.TEAM);
    CreateTable createTable2 = tableResourceTest.createRequest(test);
    createTable2.withName("table2").withOwner(TEAM2_REF);
    TABLE2 = tableResourceTest.createAndCheckEntity(createTable2, ADMIN_AUTH_HEADERS);

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
  void post_feedWithNonExistentFrom_404() {
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
  void post_validThreadAndList_200(TestInfo test) throws IOException {
    int totalThreadCount = listThreads(null, null, ADMIN_AUTH_HEADERS).getData().size();
    int userThreadCount = listThreads(USER_LINK, null, ADMIN_AUTH_HEADERS).getData().size();
    int teamThreadCount = listThreads(TEAM_LINK, null, ADMIN_AUTH_HEADERS).getData().size();
    int tableThreadCount = listThreads(TABLE_LINK, null, ADMIN_AUTH_HEADERS).getData().size();
    int tableDescriptionThreadCount = listThreads(TABLE_DESCRIPTION_LINK, null, ADMIN_AUTH_HEADERS).getData().size();
    int tableColumnDescriptionThreadCount = listThreads(TABLE_COLUMN_LINK, null, ADMIN_AUTH_HEADERS).getData().size();

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
      assertEquals(++userThreadCount, listThreads(USER_LINK, null, userAuthHeaders).getData().size()); // Mentioned user
      // TODO: There is no support for team mentions yet.
      // assertEquals(++teamThreadCount, listThreads(TEAM_LINK, null, userAuthHeaders).getData().size()); // Mentioned
      // team
      assertEquals(++tableThreadCount, listThreads(TABLE_LINK, null, userAuthHeaders).getData().size()); // About TABLE
      assertEquals(++totalThreadCount, listThreads(null, null, userAuthHeaders).getData().size()); // Overall threads
    }

    // List threads should not include mentioned entities
    // It should only include threads which are about the entity link
    assertEquals(
        tableDescriptionThreadCount,
        listThreads(TABLE_DESCRIPTION_LINK, null, userAuthHeaders).getData().size()); // About TABLE Description
    assertEquals(
        tableColumnDescriptionThreadCount,
        listThreads(TABLE_COLUMN_LINK, null, userAuthHeaders).getData().size()); // About TABLE Column Description

    create.withAbout(TABLE_DESCRIPTION_LINK);
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, userAuthHeaders);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(++userThreadCount, listThreads(USER_LINK, null, userAuthHeaders).getData().size()); // Mentioned user
      assertEquals(++tableThreadCount, listThreads(TABLE_LINK, null, userAuthHeaders).getData().size()); // About TABLE
      assertEquals(
          ++tableDescriptionThreadCount,
          listThreads(TABLE_DESCRIPTION_LINK, null, userAuthHeaders).getData().size()); // About TABLE Description
      assertEquals(++totalThreadCount, listThreads(null, null, userAuthHeaders).getData().size()); // Overall threads
    }

    create.withAbout(TABLE_COLUMN_LINK);
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, userAuthHeaders);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(++userThreadCount, listThreads(USER_LINK, null, userAuthHeaders).getData().size()); // Mentioned user
      assertEquals(++tableThreadCount, listThreads(TABLE_LINK, null, userAuthHeaders).getData().size()); // About TABLE
      assertEquals(
          ++tableColumnDescriptionThreadCount,
          listThreads(TABLE_COLUMN_LINK, null, userAuthHeaders).getData().size()); // About TABLE Description
      assertEquals(++totalThreadCount, listThreads(null, null, userAuthHeaders).getData().size()); // Overall threads
    }

    // Test the /api/v1/feed/count API
    assertEquals(userThreadCount, listThreadsCount(USER_LINK, userAuthHeaders).getTotalCount());
    assertEquals(tableDescriptionThreadCount, getThreadCount(TABLE_DESCRIPTION_LINK, userAuthHeaders));
    assertEquals(tableColumnDescriptionThreadCount, getThreadCount(TABLE_COLUMN_LINK, userAuthHeaders));
  }

  @Test
  void post_addPostWithoutMessage_4xx() {
    // Add post to a thread without message field
    CreatePost createPost = createPost(null).withMessage(null);

    assertResponseContains(
        () -> addPost(THREAD.getId(), createPost, AUTH_HEADERS), BAD_REQUEST, "[message must not be null]");
  }

  @Test
  void post_addPostWithoutFrom_4xx() {
    // Add post to a thread without from field
    CreatePost createPost = createPost(null).withFrom(null);

    assertResponseContains(
        () -> addPost(THREAD.getId(), createPost, AUTH_HEADERS), BAD_REQUEST, "[from must not be null]");
  }

  @Test
  void post_addPostWithNonExistentFrom_404() {
    // Add post to a thread with non-existent from user

    CreatePost createPost = createPost(null).withFrom(NON_EXISTENT_ENTITY.toString());
    assertResponse(
        () -> addPost(THREAD.getId(), createPost, AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_validAddPost_200() throws HttpResponseException {
    Thread thread = createAndCheck(create(), AUTH_HEADERS);
    // Add 10 posts and validate
    int POST_COUNT = 10;
    for (int i = 0; i < POST_COUNT; i++) {
      CreatePost createPost = createPost(null);
      thread = addPostAndCheck(thread, createPost, AUTH_HEADERS);
    }

    // Check if get posts API returns all the posts
    PostList postList = listPosts(thread.getId().toString(), AUTH_HEADERS);
    assertEquals(POST_COUNT, postList.getData().size());
  }

  @Test
  void patch_thread_200() throws IOException {
    // create a thread
    CreateThread create = create().withMessage("message");
    Thread thread = createAndCheck(create, ADMIN_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(thread);

    // update message and resolved state
    Thread updated = thread.withMessage("updated message").withResolved(true);

    patchThreadAndCheck(updated, originalJson, ADMIN_AUTH_HEADERS);
  }

  @Test
  void patch_thread_not_allowed_fields() throws IOException {
    // create a thread
    CreateThread create = create().withMessage("message");
    Thread thread = createAndCheck(create, ADMIN_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(thread);

    // update the About of the thread
    String originalAbout = thread.getAbout();
    Thread updated = thread.withAbout("<#E/user>");

    patchThread(updated.getId(), originalJson, updated, ADMIN_AUTH_HEADERS);
    updated = getThread(thread.getId(), ADMIN_AUTH_HEADERS);
    // verify that the "About" is not changed
    validateThread(updated, thread.getMessage(), thread.getCreatedBy(), originalAbout);
  }

  @Test
  void list_threadsWithPostsLimit() throws HttpResponseException {
    Thread thread = createAndCheck(create(), AUTH_HEADERS);
    // Add 10 posts and validate
    int POST_COUNT = 10;
    for (int i = 0; i < POST_COUNT; i++) {
      CreatePost createPost = createPost("message" + i);
      thread = addPostAndCheck(thread, createPost, AUTH_HEADERS);
    }

    ThreadList threads = listThreads(null, 5, AUTH_HEADERS);
    thread = threads.getData().get(0);
    assertEquals(5, thread.getPosts().size());
    assertEquals(POST_COUNT, thread.getPostsCount());
    // Thread should contain the latest 5 messages
    List<Post> posts = thread.getPosts();
    int startIndex = 5;
    for (var post : posts) {
      assertEquals("message" + startIndex++, post.getMessage());
    }

    // when posts limit is null, it should return 3 posts which is the default
    threads = listThreads(null, null, AUTH_HEADERS);
    thread = threads.getData().get(0);
    assertEquals(3, thread.getPosts().size());

    // limit <0 is not supported and should throw an exception
    assertResponse(
        () -> listThreads(null, -1, AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limitPosts must be greater than or equal to 0]");

    // limit greater than total number of posts should return correct response
    threads = listThreads(null, 100, AUTH_HEADERS);
    thread = threads.getData().get(0);
    assertEquals(10, thread.getPosts().size());
  }

  @Test
  void list_threadsWithOwnerFilter() throws HttpResponseException {
    // THREAD is created with TABLE entity in BeforeAll
    int totalThreadCount = listThreads(null, null, ADMIN_AUTH_HEADERS).getData().size();
    int user2ThreadCount =
        listThreadsWithFilter(USER2.getId().toString(), FilterType.OWNER.toString(), AUTH_HEADERS).getData().size();
    String ownerId = TABLE.getOwner().getId().toString();

    // create another thread on an entity with a different owner
    String ownerId2 = TABLE2.getOwner().getId().toString();
    createAndCheck(
        create().withAbout(String.format("<#E/table/%s>", TABLE2.getFullyQualifiedName())).withFrom(ADMIN_USER_NAME),
        ADMIN_AUTH_HEADERS);

    assertNotNull(ownerId);
    assertNotNull(ownerId2);
    assertNotEquals(ownerId, ownerId2);

    ThreadList threads = listThreadsWithFilter(ownerId, FilterType.OWNER.toString(), AUTH_HEADERS);
    assertEquals(totalThreadCount, threads.getData().size());

    // This should return 0 since the table is owned by a team
    // and for the filter we are passing team id instead of user id
    threads = listThreadsWithFilter(ownerId2, FilterType.OWNER.toString(), AUTH_HEADERS);
    assertEquals(0, threads.getData().size());

    // Now, test the filter with user who is part of the team
    threads = listThreadsWithFilter(USER2.getId().toString(), FilterType.OWNER.toString(), AUTH_HEADERS);
    assertEquals(user2ThreadCount + 1, threads.getData().size());

    // Test if no user id  filter returns all threads
    threads = listThreadsWithFilter(null, FilterType.OWNER.toString(), AUTH_HEADERS);
    assertEquals(totalThreadCount + 1, threads.getData().size());
  }

  @Test
  void list_threadsWithMentionsFilter() throws HttpResponseException {
    // Create a thread with user mention
    createAndCheck(
        create()
            .withMessage(String.format("Message mentions %s", USER_LINK))
            .withAbout(String.format("<#E/table/%s>", TABLE2.getFullyQualifiedName())),
        ADMIN_AUTH_HEADERS);

    // Create a thread that has user mention in a post
    CreatePost createPost = createPost(String.format("message mentions %s", USER_LINK));
    Thread thread =
        createAndCheck(
            create()
                .withMessage("Thread Message")
                .withAbout(String.format("<#E/table/%s>", TABLE2.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);
    addPostAndCheck(thread, createPost, ADMIN_AUTH_HEADERS);

    ThreadList threads = listThreadsWithFilter(USER.getId().toString(), FilterType.MENTIONS.toString(), AUTH_HEADERS);
    assertEquals(2, threads.getData().size());
  }

  @Test
  void list_threadsWithInvalidFilter() {
    assertResponse(
        () -> listThreadsWithFilter(USER.getId().toString(), "Invalid", AUTH_HEADERS),
        BAD_REQUEST,
        String.format("query param filterType must be one of %s", Arrays.toString(FilterType.values())));
  }

  @Test
  void get_listPosts_404() {
    assertResponse(
        () -> listPosts(NON_EXISTENT_ENTITY.toString(), AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_post_404() {
    // Test with an invalid thread id
    assertResponse(
        () -> deletePost(NON_EXISTENT_ENTITY, NON_EXISTENT_ENTITY, AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", NON_EXISTENT_ENTITY));

    // Test with an invalid post id
    assertResponse(
        () -> deletePost(THREAD.getId(), NON_EXISTENT_ENTITY, AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Post", NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_post_200() throws HttpResponseException {
    // Create a thread and add a post
    Thread thread = createAndCheck(create(), AUTH_HEADERS);
    CreatePost createPost = createPost(null);
    thread = addPostAndCheck(thread, createPost, AUTH_HEADERS);
    assertEquals(1, thread.getPosts().size());

    // delete the post
    Post post = thread.getPosts().get(0);
    Post deletedPost = deletePost(thread.getId(), post.getId(), AUTH_HEADERS);
    assertEquals(post.getId(), deletedPost.getId());

    // Check if get posts API returns the post
    PostList postList = listPosts(thread.getId().toString(), AUTH_HEADERS);
    assertTrue(postList.getData().isEmpty());

    // validate posts count
    Thread getThread = getThread(thread.getId(), AUTH_HEADERS);
    assertEquals(0, getThread.getPostsCount());
  }

  @Test
  void delete_post_unauthorized_403() throws HttpResponseException {
    // Create a thread and add a post as admin user
    Thread thread = createAndCheck(create(), ADMIN_AUTH_HEADERS);
    CreatePost createPost = createPost(null).withFrom(ADMIN_USER_NAME);
    thread = addPostAndCheck(thread, createPost, ADMIN_AUTH_HEADERS);
    assertEquals(1, thread.getPosts().size());

    // delete the post using a different user who is not an admin
    // Here post author is ADMIN, and we try to delete as USER
    Post post = thread.getPosts().get(0);
    UUID threadId = thread.getId();
    UUID postId = post.getId();
    assertResponse(() -> deletePost(threadId, postId, AUTH_HEADERS), FORBIDDEN, noPermission(USER.getName()));
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

  private Thread addPostAndCheck(Thread thread, CreatePost create, Map<String, String> authHeaders)
      throws HttpResponseException {
    Thread returnedThread = addPost(thread.getId(), create, authHeaders);
    // Last post is the newly added one
    validatePost(thread, returnedThread, create.getFrom(), create.getMessage());

    Thread getThread = getThread(thread.getId(), authHeaders);
    validatePost(thread, getThread, create.getFrom(), create.getMessage());
    return returnedThread;
  }

  private static void validateThread(Thread thread, String message, String from, String about) {
    assertNotNull(thread.getId());
    assertEquals(message, thread.getMessage());
    assertEquals(from, thread.getCreatedBy());
    assertEquals(about, thread.getAbout());
  }

  private static void validatePost(Thread expected, Thread actual, String from, String message) {
    // Make sure the post added is as expected
    Post actualPost = actual.getPosts().get(actual.getPosts().size() - 1); // Last post was newly added to the thread
    assertEquals(from, actualPost.getFrom());
    assertEquals(message, actualPost.getMessage());
    assertNotNull(actualPost.getPostTs());

    // Ensure post count increased
    assertEquals(expected.getPosts().size() + 1, actual.getPosts().size());
  }

  public static Thread createThread(CreateThread create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("feed"), create, Thread.class, authHeaders);
  }

  public static Thread addPost(UUID threadId, CreatePost post, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("feed/" + threadId + "/posts"), post, Thread.class, authHeaders);
  }

  public static Post deletePost(UUID threadId, UUID postId, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.delete(getResource("feed/" + threadId + "/posts/" + postId), Post.class, authHeaders);
  }

  public static CreateThread create() {
    String about = String.format("<#E/%s/%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    return new CreateThread().withFrom(USER.getName()).withMessage("message").withAbout(about);
  }

  public static CreatePost createPost(String message) {
    message = StringUtils.isNotEmpty(message) ? message : "message";
    return new CreatePost().withFrom(USER.getName()).withMessage(message);
  }

  public static Thread getThread(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("feed/" + id);
    return TestUtils.get(target, Thread.class, authHeaders);
  }

  public static ThreadList listThreads(String entityLink, Integer limitPosts, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed");
    target = entityLink != null ? target.queryParam("entityLink", entityLink) : target;
    target = limitPosts != null ? target.queryParam("limitPosts", limitPosts) : target;
    return TestUtils.get(target, ThreadList.class, authHeaders);
  }

  public static ThreadList listThreadsWithFilter(String userId, String filterType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed");
    target = userId != null ? target.queryParam("userId", userId) : target;
    target = filterType != null ? target.queryParam("filterType", filterType) : target;
    return TestUtils.get(target, ThreadList.class, authHeaders);
  }

  public static PostList listPosts(String threadId, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(String.format("feed/%s/posts", threadId));
    return TestUtils.get(target, PostList.class, authHeaders);
  }

  public static ThreadCount listThreadsCount(String entityLink, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed/count");
    target = entityLink != null ? target.queryParam("entityLink", entityLink) : target;
    return TestUtils.get(target, ThreadCount.class, authHeaders);
  }

  private int getThreadCount(String entityLink, Map<String, String> authHeaders) throws HttpResponseException {
    List<EntityLinkThreadCount> linkThreadCount = listThreadsCount(entityLink, authHeaders).getCounts();
    EntityLinkThreadCount threadCount =
        linkThreadCount.stream().filter(l -> l.getEntityLink().equals(entityLink)).findFirst().orElseThrow();
    return threadCount.getCount();
  }

  protected final Thread patchThreadAndCheck(Thread updated, String originalJson, Map<String, String> authHeaders)
      throws IOException {

    // Validate information returned in patch response has the updates
    Thread returned = patchThread(updated.getId(), originalJson, updated, authHeaders);

    compareEntities(updated, returned, authHeaders);

    // GET the entity and Validate information returned
    Thread getEntity = getThread(updated.getId(), authHeaders);
    compareEntities(updated, getEntity, authHeaders);

    return returned;
  }

  public final Thread patchThread(UUID id, String originalJson, Thread updated, Map<String, String> authHeaders)
      throws JsonProcessingException, HttpResponseException {
    String updatedThreadJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedThreadJson);
    return TestUtils.patch(getResource(String.format("feed/%s", id)), patch, Thread.class, authHeaders);
  }

  public void compareEntities(Thread expected, Thread patched, Map<String, String> authHeaders) {
    assertListNotNull(patched.getId(), patched.getHref(), patched.getAbout());
    assertEquals(expected.getMessage(), patched.getMessage());
    assertEquals(expected.getResolved(), patched.getResolved());
    assertEquals(TestUtils.getPrincipal(authHeaders), patched.getUpdatedBy());
  }
}
