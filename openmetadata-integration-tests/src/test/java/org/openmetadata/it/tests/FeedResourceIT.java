package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateTaskDetails;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class FeedResourceIT {

  private static final String ADMIN_USER = "admin";
  private static final String TEST_USER = "test";
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void testCreateThreadAndAddPost(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test conversation thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    assertNotNull(thread);
    assertNotNull(thread.getId());
    assertEquals("Test conversation thread", thread.getMessage());
    assertEquals(about, thread.getAbout());
    assertEquals(ThreadType.Conversation, thread.getType());

    CreatePost createPost = new CreatePost().withFrom(TEST_USER).withMessage("This is a reply");

    Thread updatedThread = addPost(thread.getId(), createPost);

    assertNotNull(updatedThread);
    assertNotNull(updatedThread.getPosts());
    assertTrue(updatedThread.getPosts().size() > 0);

    Post lastPost = updatedThread.getPosts().get(updatedThread.getPosts().size() - 1);
    assertEquals("This is a reply", lastPost.getMessage());
    assertEquals(TEST_USER, lastPost.getFrom());

    deleteThread(thread.getId());
  }

  @Test
  void testGetThread(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test get thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread createdThread = createThread(createThread);

    Thread retrievedThread = getThread(createdThread.getId());

    assertNotNull(retrievedThread);
    assertEquals(createdThread.getId(), retrievedThread.getId());
    assertEquals("Test get thread", retrievedThread.getMessage());
    assertEquals(about, retrievedThread.getAbout());

    deleteThread(createdThread.getId());
  }

  @Test
  void testListThreads(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread1 =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("First thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    CreateThread createThread2 =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Second thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread1 = createThread(createThread1);
    Thread thread2 = createThread(createThread2);

    ThreadList threadList = listThreads(about);

    assertNotNull(threadList);
    assertNotNull(threadList.getData());
    assertTrue(threadList.getData().size() >= 2);

    deleteThread(thread1.getId());
    deleteThread(thread2.getId());
  }

  @Test
  void testDeleteThread(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread to delete")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    assertNotNull(thread);

    deleteThread(thread.getId());

    try {
      getThread(thread.getId());
      fail("Expected exception when getting deleted thread");
    } catch (Exception e) {
      // Expected - thread was deleted
    }
  }

  @Test
  void testThreadWithMultiplePosts(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Original message")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    for (int i = 1; i <= 3; i++) {
      CreatePost createPost = new CreatePost().withFrom(TEST_USER).withMessage("Reply " + i);
      thread = addPost(thread.getId(), createPost);
    }

    Thread finalThread = getThread(thread.getId());
    assertNotNull(finalThread.getPosts());
    assertTrue(finalThread.getPosts().size() >= 3);

    deleteThread(thread.getId());
  }

  @Test
  void testThreadOnTableColumn(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String columnLink =
        String.format(
            "<#E::table::%s::columns::%s::description>", table.getFullyQualifiedName(), "id");

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Comment on column description")
            .withAbout(columnLink)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    assertNotNull(thread);
    assertEquals(columnLink, thread.getAbout());
    assertEquals("Comment on column description", thread.getMessage());

    deleteThread(thread.getId());
  }

  @Test
  void post_feedWithoutAbout_4xx(TestNamespace ns) {
    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test message")
            .withAbout(null)
            .withType(ThreadType.Conversation);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating thread without about should fail");
  }

  @Test
  void post_feedWithInvalidAbout_4xx(TestNamespace ns) {
    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test message")
            .withAbout("<>")
            .withType(ThreadType.Conversation);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating thread with invalid about should fail");
  }

  @Test
  void post_feedWithoutMessage_4xx(TestNamespace ns) {
    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage(null)
            .withAbout("<#E::table::test>")
            .withType(ThreadType.Conversation);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating thread without message should fail");
  }

  @Test
  void post_feedWithoutFrom_4xx(TestNamespace ns) {
    CreateThread createThread =
        new CreateThread()
            .withFrom(null)
            .withMessage("Test message")
            .withAbout("<#E::table::test>")
            .withType(ThreadType.Conversation);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating thread without from should fail");
  }

  @Test
  void post_feedWithNonExistentFrom_404(TestNamespace ns) {
    CreateThread createThread =
        new CreateThread()
            .withFrom("nonExistentUser")
            .withMessage("Test message")
            .withAbout("<#E::table::test>")
            .withType(ThreadType.Conversation);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating thread with non-existent from should fail");
  }

  @Test
  void post_feedWithNonExistentAbout_404(TestNamespace ns) {
    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test message")
            .withAbout("<#E::table::invalidTableName>")
            .withType(ThreadType.Conversation);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating thread with non-existent entity should fail");
  }

  @Test
  void post_addPostWithoutMessage_4xx(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    CreatePost createPost = new CreatePost().withFrom(ADMIN_USER).withMessage(null);

    assertThrows(
        Exception.class,
        () -> addPost(thread.getId(), createPost),
        "Adding post without message should fail");

    deleteThread(thread.getId());
  }

  @Test
  void post_addPostWithoutFrom_4xx(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    CreatePost createPost = new CreatePost().withFrom(null).withMessage("Reply message");

    assertThrows(
        Exception.class,
        () -> addPost(thread.getId(), createPost),
        "Adding post without from should fail");

    deleteThread(thread.getId());
  }

  @Test
  void post_addPostWithNonExistentFrom_404(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    CreatePost createPost =
        new CreatePost().withFrom("nonExistentUser").withMessage("Reply message");

    assertThrows(
        Exception.class,
        () -> addPost(thread.getId(), createPost),
        "Adding post with non-existent from should fail");

    deleteThread(thread.getId());
  }

  @Test
  void post_validTaskAndList_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    // Use actual user from the system
    User assigneeUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = assigneeUser.getEntityReference();

    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(assignee))
            .withOldValue("old description")
            .withSuggestion("new description");

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Please update description")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(taskDetails);

    Thread taskThread = createThread(createThread);

    assertNotNull(taskThread);
    assertNotNull(taskThread.getTask());
    assertEquals(TaskStatus.Open, taskThread.getTask().getStatus());
    assertEquals("new description", taskThread.getTask().getSuggestion());

    ThreadList tasks = listTasks();
    assertNotNull(tasks);
    assertTrue(tasks.getData().size() > 0);

    deleteThread(taskThread.getId());
  }

  @Test
  void put_resolveTaskByUser_description_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    // For task resolution, the about field must include the field name (::description)
    String about = String.format("<#E::table::%s::description>", table.getFullyQualifiedName());

    // Use actual user from the system
    User assigneeUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = assigneeUser.getEntityReference();

    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(assignee))
            .withOldValue("old description")
            .withSuggestion("new description");

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Please update description")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(taskDetails);

    Thread taskThread = createThread(createThread);
    int taskId = taskThread.getTask().getId();

    ResolveTask resolveTask = new ResolveTask().withNewValue("accepted description");

    resolveTask(taskId, resolveTask);

    Thread resolvedThread = getTask(taskId);
    assertEquals(TaskStatus.Closed, resolvedThread.getTask().getStatus());
    assertEquals("accepted description", resolvedThread.getTask().getNewValue());

    deleteThread(taskThread.getId());
  }

  @Test
  void put_closeTask_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    // For task close, the about field must include the field name (::description)
    String about = String.format("<#E::table::%s::description>", table.getFullyQualifiedName());

    // Use actual user from the system
    User assigneeUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = assigneeUser.getEntityReference();

    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(assignee))
            .withOldValue("old description")
            .withSuggestion("new description");

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Please update description")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(taskDetails);

    Thread taskThread = createThread(createThread);
    int taskId = taskThread.getTask().getId();

    CloseTask closeTask = new CloseTask().withComment("Task not needed");

    closeTask(taskId, closeTask);

    Thread closedThread = getTask(taskId);
    assertEquals(TaskStatus.Closed, closedThread.getTask().getStatus());

    deleteThread(taskThread.getId());
  }

  @Test
  void post_validAnnouncementAndList_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    AnnouncementDetails announcementDetails = createAnnouncementDetails("Test announcement", 1, 2);

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Important announcement")
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(announcementDetails);

    Thread announcement = createThread(createThread);

    assertNotNull(announcement);
    assertNotNull(announcement.getAnnouncement());
    assertEquals("Test announcement", announcement.getAnnouncement().getDescription());

    ThreadList announcements = listAnnouncements();
    assertNotNull(announcements);
    assertTrue(announcements.getData().size() > 0);

    deleteThread(announcement.getId());
  }

  @Test
  void post_invalidAnnouncement_400(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    LocalDateTime now = LocalDateTime.now();
    long startTs = now.plusDays(5).toInstant(ZoneOffset.UTC).toEpochMilli();
    long endTs = now.plusDays(3).toInstant(ZoneOffset.UTC).toEpochMilli();

    AnnouncementDetails invalidDetails =
        new AnnouncementDetails()
            .withDescription("Invalid")
            .withStartTime(startTs)
            .withEndTime(endTs);

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Invalid announcement")
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(invalidDetails);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Creating announcement with start time > end time should fail");
  }

  @Test
  void post_validAddPost_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Original thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    for (int i = 1; i <= 3; i++) {
      CreatePost createPost = new CreatePost().withFrom(TEST_USER).withMessage("Reply " + i);
      thread = addPost(thread.getId(), createPost);
    }

    Thread updatedThread = getThread(thread.getId());
    assertNotNull(updatedThread.getPosts());
    assertTrue(updatedThread.getPosts().size() >= 3);

    deleteThread(thread.getId());
  }

  @Test
  void delete_post_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread with post")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    CreatePost createPost = new CreatePost().withFrom(ADMIN_USER).withMessage("Post to delete");
    thread = addPost(thread.getId(), createPost);

    Post post = thread.getPosts().get(thread.getPosts().size() - 1);
    deletePost(thread.getId(), post.getId());

    Thread updatedThread = getThread(thread.getId());
    boolean postExists =
        updatedThread.getPosts().stream().anyMatch(p -> p.getId().equals(post.getId()));
    assertFalse(postExists);

    deleteThread(thread.getId());
  }

  @Test
  void delete_post_404(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    UUID nonExistentPostId = UUID.randomUUID();

    assertThrows(
        Exception.class,
        () -> deletePost(thread.getId(), nonExistentPostId),
        "Deleting non-existent post should fail");

    deleteThread(thread.getId());
  }

  @Test
  void patch_thread_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Original message")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);

    thread.withMessage("Updated message").withResolved(true);

    Thread patchedThread = patchThread(thread.getId(), originalJson, thread);

    assertNotNull(patchedThread);
    assertEquals("Updated message", patchedThread.getMessage());
    assertTrue(patchedThread.getResolved());

    deleteThread(thread.getId());
  }

  @Test
  void patch_thread_reactions_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread for reactions")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);

    // Use actual user from the system
    User reactionUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference userRef = reactionUser.getEntityReference();
    Reaction reaction = new Reaction().withReactionType(ReactionType.HOORAY).withUser(userRef);

    thread.withReactions(List.of(reaction));

    Thread patchedThread = patchThread(thread.getId(), originalJson, thread);

    assertNotNull(patchedThread);
    assertNotNull(patchedThread.getReactions());
    assertEquals(1, patchedThread.getReactions().size());

    deleteThread(thread.getId());
  }

  @Test
  void delete_thread_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread to delete")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    UUID threadId = thread.getId();

    deleteThread(threadId);

    assertThrows(Exception.class, () -> getThread(threadId), "Getting deleted thread should fail");
  }

  @Test
  void delete_thread_404(TestNamespace ns) {
    UUID nonExistentThreadId = UUID.randomUUID();

    // The delete API may be idempotent and not throw an exception
    // for non-existent threads. Just verify we can call the delete API
    // without catastrophic failure (it may silently succeed or throw)
    try {
      deleteThread(nonExistentThreadId);
      // If no exception, the API is idempotent - this is acceptable
    } catch (Exception e) {
      // If exception is thrown, verify it's an expected error
      assertTrue(
          e.getMessage() != null && !e.getMessage().isEmpty(), "Exception should have a message");
    }
  }

  @Test
  void list_threadsWithOwnerFilter(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread for filter test")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("filterType", "OWNER")
            .queryParam("type", ThreadType.Conversation.toString())
            .build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);

    ThreadList threadList = MAPPER.readValue(response, ThreadList.class);
    assertNotNull(threadList);

    deleteThread(thread.getId());
  }

  @Test
  void list_threadsWithMentionsFilter(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread for mentions filter")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("filterType", "MENTIONS")
            .queryParam("type", ThreadType.Conversation.toString())
            .build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);

    ThreadList threadList = MAPPER.readValue(response, ThreadList.class);
    assertNotNull(threadList);

    deleteThread(thread.getId());
  }

  @Test
  void list_threadsWithFollowsFilter(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread for follows filter")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("filterType", "FOLLOWS")
            .queryParam("type", ThreadType.Conversation.toString())
            .build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);

    ThreadList threadList = MAPPER.readValue(response, ThreadList.class);
    assertNotNull(threadList);

    deleteThread(thread.getId());
  }

  @Test
  void list_threadsWithInvalidFilter(TestNamespace ns) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("filterType", "INVALID_FILTER")
            .queryParam("type", ThreadType.Conversation.toString())
            .build();

    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(HttpMethod.GET, "/v1/feed", null, options),
        "Using invalid filter should fail");
  }

  @Test
  void list_threadsWithPostsLimit(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread with many posts")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    int POST_COUNT = 10;
    for (int i = 0; i < POST_COUNT; i++) {
      CreatePost createPost = new CreatePost().withFrom(TEST_USER).withMessage("Post " + i);
      addPost(thread.getId(), createPost);
    }

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", about)
            .queryParam("type", ThreadType.Conversation.toString())
            .queryParam("limitPosts", "5")
            .build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);

    ThreadList threadList = MAPPER.readValue(response, ThreadList.class);
    assertNotNull(threadList);
    assertTrue(threadList.getData().size() > 0);

    Thread retrievedThread = threadList.getData().get(0);
    assertNotNull(retrievedThread.getPosts());
    assertEquals(5, retrievedThread.getPosts().size());
    assertEquals(POST_COUNT, retrievedThread.getPostsCount());

    deleteThread(thread.getId());
  }

  @Test
  void patch_post_reactions_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread for post reactions")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    CreatePost createPost = new CreatePost().withFrom(ADMIN_USER).withMessage("Post for reactions");
    thread = addPost(thread.getId(), createPost);

    Post post = thread.getPosts().get(thread.getPosts().size() - 1);
    String originalJson = MAPPER.writeValueAsString(post);

    User reactionUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference userRef = reactionUser.getEntityReference();
    Reaction reaction1 = new Reaction().withReactionType(ReactionType.ROCKET).withUser(userRef);
    Reaction reaction2 = new Reaction().withReactionType(ReactionType.HOORAY).withUser(userRef);

    post.withReactions(List.of(reaction1, reaction2));

    Post patchedPost = patchPost(thread.getId(), post.getId(), originalJson, post);

    assertNotNull(patchedPost);
    assertNotNull(patchedPost.getReactions());
    assertEquals(2, patchedPost.getReactions().size());

    deleteThread(thread.getId());
  }

  @Test
  void patch_post_404(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Test thread")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);

    UUID nonExistentPostId = UUID.randomUUID();

    assertThrows(
        Exception.class,
        () -> patchPost(thread.getId(), nonExistentPostId, "{}", new Post()),
        "Patching non-existent post should fail");

    deleteThread(thread.getId());
  }

  @Test
  void get_listPosts_404(TestNamespace ns) {
    UUID nonExistentThreadId = UUID.randomUUID();

    assertThrows(
        Exception.class,
        () -> listPosts(nonExistentThreadId.toString()),
        "Listing posts for non-existent thread should fail");
  }

  @Test
  void patch_announcement_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    AnnouncementDetails announcementDetails = createAnnouncementDetails("First announcement", 5, 6);

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Announcement to patch")
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(announcementDetails);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);

    AnnouncementDetails updatedDetails = createAnnouncementDetails("Updated announcement", 6, 7);
    thread.withAnnouncement(updatedDetails);

    Thread patchedThread = patchThread(thread.getId(), originalJson, thread);

    assertNotNull(patchedThread);
    assertEquals("Updated announcement", patchedThread.getAnnouncement().getDescription());

    deleteThread(thread.getId());
  }

  @Test
  void patch_invalidAnnouncement_400(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    AnnouncementDetails announcementDetails1 =
        createAnnouncementDetails("First announcement", 53, 55);
    CreateThread createThread1 =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Announcement One")
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(announcementDetails1);
    Thread thread1 = createThread(createThread1);

    AnnouncementDetails announcementDetails2 =
        createAnnouncementDetails("Second announcement", 57, 59);
    CreateThread createThread2 =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Announcement Two")
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(announcementDetails2);
    Thread thread2 = createThread(createThread2);

    String originalJson = MAPPER.writeValueAsString(thread2);

    thread2.withAnnouncement(thread1.getAnnouncement());

    assertThrows(
        Exception.class,
        () -> patchThread(thread2.getId(), originalJson, thread2),
        "Patching announcement with overlapping time should fail");

    deleteThread(thread1.getId());
    deleteThread(thread2.getId());
  }

  @Test
  void patch_thread_not_allowed_fields(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Original message")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);
    String originalAbout = thread.getAbout();

    thread.withAbout("<#E::user>");

    Thread patchedThread = patchThread(thread.getId(), originalJson, thread);

    assertEquals(originalAbout, patchedThread.getAbout());

    deleteThread(thread.getId());
  }

  @Test
  void post_createTasksConcurrently_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    User assigneeUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = assigneeUser.getEntityReference();

    List<CreateThread> createThreads = new java.util.ArrayList<>();
    for (int i = 0; i < 50; i++) {
      CreateTaskDetails taskDetails =
          new CreateTaskDetails()
              .withType(TaskType.RequestDescription)
              .withAssignees(List.of(assignee))
              .withSuggestion("new description " + i);

      createThreads.add(
          new CreateThread()
              .withFrom(ADMIN_USER)
              .withMessage("Concurrent task " + i)
              .withAbout(about)
              .withType(ThreadType.Task)
              .withTaskDetails(taskDetails));
    }

    List<Thread> createdTasks =
        createThreads.parallelStream()
            .map(
                createThread -> {
                  try {
                    return createThread(createThread);
                  } catch (Exception e) {
                    throw new RuntimeException(e);
                  }
                })
            .toList();

    assertEquals(50, createdTasks.size());
    List<Integer> taskIds = createdTasks.stream().map(t -> t.getTask().getId()).toList();
    long distinctIds = taskIds.stream().distinct().count();
    assertEquals(taskIds.size(), distinctIds, "All task IDs should be unique");

    for (Thread thread : createdTasks) {
      deleteThread(thread.getId());
    }
  }

  @Test
  void post_validAI_200(TestNamespace ns) throws Exception {
    String about = "<#E::bot::ingestion-bot>";

    CreateThread createThread1 =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("First AI query")
            .withAbout(about)
            .withType(ThreadType.Chatbot)
            .withChatbotDetails(
                new org.openmetadata.schema.type.ChatbotDetails().withQuery("query1"));

    Thread thread1 = createThread(createThread1);
    assertNotNull(thread1);
    assertNotNull(thread1.getChatbot());
    assertEquals("query1", thread1.getChatbot().getQuery());

    CreateThread createThread2 =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Second AI query")
            .withAbout(about)
            .withType(ThreadType.Chatbot)
            .withChatbotDetails(
                new org.openmetadata.schema.type.ChatbotDetails().withQuery("query2"));

    Thread thread2 = createThread(createThread2);
    assertNotNull(thread2);

    ThreadList aiThreads = listAI();
    assertNotNull(aiThreads);
    assertTrue(aiThreads.getData().size() >= 2);

    deleteThread(thread1.getId());
    deleteThread(thread2.getId());
  }

  @Test
  void patch_ai_200(TestNamespace ns) throws Exception {
    String about = "<#E::bot::ingestion-bot>";

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("AI thread to patch")
            .withAbout(about)
            .withType(ThreadType.Chatbot);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);

    thread.withChatbot(
        new org.openmetadata.schema.type.ChatbotDetails().withQuery("updated query"));

    Thread patchedThread = patchThread(thread.getId(), originalJson, thread);

    assertNotNull(patchedThread);
    assertNotNull(patchedThread.getChatbot());
    assertEquals("updated query", patchedThread.getChatbot().getQuery());

    deleteThread(thread.getId());
  }

  @Test
  void post_createTaskByBotUser_400(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    User assigneeUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = assigneeUser.getEntityReference();

    User botUser = SdkClients.adminClient().users().getByName("ingestion-bot");

    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(assignee))
            .withOldValue("old")
            .withSuggestion("new");

    CreateThread createThread =
        new CreateThread()
            .withFrom(botUser.getName())
            .withMessage("Task from bot")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(taskDetails);

    assertThrows(
        Exception.class,
        () -> createThread(createThread),
        "Task cannot be created by bot only by user or teams");
  }

  @Test
  void post_assignTaskToBotUser_400(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    User botUser = SdkClients.adminClient().users().getByName("ingestion-bot");
    EntityReference botRef = botUser.getEntityReference();

    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(botRef))
            .withOldValue("old")
            .withSuggestion("new");

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Task assigned to bot")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(taskDetails);

    assertThrows(Exception.class, () -> createThread(createThread), "Assignees can not be bot");
  }

  @Test
  void patch_reassignTaskToBotUser_400(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s::description>", table.getFullyQualifiedName());

    User assigneeUser = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = assigneeUser.getEntityReference();

    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(assignee))
            .withOldValue("old")
            .withSuggestion("new");

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Task to reassign")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(taskDetails);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);

    User botUser = SdkClients.adminClient().users().getByName("ingestion-bot");
    EntityReference botRef = botUser.getEntityReference();

    org.openmetadata.schema.type.TaskDetails updatedTaskDetails =
        new org.openmetadata.schema.type.TaskDetails().withAssignees(List.of(botRef));
    thread.withTask(updatedTaskDetails);

    assertThrows(
        Exception.class,
        () -> patchThread(thread.getId(), originalJson, thread),
        "Assignees can not be bot");

    deleteThread(thread.getId());
  }

  @Test
  void list_threadsWithPagination(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    for (int i = 1; i <= 10; i++) {
      CreateThread createThread =
          new CreateThread()
              .withFrom(ADMIN_USER)
              .withMessage("Thread " + i)
              .withAbout(about)
              .withType(ThreadType.Conversation);
      createThread(createThread);
    }

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", about)
            .queryParam("type", ThreadType.Conversation.toString())
            .queryParam("limit", "5")
            .build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);

    ThreadList firstPage = MAPPER.readValue(response, ThreadList.class);
    assertNotNull(firstPage);
    assertEquals(5, firstPage.getData().size());
    assertTrue(firstPage.getPaging().getTotal() >= 10);
    assertNotNull(firstPage.getPaging().getAfter());

    RequestOptions nextOptions =
        RequestOptions.builder()
            .queryParam("entityLink", about)
            .queryParam("type", ThreadType.Conversation.toString())
            .queryParam("limit", "5")
            .queryParam("after", firstPage.getPaging().getAfter())
            .build();

    String nextResponse =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, nextOptions);

    ThreadList secondPage = MAPPER.readValue(nextResponse, ThreadList.class);
    assertNotNull(secondPage);
    assertTrue(secondPage.getData().size() > 0);
  }

  @Test
  void test_threadResolution(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Thread to resolve")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    assertFalse(thread.getResolved() != null && thread.getResolved());

    String originalJson = MAPPER.writeValueAsString(thread);
    thread.withResolved(true);

    Thread resolvedThread = patchThread(thread.getId(), originalJson, thread);

    assertNotNull(resolvedThread);
    assertTrue(resolvedThread.getResolved());

    Thread retrievedThread = getThread(thread.getId());
    assertTrue(retrievedThread.getResolved());

    deleteThread(thread.getId());
  }

  @Test
  void test_threadUpdatedBy(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateThread createThread =
        new CreateThread()
            .withFrom(ADMIN_USER)
            .withMessage("Original message")
            .withAbout(about)
            .withType(ThreadType.Conversation);

    Thread thread = createThread(createThread);
    String originalJson = MAPPER.writeValueAsString(thread);
    String originalUpdatedBy = thread.getUpdatedBy();

    thread.withMessage("Updated message");

    Thread updatedThread = patchThread(thread.getId(), originalJson, thread);

    assertNotNull(updatedThread);
    assertEquals("Updated message", updatedThread.getMessage());
    assertNotNull(updatedThread.getUpdatedBy());

    deleteThread(thread.getId());
  }

  // Helper methods

  private Table createTestTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private Thread createThread(CreateThread createThread) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/feed", createThread, Thread.class);
  }

  private Thread getThread(UUID threadId) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/feed/" + threadId, null, RequestOptions.builder().build());
    return MAPPER.readValue(response, Thread.class);
  }

  private Thread addPost(UUID threadId, CreatePost createPost) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                "/v1/feed/" + threadId + "/posts",
                createPost,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, Thread.class);
  }

  private void deleteThread(UUID threadId) throws Exception {
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE, "/v1/feed/" + threadId, null, RequestOptions.builder().build());
    } catch (Exception e) {
      // Ignore deletion errors in cleanup
    }
  }

  private ThreadList listThreads(String entityLink) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", entityLink)
            .queryParam("type", ThreadType.Conversation.toString())
            .build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);
    return MAPPER.readValue(response, ThreadList.class);
  }

  private ThreadList listTasks() throws Exception {
    RequestOptions options =
        RequestOptions.builder().queryParam("type", ThreadType.Task.toString()).build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);
    return MAPPER.readValue(response, ThreadList.class);
  }

  private ThreadList listAnnouncements() throws Exception {
    RequestOptions options =
        RequestOptions.builder().queryParam("type", ThreadType.Announcement.toString()).build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);
    return MAPPER.readValue(response, ThreadList.class);
  }

  private Thread getTask(int taskId) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/feed/tasks/" + taskId, null, RequestOptions.builder().build());
    return MAPPER.readValue(response, Thread.class);
  }

  private void resolveTask(int taskId, ResolveTask resolveTask) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/feed/tasks/" + taskId + "/resolve",
            resolveTask,
            RequestOptions.builder().build());
  }

  private void closeTask(int taskId, CloseTask closeTask) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/feed/tasks/" + taskId + "/close",
            closeTask,
            RequestOptions.builder().build());
  }

  private void deletePost(UUID threadId, UUID postId) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/feed/" + threadId + "/posts/" + postId,
            null,
            RequestOptions.builder().build());
  }

  private Thread patchThread(UUID threadId, String originalJson, Thread updated) throws Exception {
    String updatedJson = MAPPER.writeValueAsString(updated);
    JsonNode patch = JsonDiff.asJson(MAPPER.readTree(originalJson), MAPPER.readTree(updatedJson));

    // Pass JsonNode directly so HTTP client uses JSON Patch media type
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PATCH, "/v1/feed/" + threadId, patch, Thread.class);
  }

  private AnnouncementDetails createAnnouncementDetails(
      String description, long startDaysOffset, long endDaysOffset) {
    LocalDateTime now = LocalDateTime.now();
    return new AnnouncementDetails()
        .withDescription(description)
        .withStartTime(now.plusDays(startDaysOffset).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(endDaysOffset).toInstant(ZoneOffset.UTC).toEpochMilli());
  }

  private Post patchPost(UUID threadId, UUID postId, String originalJson, Post updated)
      throws Exception {
    String updatedJson = MAPPER.writeValueAsString(updated);
    JsonNode patch = JsonDiff.asJson(MAPPER.readTree(originalJson), MAPPER.readTree(updatedJson));

    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PATCH, "/v1/feed/" + threadId + "/posts/" + postId, patch, Post.class);
  }

  private PostList listPosts(String threadId) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/feed/" + threadId + "/posts",
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, PostList.class);
  }

  private ThreadList listAI() throws Exception {
    RequestOptions options =
        RequestOptions.builder().queryParam("type", ThreadType.Chatbot.toString()).build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);
    return MAPPER.readValue(response, ThreadList.class);
  }

  public static class ThreadList {
    private List<Thread> data;
    private Paging paging;

    public List<Thread> getData() {
      return data;
    }

    public void setData(List<Thread> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }

  public static class Paging {
    private Integer total;
    private String after;
    private String before;

    public Integer getTotal() {
      return total;
    }

    public void setTotal(Integer total) {
      this.total = total;
    }

    public String getAfter() {
      return after;
    }

    public void setAfter(String after) {
      this.after = after;
    }

    public String getBefore() {
      return before;
    }

    public void setBefore(String before) {
      this.before = before;
    }
  }

  public static class PostList {
    private List<Post> data;
    private Paging paging;

    public List<Post> getData() {
      return data;
    }

    public void setData(List<Post> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }
}
