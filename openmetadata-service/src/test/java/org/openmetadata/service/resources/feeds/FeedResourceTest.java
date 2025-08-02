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

package org.openmetadata.service.resources.feeds;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.awaitility.Awaitility.with;
import static org.awaitility.Durations.ONE_MINUTE;
import static org.awaitility.Durations.ONE_SECOND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.TaskType.RequestDescription;
import static org.openmetadata.schema.type.TaskType.RequestTag;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ANNOUNCEMENT_INVALID_START_TIME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ANNOUNCEMENT_OVERLAP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.jdbi3.RoleRepository.DOMAIN_ONLY_ACCESS_ROLE;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.resources.EntityResourceTest.DOMAIN_ONLY_ACCESS_ROLE_REF;
import static org.openmetadata.service.resources.EntityResourceTest.MULTI_DOMAIN_RULE;
import static org.openmetadata.service.resources.EntityResourceTest.USER1;
import static org.openmetadata.service.resources.EntityResourceTest.USER2_REF;
import static org.openmetadata.service.resources.EntityResourceTest.USER_ADDRESS_TAG_LABEL;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Predicate;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.openmetadata.schema.api.CreateTaskDetails;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.feed.ThreadCount;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.ChatbotDetails;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.FeedMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FeedMessage;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DomainResourceTest;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.feeds.FeedResource.PostList;
import org.openmetadata.service.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class FeedResourceTest extends OpenMetadataApplicationTest {
  public static Table TABLE;
  public static Table TABLE2;
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_DESCRIPTION_LINK;
  public static List<Column> COLUMNS;
  public static User USER;
  public static String USER_LINK;
  public static User BOT_USER;
  public static Map<String, String> USER_AUTH_HEADERS;
  public static User USER2;
  public static Map<String, String> USER2_AUTH_HEADERS;
  public static Team TEAM;
  public static Team TEAM2;
  public static String TEAM_LINK;
  public static Thread THREAD;
  public static TableResourceTest TABLE_RESOURCE_TEST;
  protected static RoleRepository roleRepository;
  public static final Comparator<Reaction> REACTION_COMPARATOR =
      (o1, o2) ->
          o1.getReactionType().equals(o2.getReactionType())
                  && o1.getUser().getId().equals(o2.getUser().getId())
              ? 0
              : 1;

  private static final MessageDecorator<FeedMessage> feedMessageFormatter =
      new FeedMessageDecorator();

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    TABLE_RESOURCE_TEST = new TableResourceTest();
    TABLE_RESOURCE_TEST.setup(test); // Initialize TableResourceTest for using helper methods

    // Create a test domain for the main tables used in tests
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain testDomain =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("feed-test-domain"), ADMIN_AUTH_HEADERS);

    UserResourceTest userResourceTest = new UserResourceTest();
    USER2 =
        userResourceTest.createEntity(userResourceTest.createRequest(test, 4), ADMIN_AUTH_HEADERS);
    USER2_AUTH_HEADERS = authHeaders(USER2.getName());

    BOT_USER = userResourceTest.createUser("bot_user", true);

    CreateTable createTable =
        TABLE_RESOURCE_TEST.createRequest(test).withOwners(List.of(TableResourceTest.USER1_REF));
    TABLE = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam =
        teamResourceTest
            .createRequest(test, 4)
            .withDisplayName("Team2")
            .withDescription("Team2 description")
            .withUsers(List.of(USER2.getId()));
    TEAM2 = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);
    EntityReference TEAM2_REF = TEAM2.getEntityReference();

    CreateTable createTable2 = TABLE_RESOURCE_TEST.createRequest(test);
    createTable2.withName("table2").withOwners(List.of(TEAM2_REF));
    TABLE2 = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable2, ADMIN_AUTH_HEADERS);

    COLUMNS =
        Collections.singletonList(
            new Column().withName("column1").withDataType(ColumnDataType.BIGINT));
    TABLE_LINK = String.format("<#E::table::%s>", TABLE.getFullyQualifiedName());
    TABLE_COLUMN_LINK =
        String.format(
            "<#E::table::%s::columns::" + C1 + "::description>", TABLE.getFullyQualifiedName());
    TABLE_DESCRIPTION_LINK =
        String.format("<#E::table::%s::description>", TABLE.getFullyQualifiedName());

    USER = TableResourceTest.USER1;
    USER_LINK = String.format("<#E::user::%s>", USER.getFullyQualifiedName());
    USER_AUTH_HEADERS = authHeaders(USER.getName());

    TEAM = TableResourceTest.TEAM1;
    TEAM_LINK = String.format("<#E::team::%s>", TEAM.getFullyQualifiedName());

    CreateThread createThread = create();
    THREAD = createAndCheck(createThread, ADMIN_AUTH_HEADERS);

    roleRepository = Entity.getRoleRepository();
    DOMAIN_ONLY_ACCESS_ROLE_REF =
        roleRepository.getReferenceByName(DOMAIN_ONLY_ACCESS_ROLE, Include.NON_DELETED);
  }

  @Test
  void post_feedWithoutAbout_4xx() {
    // Create thread without addressed to entity in the request
    CreateThread create = create().withFrom(USER.getName()).withAbout(null);
    assertResponse(
        () -> createThread(create, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param about must not be null]");
  }

  @Test
  void post_feedWithInvalidAbout_4xx() {
    // Create thread without addressed to entity in the request
    CreateThread create = create().withFrom(USER.getName()).withAbout("<>"); // Invalid EntityLink

    String failureReason =
        "[about must match \"(?U)^<#E::\\w+::(?:[^:<>|]|:[^:<>|])+(?:::(?:[^:<>|]|:[^:<>|])+)*>$\"]";
    assertResponseContains(
        () -> createThread(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withAbout("<#E::>"); // Invalid EntityLink - missing entityType and entityId
    assertResponseContains(
        () -> createThread(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withAbout("<#E::table::>"); // Invalid EntityLink - missing entityId
    assertResponseContains(
        () -> createThread(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withAbout("<#E::table::tableName"); // Invalid EntityLink - missing closing bracket ">"
    assertResponseContains(
        () -> createThread(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);
  }

  @Test
  void post_feedWithoutMessage_4xx() {
    CreateThread create = create().withFrom(USER.getName()).withMessage(null);
    assertResponseContains(
        () -> createThread(create, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param message must not be null]");
  }

  @Test
  void post_feedWithoutFrom_4xx() {
    CreateThread create = create().withFrom(null);
    assertResponseContains(
        () -> createThread(create, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param from must not be null]");
  }

  @Test
  void post_feedWithNonExistentFrom_404() {
    CreateThread create = create().withFrom(NON_EXISTENT_ENTITY.toString());
    assertResponse(
        () -> createThread(create, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_feedWithNonExistentAbout_404() {
    CreateThread create = create().withAbout("<#E::table::invalidTableName>");
    assertResponse(
        () -> createThread(create, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TABLE, "invalidTableName"));
  }

  @Test
  @Order(1)
  void post_validThreadAndList_200(TestInfo test) throws IOException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    EventSubscription subscription =
        eventSubscriptionResourceTest.getEntityByName("ActivityFeedAlert", ADMIN_AUTH_HEADERS);
    eventSubscriptionResourceTest.waitForAllEventToComplete(subscription.getId());
    int totalThreadCount = listThreads(null, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    int userThreadCount = listThreads(USER_LINK, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    int tableThreadCount = listThreads(TABLE_LINK, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    int tableDescriptionThreadCount =
        listThreads(TABLE_DESCRIPTION_LINK, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    int tableColumnDescriptionThreadCount =
        listThreads(TABLE_COLUMN_LINK, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();

    String message =
        String.format(
            "%s mentions user %s team %s, table %s, description %s, and column description %s",
            test.getDisplayName(),
            USER_LINK,
            TEAM_LINK,
            TABLE_LINK,
            TABLE_DESCRIPTION_LINK,
            TABLE_COLUMN_LINK);
    CreateThread create = create().withMessage(message);
    // Create 10 threads
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, USER_AUTH_HEADERS);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(
          ++userThreadCount,
          listThreads(USER_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal()); // Mentioned user
      assertEquals(
          ++tableThreadCount,
          listThreads(TABLE_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal()); // About TABLE
      assertEquals(
          ++totalThreadCount,
          listThreads(null, null, USER_AUTH_HEADERS).getPaging().getTotal()); // Overall threads
    }

    // List threads should not include mentioned entities
    // It should only include threads which are about the entity link
    assertEquals(
        tableDescriptionThreadCount,
        listThreads(TABLE_DESCRIPTION_LINK, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal()); // About TABLE Description
    assertEquals(
        tableColumnDescriptionThreadCount,
        listThreads(TABLE_COLUMN_LINK, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal()); // About TABLE Column Description

    create.withAbout(TABLE_DESCRIPTION_LINK);
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, USER_AUTH_HEADERS);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(
          ++userThreadCount,
          listThreads(USER_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal()); // Mentioned user
      assertEquals(
          ++tableThreadCount,
          listThreads(TABLE_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal()); // About TABLE
      assertEquals(
          ++tableDescriptionThreadCount,
          listThreads(TABLE_DESCRIPTION_LINK, null, USER_AUTH_HEADERS)
              .getPaging()
              .getTotal()); // About TABLE Description
      assertEquals(
          ++totalThreadCount,
          listThreads(null, null, USER_AUTH_HEADERS).getPaging().getTotal()); // Overall threads
    }

    create.withAbout(TABLE_COLUMN_LINK);
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, USER_AUTH_HEADERS);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(
          ++userThreadCount,
          listThreads(USER_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal()); // Mentioned user
      assertEquals(
          ++tableThreadCount,
          listThreads(TABLE_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal()); // About TABLE
      assertEquals(
          ++tableColumnDescriptionThreadCount,
          listThreads(TABLE_COLUMN_LINK, null, USER_AUTH_HEADERS)
              .getPaging()
              .getTotal()); // About TABLE Description
      assertEquals(
          ++totalThreadCount,
          listThreads(null, null, USER_AUTH_HEADERS).getPaging().getTotal()); // Overall threads
    }

    // Test the /api/v1/feed/count API
    assertEquals(
        userThreadCount, listThreads(USER_LINK, null, USER_AUTH_HEADERS).getPaging().getTotal());
    FeedResource.ThreadCountList threadCounts = listThreadsCount(USER_LINK, USER_AUTH_HEADERS);
    for (ThreadCount threadCount : threadCounts.getData()) {
      if (threadCount.getEntityLink().equals(USER_LINK)) {
        assertEquals(userThreadCount, threadCount.getConversationCount());
      }
    }
    assertEquals(
        tableDescriptionThreadCount, getThreadCount(TABLE_DESCRIPTION_LINK, USER_AUTH_HEADERS));
    assertEquals(
        tableColumnDescriptionThreadCount, getThreadCount(TABLE_COLUMN_LINK, USER_AUTH_HEADERS));
  }

  @Test
  void post_validTaskAndList_200() throws IOException {
    int totalTaskCount =
        listTasks(null, null, null, null, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    int assignedByCount =
        listTasks(
                null,
                USER.getId().toString(),
                FilterType.ASSIGNED_BY,
                null,
                null,
                ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();
    int assignedToCount =
        listTasks(
                null,
                USER.getId().toString(),
                FilterType.ASSIGNED_TO,
                null,
                null,
                ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();

    // User creates task1 assigned to User2 on TABLE
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    Thread taskThread =
        createTaskThread(
            USER.getName(),
            about,
            USER2.getEntityReference(),
            "old",
            "new",
            RequestDescription,
            USER_AUTH_HEADERS);
    TaskDetails task1 = taskThread.getTask();

    // List task and validate
    ThreadList tasks = listTasks(null, null, null, null, null, USER_AUTH_HEADERS);
    TaskDetails task = tasks.getData().get(0).getTask();
    validateTaskList(USER2.getId(), "new", TaskStatus.Open, totalTaskCount + 1, tasks);

    // Get task and validate
    taskThread = getTask(task.getId(), USER_AUTH_HEADERS);
    validateTask(task1, taskThread.getTask());

    // User2 creates a task2 assigned to User on TABLE2
    about =
        String.format(
            "<#E::%s::%s::columns::%s::description>",
            Entity.TABLE, TABLE2.getFullyQualifiedName(), C1);
    taskThread =
        createTaskThread(
            USER2.getName(),
            about,
            USER.getEntityReference(),
            "old",
            "new2",
            RequestDescription,
            USER2_AUTH_HEADERS);
    TaskDetails task2 = taskThread.getTask();
    tasks = listTasks(null, null, null, null, null, USER2_AUTH_HEADERS);
    validateTaskList(USER.getId(), "new2", TaskStatus.Open, totalTaskCount + 2, tasks);

    // List tasks assigned by USER
    tasks =
        listTasks(
            null, USER.getId().toString(), FilterType.ASSIGNED_BY, null, null, USER2_AUTH_HEADERS);
    task = tasks.getData().get(0).getTask();
    validateTask(task1, task);
    validateTaskList(USER2.getId(), "new", TaskStatus.Open, assignedByCount + 1, tasks);

    // List tasks assigned to USER
    tasks =
        listTasks(
            null, USER.getId().toString(), FilterType.ASSIGNED_TO, null, null, USER2_AUTH_HEADERS);
    task = tasks.getData().get(0).getTask();
    validateTask(task2, task);
    validateTaskList(USER.getId(), "new2", TaskStatus.Open, assignedToCount + 1, tasks);

    // List all the tasks for a user
    tasks = listTasks(null, USER.getId().toString(), null, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(assignedToCount + assignedByCount + 2, tasks.getPaging().getTotal());
    assertEquals(assignedToCount + assignedByCount + 2, tasks.getData().size());

    // close a task and test the task status filter
    ResolveTask resolveTask = new ResolveTask().withNewValue("accepted description");
    resolveTask(task2.getId(), resolveTask, USER_AUTH_HEADERS);

    tasks = listTasks(null, null, null, TaskStatus.Open, null, USER2_AUTH_HEADERS);
    assertFalse(tasks.getData().stream().anyMatch(t -> t.getTask().getId().equals(task2.getId())));

    tasks = listTasks(null, null, null, TaskStatus.Closed, null, USER2_AUTH_HEADERS);
    assertEquals(task2.getId(), tasks.getData().get(0).getTask().getId());
  }

  @Test
  void post_validAnnouncementAndList_200() throws IOException {
    int totalAnnouncementCount =
        listAnnouncements(null, null, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();

    // create two announcements with start time in the future
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());

    // Create announcement 1
    AnnouncementDetails announcementDetails = getAnnouncementDetails("First announcement", 10, 11);
    createAnnouncement(
        USER.getName(), about, "Announcement One", announcementDetails, USER_AUTH_HEADERS);

    // Create announcement 2
    announcementDetails = getAnnouncementDetails("Second announcement", 12, 13);
    createAnnouncement(
        USER.getName(), about, "Announcement Two", announcementDetails, USER_AUTH_HEADERS);

    // create an expired announcement
    announcementDetails = getAnnouncementDetails("Expired", -30, -20);
    createAnnouncement(
        USER.getName(), about, "Announcement Three", announcementDetails, USER_AUTH_HEADERS);

    // create one active announcement
    announcementDetails = getAnnouncementDetails("Active", -1, 1);
    createAnnouncement(
        USER.getName(), about, "Announcement Four", announcementDetails, USER_AUTH_HEADERS);

    ThreadList announcements = listAnnouncements(null, null, null, ADMIN_AUTH_HEADERS);
    int announcementCount = announcements.getPaging().getTotal();

    assertEquals(totalAnnouncementCount + 4, announcementCount);
    assertEquals(totalAnnouncementCount + 4, announcements.getData().size());

    announcements = listAnnouncements(about, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(announcementCount, announcements.getPaging().getTotal());
    assertEquals(announcementCount, announcements.getData().size());

    announcements = listAnnouncements(null, null, true, ADMIN_AUTH_HEADERS);
    int activeAnnouncementCount = announcements.getPaging().getTotal();

    assertEquals(1, activeAnnouncementCount);
    assertEquals(1, announcements.getData().size());
    assertEquals("Active", announcements.getData().get(0).getAnnouncement().getDescription());

    announcements = listAnnouncements(about, null, true, ADMIN_AUTH_HEADERS);
    assertEquals(activeAnnouncementCount, announcements.getPaging().getTotal());
    assertEquals(activeAnnouncementCount, announcements.getData().size());

    // get non-active announcements
    announcements = listAnnouncements(null, null, false, ADMIN_AUTH_HEADERS);
    assertEquals(totalAnnouncementCount + 3, announcements.getPaging().getTotal());
    assertEquals(totalAnnouncementCount + 3, announcements.getData().size());

    announcements = listAnnouncements(about, null, false, ADMIN_AUTH_HEADERS);
    assertEquals(totalAnnouncementCount + 3, announcements.getPaging().getTotal());
    assertEquals(totalAnnouncementCount + 3, announcements.getData().size());

    // verify the announcement counts in the feed count API
    FeedResource.ThreadCountList threadCounts = listThreadsCount(about, ADMIN_AUTH_HEADERS);
    for (ThreadCount threadCount : threadCounts.getData()) {
      if (threadCount.getEntityLink().equals(about)
          && threadCount.getTotalAnnouncementCount() != null) {
        assertEquals(totalAnnouncementCount + 4, threadCount.getTotalAnnouncementCount());
        assertEquals(1, threadCount.getActiveAnnouncementCount());
        assertEquals(totalAnnouncementCount + 3, threadCount.getInactiveAnnouncementCount());
      }
    }
  }

  @Test
  void post_validAI_200() throws IOException {
    // Sample EntityLink
    String about = String.format("<#E::%s::%s>", Entity.BOT, "ingestion-bot");
    createAI(USER.getName(), about, "First AI", "query", USER_AUTH_HEADERS);
    createAI(USER.getName(), about, "Second AI", "query", USER_AUTH_HEADERS);

    // List all the AI and make sure the number of AI increased by 2
    assertEquals(2, listAI(null, null, ADMIN_AUTH_HEADERS).getPaging().getTotal());
  }

  @Test
  void post_invalidAnnouncement_400() throws IOException {
    // create two announcements with same start time in the future
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    AnnouncementDetails announcementDetails = getAnnouncementDetails("1", 3, 5);
    createAnnouncement(
        USER.getName(), about, "Announcement One", announcementDetails, USER_AUTH_HEADERS);

    // create announcement with same start and end time
    assertResponse(
        () ->
            createAnnouncement(
                USER.getName(), about, "Announcement Two", announcementDetails, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);

    // create announcement with start time > end time
    assertResponse(
        () ->
            createAnnouncement(
                USER.getName(),
                about,
                "Announcement Three",
                getAnnouncementDetails("2", 3, 2),
                USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_INVALID_START_TIME);

    // create announcement with overlap
    assertResponse(
        () ->
            createAnnouncement(
                USER.getName(),
                about,
                "Announcement Four",
                getAnnouncementDetails("3", 2, 6),
                USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);
  }

  @Test
  void put_resolveTaskByUser_description_200(TestInfo testInfo) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        tableResourceTest.createRequest(testInfo).withOwners(List.of(USER2_REF));
    Table table = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
    // Create a task from User to User2
    String about =
        String.format(
            "<#E::%s::%s::columns::%s::description>",
            Entity.TABLE, table.getFullyQualifiedName(), C1);
    Thread taskThread =
        createTaskThread(
            USER.getName(),
            about,
            USER2.getEntityReference(),
            "old",
            "new",
            RequestDescription,
            USER_AUTH_HEADERS);

    assertNotNull(taskThread.getTask().getId());
    int taskId = taskThread.getTask().getId();

    ResolveTask resolveTask = new ResolveTask().withNewValue("accepted");

    // User who created the task can't resolve the task
    assertResponse(
        () -> resolveTask(taskId, resolveTask, USER_AUTH_HEADERS),
        FORBIDDEN,
        CatalogExceptionMessage.taskOperationNotAllowed(USER.getName(), "resolveTask"));

    // User2 who is assigned the task can resolve the task
    resolveTask(taskId, resolveTask, USER2_AUTH_HEADERS);
    table = TABLE_RESOURCE_TEST.getEntity(table.getId(), null, USER_AUTH_HEADERS);
    assertEquals("accepted", EntityUtil.getColumn(table, (C1)).getDescription());

    taskThread = getTask(taskId, USER_AUTH_HEADERS);
    assertEquals(taskId, taskThread.getTask().getId());
    assertEquals("accepted", taskThread.getTask().getNewValue());
    assertEquals(TaskStatus.Closed, taskThread.getTask().getStatus());
    assertEquals(1, taskThread.getPostsCount());
    assertEquals(1, taskThread.getPosts().size());
    String diff = feedMessageFormatter.getPlaintextDiff("old", "accepted");
    String expectedMessage = String.format("Resolved the Task with Description - %s", diff);
    assertEquals(expectedMessage, taskThread.getPosts().get(0).getMessage());
  }

  @Test
  void put_resolveTaskByTeamMember_description_200() throws IOException {
    // Create a task from User to Team2
    String about =
        String.format(
            "<#E::%s::%s::columns::%s::description>",
            Entity.TABLE, TABLE.getFullyQualifiedName(), C1);
    Thread taskThread =
        createTaskThread(
            USER.getName(),
            about,
            TEAM2.getEntityReference(),
            "old",
            "new",
            RequestDescription,
            USER_AUTH_HEADERS);

    assertNotNull(taskThread.getTask().getId());
    int taskId = taskThread.getTask().getId();

    ResolveTask resolveTask = new ResolveTask().withNewValue("accepted");

    // User2 to who is part of Team 2 to which the task is assigned to can resolve the task
    resolveTask(taskId, resolveTask, USER2_AUTH_HEADERS);
    Table table = TABLE_RESOURCE_TEST.getEntity(TABLE.getId(), null, USER_AUTH_HEADERS);
    assertEquals("accepted", EntityUtil.getColumn(table, (C1)).getDescription());

    taskThread = getTask(taskId, USER_AUTH_HEADERS);
    assertEquals(taskId, taskThread.getTask().getId());
    assertEquals("accepted", taskThread.getTask().getNewValue());
    assertEquals(TaskStatus.Closed, taskThread.getTask().getStatus());
    assertEquals(1, taskThread.getPostsCount());
    assertEquals(1, taskThread.getPosts().size());
    String diff = feedMessageFormatter.getPlaintextDiff("old", "accepted");
    String expectedMessage = String.format("Resolved the Task with Description - %s", diff);
    assertEquals(expectedMessage, taskThread.getPosts().get(0).getMessage());
  }

  @Test
  void put_closeTask_200() throws IOException {
    // User created a task for USER2
    String about =
        String.format(
            "<#E::%s::%s::columns::%s::description>",
            Entity.TABLE, TABLE.getFullyQualifiedName(), C1);
    Thread threadTask =
        createTaskThread(
            USER.getName(),
            about,
            USER2.getEntityReference(),
            "old description",
            "new description",
            RequestDescription,
            USER_AUTH_HEADERS);
    assertNotNull(threadTask.getTask().getId());
    int taskId = threadTask.getTask().getId();

    Table table = TABLE_RESOURCE_TEST.getEntity(TABLE.getId(), null, USER_AUTH_HEADERS);
    String oldDescription = EntityUtil.getColumn(table, C1).getDescription();

    closeTask(taskId, "closing comment", USER_AUTH_HEADERS);

    // closing the task should not affect description of the table
    table = TABLE_RESOURCE_TEST.getEntity(TABLE.getId(), null, USER_AUTH_HEADERS);
    assertEquals(oldDescription, EntityUtil.getColumn(table, C1).getDescription());

    Thread taskThread = getTask(taskId, USER_AUTH_HEADERS);
    assertEquals(taskId, taskThread.getTask().getId());
    assertNull(taskThread.getTask().getNewValue());
    assertEquals(TaskStatus.Closed, taskThread.getTask().getStatus());
    assertEquals(1, taskThread.getPostsCount());
    assertEquals(1, taskThread.getPosts().size());
    assertEquals(
        "Closed the Task with comment - closing comment",
        taskThread.getPosts().get(0).getMessage());
  }

  @Test
  void put_resolveTask_tags_200() throws IOException {
    // Test user creates a task for TABLE (owned by USER) and assigns it to User2
    String about =
        String.format(
            "<#E::%s::%s::columns::%s::tags>", Entity.TABLE, TABLE.getFullyQualifiedName(), C1);
    String newValue = "[" + JsonUtils.pojoToJson(USER_ADDRESS_TAG_LABEL) + "]";

    Thread taskThread =
        createTaskThread(
            TEST_USER_NAME,
            about,
            USER2.getEntityReference(),
            null,
            newValue,
            RequestTag,
            TEST_AUTH_HEADERS);
    int taskId = taskThread.getTask().getId();

    ResolveTask resolveTask = new ResolveTask().withNewValue(newValue);

    // Task can't be resolved by Test user who crated the task
    assertResponse(
        () -> resolveTask(taskId, resolveTask, TEST_AUTH_HEADERS),
        FORBIDDEN,
        CatalogExceptionMessage.taskOperationNotAllowed(TEST_USER_NAME, "resolveTask"));

    // Task can be resolved by the User2 to whom the task is assigned
    resolveTask(taskId, resolveTask, USER2_AUTH_HEADERS);

    Table table = TABLE_RESOURCE_TEST.getEntity(TABLE.getId(), "tags,columns", USER_AUTH_HEADERS);
    List<TagLabel> tags = EntityUtil.getColumn(table, C1).getTags();
    assertEquals(USER_ADDRESS_TAG_LABEL.getTagFQN(), tags.get(0).getTagFQN());

    taskThread = getTask(taskId, USER_AUTH_HEADERS);
    assertEquals(taskId, taskThread.getTask().getId());
    assertEquals(newValue, taskThread.getTask().getNewValue());
    assertEquals(TaskStatus.Closed, taskThread.getTask().getStatus());
    assertEquals(1, taskThread.getPostsCount());
    assertEquals(1, taskThread.getPosts().size());
    String diff = feedMessageFormatter.getPlaintextDiff("", USER_ADDRESS_TAG_LABEL.getTagFQN());
    String expectedMessage = String.format("Resolved the Task with Tag(s) - %s", diff);
    assertEquals(expectedMessage, taskThread.getPosts().get(0).getMessage());
  }

  private static Stream<Arguments> provideStringsForListThreads() {
    return Stream.of(
        Arguments.of(String.format("<#E::%s::%s>", Entity.USER, USER.getFullyQualifiedName())),
        Arguments.of(String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName())));
  }

  @ParameterizedTest
  @NullSource
  @MethodSource("provideStringsForListThreads")
  @Order(3)
  void get_listThreadsWithPagination(String entityLink) throws HttpResponseException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    EventSubscription subscription =
        eventSubscriptionResourceTest.getEntityByName("ActivityFeedAlert", ADMIN_AUTH_HEADERS);
    eventSubscriptionResourceTest.waitForAllEventToComplete(subscription.getId());
    // Create 10 threads
    int totalThreadCount = listThreads(entityLink, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    for (int i = 1; i <= 10; i++) {
      CreateThread create = create().withMessage("Thread " + i);
      createAndCheck(create, USER_AUTH_HEADERS);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(
          ++totalThreadCount,
          listThreads(entityLink, null, USER_AUTH_HEADERS).getPaging().getTotal());
    }
    // Now test if there are n number of pages with limit set to 5. (n = totalThreadCount / 5)
    int limit = 5;
    int totalPages = totalThreadCount / limit;
    int lastPageCount;
    if (totalThreadCount % limit != 0) {
      totalPages++;
      lastPageCount = totalThreadCount % limit;
    } else {
      lastPageCount = limit;
    }

    // Get the first page
    ThreadList threads =
        listThreads(
            entityLink,
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            null,
            ThreadType.Conversation.toString(),
            null,
            limit,
            null,
            null);
    assertEquals(limit, threads.getData().size());
    assertEquals(totalThreadCount, threads.getPaging().getTotal());
    assertNotNull(threads.getPaging().getAfter());
    assertNull(threads.getPaging().getBefore());
    String afterCursor = threads.getPaging().getAfter();
    String beforeCursor = null;
    int pageCount = 1;

    // From the second page till last page, after and before cursors should not be null
    while (afterCursor != null && pageCount < totalPages - 1) {
      threads =
          listThreads(
              entityLink,
              null,
              USER_AUTH_HEADERS,
              null,
              null,
              null,
              ThreadType.Conversation.toString(),
              null,
              limit,
              null,
              afterCursor);
      assertListNotNull(threads.getPaging().getAfter(), threads.getPaging().getBefore());
      pageCount++;
      afterCursor = threads.getPaging().getAfter();
      if (pageCount == 2) {
        beforeCursor = threads.getPaging().getBefore();
      }
    }
    assertEquals(totalPages - 1, pageCount);

    // Get the last page
    threads =
        listThreads(
            entityLink,
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            null,
            ThreadType.Conversation.toString(),
            null,
            limit,
            null,
            afterCursor);
    assertEquals(lastPageCount, threads.getData().size());
    assertNull(threads.getPaging().getAfter());

    // beforeCursor should point to the first page
    threads =
        listThreads(
            entityLink,
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            null,
            ThreadType.Conversation.toString(),
            null,
            limit,
            beforeCursor,
            null);
    assertEquals(limit, threads.getData().size());
    // since threads are always returned to the order of updated timestamp
    // the first message should read "Thread 10"
    assertEquals("Thread 10", threads.getData().get(0).getMessage());
  }

  @Test
  void post_addPostWithoutMessage_4xx() {
    // Add post to a thread without message field
    CreatePost createPost = createPost(null).withMessage(null);

    assertResponseContains(
        () -> addPost(THREAD.getId(), createPost, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param message must not be null]");
  }

  @Test
  void post_addPostWithoutFrom_4xx() {
    // Add post to a thread without from field
    CreatePost createPost = createPost(null).withFrom(null);

    assertResponseContains(
        () -> addPost(THREAD.getId(), createPost, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param from must not be null]");
  }

  @Test
  void post_addPostWithNonExistentFrom_404() {
    // Add post to a thread with non-existent from user

    CreatePost createPost = createPost(null).withFrom(NON_EXISTENT_ENTITY.toString());
    assertResponse(
        () -> addPost(THREAD.getId(), createPost, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_validAddPost_200() throws HttpResponseException {
    Thread thread = createAndCheck(create(), USER_AUTH_HEADERS);
    // Add 10 posts and validate
    int POST_COUNT = 10;
    for (int i = 0; i < POST_COUNT; i++) {
      CreatePost createPost = createPost(null);
      thread = addPostAndCheck(thread, createPost, USER_AUTH_HEADERS);
    }

    // Check if get posts API returns all the posts
    PostList postList = listPosts(thread.getId().toString(), USER_AUTH_HEADERS);
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
  void patch_thread_reactions_200() throws IOException {
    // create a thread
    CreateThread create = create().withMessage("message");
    Thread thread = createAndCheck(create, ADMIN_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(thread);

    // add reactions
    Reaction reaction =
        new Reaction().withReactionType(ReactionType.HOORAY).withUser(USER2.getEntityReference());
    Thread updated = thread.withReactions(List.of(reaction));

    Thread patched = patchThreadAndCheck(updated, originalJson, TEST_AUTH_HEADERS);
    assertNotEquals(patched.getUpdatedAt(), thread.getUpdatedAt());
    assertEquals(TEST_USER_NAME, patched.getUpdatedBy());
  }

  @Test
  void patch_ai_200() throws IOException {
    String about = String.format("<#E::%s::%s>", Entity.BOT, "ingestion-bot");

    // Create thread without AI
    CreateThread create =
        new CreateThread()
            .withFrom(USER.getName())
            .withMessage("message")
            .withAbout(about)
            .withType(ThreadType.Chatbot);
    Thread thread = createAndCheck(create, ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(thread);

    Thread updated = thread.withChatbot(new ChatbotDetails().withQuery("query"));
    Thread patched = patchThreadAndCheck(updated, originalJson, TEST_AUTH_HEADERS);

    assertNotEquals(patched.getUpdatedAt(), thread.getUpdatedAt());
    assertEquals(TEST_USER_NAME, patched.getUpdatedBy());
    assertEquals("query", patched.getChatbot().getQuery());

    // Patch again to update the query
    String originalJson2 = JsonUtils.pojoToJson(patched);
    Thread updated2 = patched.withChatbot(new ChatbotDetails().withQuery("query2"));
    Thread patched2 = patchThreadAndCheck(updated2, originalJson2, TEST_AUTH_HEADERS);

    assertNotEquals(patched2.getUpdatedAt(), patched.getUpdatedAt());
    assertEquals(TEST_USER_NAME, patched2.getUpdatedBy());
    assertEquals("query2", patched2.getChatbot().getQuery());
  }

  @Test
  void patch_announcement_200() throws IOException {
    LocalDateTime now = LocalDateTime.now();
    AnnouncementDetails announcementDetails = getAnnouncementDetails("First announcement", 5, 6);
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    Thread thread =
        createAnnouncement(
            USER.getName(), about, "Announcement One", announcementDetails, USER_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(thread);

    long startTs = now.plusDays(6L).toInstant(ZoneOffset.UTC).toEpochMilli();
    long endTs = now.plusDays(7L).toInstant(ZoneOffset.UTC).toEpochMilli();

    announcementDetails.withStartTime(startTs).withEndTime(endTs);
    Thread updated = thread.withAnnouncement(announcementDetails);

    Thread patched = patchThreadAndCheck(updated, originalJson, TEST_AUTH_HEADERS);

    assertNotEquals(patched.getUpdatedAt(), thread.getUpdatedAt());
    assertEquals(TEST_USER_NAME, patched.getUpdatedBy());
    assertEquals(startTs, patched.getAnnouncement().getStartTime());
    assertEquals(endTs, patched.getAnnouncement().getEndTime());

    Thread thread1 = getThread(thread.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(startTs, thread1.getAnnouncement().getStartTime());
    assertEquals(endTs, thread1.getAnnouncement().getEndTime());

    // patch description
    originalJson = JsonUtils.pojoToJson(thread1);
    AnnouncementDetails announcementDetails1 =
        thread1.getAnnouncement().withDescription("New Description");
    updated = thread1.withAnnouncement(announcementDetails1);
    patched = patchThreadAndCheck(updated, originalJson, TEST_AUTH_HEADERS);
    assertEquals("New Description", patched.getAnnouncement().getDescription());

    Thread thread2 = getThread(thread.getId(), ADMIN_AUTH_HEADERS);
    assertEquals("New Description", thread2.getAnnouncement().getDescription());
  }

  @Test
  void patch_invalidAnnouncement_400() throws IOException {
    LocalDateTime now = LocalDateTime.now();
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    AnnouncementDetails announcementDetails = getAnnouncementDetails("First announcement", 53, 55);
    Thread thread1 =
        createAnnouncement(
            USER.getName(), about, "Announcement One", announcementDetails, USER_AUTH_HEADERS);

    announcementDetails = getAnnouncementDetails("Second announcement", 57, 59);
    Thread thread2 =
        createAnnouncement(
            USER.getName(), about, "Announcement Two", announcementDetails, USER_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(thread2);

    // patch announcement2 with same start and end time as announcement1
    Thread updated = thread2.withAnnouncement(thread1.getAnnouncement());

    assertResponse(
        () -> patchThread(thread2.getId(), originalJson, updated, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);

    // create announcement with start time > end time
    announcementDetails
        .withStartTime(now.plusDays(58L).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(57L).toInstant(ZoneOffset.UTC).toEpochMilli());
    Thread updated2 = thread2.withAnnouncement(announcementDetails);
    assertResponse(
        () -> patchThread(thread2.getId(), originalJson, updated2, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_INVALID_START_TIME);

    // create announcement with overlaps
    announcementDetails
        .withStartTime(now.plusDays(52L).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(56L).toInstant(ZoneOffset.UTC).toEpochMilli());
    Thread updated3 = thread2.withAnnouncement(announcementDetails);
    assertResponse(
        () -> patchThread(thread2.getId(), originalJson, updated3, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);

    announcementDetails
        .withStartTime(now.plusDays(53L).plusHours(2L).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(54L).toInstant(ZoneOffset.UTC).toEpochMilli());
    Thread updated4 = thread2.withAnnouncement(announcementDetails);
    assertResponse(
        () -> patchThread(thread2.getId(), originalJson, updated4, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);

    announcementDetails
        .withStartTime(now.plusDays(52L).plusHours(12L).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(54L).toInstant(ZoneOffset.UTC).toEpochMilli());
    Thread updated5 = thread2.withAnnouncement(announcementDetails);
    assertResponse(
        () -> patchThread(thread2.getId(), originalJson, updated5, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);

    announcementDetails
        .withStartTime(now.plusDays(54L).plusHours(12L).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(56L).toInstant(ZoneOffset.UTC).toEpochMilli());
    Thread updated6 = thread2.withAnnouncement(announcementDetails);
    assertResponse(
        () -> patchThread(thread2.getId(), originalJson, updated6, USER_AUTH_HEADERS),
        BAD_REQUEST,
        ANNOUNCEMENT_OVERLAP);
  }

  @Test
  void patch_thread_not_allowed_fields() throws IOException {
    // create a thread
    CreateThread create = create().withMessage("message");
    Thread thread = createAndCheck(create, ADMIN_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(thread);

    // update the About of the thread
    String originalAbout = thread.getAbout();
    Thread updated = thread.withAbout("<#E::user>");

    patchThread(updated.getId(), originalJson, updated, ADMIN_AUTH_HEADERS);
    updated = getThread(thread.getId(), ADMIN_AUTH_HEADERS);
    // verify that the "About" is not changed
    validateThread(updated, thread.getMessage(), thread.getCreatedBy(), originalAbout);
  }

  @Test
  void list_threadsWithPostsLimit() throws HttpResponseException {
    Thread thread = createAndCheck(create(), USER_AUTH_HEADERS);
    // Add 10 posts and validate
    int POST_COUNT = 10;
    for (int i = 0; i < POST_COUNT; i++) {
      CreatePost createPost = createPost("message" + i);
      thread = addPostAndCheck(thread, createPost, USER_AUTH_HEADERS);
    }

    ThreadList threads = listThreads(null, 5, USER_AUTH_HEADERS);
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
    threads = listThreads(null, null, USER_AUTH_HEADERS);
    thread = threads.getData().get(0);
    assertEquals(3, thread.getPosts().size());

    // limit <0 is not supported and should throw an exception
    assertResponse(
        () -> listThreads(null, -1, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limitPosts must be greater than or equal to 0]");

    // limit greater than total number of posts should return correct response
    threads = listThreads(null, 100, USER_AUTH_HEADERS);
    thread = threads.getData().get(0);
    assertEquals(10, thread.getPosts().size());
  }

  @Test
  void list_threadsWithOwnerFilter() throws HttpResponseException {
    int totalThreadCount = listThreads(null, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    String user1 = USER1.getId().toString(); // user1 is the owner of TABLE
    String user2 = USER2.getId().toString(); // user2 belongs to team2 which owns TABLE2
    assertNotNull(user1);
    // Get thread counts for user1 and user2
    int user1ThreadCount =
        listThreadsWithFilter(user1, FilterType.OWNER, USER_AUTH_HEADERS).getPaging().getTotal();
    int user2ThreadCount =
        listThreadsWithFilter(user2, FilterType.OWNER, USER_AUTH_HEADERS).getPaging().getTotal();

    // create another thread on an entity with team2 as owner
    String team2 = TABLE2.getOwners().get(0).getId().toString();
    assertNotEquals(user1, team2);
    createAndCheck(
        create()
            .withAbout(String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName()))
            .withFrom(ADMIN_USER_NAME),
        ADMIN_AUTH_HEADERS);

    // user1 thread count remains the same as the newly created thread belongs to team2 and user1 is
    // not part of it
    ThreadList threads = listThreadsWithFilter(user1, FilterType.OWNER, USER_AUTH_HEADERS);
    assertEquals(user1ThreadCount, threads.getPaging().getTotal());

    // This should return error since the table is owned by a team
    // and for the filter we are passing team id instead of user id
    assertResponse(
        () -> listThreadsWithFilter(team2, FilterType.OWNER, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, team2));

    // Now, test the filter with user2 who is part of the team2
    threads = listThreadsWithFilter(user2, FilterType.OWNER, USER_AUTH_HEADERS);
    assertEquals(user2ThreadCount + 1, threads.getPaging().getTotal());

    // Test if no user id  filter returns all threads
    threads = listThreadsWithFilter(null, FilterType.OWNER, USER_AUTH_HEADERS);
    assertEquals(totalThreadCount + 1, threads.getPaging().getTotal());
  }

  @Test
  void list_threadsWithOwnerOrFollowerFilter() throws HttpResponseException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    EventSubscription subscription =
        eventSubscriptionResourceTest.getEntityByName("ActivityFeedAlert", ADMIN_AUTH_HEADERS);
    eventSubscriptionResourceTest.waitForAllEventToComplete(subscription.getId());
    int totalThreadCount = listThreads(null, null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    String user1 = USER1.getId().toString(); // user1 is the owner of TABLE
    // Get thread counts for user1 and user2
    int user1ThreadCount =
        listThreadsWithFilter(user1, FilterType.OWNER, USER_AUTH_HEADERS).getPaging().getTotal();

    // create another thread on an entity with team2 as owner
    String team2 = TABLE2.getOwners().get(0).getId().toString();
    assertNotEquals(user1, team2);
    createAndCheck(
        create()
            .withAbout(String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName()))
            .withFrom(ADMIN_USER_NAME),
        ADMIN_AUTH_HEADERS);

    // user1 thread count remains the same as the newly created thread belongs to team2 and user1 is
    // not part of it
    ThreadList threads = listThreadsWithFilter(user1, FilterType.OWNER, USER_AUTH_HEADERS);
    assertEquals(user1ThreadCount, threads.getPaging().getTotal());

    String entityLink = String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName());
    int initialThreadCount =
        listThreads(entityLink, null, USER_AUTH_HEADERS).getPaging().getTotal();

    // Create threads
    createAndCheck(create().withMessage("Message 1").withAbout(entityLink), ADMIN_AUTH_HEADERS);

    createAndCheck(create().withMessage("Message 2").withAbout(entityLink), ADMIN_AUTH_HEADERS);

    // Make the USER follow TABLE2
    followTable(TABLE2.getId(), USER1.getId(), USER_AUTH_HEADERS);
    with()
        .pollInterval(ONE_SECOND)
        .timeout(ONE_MINUTE)
        .await("Threads With Follows")
        .until(
            () -> {
              ThreadList followThreads =
                  listThreadsWithFilter(
                      USER.getId().toString(), FilterType.FOLLOWS, USER_AUTH_HEADERS);
              return followThreads.getPaging().getTotal().equals(initialThreadCount + 3);
            });

    // filter by OWNER_OR_FOLLOWS we should list both team owned listing and followed table threads.
    ThreadList ownerOrFollowTreads =
        listThreadsWithFilter(
            USER.getId().toString(), FilterType.OWNER_OR_FOLLOWS, USER_AUTH_HEADERS);
    assertEquals(threads.getPaging().getTotal() + 3, ownerOrFollowTreads.getPaging().getTotal());
  }

  @Test
  @Order(2)
  void list_threadsWithMentionsFilter() throws HttpResponseException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    EventSubscription subscription =
        eventSubscriptionResourceTest.getEntityByName("ActivityFeedAlert", ADMIN_AUTH_HEADERS);
    eventSubscriptionResourceTest.waitForAllEventToComplete(subscription.getId());
    // Create a thread with user mention
    createAndCheck(
        create()
            .withMessage(String.format("Message mentions %s", USER_LINK))
            .withAbout(String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName())),
        ADMIN_AUTH_HEADERS);

    // Create a thread that has user mention in a post
    CreatePost createPost = createPost(String.format("message mentions %s", USER_LINK));
    Thread thread =
        createAndCheck(
            create()
                .withMessage("Thread Message")
                .withAbout(String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);
    addPostAndCheck(thread, createPost, ADMIN_AUTH_HEADERS);

    ThreadList threads =
        listThreadsWithFilter(USER.getId().toString(), FilterType.MENTIONS, USER_AUTH_HEADERS);
    assertEquals(32, threads.getPaging().getTotal());
  }

  @Test
  void list_threadsWithFollowsFilter() throws HttpResponseException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    EventSubscription subscription =
        eventSubscriptionResourceTest.getEntityByName("ActivityFeedAlert", ADMIN_AUTH_HEADERS);
    eventSubscriptionResourceTest.waitForAllEventToComplete(subscription.getId());
    // Get the initial thread count of TABLE2
    String entityLink = String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName());
    int initialThreadCount =
        listThreads(entityLink, null, USER_AUTH_HEADERS).getPaging().getTotal();

    // Create threads
    createAndCheck(create().withMessage("Message 1").withAbout(entityLink), ADMIN_AUTH_HEADERS);

    createAndCheck(create().withMessage("Message 2").withAbout(entityLink), ADMIN_AUTH_HEADERS);

    // Make the USER follow TABLE2
    followTable(TABLE2.getId(), USER.getId(), USER_AUTH_HEADERS);

    // Following the table will create a thread saying
    // User started following this table
    with()
        .pollInterval(ONE_SECOND)
        .timeout(ONE_MINUTE)
        .await("Threads With Follows")
        .until(
            () -> {
              ThreadList threads =
                  listThreadsWithFilter(
                      USER.getId().toString(), FilterType.FOLLOWS, USER_AUTH_HEADERS);
              return threads.getPaging().getTotal().equals(initialThreadCount + 3);
            });
    ThreadList threads =
        listThreadsWithFilter(USER.getId().toString(), FilterType.FOLLOWS, USER_AUTH_HEADERS);
    assertEquals(initialThreadCount + 3, threads.getPaging().getTotal());
    assertEquals(initialThreadCount + 3, threads.getData().size());
    assertEquals(
        String.format("Followed **table** `%s`", TABLE2.getFullyQualifiedName()),
        threads.getData().get(0).getMessage());
    assertEquals("Message 2", threads.getData().get(1).getMessage());

    // Filter by follows for another user should return 0 threads
    threads =
        listThreadsWithFilter(USER2.getId().toString(), FilterType.FOLLOWS, USER_AUTH_HEADERS);
    assertEquals(0, threads.getPaging().getTotal());
    assertEquals(0, threads.getData().size());
  }

  @Test
  void list_threadsWithInvalidFilter() {
    assertResponse(
        () -> listThreadsWithFilter(USER.getId().toString(), "Invalid", USER_AUTH_HEADERS),
        BAD_REQUEST,
        String.format(
            "query param filterType must be one of %s", Arrays.toString(FilterType.values())));
  }

  @Test
  void get_listPosts_404() {
    assertResponse(
        () -> listPosts(NON_EXISTENT_ENTITY.toString(), USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_post_404() {
    // Test with an invalid thread id
    assertResponse(
        () -> deletePost(NON_EXISTENT_ENTITY, NON_EXISTENT_ENTITY, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", NON_EXISTENT_ENTITY));

    // Test with an invalid post id
    assertResponse(
        () -> deletePost(THREAD.getId(), NON_EXISTENT_ENTITY, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Post", NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_thread_404() {
    // Test with an invalid thread id
    assertResponse(
        () -> deleteThread(NON_EXISTENT_ENTITY, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_post_200() throws HttpResponseException {
    // Create a thread and add a post
    Thread thread = createAndCheck(create(), USER_AUTH_HEADERS);
    CreatePost createPost = createPost(null);
    thread = addPostAndCheck(thread, createPost, USER_AUTH_HEADERS);
    assertEquals(1, thread.getPosts().size());

    // delete the post
    Post post = thread.getPosts().get(0);
    Post deletedPost = deletePost(thread.getId(), post.getId(), USER_AUTH_HEADERS);
    assertEquals(post.getId(), deletedPost.getId());

    // Check if get posts API returns the post
    PostList postList = listPosts(thread.getId().toString(), USER_AUTH_HEADERS);
    assertTrue(postList.getData().isEmpty());

    // validate posts count
    Thread getThread = getThread(thread.getId(), USER_AUTH_HEADERS);
    assertEquals(0, getThread.getPostsCount());
  }

  @Test
  void delete_thread_200() throws HttpResponseException {
    // Create a thread
    Thread thread = createAndCheck(create(), USER_AUTH_HEADERS);
    assertNotNull(thread);

    // delete the thread
    Thread deletedThread = deleteThread(thread.getId(), USER_AUTH_HEADERS);
    assertEquals(thread.getId(), deletedThread.getId());

    // Check if thread is not found
    assertResponse(
        () -> getThread(thread.getId(), USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", thread.getId()));
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
    assertResponse(
        () -> deletePost(threadId, postId, USER_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(USER.getName(), List.of(MetadataOperation.DELETE)));
  }

  @Test
  void delete_thread_unauthorized_403() throws HttpResponseException {
    // Create a thread as admin user
    CreateThread create = create();
    Thread thread = createAndCheck(create.withFrom(ADMIN_USER_NAME), ADMIN_AUTH_HEADERS);
    assertNotNull(thread);

    // delete the thread using a different user who is not an admin
    // Here thread author is ADMIN, and we try to delete as USER
    UUID threadId = thread.getId();
    assertResponse(
        () -> deleteThread(threadId, USER_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(USER.getName(), List.of(MetadataOperation.DELETE)));
  }

  @Test
  void patch_post_reactions_200() throws IOException {
    // Create a thread and add a post
    Thread thread = createAndCheck(create(), USER_AUTH_HEADERS);
    CreatePost createPost = createPost("reply 1");
    thread = addPostAndCheck(thread, createPost, USER_AUTH_HEADERS);
    assertEquals(1, thread.getPosts().size());

    // patch the post
    Post post = thread.getPosts().get(0);
    String originalJson = JsonUtils.pojoToJson(post);
    Reaction reaction1 =
        new Reaction().withReactionType(ReactionType.ROCKET).withUser(USER2.getEntityReference());
    Reaction reaction2 =
        new Reaction().withReactionType(ReactionType.HOORAY).withUser(USER2.getEntityReference());
    post.withReactions(List.of(reaction1, reaction2));
    Post updatedPost = patchPostAndCheck(thread.getId(), post, originalJson, TEST_AUTH_HEADERS);
    assertTrue(containsAll(updatedPost.getReactions(), List.of(reaction1, reaction2)));
    ThreadList threads = listThreads(null, 5, USER_AUTH_HEADERS);
    thread = threads.getData().get(0);
    assertEquals(TEST_USER_NAME, thread.getUpdatedBy());
  }

  private Table createTableWithDomain(EntityReference domain)
      throws HttpResponseException, IOException {
    CreateTable createTable =
        TABLE_RESOURCE_TEST.createRequest("domain-test-table-" + UUID.randomUUID());
    if (domain != null) {
      createTable.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return TABLE_RESOURCE_TEST.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  private Table createTableWithMultipleDomains(List<EntityReference> domains)
      throws HttpResponseException, IOException {
    CreateTable createTable =
        TABLE_RESOURCE_TEST.createRequest("domain-test-table-" + UUID.randomUUID());
    if (domains != null && !domains.isEmpty()) {
      createTable.withDomains(domains.stream().map(d -> d.getFullyQualifiedName()).toList());
    }
    return TABLE_RESOURCE_TEST.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  private void cleanupTable(Table table) throws HttpResponseException {
    TABLE_RESOURCE_TEST.deleteEntity(table.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void list_threadsWithUserHavingMultipleDomains() throws HttpResponseException, IOException {
    toggleMultiDomainSupport(false); // Disable multi-domain support rule for this test
    // Create domains for this test
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain testDomain1 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("test-domain1"), ADMIN_AUTH_HEADERS);
    Domain testDomain2 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("test-domain2"), ADMIN_AUTH_HEADERS);

    try {
      // Create a user with multiple domains via team membership
      TeamResourceTest teamResourceTest = new TeamResourceTest();
      UserResourceTest userResourceTest = new UserResourceTest();

      // Create team1 with testDomain1
      CreateTeam createTeam1 =
          teamResourceTest
              .createRequest("multi-domain-team1")
              .withDomains(List.of(testDomain1.getFullyQualifiedName()));
      Team team1 = teamResourceTest.createAndCheckEntity(createTeam1, ADMIN_AUTH_HEADERS);

      // Create team2 with testDomain2
      CreateTeam createTeam2 =
          teamResourceTest
              .createRequest("multi-domain-team2")
              .withDomains(List.of(testDomain2.getFullyQualifiedName()));
      Team team2 = teamResourceTest.createAndCheckEntity(createTeam2, ADMIN_AUTH_HEADERS);

      // Create user with domain access role and assign to both teams
      User multiDomainUser = userResourceTest.createUser("multi-domain-user", false);
      String multiDomainUserJson = JsonUtils.pojoToJson(multiDomainUser);
      multiDomainUser.setRoles(List.of(DOMAIN_ONLY_ACCESS_ROLE_REF));
      multiDomainUser.setTeams(List.of(team1.getEntityReference(), team2.getEntityReference()));
      multiDomainUser =
          userResourceTest.patchEntity(
              multiDomainUser.getId(), multiDomainUserJson, multiDomainUser, ADMIN_AUTH_HEADERS);
      Map<String, String> multiDomainUserAuthHeaders = authHeaders(multiDomainUser.getName());

      // Create tables with different domain combinations
      Table tableDomain1 = createTableWithDomain(testDomain1.getEntityReference());
      Table tableDomain2 = createTableWithDomain(testDomain2.getEntityReference());
      Table tableNoDomain = createTableWithDomain(null);
      Table tableMultiDomain =
          createTableWithMultipleDomains(
              Arrays.asList(testDomain1.getEntityReference(), testDomain2.getEntityReference()));

      try {
        // Create threads in each table
        Thread threadDomain1 =
            createAndCheck(
                create()
                    .withAbout(buildEntityLink(Entity.TABLE, tableDomain1.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain1.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadDomain2 =
            createAndCheck(
                create()
                    .withAbout(buildEntityLink(Entity.TABLE, tableDomain2.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain2.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadNoDomain =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableNoDomain.getFullyQualifiedName())),
                ADMIN_AUTH_HEADERS);
        Thread threadMultiDomain =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableMultiDomain.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain1.getId())),
                ADMIN_AUTH_HEADERS);

        // User with multiple domains should see threads from all their domains and no-domain
        // threads
        ThreadList threads = listThreads(null, 100, multiDomainUserAuthHeaders);

        // User should see threads from tables that match any of their domains
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadDomain1.getId())),
            "User should see thread from table with domain 1");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadDomain2.getId())),
            "User should see thread from table with domain 2");
        assertFalse(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadNoDomain.getId())),
            "User with domain should not see thread from table with no domain");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadMultiDomain.getId())),
            "User should see thread from table with multiple domains");
      } finally {
        // Clean up tables
        cleanupTable(tableDomain1);
        cleanupTable(tableDomain2);
        cleanupTable(tableNoDomain);
        cleanupTable(tableMultiDomain);
      }
    } finally {
      // Clean up domains
      domainResourceTest.deleteEntity(testDomain1.getId(), ADMIN_AUTH_HEADERS);
      domainResourceTest.deleteEntity(testDomain2.getId(), ADMIN_AUTH_HEADERS);
    }
    toggleMultiDomainSupport(true);
  }

  @Test
  void list_threadsWithComplexDomainScenarios() throws HttpResponseException, IOException {
    toggleMultiDomainSupport(false); // Disable multi-domain support rule for this test
    // Create test domains
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain testDomain1 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("complex-domain1"), ADMIN_AUTH_HEADERS);
    Domain testDomain2 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("complex-domain2"), ADMIN_AUTH_HEADERS);
    Domain testDomain3 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("complex-domain3"), ADMIN_AUTH_HEADERS);

    try {
      TeamResourceTest teamResourceTest = new TeamResourceTest();
      UserResourceTest userResourceTest = new UserResourceTest();

      // Create teams with different domain configurations
      CreateTeam createTeam1 =
          teamResourceTest
              .createRequest("complex-team1")
              .withDomains(List.of(testDomain1.getFullyQualifiedName()));
      Team team1 = teamResourceTest.createAndCheckEntity(createTeam1, ADMIN_AUTH_HEADERS);

      CreateTeam createTeam2 =
          teamResourceTest
              .createRequest("complex-team2")
              .withDomains(
                  List.of(
                      testDomain2.getFullyQualifiedName(), testDomain3.getFullyQualifiedName()));
      Team team2 = teamResourceTest.createAndCheckEntity(createTeam2, ADMIN_AUTH_HEADERS);

      // Create user with access to all domains via teams
      User complexDomainUser = userResourceTest.createUser("complex-domain-user", false);
      String complexDomainUserJson = JsonUtils.pojoToJson(complexDomainUser);
      complexDomainUser.setRoles(List.of(DOMAIN_ONLY_ACCESS_ROLE_REF));
      complexDomainUser.setTeams(List.of(team1.getEntityReference(), team2.getEntityReference()));
      complexDomainUser =
          userResourceTest.patchEntity(
              complexDomainUser.getId(),
              complexDomainUserJson,
              complexDomainUser,
              ADMIN_AUTH_HEADERS);
      Map<String, String> complexDomainUserAuthHeaders = authHeaders(complexDomainUser.getName());

      // Create tables with various domain combinations
      Table tableDomain1Only = createTableWithDomain(testDomain1.getEntityReference());
      Table tableDomain2Only = createTableWithDomain(testDomain2.getEntityReference());
      Table tableDomain3Only = createTableWithDomain(testDomain3.getEntityReference());
      Table tableMultiple12 =
          createTableWithMultipleDomains(
              Arrays.asList(testDomain1.getEntityReference(), testDomain2.getEntityReference()));
      Table tableMultiple13 =
          createTableWithMultipleDomains(
              Arrays.asList(testDomain1.getEntityReference(), testDomain3.getEntityReference()));
      Table tableMultiple23 =
          createTableWithMultipleDomains(
              Arrays.asList(testDomain2.getEntityReference(), testDomain3.getEntityReference()));
      Table tableAllThree =
          createTableWithMultipleDomains(
              Arrays.asList(
                  testDomain1.getEntityReference(),
                  testDomain2.getEntityReference(),
                  testDomain3.getEntityReference()));

      try {
        // Create threads for each table
        Thread threadDomain1 =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableDomain1Only.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain1.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadDomain2 =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableDomain2Only.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain2.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadDomain3 =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableDomain3Only.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain3.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadMultiple12 =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableMultiple12.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain1.getId(), testDomain2.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadMultiple13 =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableMultiple13.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain1.getId(), testDomain3.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadMultiple23 =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableMultiple23.getFullyQualifiedName()))
                    .withDomains(List.of(testDomain2.getId(), testDomain3.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadAllThree =
            createAndCheck(
                create()
                    .withAbout(buildEntityLink(Entity.TABLE, tableAllThree.getFullyQualifiedName()))
                    .withDomains(
                        List.of(testDomain1.getId(), testDomain2.getId(), testDomain3.getId())),
                ADMIN_AUTH_HEADERS);

        // Test filtering - user should see threads from tables containing their domains
        ThreadList threads = listThreads(null, 100, complexDomainUserAuthHeaders);

        // User has access to all three domains via teams
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadDomain1.getId())),
            "Should see thread from table with domain 1");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadDomain2.getId())),
            "Should see thread from table with domain 2");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadDomain3.getId())),
            "Should see thread from table with domain 3");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadMultiple12.getId())),
            "Should see thread from table with domains 1&2");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadMultiple13.getId())),
            "Should see thread from table with domains 1&3");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadMultiple23.getId())),
            "Should see thread from table with domains 2&3");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadAllThree.getId())),
            "Should see thread from table with all three domains");
      } finally {
        // Clean up tables
        cleanupTable(tableDomain1Only);
        cleanupTable(tableDomain2Only);
        cleanupTable(tableDomain3Only);
        cleanupTable(tableMultiple12);
        cleanupTable(tableMultiple13);
        cleanupTable(tableMultiple23);
        cleanupTable(tableAllThree);
      }
    } finally {
      // Clean up domains
      domainResourceTest.deleteEntity(testDomain1.getId(), ADMIN_AUTH_HEADERS);
      domainResourceTest.deleteEntity(testDomain2.getId(), ADMIN_AUTH_HEADERS);
      domainResourceTest.deleteEntity(testDomain3.getId(), ADMIN_AUTH_HEADERS);
    }
    toggleMultiDomainSupport(true);
  }

  @Test
  void list_threadsWithDomainFilterEdgeCases() throws HttpResponseException, IOException {
    // Create test domain
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain testDomain =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("edge-case-domain"), ADMIN_AUTH_HEADERS);

    try {
      UserResourceTest userResourceTest = new UserResourceTest();

      // Create user with domain access role but no domains assigned (via teams with no domains)
      User noDomainUser = userResourceTest.createUser("no-domain-user", false);
      String noDomainUserJson = JsonUtils.pojoToJson(noDomainUser);
      noDomainUser.setRoles(List.of(DOMAIN_ONLY_ACCESS_ROLE_REF));
      noDomainUser =
          userResourceTest.patchEntity(
              noDomainUser.getId(), noDomainUserJson, noDomainUser, ADMIN_AUTH_HEADERS);
      Map<String, String> noDomainUserAuthHeaders = authHeaders(noDomainUser.getName());

      // Create tables with and without domains
      Table tableDomain1 = createTableWithDomain(testDomain.getEntityReference());
      Table tableNoDomain = createTableWithDomain(null);

      try {
        // Create threads
        Thread threadDomain1 =
            createAndCheck(
                create()
                    .withAbout(buildEntityLink(Entity.TABLE, tableDomain1.getFullyQualifiedName()))
                    .withDomains(List.of(tableDomain1.getId())),
                ADMIN_AUTH_HEADERS);
        Thread threadNoDomain =
            createAndCheck(
                create()
                    .withAbout(
                        buildEntityLink(Entity.TABLE, tableNoDomain.getFullyQualifiedName())),
                ADMIN_AUTH_HEADERS);

        // User with domain access role and with no domains should only see threads from tables with
        // their domains
        ThreadList threads = listThreads(null, 100, noDomainUserAuthHeaders);

        assertFalse(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadDomain1.getId())),
            "User with no domains should not see thread from table with domain");
        assertTrue(
            threads.getData().stream().anyMatch(t -> t.getId().equals(threadNoDomain.getId())),
            "User with no domains should see thread from table with no domain");
      } finally {
        // Clean up tables
        cleanupTable(tableDomain1);
        cleanupTable(tableNoDomain);
      }
    } finally {
      // Clean up domain
      domainResourceTest.deleteEntity(testDomain.getId(), ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void list_threadsWithDomainFilterDifferentThreadTypes()
      throws HttpResponseException, IOException {
    // Create test domains
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain testDomain1 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("thread-type-domain1"), ADMIN_AUTH_HEADERS);
    Domain testDomain2 =
        domainResourceTest.createEntity(
            domainResourceTest.createRequest("thread-type-domain2"), ADMIN_AUTH_HEADERS);

    // Create tables with different domains first to ensure they inherit domain associations
    Table tableDomainAccess = createTableWithDomain(testDomain1.getEntityReference());
    Table tableNoAccess = createTableWithDomain(testDomain2.getEntityReference());

    try {
      TeamResourceTest teamResourceTest = new TeamResourceTest();
      UserResourceTest userResourceTest = new UserResourceTest();

      // Create user with domain access
      CreateTeam createTeam =
          teamResourceTest
              .createRequest("thread-type-team")
              .withDomains(List.of(testDomain1.getFullyQualifiedName()));
      Team team = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);

      User threadTypeUser = userResourceTest.createUser("thread-type-user", false);
      String userJson = JsonUtils.pojoToJson(threadTypeUser);
      threadTypeUser.setRoles(List.of(DOMAIN_ONLY_ACCESS_ROLE_REF));
      threadTypeUser.setTeams(List.of(team.getEntityReference()));
      threadTypeUser =
          userResourceTest.patchEntity(
              threadTypeUser.getId(), userJson, threadTypeUser, ADMIN_AUTH_HEADERS);
      Map<String, String> threadTypeUserAuthHeaders = authHeaders(threadTypeUser.getName());

      // Create different types of threads - these will inherit domain from their tables
      Thread conversationThread =
          createAndCheck(
              create()
                  .withAbout(
                      buildEntityLink(Entity.TABLE, tableDomainAccess.getFullyQualifiedName()))
                  .withDomains(List.of(testDomain1.getId())),
              ADMIN_AUTH_HEADERS);

      Thread taskThread =
          createTaskThreadWithDomain(
              TEST_USER_NAME,
              "<#E::table::" + tableDomainAccess.getFullyQualifiedName() + "::description>",
              USER.getEntityReference(),
              "old description",
              "new description",
              RequestDescription,
              List.of(testDomain1.getId()),
              ADMIN_AUTH_HEADERS);

      // Create announcement thread
      LocalDateTime now = LocalDateTime.now();
      AnnouncementDetails announcementDetails = getAnnouncementDetails("Test Announcement", 1, 2);
      Thread announcementThread =
          createAnnouncementWithDomain(
              TEST_USER_NAME,
              buildEntityLink(Entity.TABLE, tableDomainAccess.getFullyQualifiedName()),
              "Announcement Message",
              announcementDetails,
              List.of(testDomain1.getId()),
              ADMIN_AUTH_HEADERS);

      // Create threads on table user doesn't have access to
      Thread conversationThreadNoAccess =
          createAndCheck(
              create()
                  .withAbout(buildEntityLink(Entity.TABLE, tableNoAccess.getFullyQualifiedName()))
                  .withDomains(List.of(testDomain2.getId())),
              ADMIN_AUTH_HEADERS);

      // Test different thread type filtering with domain access
      ThreadList conversationThreads =
          listThreads(
              null,
              100,
              threadTypeUserAuthHeaders,
              null,
              null,
              null,
              ThreadType.Conversation.toString(),
              null,
              null,
              null,
              null);

      assertTrue(
          conversationThreads.getData().stream()
              .anyMatch(t -> t.getId().equals(conversationThread.getId())),
          "Should see conversation thread from accessible domain");
      assertFalse(
          conversationThreads.getData().stream()
              .anyMatch(t -> t.getId().equals(conversationThreadNoAccess.getId())),
          "Should not see conversation thread from inaccessible domain");

      ThreadList taskThreads =
          listThreads(
              null,
              100,
              threadTypeUserAuthHeaders,
              null,
              null,
              null,
              ThreadType.Task.toString(),
              null,
              null,
              null,
              null);
      assertTrue(
          taskThreads.getData().stream().anyMatch(t -> t.getId().equals(taskThread.getId())),
          "Should see task thread from accessible domain");

      ThreadList announcementThreads =
          listThreads(
              null,
              100,
              threadTypeUserAuthHeaders,
              null,
              null,
              null,
              ThreadType.Announcement.toString(),
              null,
              null,
              null,
              null);
      assertTrue(
          announcementThreads.getData().stream()
              .anyMatch(t -> t.getId().equals(announcementThread.getId())),
          "Should see announcement thread from accessible domain");

    } finally {
      // Clean up tables first before domains
      cleanupTable(tableDomainAccess);
      cleanupTable(tableNoAccess);

      // Clean up domains last to ensure they exist during table lifecycle
      domainResourceTest.deleteEntity(testDomain1.getId(), ADMIN_AUTH_HEADERS);
      domainResourceTest.deleteEntity(testDomain2.getId(), ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void patch_post_404() {
    // Test with an invalid thread id
    assertResponse(
        () ->
            patchPost(
                NON_EXISTENT_ENTITY, NON_EXISTENT_ENTITY, "{}", new Post(), USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Thread", NON_EXISTENT_ENTITY));

    // Test with an invalid post id
    assertResponse(
        () -> patchPost(THREAD.getId(), NON_EXISTENT_ENTITY, "{}", new Post(), USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("Post", NON_EXISTENT_ENTITY));
  }

  @Test
  void post_createTaskByBotUser_400() {
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());

    assertResponse(
        () ->
            createTaskThread(
                BOT_USER.getName(),
                about,
                USER.getEntityReference(),
                "old",
                "new",
                RequestDescription,
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Task cannot be created by bot only by user or teams");
  }

  @Test
  void post_assignTaskToBotUser_400() {
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());

    assertResponse(
        () ->
            createTaskThread(
                USER.getName(),
                about,
                BOT_USER.getEntityReference(),
                "old",
                "new",
                RequestDescription,
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Assignees can not be bot");
  }

  @Test
  void patch_reassignTaskToBotUser_400() throws IOException {
    String about =
        String.format(
            "<#E::%s::%s::columns::%s::description>",
            Entity.TABLE, TABLE.getFullyQualifiedName(), C1);

    Thread thread =
        createTaskThread(
            TEST_USER_NAME,
            about,
            USER.getEntityReference(),
            "old",
            "new",
            RequestDescription,
            ADMIN_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(thread);
    TaskDetails upadtedAssigneeTaskDetails =
        new TaskDetails().withAssignees(List.of(BOT_USER.getEntityReference()));

    // update assignees or reassign task to bot user
    thread.withTask(upadtedAssigneeTaskDetails);
    assertResponse(
        () -> patchThreadAndCheck(thread, originalJson, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Assignees can not be bot");
  }

  public Thread createAndCheck(CreateThread create, Map<String, String> authHeaders)
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

  private void validateThread(Thread thread, String message, String from, String about) {
    assertNotNull(thread.getId());
    assertEquals(message, thread.getMessage());
    assertEquals(from, thread.getCreatedBy());
    assertEquals(about, thread.getAbout());
  }

  private void validatePost(Thread expected, Thread actual, String from, String message) {
    // Make sure the post added is as expected
    Post actualPost =
        actual
            .getPosts()
            .get(actual.getPosts().size() - 1); // Last post was newly added to the thread
    assertEquals(from, actualPost.getFrom());
    assertEquals(message, actualPost.getMessage());
    assertNotNull(actualPost.getPostTs());

    // Ensure post count increased
    assertEquals(expected.getPosts().size() + 1, actual.getPosts().size());
  }

  public Thread createThread(CreateThread create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("feed"), create, Thread.class, authHeaders);
  }

  public Thread addPost(UUID threadId, CreatePost post, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(
        getResource("feed/" + threadId + "/posts"), post, Thread.class, authHeaders);
  }

  public Thread deleteThread(UUID threadId, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.delete(getResource("feed/" + threadId), Thread.class, authHeaders);
  }

  public Post deletePost(UUID threadId, UUID postId, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.delete(
        getResource("feed/" + threadId + "/posts/" + postId), Post.class, authHeaders);
  }

  public CreateThread create() {
    String about = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    return new CreateThread().withFrom(USER.getName()).withMessage("message").withAbout(about);
  }

  public CreatePost createPost(String message) {
    message = StringUtils.isNotEmpty(message) ? message : "message";
    return new CreatePost().withFrom(USER.getName()).withMessage(message);
  }

  public Thread getThread(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("feed/" + id);
    return TestUtils.get(target, Thread.class, authHeaders);
  }

  public Thread getTask(int id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("feed/tasks/" + id);
    return TestUtils.get(target, Thread.class, authHeaders);
  }

  public void resolveTask(int id, ResolveTask resolveTask, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed/tasks/" + id + "/resolve");
    TestUtils.put(target, resolveTask, Status.OK, authHeaders);
  }

  public void closeTask(int id, String comment, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed/tasks/" + id + "/close");
    TestUtils.put(target, new CloseTask().withComment(comment), Status.OK, authHeaders);
  }

  public void closeTask(int id, CloseTask closeTask, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed/tasks/" + id + "/close");
    TestUtils.put(target, closeTask, Status.OK, authHeaders);
  }

  public ThreadList listTasks(
      String entityLink,
      String userId,
      FilterType filterType,
      TaskStatus taskStatus,
      Integer limitPosts,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    return listThreads(
        entityLink,
        limitPosts,
        authHeaders,
        userId,
        filterType != null ? filterType.toString() : null,
        taskStatus,
        ThreadType.Task.toString(),
        null,
        null,
        null,
        null);
  }

  public ThreadList listAnnouncements(
      String entityLink,
      Integer limitPosts,
      Boolean activeAnnouncement,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    return listThreads(
        entityLink,
        limitPosts,
        authHeaders,
        null,
        null,
        null,
        ThreadType.Announcement.toString(),
        activeAnnouncement,
        null,
        null,
        null);
  }

  public ThreadList listAI(String entityLink, Integer limitPosts, Map<String, String> authHeaders)
      throws HttpResponseException {
    return listThreads(
        entityLink,
        limitPosts,
        authHeaders,
        null,
        null,
        null,
        ThreadType.Chatbot.toString(),
        null,
        null,
        null,
        null);
  }

  public ThreadList listThreads(
      String entityLink, Integer limitPosts, Map<String, String> authHeaders)
      throws HttpResponseException {
    return listThreads(
        entityLink,
        limitPosts,
        authHeaders,
        null,
        null,
        null,
        ThreadType.Conversation.toString(),
        null,
        null,
        null,
        null);
  }

  public ThreadList listThreads(
      String entityLink,
      Integer limitPosts,
      Map<String, String> authHeaders,
      String userId,
      String filterType,
      TaskStatus taskStatus,
      String threadType,
      Boolean activeAnnouncement,
      Integer limitParam,
      String before,
      String after)
      throws HttpResponseException {
    WebTarget target = getResource("feed");
    target = userId != null ? target.queryParam("userId", userId) : target;
    target = filterType != null ? target.queryParam("filterType", filterType) : target;
    target = taskStatus != null ? target.queryParam("taskStatus", taskStatus) : target;
    target = threadType != null ? target.queryParam("type", threadType) : target;
    target =
        activeAnnouncement != null
            ? target.queryParam("activeAnnouncement", activeAnnouncement)
            : target;
    target = entityLink != null ? target.queryParam("entityLink", entityLink) : target;
    target = limitPosts != null ? target.queryParam("limitPosts", limitPosts) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, ThreadList.class, authHeaders);
  }

  public void followTable(UUID tableId, UUID userId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tables/" + tableId + "/followers");
    TestUtils.put(target, userId, OK, authHeaders);
  }

  public ThreadList listThreadsWithFilter(
      String userId, FilterType filterType, Map<String, String> authHeaders)
      throws HttpResponseException {
    return listThreadsWithFilter(userId, filterType.toString(), authHeaders);
  }

  public ThreadList listThreadsWithFilter(
      String userId, String filterType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed");
    target = target.queryParam("type", ThreadType.Conversation);
    target = userId != null ? target.queryParam("userId", userId) : target;
    target = filterType != null ? target.queryParam("filterType", filterType) : target;
    return TestUtils.get(target, ThreadList.class, authHeaders);
  }

  public PostList listPosts(String threadId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("feed/%s/posts", threadId));
    return TestUtils.get(target, PostList.class, authHeaders);
  }

  public FeedResource.ThreadCountList listThreadsCount(
      String entityLink, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("feed/count");
    target = entityLink != null ? target.queryParam("entityLink", entityLink) : target;
    return TestUtils.get(target, FeedResource.ThreadCountList.class, authHeaders);
  }

  public ThreadCount listTasksCount(
      String entityLink, TaskStatus taskStatus, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("feed/count");
    target = entityLink != null ? target.queryParam("entityLink", entityLink) : target;
    return TestUtils.get(target, ThreadCount.class, authHeaders);
  }

  private int getThreadCount(String entityLink, Map<String, String> authHeaders)
      throws HttpResponseException {
    FeedResource.ThreadCountList threadCounts = listThreadsCount(entityLink, authHeaders);
    for (ThreadCount threadCount : threadCounts.getData()) {
      if (threadCount.getEntityLink().equalsIgnoreCase(entityLink)) {
        return threadCount.getConversationCount() != null ? threadCount.getConversationCount() : 0;
      }
    }
    return 0;
  }

  protected final Thread patchThreadAndCheck(
      Thread updated, String originalJson, Map<String, String> authHeaders) throws IOException {
    // Validate information returned in patch response has the updates
    Thread returned = patchThread(updated.getId(), originalJson, updated, authHeaders);
    compareEntities(updated, returned, authHeaders);

    // GET the entity and Validate information returned
    Thread getEntity = getThread(updated.getId(), authHeaders);
    compareEntities(updated, getEntity, authHeaders);
    return returned;
  }

  public final Thread patchThread(
      UUID id, String originalJson, Thread updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    try {
      String updatedThreadJson = JsonUtils.pojoToJson(updated);
      ObjectMapper mapper = new ObjectMapper();
      JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedThreadJson));
      return TestUtils.patch(
          getResource(String.format("feed/%s", id)), patch, Thread.class, authHeaders);
    } catch (JsonProcessingException e) {
    }
    return null;
  }

  protected final Post patchPostAndCheck(
      UUID threadId, Post updated, String originalJson, Map<String, String> authHeaders)
      throws IOException {
    // Validate information returned in patch response has the updates
    Post returned = patchPost(threadId, updated.getId(), originalJson, updated, authHeaders);
    compareEntities(updated, returned);

    // GET the entity and Validate information returned
    Thread thread = getThread(threadId, authHeaders);
    Post post =
        thread.getPosts().stream().filter(p -> p.getId().equals(updated.getId())).findAny().get();
    compareEntities(updated, post);
    return returned;
  }

  public final Post patchPost(
      UUID threadId, UUID id, String originalJson, Post updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    try {
      String updatedPostJson = JsonUtils.pojoToJson(updated);
      ObjectMapper mapper = new ObjectMapper();
      JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedPostJson));
      return TestUtils.patch(
          getResource(String.format("feed/%s/posts/%s", threadId, id)),
          patch,
          Post.class,
          authHeaders);
    } catch (JsonProcessingException ignored) {
    }
    return null;
  }

  public void compareEntities(Thread expected, Thread patched, Map<String, String> authHeaders) {
    assertListNotNull(patched.getId(), patched.getHref(), patched.getAbout());
    assertEquals(expected.getMessage(), patched.getMessage());
    assertEquals(expected.getResolved(), patched.getResolved());
    assertEquals(getPrincipalName(authHeaders), patched.getUpdatedBy());
  }

  public void compareEntities(Post expected, Post patched) {
    assertListNotNull(patched.getId(), patched.getMessage(), patched.getFrom());
    assertEquals(expected.getMessage(), patched.getMessage());
    assertEquals(expected.getFrom(), patched.getFrom());
    assertEquals(expected.getPostTs(), patched.getPostTs());
    assertEquals(expected.getReactions().size(), patched.getReactions().size());
    assertTrue(containsAll(expected.getReactions(), patched.getReactions()));
  }

  private static <T> BiPredicate<T, T> match(Comparator<T> f) {
    return (a, b) -> f.compare(a, b) == 0;
  }

  private static <T, U> Predicate<U> bind(BiPredicate<T, U> f, T t) {
    return u -> f.test(t, u);
  }

  private static <T> boolean containsAll(List<T> list, List<T> items) {
    for (T item : items) {
      if (list.stream()
          .noneMatch(
              bind(match((Comparator<? super T>) FeedResourceTest.REACTION_COMPARATOR), item))) {
        return false;
      }
    }
    return true;
  }

  public Thread createTaskThread(
      String fromUser,
      String about,
      EntityReference assignee,
      String oldValue,
      String newValue,
      TaskType taskType,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withOldValue(oldValue)
            .withAssignees(List.of(assignee))
            .withType(taskType)
            .withSuggestion(newValue);
    CreateThread create =
        new CreateThread()
            .withFrom(fromUser)
            .withAbout(about)
            .withMessage("Message")
            .withTaskDetails(taskDetails)
            .withType(ThreadType.Task);
    return createAndCheck(create, authHeaders);
  }

  public Thread createTaskThreadWithDomain(
      String fromUser,
      String about,
      EntityReference assignee,
      String oldValue,
      String newValue,
      TaskType taskType,
      List<UUID> domains,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withOldValue(oldValue)
            .withAssignees(List.of(assignee))
            .withType(taskType)
            .withSuggestion(newValue);
    CreateThread create =
        new CreateThread()
            .withFrom(fromUser)
            .withAbout(about)
            .withMessage("Message")
            .withTaskDetails(taskDetails)
            .withType(ThreadType.Task)
            .withDomains(domains);
    return createAndCheck(create, authHeaders);
  }

  public Thread createAnnouncement(
      String fromUser,
      String about,
      String message,
      AnnouncementDetails announcementDetails,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateThread create =
        new CreateThread()
            .withFrom(fromUser)
            .withMessage(message)
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(announcementDetails);
    return createAndCheck(create, authHeaders);
  }

  public Thread createAnnouncementWithDomain(
      String fromUser,
      String about,
      String message,
      AnnouncementDetails announcementDetails,
      List<UUID> domains,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateThread create =
        new CreateThread()
            .withFrom(fromUser)
            .withMessage(message)
            .withAbout(about)
            .withType(ThreadType.Announcement)
            .withAnnouncementDetails(announcementDetails)
            .withDomains(domains);
    return createAndCheck(create, authHeaders);
  }

  public Thread createAI(
      String fromUser, String about, String message, String query, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateThread create =
        new CreateThread()
            .withFrom(fromUser)
            .withMessage(message)
            .withAbout(about)
            .withType(ThreadType.Chatbot)
            .withChatbotDetails(new ChatbotDetails().withQuery(query));
    return createAndCheck(create, authHeaders);
  }

  public void validateTaskList(
      UUID expectedAssignee,
      String expectedSuggestion,
      TaskStatus expectedTaskStatus,
      int expectedCount,
      ThreadList tasks) {
    validateTask(
        expectedAssignee, expectedSuggestion, expectedTaskStatus, tasks.getData().get(0).getTask());
    assertEquals(expectedCount, tasks.getPaging().getTotal());
    assertEquals(expectedCount, tasks.getData().size());
  }

  public void validateTask(
      UUID expectedAssignee,
      String expectedSuggestion,
      TaskStatus expectedTaskStatus,
      TaskDetails task) {
    assertNotNull(task.getId());
    assertEquals(expectedAssignee, task.getAssignees().get(0).getId());
    assertEquals(expectedSuggestion, task.getSuggestion());
    assertEquals(expectedTaskStatus, task.getStatus());
  }

  public void validateTask(TaskDetails expected, TaskDetails actual) {
    assertEquals(expected.getId(), actual.getId());
    assertEquals(expected.getAssignees(), actual.getAssignees());
    assertEquals(expected.getSuggestion(), actual.getSuggestion());
    assertEquals(expected.getStatus(), actual.getStatus());
  }

  public AnnouncementDetails getAnnouncementDetails(String description, long start, long end) {
    LocalDateTime now = LocalDateTime.now();
    return new AnnouncementDetails()
        .withDescription(description)
        .withStartTime(now.plusDays(start).toInstant(ZoneOffset.UTC).toEpochMilli())
        .withEndTime(now.plusDays(end).toInstant(ZoneOffset.UTC).toEpochMilli());
  }

  public static String buildEntityLink(String entityType, String fullyQualifiedName) {
    return String.format("<#E::%s::%s>", entityType, fullyQualifiedName);
  }

  public static String buildColumnLink(String tableFqn, String columnName, String field) {
    return String.format("<#E::table::%s::columns::%s::%s>", tableFqn, columnName, field);
  }

  public static String buildTableFieldLink(String tableFqn, String field) {
    return String.format("<#E::table::%s::%s>", tableFqn, field);
  }

  public void toggleMultiDomainSupport(Boolean enable) {
    SystemRepository systemRepository = Entity.getSystemRepository();

    Settings currentSettings =
        systemRepository.getConfigWithKey(SettingsType.ENTITY_RULES_SETTINGS.toString());
    EntityRulesSettings entityRulesSettings =
        (EntityRulesSettings) currentSettings.getConfigValue();
    entityRulesSettings
        .getEntitySemantics()
        .forEach(
            rule -> {
              if (MULTI_DOMAIN_RULE.equals(rule.getName())) {
                rule.setEnabled(enable);
              }
            });
    systemRepository.updateSetting(currentSettings);
  }
}
