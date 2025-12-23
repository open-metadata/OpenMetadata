package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Post;
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
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/feed", createThread, RequestOptions.builder().build());
    return MAPPER.readValue(response, Thread.class);
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
}
