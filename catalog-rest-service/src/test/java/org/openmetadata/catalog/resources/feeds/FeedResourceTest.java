package org.openmetadata.catalog.resources.feeds;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
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
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.catalog.resources.databases.TableResourceTest.createAndCheckTable;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FeedResourceTest extends CatalogApplicationTest {
  public static Table TABLE;
  public static String TABLE_LINK;
  public static List<Column> COLUMNS;
  public static User USER;
  public static String USER_LINK;
  public static Team TEAM;
  public static String TEAM_LINK;
  public static Thread THREAD;

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    TableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    CreateTable createTable = TableResourceTest.create(test);
    TABLE = createAndCheckTable(createTable);
    COLUMNS = Collections.singletonList(new Column().withName("column1").withColumnDataType(ColumnDataType.BIGINT));
    TABLE_LINK = String.format("<#E/table/%s>", TABLE.getFullyQualifiedName());

    USER = TableResourceTest.USER1;
    USER_LINK = String.format("<#E/user/%s>", USER.getName());

    TEAM = TableResourceTest.TEAM1;
    TEAM_LINK = String.format("<#E/team/%s>", TEAM.getName());

    CreateThread createThread = create(test);
    THREAD = createAndCheck(createThread);
  }

  @Test
  public void post_feedWithoutAbout_4xx(TestInfo test) {
    // Create thread without addressed to entity in the request
    CreateThread create = create(test).withAbout(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[about must not be null]");
  }

  @Test
  public void post_feedWithInvalidAbout_4xx(TestInfo test) {
    // Create thread without addressed to entity in the request
    CreateThread create = create(test).withAbout("<>"); // Invalid EntityLink
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");

    create.withAbout("<#E/>"); // Invalid EntityLink - missing entityType and entityId
    exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");

    create.withAbout("<#E/table/>"); // Invalid EntityLink - missing entityId
    exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");

    create.withAbout("<#E/table/tableName"); // Invalid EntityLink - missing closing bracket ">"
    exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[about must match \"^<#E/\\S+/\\S+>$\"]");
  }

  @Test
  public void post_feedWithoutMessage_4xx(TestInfo test) {
    // Create thread without message field in the request
    CreateThread create = create(test).withMessage(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[message must not be null]");
  }

  @Test
  public void post_feedWithoutFrom_4xx(TestInfo test) {
    // Create thread without from field in the request
    CreateThread create = create(test).withFrom(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[from must not be null]");
  }

  @Test
  public void post_feedWithNonExistentFrom_404(TestInfo test) {
    // Create thread with non existent from
    CreateThread create = create(test).withFrom(TestUtils.NON_EXISTENT_ENTITY);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_feedWithNonExistentAbout_404(TestInfo test) {
    // Create thread with non existent addressed To entity
    CreateThread create = create(test).withAbout("<#E/table/invalidTableName>");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createThread(create));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.TABLE,
            "invalidTableName"));
  }

  @Test
  public void post_validThreadAndList_200(TestInfo test) throws HttpResponseException {
    int totalThreadCount = listThreads(null).getData().size();
    int userThreadCount = listThreads(USER_LINK).getData().size();
    int teamThreadCount = listThreads(TEAM_LINK).getData().size();
    int tableThreadCount = listThreads(TABLE_LINK).getData().size();

    CreateThread create = create(test).withMessage(
            String.format("%s mentions user %s team %s and table %s", test.getDisplayName(),
                    USER_LINK, TEAM_LINK, TABLE_LINK));
    // Create 10 threads
    for (int i = 0; i < 10; i++) {
      Thread thread = createAndCheck(create);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(++userThreadCount, listThreads(USER_LINK).getData().size()); // For mentioned user
      assertEquals(++teamThreadCount, listThreads(TEAM_LINK).getData().size()); // For mentione team
      assertEquals(++tableThreadCount, listThreads(TABLE_LINK).getData().size()); // For about TABLE
      assertEquals(++totalThreadCount, listThreads(null).getData().size()); // Overall number of threads
    }
  }

  @Test
  public void post_addPostWithoutMessage_4xx(TestInfo test) {
    // Add post to a thread without message field
    Post post = createPost().withMessage(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> addPost(THREAD.getId(), post));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[message must not be null]");
  }

  @Test
  public void post_addPostWithoutFrom_4xx(TestInfo test) {
    // Add post to a thread without from field
    Post post = createPost().withFrom(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> addPost(THREAD.getId(), post));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[from must not be null]");
  }

  @Test
  public void post_addPostWithNonExistentFrom_404(TestInfo test) {
    // Add post to a thread with non existent from user
    Post post = createPost().withFrom(TestUtils.NON_EXISTENT_ENTITY);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> addPost(THREAD.getId(), post));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_validAddPost_200(TestInfo test) throws HttpResponseException {
    Thread thread = createAndCheck(create(test));
    // Add 10 posts and validate
    for (int i = 0; i < 10; i++) {
      Post post = createPost();
      thread = addPostAndCheck(thread, post);
    }
  }

  public static Thread createAndCheck(CreateThread create) throws HttpResponseException {
    // Validate returned thread from POST
    Thread thread = createThread(create);
    validateThread(thread, create.getMessage(), create.getFrom(), create.getAbout());

    // Validate returned thread again from GET
    Thread getThread = getThread(thread.getId());
    validateThread(getThread, create.getMessage(), create.getFrom(), create.getAbout());
    return thread;
  }

  private Thread addPostAndCheck(Thread thread, Post addPost) throws HttpResponseException {
    Thread returnedThread = addPost(thread.getId(), addPost);
    // Last post is the newly added one
    validatePost(thread, returnedThread, addPost);

    Thread getThread = getThread(thread.getId());
    validatePost(thread, getThread, addPost);
    return returnedThread;
  }

  private static void validateThread(Thread thread, String message, UUID from, String about) {
    assertNotNull(thread.getId());
    Post firstPost = thread.getPosts().get(0);
    assertEquals(message, firstPost.getMessage());
    assertEquals(from, firstPost.getFrom());
    Assertions.assertEquals(about, thread.getAbout());
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

  public static Thread createThread(CreateThread create) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("feed"), create, Thread.class);
  }

  public static Thread addPost(UUID threadId, Post post) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("feed/" + threadId + "/posts"), post, Thread.class);
  }

  public static CreateThread create(TestInfo test) {
    String about = String.format("<#E/%s/%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    return new CreateThread().withFrom(USER.getId()).withMessage("message").withAbout(about);
  }

  public static Post createPost() {
    return new Post().withFrom(USER.getId()).withMessage("message");
  }

  public static Thread getThread(UUID id) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("feed/" + id);
    return TestUtils.get(target, Thread.class);
  }

  public static ThreadList listThreads(String entityLink) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("feed");
    target = entityLink != null ? target.queryParam("entity", entityLink) : target;
    return TestUtils.get(target, ThreadList.class);
  }
}
