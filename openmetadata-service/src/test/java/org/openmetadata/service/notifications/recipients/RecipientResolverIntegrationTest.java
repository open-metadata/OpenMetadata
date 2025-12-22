/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.notifications.recipients;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;

/**
 * Integration tests for the notifications recipients package.
 */
@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class RecipientResolverIntegrationTest extends OpenMetadataApplicationTest {

  private final RecipientResolver recipientResolver = new RecipientResolver();
  private static User TEST_USER1;
  private static User TEST_USER2;
  private static User TEST_USER3;
  private static User TEST_ADMIN_USER;
  private static Team TEST_TEAM;
  private static UserResourceTest userResourceTest;
  private static TableResourceTest tableResourceTest;
  private static TeamResourceTest teamResourceTest;
  private final List<Table> createdTables = new ArrayList<>();

  @BeforeAll
  void setupTestData(TestInfo test) throws IOException, URISyntaxException {
    // Initialize TableResourceTest via setup() to configure REST client for all resource tests
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);

    // Initialize UserResourceTest (without calling setup()) - it will use the same REST client
    // context configured by TableResourceTest.setup()
    userResourceTest = new UserResourceTest();

    // Create test users via the resource API
    CreateUser createTestUser1 = userResourceTest.createRequest("recipient-test-user1");
    TEST_USER1 = userResourceTest.createEntity(createTestUser1, ADMIN_AUTH_HEADERS);

    CreateUser createTestUser2 = userResourceTest.createRequest("recipient-test-user2");
    TEST_USER2 = userResourceTest.createEntity(createTestUser2, ADMIN_AUTH_HEADERS);

    CreateUser createTestUser3 = userResourceTest.createRequest("recipient-test-user3");
    TEST_USER3 = userResourceTest.createEntity(createTestUser3, ADMIN_AUTH_HEADERS);

    // Create test admin user
    CreateUser createTestAdminUser = userResourceTest.createRequest("recipient-test-admin-user");
    createTestAdminUser.withIsAdmin(true);
    TEST_ADMIN_USER = userResourceTest.createEntity(createTestAdminUser, ADMIN_AUTH_HEADERS);

    // Initialize TeamResourceTest to create a test team with email
    teamResourceTest = new TeamResourceTest();
    CreateTeam createTestTeam = teamResourceTest.createRequest("recipient-test-team");
    createTestTeam.withEmail("recipient-test-team@openmetadata.org");
    TEST_TEAM = teamResourceTest.createEntity(createTestTeam, ADMIN_AUTH_HEADERS);

    LOG.info(
        "Created test users: {} (id={}), {} (id={}), {} (id={}) and team: {} (id={})",
        TEST_USER1.getName(),
        TEST_USER1.getId(),
        TEST_USER2.getName(),
        TEST_USER2.getId(),
        TEST_USER3.getName(),
        TEST_USER3.getId(),
        TEST_TEAM.getName(),
        TEST_TEAM.getId());
  }

  @AfterEach
  void cleanupTestData() {
    // Clean up tables created during tests
    for (Table table : createdTables) {
      try {
        tableResourceTest.deleteEntity(table.getId(), ADMIN_AUTH_HEADERS);
        LOG.info("Cleaned up test table: {}", table.getName());
      } catch (Exception e) {
        LOG.warn("Failed to clean up test table: {}", table.getName(), e);
      }
    }
    createdTables.clear();

    // Note: Do NOT clean up TEST_USER1 here - it's created in @BeforeAll
    // and should persist across all test methods for reuse
  }

  // ============ OWNERS CATEGORY TESTS ============

  /**
   * Test that OWNERS destination resolves the owner of an entity.
   *
   * Creates a table with owner reference (user1@open-metadata.org).
   * Expected: Resolves to EMAIL recipient with USER1's email.
   */
  @Test
  void test_ownerRecipientResolution_withTableOwner() throws Exception {
    Table tableWithOwner = createTableWithOwner(TEST_USER1);
    ChangeEvent event = createChangeEvent(tableWithOwner, EventType.ENTITY_UPDATED);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.OWNERS);
    SubscriptionAction action = createSubscriptionAction();

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly one recipient is resolved
    assertEquals(1, recipients.size(), "Should resolve exactly 1 owner recipient");

    // Verify the recipient is an EmailRecipient and extract it
    Recipient recipient = recipients.iterator().next();
    EmailRecipient emailRecipient =
        assertInstanceOf(
            EmailRecipient.class, recipient, "Recipient should be an EmailRecipient instance");

    // Verify the email matches the owner's email
    assertEquals(
        TEST_USER1.getEmail(),
        emailRecipient.getEmail(),
        "Recipient email should match TEST_USER1's email");
  }

  // ============ EXTERNAL CATEGORY TESTS ============

  /**
   * Test that EXTERNAL destination resolves external email receivers.
   *
   * External recipients are statically configured in the action's receivers list
   * and do not depend on entity data. Expected: Resolves to EMAIL recipients with
   * those exact email addresses.
   */
  @Test
  void test_externalRecipientResolution_withMultipleReceivers() {
    // Create minimal in-memory table (no persistence needed - EXTERNAL resolver doesn't use
    // entity data)
    Table minimalTable =
        new Table()
            .withId(UUID.randomUUID())
            .withName("minimal-table")
            .withFullyQualifiedName("test.schema.minimal_table");

    ChangeEvent event = createChangeEvent(minimalTable, EventType.ENTITY_UPDATED);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.EXTERNAL);
    List<String> externalEmails =
        List.of("external1@example.com", "external2@example.com", "external3@example.com");
    SubscriptionAction action = createSubscriptionActionWithReceivers(externalEmails);

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly three recipients are resolved
    assertEquals(3, recipients.size(), "Should resolve exactly 3 external recipients");

    // Verify each email is present
    Set<String> resolvedEmails =
        recipients.stream()
            .map(r -> assertInstanceOf(EmailRecipient.class, r))
            .map(EmailRecipient::getEmail)
            .collect(Collectors.toSet());

    assertEquals(
        new HashSet<>(externalEmails),
        resolvedEmails,
        "Should resolve all external email addresses");
  }

  // ============ USER CATEGORY TESTS ============

  /**
   * Test that USER destination resolves users by their usernames.
   *
   * Users are looked up from the action's receivers list by their usernames
   * and converted to recipients. Expected: Resolves to EMAIL recipients with
   * the matching users' email addresses.
   */
  @Test
  void test_userRecipientResolution_withMultipleUsernames() {
    // Create minimal in-memory table (no persistence needed - USER resolver doesn't use entity
    // data)
    Table minimalTable =
        new Table()
            .withId(UUID.randomUUID())
            .withName("minimal-table")
            .withFullyQualifiedName("test.schema.minimal_table");

    ChangeEvent event = createChangeEvent(minimalTable, EventType.ENTITY_UPDATED);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.USERS);
    List<String> usernames =
        List.of(TEST_USER1.getName(), TEST_USER2.getName(), TEST_USER3.getName());
    SubscriptionAction action = createSubscriptionActionWithReceivers(usernames);

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly three recipients are resolved
    assertEquals(3, recipients.size(), "Should resolve exactly 3 user recipients");

    // Verify each user's email is present
    Set<String> resolvedEmails =
        recipients.stream()
            .map(r -> assertInstanceOf(EmailRecipient.class, r))
            .map(EmailRecipient::getEmail)
            .collect(Collectors.toSet());

    Set<String> expectedEmails =
        Set.of(TEST_USER1.getEmail(), TEST_USER2.getEmail(), TEST_USER3.getEmail());
    assertEquals(expectedEmails, resolvedEmails, "Should resolve all user email addresses");
  }

  // ============ TEAM CATEGORY TESTS ============

  /**
   * Test that TEAM destination resolves teams by their team names.
   *
   * Teams are looked up from the action's receivers list by their team names
   * and converted to recipients. Expected: Resolves to EMAIL recipients with
   * the team members' email addresses.
   */
  @Test
  void test_teamRecipientResolution_withTeamName() {
    // Create minimal in-memory table (no persistence needed - TEAM resolver doesn't use entity
    // data)
    Table minimalTable =
        new Table()
            .withId(UUID.randomUUID())
            .withName("minimal-table")
            .withFullyQualifiedName("test.schema.minimal_table");

    ChangeEvent event = createChangeEvent(minimalTable, EventType.ENTITY_UPDATED);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.TEAMS);
    List<String> teamNames = List.of(TEST_TEAM.getName());
    SubscriptionAction action = createSubscriptionActionWithReceivers(teamNames);

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly one recipient is resolved
    assertEquals(1, recipients.size(), "Should resolve exactly 1 team recipient");

    // Verify the recipient is an EmailRecipient and extract it
    Recipient recipient = recipients.iterator().next();
    EmailRecipient emailRecipient =
        assertInstanceOf(
            EmailRecipient.class, recipient, "Recipient should be an EmailRecipient instance");

    // Verify the email matches the team's email
    assertEquals(
        TEST_TEAM.getEmail(),
        emailRecipient.getEmail(),
        "Recipient email should match TEST_TEAM's email");
  }

  // ============ FOLLOWER CATEGORY TESTS ============

  /**
   * Test that FOLLOWER destination resolves followers of an entity.
   *
   * Creates a table and adds TEST_USER1 and TEST_USER2 as followers.
   * Expected: Resolves to EMAIL recipients with both users' email addresses.
   */
  @Test
  void test_followerRecipientResolution_withTableFollowers() throws Exception {
    Table tableWithFollowers = createTableWithFollowers(TEST_USER1, TEST_USER2);
    ChangeEvent event = createChangeEvent(tableWithFollowers, EventType.ENTITY_UPDATED);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.FOLLOWERS);
    SubscriptionAction action = createSubscriptionAction();

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly two recipients are resolved
    assertEquals(2, recipients.size(), "Should resolve exactly 2 follower recipients");

    // Verify both users' emails are present
    Set<String> resolvedEmails =
        recipients.stream()
            .map(r -> assertInstanceOf(EmailRecipient.class, r))
            .map(EmailRecipient::getEmail)
            .collect(Collectors.toSet());

    Set<String> expectedEmails = Set.of(TEST_USER1.getEmail(), TEST_USER2.getEmail());
    assertEquals(expectedEmails, resolvedEmails, "Should resolve all follower email addresses");
  }

  // ============ ADMIN CATEGORY TESTS ============

  /**
   * Test that ADMIN destination resolves system administrators.
   *
   * Creates a test admin user and verifies the ADMIN resolver finds and resolves them.
   * Expected: Resolves to EMAIL recipient with the admin user's email.
   */
  @Test
  void test_adminRecipientResolution_withAdminUser() {
    // Create minimal in-memory table (no persistence needed - ADMIN resolver doesn't use entity
    // data)
    Table minimalTable =
        new Table()
            .withId(UUID.randomUUID())
            .withName("minimal-table")
            .withFullyQualifiedName("test.schema.minimal_table");

    ChangeEvent event = createChangeEvent(minimalTable, EventType.ENTITY_UPDATED);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.ADMINS);
    SubscriptionAction action = createSubscriptionAction();

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify at least one admin recipient is resolved
    assertEquals(true, recipients.size() >= 1, "Should resolve at least 1 admin recipient");

    // Verify all recipients are EmailRecipient instances
    Set<String> resolvedEmails =
        recipients.stream()
            .map(r -> assertInstanceOf(EmailRecipient.class, r))
            .map(EmailRecipient::getEmail)
            .collect(Collectors.toSet());

    // Verify TEST_ADMIN_USER's email is among the resolved admins
    assertEquals(
        true,
        resolvedEmails.contains(TEST_ADMIN_USER.getEmail()),
        "Resolved admin emails should include TEST_ADMIN_USER's email");
  }

  // ============ ASSIGNEE CATEGORY TESTS ============

  /**
   * Test that ASSIGNEE destination resolves task assignees from thread entity.
   *
   * Creates a thread with assignees (TEST_USER1 and TEST_TEAM) and verifies the resolver
   * extracts and returns them as email recipients.
   * Expected: Resolves to EMAIL recipients with exactly the assignees' email addresses.
   */
  @Test
  void test_assigneeRecipientResolution_withTaskThread() {
    Table testTable =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("test.schema.test_table");

    Thread taskThread = createTaskThreadWithAssignees(testTable, TEST_USER1, TEST_TEAM);
    ChangeEvent event = createChangeEvent(taskThread, EventType.ENTITY_CREATED);
    event.withEntityType(Entity.THREAD);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.ASSIGNEES);
    SubscriptionAction action = createSubscriptionAction();

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly two recipients are resolved (user and team assignees)
    assertEquals(2, recipients.size(), "Should resolve exactly 2 assignee recipients");

    // Verify that all recipients are EmailRecipient instances and extract emails
    Set<String> resolvedEmails =
        recipients.stream()
            .map(
                r ->
                    assertInstanceOf(
                        EmailRecipient.class,
                        r,
                        "All assignee recipients must be EmailRecipient instances"))
            .map(EmailRecipient::getEmail)
            .collect(Collectors.toSet());

    // Verify exact assignee emails are resolved
    Set<String> expectedEmails = Set.of(TEST_USER1.getEmail(), TEST_TEAM.getEmail());
    assertEquals(
        expectedEmails,
        resolvedEmails,
        "Resolved assignees must be exactly TEST_USER1's email and TEST_TEAM's email");
  }

  // ============ MENTION CATEGORY TESTS ============

  /**
   * Test that MENTION destination resolves mentioned users from thread messages.
   *
   * Creates a thread with a message mentioning TEST_USER1 and verifies the resolver
   * extracts and returns the mentioned user as an email recipient.
   * Expected: Resolves to EMAIL recipient with the mentioned user's exact email.
   */
  @Test
  void test_mentionRecipientResolution_withMentionedUser() {
    Table testTable =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("test.schema.test_table");

    String mentionMessage =
        String.format("Mentioning <#E::%s::%s>", Entity.USER, TEST_USER1.getName());
    Thread mentionThread = createThreadWithMentions(testTable, mentionMessage);

    ChangeEvent event = createChangeEvent(mentionThread, EventType.ENTITY_CREATED);
    event.withEntityType(Entity.THREAD);
    SubscriptionDestination destination =
        createDestination(SubscriptionDestination.SubscriptionCategory.MENTIONS);
    SubscriptionAction action = createSubscriptionAction();

    Set<Recipient> recipients = recipientResolver.resolveRecipients(event, destination, action);

    // Verify exactly one recipient is resolved
    assertEquals(1, recipients.size(), "Should resolve exactly 1 mention recipient");

    // Verify all recipients are EmailRecipient instances
    Set<String> resolvedEmails =
        recipients.stream()
            .map(
                r ->
                    assertInstanceOf(
                        EmailRecipient.class,
                        r,
                        "All mention recipients must be EmailRecipient instances"))
            .map(EmailRecipient::getEmail)
            .collect(Collectors.toSet());

    // Verify exact mention email is resolved
    Set<String> expectedEmails = Set.of(TEST_USER1.getEmail());
    assertEquals(
        expectedEmails, resolvedEmails, "Resolved mentions must be exactly TEST_USER1's email");
  }

  // ============ HELPER METHODS ============

  /**
   * Creates a ChangeEvent for a table with the given event type.
   *
   * The entity data is serialized to JSON in the ChangeEvent payload, allowing it to be
   * deserialized by the resolver for deleted entities.
   */
  private ChangeEvent createChangeEvent(Object entity, EventType eventType) {
    String entityType =
        switch (entity) {
          case Table table -> Entity.TABLE;
          case Thread thread -> Entity.THREAD;
          case User user -> Entity.USER;
          default -> throw new IllegalArgumentException(
              "Unsupported entity type: " + entity.getClass());
        };

    UUID entityId =
        switch (entity) {
          case Table table -> table.getId();
          case Thread thread -> thread.getId();
          case User user -> user.getId();
          default -> throw new IllegalArgumentException(
              "Unsupported entity type: " + entity.getClass());
        };

    String entityFqn =
        switch (entity) {
          case Table table -> table.getFullyQualifiedName();
          case Thread thread -> thread.getAbout();
          case User user -> user.getFullyQualifiedName();
          default -> throw new IllegalArgumentException(
              "Unsupported entity type: " + entity.getClass());
        };

    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityType(entityType)
        .withEntityId(entityId)
        .withEntityFullyQualifiedName(entityFqn)
        .withEntity(JsonUtils.pojoToJson(entity))
        .withTimestamp(System.currentTimeMillis());
  }

  /**
   * Creates a SubscriptionDestination with the given category.
   */
  private SubscriptionDestination createDestination(
      SubscriptionDestination.SubscriptionCategory category) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withCategory(category)
        .withType(SubscriptionDestination.SubscriptionType.EMAIL);
  }

  /**
   * Creates a basic SubscriptionAction with no receivers or user refs.
   */
  private SubscriptionAction createSubscriptionAction() {
    return new SubscriptionAction() {};
  }

  /**
   * Creates a SubscriptionAction with external email receivers.
   */
  private SubscriptionAction createSubscriptionActionWithReceivers(List<String> receivers) {
    return new SubscriptionAction() {
      @Override
      public Set<String> getReceivers() {
        return new HashSet<>(receivers);
      }
    };
  }

  /**
   * Creates a table with an owner via the TableResourceTest API and persists it to the database.
   * The table is tracked in createdTables for cleanup.
   */
  private Table createTableWithOwner(User owner) throws Exception {
    String tableName = "recipient-test-table-" + UUID.randomUUID().toString().substring(0, 8);
    CreateTable createTable = tableResourceTest.createRequest(tableName);

    // Add owner to the table creation request
    EntityReference ownerRef =
        new EntityReference().withId(owner.getId()).withType(Entity.USER).withName(owner.getName());
    createTable.withOwners(List.of(ownerRef));

    // Create table via the REST API
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    createdTables.add(table);

    LOG.info(
        "Created test table: {} (id={}) with owner: {}",
        table.getName(),
        table.getId(),
        owner.getEmail());

    return table;
  }

  /**
   * Creates a table and adds the specified users as followers via the API.
   * The table is tracked in createdTables for cleanup.
   */
  private Table createTableWithFollowers(User... followers) throws Exception {
    String tableName = "recipient-test-table-" + UUID.randomUUID().toString().substring(0, 8);
    CreateTable createTable = tableResourceTest.createRequest(tableName);

    // Create table via the REST API
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    createdTables.add(table);

    // Add followers via the addFollower endpoint
    for (User follower : followers) {
      tableResourceTest.addFollower(table.getId(), follower.getId(), OK, ADMIN_AUTH_HEADERS);
    }

    LOG.info(
        "Created test table: {} (id={}) with {} followers",
        table.getName(),
        table.getId(),
        followers.length);

    // Fetch the table again to get the updated followers list
    return tableResourceTest.getEntity(table.getId(), "followers", ADMIN_AUTH_HEADERS);
  }

  /**
   * Creates a task thread with the specified users and teams as assignees.
   * The thread is about the given table entity and contains a TaskDetails with assignees.
   */
  private Thread createTaskThreadWithAssignees(Table table, User userAssignee, Team teamAssignee) {
    String about = String.format("<#E::%s::%s>", Entity.TABLE, table.getFullyQualifiedName());

    EntityReference userRef =
        new EntityReference()
            .withId(userAssignee.getId())
            .withType(Entity.USER)
            .withName(userAssignee.getName());

    EntityReference teamRef =
        new EntityReference()
            .withId(teamAssignee.getId())
            .withType(Entity.TEAM)
            .withName(teamAssignee.getName());

    TaskDetails taskDetails =
        new TaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(userRef, teamRef));

    return new Thread()
        .withId(UUID.randomUUID())
        .withMessage("Task message")
        .withAbout(about)
        .withTask(taskDetails);
  }

  /**
   * Creates a thread with a message containing mentions.
   * The thread is about the given table entity.
   */
  private Thread createThreadWithMentions(Table table, String mentionMessage) {
    String about = String.format("<#E::%s::%s>", Entity.TABLE, table.getFullyQualifiedName());

    return new Thread().withId(UUID.randomUUID()).withMessage(mentionMessage).withAbout(about);
  }
}
