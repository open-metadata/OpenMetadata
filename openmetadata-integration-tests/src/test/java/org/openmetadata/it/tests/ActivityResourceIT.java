package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonProperty;
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
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Integration tests for the Activity Stream API (/v1/activity).
 *
 * <p>These tests verify:
 *
 * <ul>
 *   <li>Basic listing of activity events
 *   <li>Pagination with limit and days parameters
 *   <li>Entity-specific activity retrieval
 *   <li>User-specific activity retrieval
 *   <li>Domain-based access control
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ActivityResourceIT {

  private static final String ACTIVITY_PATH = "/v1/activity";
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  // ==================== Basic API Tests ====================

  @Test
  void test_listActivityEvents_200(TestNamespace ns) throws Exception {
    // Create some test data to generate activity events
    createTestTable(ns);

    ActivityEventList events = listActivityEvents(SdkClients.adminClient(), 10, 7);

    assertNotNull(events);
    assertNotNull(events.getData());
  }

  @Test
  void test_getActivityCount_200(TestNamespace ns) throws Exception {
    int count = getActivityCount(SdkClients.adminClient(), 7);
    assertTrue(count >= 0, "Count should be non-negative");
  }

  // ==================== Pagination Tests ====================

  @Test
  void test_listActivityEvents_pagination_limit(TestNamespace ns) throws Exception {
    // Create test data
    createTestTable(ns);

    // Test with different limits
    for (int limit : new int[] {1, 5, 10, 50}) {
      ActivityEventList events = listActivityEvents(SdkClients.adminClient(), limit, 30);
      assertNotNull(events);
      assertTrue(
          events.getData().size() <= limit,
          "Result size " + events.getData().size() + " should be <= limit " + limit);
    }
  }

  @Test
  void test_listActivityEvents_pagination_days(TestNamespace ns) throws Exception {
    // Create test data
    createTestTable(ns);

    // Test with different day ranges
    for (int days : new int[] {1, 7, 14, 30}) {
      ActivityEventList events = listActivityEvents(SdkClients.adminClient(), 50, days);
      assertNotNull(events);

      // All events should be within the specified day range
      long cutoffTime = System.currentTimeMillis() - (days * 24L * 60L * 60L * 1000L);
      for (ActivityEvent event : events.getData()) {
        assertTrue(
            event.getTimestamp() >= cutoffTime,
            "Event timestamp should be within " + days + " days");
      }
    }
  }

  @Test
  void test_listActivityEvents_pagination_consistency(TestNamespace ns) throws Exception {
    // Create multiple test tables to generate multiple events
    for (int i = 0; i < 3; i++) {
      createTestTable(ns, "table-pagination-" + i);
    }

    // Get all events with large limit
    ActivityEventList allEvents = listActivityEvents(SdkClients.adminClient(), 200, 30);

    if (allEvents.getData().size() < 3) {
      // Not enough data to test pagination consistency
      return;
    }

    // Verify that smaller pages contain subsets of the full list
    ActivityEventList smallPage = listActivityEvents(SdkClients.adminClient(), 5, 30);

    for (ActivityEvent smallPageEvent : smallPage.getData()) {
      boolean found =
          allEvents.getData().stream().anyMatch(e -> e.getId().equals(smallPageEvent.getId()));
      assertTrue(found, "Small page event should be found in full list");
    }
  }

  // ==================== Entity Activity Tests ====================

  @Test
  void test_getEntityActivity_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);

    ActivityEventList events =
        getEntityActivity(SdkClients.adminClient(), "table", table.getId(), 10, 30);

    assertNotNull(events);
    assertNotNull(events.getData());

    // All events should be for the specified entity (if any exist)
    for (ActivityEvent event : events.getData()) {
      assertEquals(
          table.getId(), event.getEntity().getId(), "Event should be for the specified entity");
    }
  }

  @Test
  void test_getEntityActivity_pagination(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);

    // Test with small limit
    ActivityEventList events =
        getEntityActivity(SdkClients.adminClient(), "table", table.getId(), 5, 30);
    assertNotNull(events);
    assertTrue(events.getData().size() <= 5, "Should respect limit parameter");
  }

  // ==================== User Activity Tests ====================

  @Test
  void test_getUserActivity_200(TestNamespace ns) throws Exception {
    User adminUser = SdkClients.adminClient().users().getByName("admin");

    ActivityEventList events = getUserActivity(SdkClients.adminClient(), adminUser.getId(), 10, 30);

    assertNotNull(events);
    assertNotNull(events.getData());

    // All events should be by the specified user (if any exist)
    for (ActivityEvent event : events.getData()) {
      assertEquals(
          adminUser.getId(), event.getActor().getId(), "Event should be by the specified user");
    }
  }

  @Test
  void test_getUserActivity_pagination(TestNamespace ns) throws Exception {
    User adminUser = SdkClients.adminClient().users().getByName("admin");

    // Test with small limit
    ActivityEventList events = getUserActivity(SdkClients.adminClient(), adminUser.getId(), 5, 30);
    assertNotNull(events);
    assertTrue(events.getData().size() <= 5, "Should respect limit parameter");
  }

  // ==================== Permission Tests ====================

  @Test
  void test_listActivityEvents_asRegularUser(TestNamespace ns) throws Exception {
    // Regular users should be able to list activity events
    ActivityEventList events = listActivityEvents(SdkClients.testUserClient(), 10, 7);
    assertNotNull(events);
  }

  @Test
  void test_getEntityActivity_regularUser(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);

    // Regular users should be able to view entity activity
    ActivityEventList events =
        getEntityActivity(SdkClients.testUserClient(), "table", table.getId(), 10, 30);
    assertNotNull(events);
  }

  @Test
  void test_getUserActivity_selfAccess(TestNamespace ns) throws Exception {
    User testUser = SdkClients.testUserClient().users().getByName("test");

    // Users should be able to view their own activity
    ActivityEventList events =
        getUserActivity(SdkClients.testUserClient(), testUser.getId(), 10, 30);
    assertNotNull(events);
  }

  @Test
  void test_getUserActivity_otherUserAccess(TestNamespace ns) throws Exception {
    User adminUser = SdkClients.adminClient().users().getByName("admin");

    // Users should be able to view other users' activity (public information)
    ActivityEventList events =
        getUserActivity(SdkClients.testUserClient(), adminUser.getId(), 10, 30);
    assertNotNull(events);
  }

  // ==================== Filter Tests ====================

  @Test
  void test_listActivityEvents_filterByEntityType(TestNamespace ns) throws Exception {
    createTestTable(ns);

    ActivityEventList events =
        listActivityEventsWithEntityFilter(SdkClients.adminClient(), "table", null, 50, 30);
    assertNotNull(events);

    // All events should be for tables
    for (ActivityEvent event : events.getData()) {
      assertEquals("table", event.getEntity().getType(), "Event should be for a table");
    }
  }

  @Test
  void test_listActivityEvents_filterByEntityTypeAndId(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);

    ActivityEventList events =
        listActivityEventsWithEntityFilter(
            SdkClients.adminClient(), "table", table.getId(), 50, 30);
    assertNotNull(events);

    // All events should be for the specific entity
    for (ActivityEvent event : events.getData()) {
      assertEquals("table", event.getEntity().getType());
      assertEquals(table.getId(), event.getEntity().getId());
    }
  }

  @Test
  void test_listActivityEvents_filterByActor(TestNamespace ns) throws Exception {
    User adminUser = SdkClients.adminClient().users().getByName("admin");

    ActivityEventList events =
        listActivityEventsWithActorFilter(SdkClients.adminClient(), adminUser.getId(), 50, 30);
    assertNotNull(events);

    // All events should be by the specified actor
    for (ActivityEvent event : events.getData()) {
      assertEquals(
          adminUser.getId(), event.getActor().getId(), "Event should be by the specified actor");
    }
  }

  // ==================== Domain Filter Tests ====================

  @Test
  void test_listActivityEvents_withDomainsFilter(TestNamespace ns) throws Exception {
    // Create a domain
    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix("activity-test-domain"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for activity stream");
    Domain domain = SdkClients.adminClient().domains().create(createDomain);

    // Create a table in that domain by setting domain on the service
    org.openmetadata.schema.api.services.CreateDatabaseService createService =
        new org.openmetadata.schema.api.services.CreateDatabaseService()
            .withName(ns.prefix("domain-db-service"))
            .withServiceType(
                org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType
                    .Postgres)
            .withDomains(java.util.List.of(domain.getFullyQualifiedName()));
    DatabaseService service = SdkClients.adminClient().databaseServices().create(createService);
    Database database =
        Databases.create()
            .name(ns.prefix("db-domain"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema-domain"))
            .in(database.getFullyQualifiedName())
            .execute();
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    // Filter by domain
    ActivityEventList events =
        listActivityEventsWithDomains(SdkClients.adminClient(), domain.getId().toString(), 50, 30);
    assertNotNull(events);
  }

  // ==================== Count Tests ====================

  @Test
  void test_getActivityCount_differentDays(TestNamespace ns) throws Exception {
    // Create test data
    createTestTable(ns);

    // Count should generally decrease as we narrow the time range
    int count7Days = getActivityCount(SdkClients.adminClient(), 7);
    int count1Day = getActivityCount(SdkClients.adminClient(), 1);

    assertTrue(count7Days >= count1Day, "7-day count should be >= 1-day count");
  }

  // ==================== Concurrent Access Tests ====================

  @Test
  void test_listActivityEvents_concurrentAccess(TestNamespace ns) throws Exception {
    // Create test data
    createTestTable(ns);

    // Execute multiple concurrent requests
    List<ActivityEventList> results =
        java.util.stream.IntStream.range(0, 10)
            .parallel()
            .mapToObj(
                i -> {
                  try {
                    return listActivityEvents(SdkClients.adminClient(), 10, 7);
                  } catch (Exception e) {
                    throw new RuntimeException(e);
                  }
                })
            .toList();

    // All requests should succeed
    assertEquals(10, results.size());
    for (ActivityEventList result : results) {
      assertNotNull(result);
      assertNotNull(result.getData());
    }
  }

  // ==================== Reaction Tests ====================

  @Test
  void test_addReaction_200(TestNamespace ns) throws Exception {
    // Create test data and activity event
    Table table = createTestTable(ns);
    ActivityEvent event = createTestActivityEvent(table);

    // Add a reaction
    ActivityEvent updatedEvent =
        addReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);

    assertNotNull(updatedEvent);
    assertNotNull(updatedEvent.getReactions());
    assertTrue(updatedEvent.getReactions().size() > 0, "Should have at least one reaction");
    assertEquals(
        ReactionType.THUMBS_UP,
        updatedEvent.getReactions().getFirst().getReactionType(),
        "Reaction type should match");
  }

  @Test
  void test_addReaction_multipleTypes(TestNamespace ns) throws Exception {
    // Create test data and activity event
    Table table = createTestTable(ns);
    ActivityEvent event = createTestActivityEvent(table);

    // Add multiple different reactions
    addReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);
    addReaction(SdkClients.adminClient(), event.getId(), ReactionType.HEART);
    ActivityEvent updatedEvent =
        addReaction(SdkClients.adminClient(), event.getId(), ReactionType.ROCKET);

    assertNotNull(updatedEvent.getReactions());
    assertEquals(3, updatedEvent.getReactions().size(), "Should have 3 reactions");
  }

  @Test
  void test_addReaction_duplicate(TestNamespace ns) throws Exception {
    // Create test data and activity event
    Table table = createTestTable(ns);
    ActivityEvent event = createTestActivityEvent(table);

    // Add the same reaction twice (should not duplicate)
    addReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);
    ActivityEvent updatedEvent =
        addReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);

    long thumbsUpCount =
        updatedEvent.getReactions().stream()
            .filter(r -> r.getReactionType() == ReactionType.THUMBS_UP)
            .count();
    assertEquals(1, thumbsUpCount, "Should not duplicate same reaction from same user");
  }

  @Test
  void test_removeReaction_200(TestNamespace ns) throws Exception {
    // Create test data and activity event
    Table table = createTestTable(ns);
    ActivityEvent event = createTestActivityEvent(table);

    // Add a reaction
    addReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);

    // Remove the reaction
    ActivityEvent updatedEvent =
        removeReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);

    assertTrue(
        updatedEvent.getReactions() == null || updatedEvent.getReactions().isEmpty(),
        "Reactions should be empty after removal");
  }

  @Test
  void test_reaction_byDifferentUsers(TestNamespace ns) throws Exception {
    // Create test data and activity event
    Table table = createTestTable(ns);
    ActivityEvent event = createTestActivityEvent(table);

    // Admin adds a reaction
    addReaction(SdkClients.adminClient(), event.getId(), ReactionType.THUMBS_UP);

    // Test user adds the same reaction type (should be allowed - different user)
    ActivityEvent updatedEvent =
        addReaction(SdkClients.testUserClient(), event.getId(), ReactionType.THUMBS_UP);

    long thumbsUpCount =
        updatedEvent.getReactions().stream()
            .filter(r -> r.getReactionType() == ReactionType.THUMBS_UP)
            .count();
    assertEquals(2, thumbsUpCount, "Two different users should be able to add same reaction");
  }

  // ==================== My Feed Tests ====================

  @Test
  void test_getMyFeed_200(TestNamespace ns) throws Exception {
    // Get my feed
    ActivityEventList events = getMyFeed(SdkClients.adminClient(), 50, 7);

    assertNotNull(events);
    assertNotNull(events.getData());
  }

  @Test
  void test_getMyFeed_asTestUser(TestNamespace ns) throws Exception {
    // Test user should be able to get their feed
    ActivityEventList events = getMyFeed(SdkClients.testUserClient(), 50, 7);

    assertNotNull(events);
    assertNotNull(events.getData());
  }

  // ==================== EntityLink (About) Tests ====================

  @Test
  void test_getActivityByEntityLink_200(TestNamespace ns) throws Exception {
    // Create a table and activity event with about field
    Table table = createTestTable(ns);
    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + ">";

    ActivityEvent event = createTestActivityEventWithAbout(table, entityLink);
    assertNotNull(event.getAbout(), "Activity event should have about field set");

    // Query by entityLink
    ActivityEventList events =
        getActivityByEntityLink(SdkClients.adminClient(), entityLink, 50, 30);

    assertNotNull(events);
    assertNotNull(events.getData());
  }

  @Test
  void test_getActivityByEntityLink_columnLevel(TestNamespace ns) throws Exception {
    // Create a table
    Table table = createTestTable(ns);

    // Create activity for a specific column
    String columnEntityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>";
    ActivityEvent event = createTestActivityEventWithAbout(table, columnEntityLink);

    // Query by column-level entityLink
    ActivityEventList events =
        getActivityByEntityLink(SdkClients.adminClient(), columnEntityLink, 50, 30);

    assertNotNull(events);
    assertNotNull(events.getData());
    assertTrue(events.getData().size() > 0, "Should find activity for the column");
    assertEquals(columnEntityLink, events.getData().getFirst().getAbout());
  }

  @Test
  void test_getActivityByEntityLink_fieldLevel(TestNamespace ns) throws Exception {
    // Create a table
    Table table = createTestTable(ns);

    // Create activity for description field
    String fieldEntityLink = "<#E::table::" + table.getFullyQualifiedName() + "::description>";
    ActivityEvent event = createTestActivityEventWithAbout(table, fieldEntityLink);

    // Query by field-level entityLink
    ActivityEventList events =
        getActivityByEntityLink(SdkClients.adminClient(), fieldEntityLink, 50, 30);

    assertNotNull(events);
    assertNotNull(events.getData());
    assertTrue(events.getData().size() > 0, "Should find activity for the field");
  }

  @Test
  void test_getActivityByEntityLink_noResults(TestNamespace ns) throws Exception {
    // Query with non-existent entityLink
    String nonExistentLink = "<#E::table::nonexistent.schema.table>";
    ActivityEventList events =
        getActivityByEntityLink(SdkClients.adminClient(), nonExistentLink, 50, 30);

    assertNotNull(events);
    assertNotNull(events.getData());
    assertEquals(
        0, events.getData().size(), "Should return empty list for non-existent entityLink");
  }

  // ==================== Error Case Tests ====================

  @Test
  void test_addReaction_invalidActivityId(TestNamespace ns) throws Exception {
    UUID nonExistentId = UUID.randomUUID();
    try {
      addReaction(SdkClients.adminClient(), nonExistentId, ReactionType.THUMBS_UP);
      // Should throw exception
      assertTrue(false, "Should have thrown exception for non-existent activity");
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("404") || e.getMessage().contains("not found"),
          "Should return 404 for non-existent activity");
    }
  }

  @Test
  void test_removeReaction_nonExistent(TestNamespace ns) throws Exception {
    // Create activity event without any reactions
    Table table = createTestTable(ns);
    ActivityEvent event = createTestActivityEvent(table);

    // Try to remove a reaction that doesn't exist - should succeed gracefully
    ActivityEvent result =
        removeReaction(SdkClients.adminClient(), event.getId(), ReactionType.HEART);

    assertNotNull(result);
    assertTrue(
        result.getReactions() == null || result.getReactions().isEmpty(),
        "Should return event with no reactions");
  }

  // ==================== Helper Methods ====================

  private ActivityEvent createTestActivityEvent(Table table) throws Exception {
    EntityReference entityRef =
        new EntityReference()
            .withId(table.getId())
            .withType(Entity.TABLE)
            .withName(table.getName())
            .withFullyQualifiedName(table.getFullyQualifiedName());

    User admin = getAdminUser();
    EntityReference actorRef =
        new EntityReference()
            .withId(admin.getId())
            .withType(Entity.USER)
            .withName(admin.getName())
            .withFullyQualifiedName(admin.getFullyQualifiedName());

    ActivityEvent event =
        new ActivityEvent()
            .withId(UUID.randomUUID())
            .withEventType(ActivityEventType.ENTITY_CREATED)
            .withEntity(entityRef)
            .withActor(actorRef)
            .withTimestamp(System.currentTimeMillis())
            .withSummary("Created table: " + table.getFullyQualifiedName());

    return insertActivityEvent(SdkClients.adminClient(), event);
  }

  private User getAdminUser() throws Exception {
    String path = "/v1/users/name/admin";
    String response =
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, path, null, null);
    return MAPPER.readValue(response, User.class);
  }

  private ActivityEvent insertActivityEvent(OpenMetadataClient client, ActivityEvent event)
      throws Exception {
    String path = ACTIVITY_PATH + "/test-insert";
    String body = MAPPER.writeValueAsString(event);
    String response = client.getHttpClient().executeForString(HttpMethod.POST, path, body, null);
    return MAPPER.readValue(response, ActivityEvent.class);
  }

  private Table createTestTable(TestNamespace ns) throws Exception {
    return createTestTable(ns, "table");
  }

  private Table createTestTable(TestNamespace ns, String name) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), name);
  }

  private ActivityEventList listActivityEvents(OpenMetadataClient client, int limit, int days)
      throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .build();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, ACTIVITY_PATH, null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private ActivityEventList listActivityEventsWithDomains(
      OpenMetadataClient client, String domains, int limit, int days) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .queryParam("domains", domains)
            .build();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, ACTIVITY_PATH, null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private ActivityEventList listActivityEventsWithEntityFilter(
      OpenMetadataClient client, String entityType, UUID entityId, int limit, int days)
      throws Exception {
    RequestOptions.Builder builder =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days));

    if (entityType != null) {
      builder.queryParam("entityType", entityType);
    }
    if (entityId != null) {
      builder.queryParam("entityId", entityId.toString());
    }

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, ACTIVITY_PATH, null, builder.build());
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private ActivityEventList listActivityEventsWithActorFilter(
      OpenMetadataClient client, UUID actorId, int limit, int days) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .queryParam("actorId", actorId.toString())
            .build();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, ACTIVITY_PATH, null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private ActivityEventList getEntityActivity(
      OpenMetadataClient client, String entityType, UUID entityId, int limit, int days)
      throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .build();

    String path = ACTIVITY_PATH + "/entity/" + entityType + "/" + entityId;
    String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private ActivityEventList getUserActivity(
      OpenMetadataClient client, UUID userId, int limit, int days) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .build();

    String path = ACTIVITY_PATH + "/user/" + userId;
    String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private int getActivityCount(OpenMetadataClient client, int days) throws Exception {
    RequestOptions options =
        RequestOptions.builder().queryParam("days", String.valueOf(days)).build();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/count", null, options);
    return MAPPER.readValue(response, Integer.class);
  }

  private ActivityEvent addReaction(
      OpenMetadataClient client, UUID activityId, ReactionType reactionType) throws Exception {
    String path = ACTIVITY_PATH + "/" + activityId + "/reaction/" + reactionType.value();
    String response = client.getHttpClient().executeForString(HttpMethod.PUT, path, null, null);
    return MAPPER.readValue(response, ActivityEvent.class);
  }

  private ActivityEvent removeReaction(
      OpenMetadataClient client, UUID activityId, ReactionType reactionType) throws Exception {
    String path = ACTIVITY_PATH + "/" + activityId + "/reaction/" + reactionType.value();
    String response = client.getHttpClient().executeForString(HttpMethod.DELETE, path, null, null);
    return MAPPER.readValue(response, ActivityEvent.class);
  }

  private ActivityEventList getMyFeed(OpenMetadataClient client, int limit, int days)
      throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/my-feed", null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  private ActivityEvent createTestActivityEventWithAbout(Table table, String about)
      throws Exception {
    EntityReference entityRef =
        new EntityReference()
            .withId(table.getId())
            .withType(Entity.TABLE)
            .withName(table.getName())
            .withFullyQualifiedName(table.getFullyQualifiedName());

    User admin = getAdminUser();
    EntityReference actorRef =
        new EntityReference()
            .withId(admin.getId())
            .withType(Entity.USER)
            .withName(admin.getName())
            .withFullyQualifiedName(admin.getFullyQualifiedName());

    ActivityEvent event =
        new ActivityEvent()
            .withId(UUID.randomUUID())
            .withEventType(ActivityEventType.DESCRIPTION_UPDATED)
            .withEntity(entityRef)
            .withAbout(about)
            .withActor(actorRef)
            .withTimestamp(System.currentTimeMillis())
            .withSummary("Updated description on: " + table.getFullyQualifiedName());

    return insertActivityEvent(SdkClients.adminClient(), event);
  }

  private ActivityEventList getActivityByEntityLink(
      OpenMetadataClient client, String entityLink, int limit, int days) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", entityLink)
            .queryParam("limit", String.valueOf(limit))
            .queryParam("days", String.valueOf(days))
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/about", null, options);
    return MAPPER.readValue(response, ActivityEventList.class);
  }

  /** Response class for activity event list. */
  public static class ActivityEventList {
    @JsonProperty("data")
    private List<ActivityEvent> data;

    @JsonProperty("paging")
    private Paging paging;

    public List<ActivityEvent> getData() {
      return data;
    }

    public void setData(List<ActivityEvent> data) {
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
