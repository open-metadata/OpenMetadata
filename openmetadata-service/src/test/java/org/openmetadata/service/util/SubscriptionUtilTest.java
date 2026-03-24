package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.entity.events.authentication.WebhookBearerAuth;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.SecurityUtil;

class SubscriptionUtilTest {

  @Test
  void getAdminsDataAggregatesAdminEmailsAcrossPages() {
    UserRepository userRepository = mock(UserRepository.class);
    ResultList<User> firstPage = mock(ResultList.class);
    ResultList<User> secondPage = mock(ResultList.class);
    Paging firstPaging = new Paging().withAfter("cursor-1");
    Paging secondPaging = new Paging().withAfter(null);

    when(firstPage.getData()).thenReturn(List.of(user("alice", "alice@example.com")));
    when(firstPage.getPaging()).thenReturn(firstPaging);
    when(secondPage.getData()).thenReturn(List.of(user("bob", "bob@example.com")));
    when(secondPage.getPaging()).thenReturn(secondPaging);
    when(userRepository.getFields("email,profile"))
        .thenReturn(new EntityUtil.Fields(Set.of("email", "profile")));
    when(userRepository.listAfter(isNull(), any(), any(), eq(50), isNull())).thenReturn(firstPage);
    when(userRepository.listAfter(isNull(), any(), any(), eq(50), eq("cursor-1")))
        .thenReturn(secondPage);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(USER)).thenReturn(userRepository);

      Set<String> admins =
          SubscriptionUtil.getAdminsData(SubscriptionDestination.SubscriptionType.EMAIL);

      assertEquals(Set.of("alice@example.com", "bob@example.com"), admins);
    }
  }

  @Test
  void getEmailOrWebhookEndpointForUsersFiltersInvalidWebhookUrls() {
    User validWebhookUser =
        user("alice", "alice@example.com")
            .withProfile(profileWithSlack("https://hooks.slack.com/services/T1/B1/ok"));
    User invalidWebhookUser =
        user("bob", "bob@example.com").withProfile(profileWithSlack("notaurl"));
    User noProfileUser = user("carol", "carol@example.com");

    Set<String> receivers =
        SubscriptionUtil.getEmailOrWebhookEndpointForUsers(
            List.of(validWebhookUser, invalidWebhookUser, noProfileUser),
            SubscriptionDestination.SubscriptionType.SLACK);

    assertEquals(Set.of("https://hooks.slack.com/services/T1/B1/ok"), receivers);
  }

  @Test
  void getEmailOrWebhookEndpointForTeamsReturnsEmailTargets() {
    Team analytics = team("analytics", "analytics@example.com");
    Team finance = team("finance", "finance@example.com");

    Set<String> receivers =
        SubscriptionUtil.getEmailOrWebhookEndpointForTeams(
            List.of(analytics, finance), SubscriptionDestination.SubscriptionType.EMAIL);

    assertEquals(Set.of("analytics@example.com", "finance@example.com"), receivers);
  }

  @Test
  void getEmailOrWebhookEndpointForTeamsFiltersInvalidWebhookUrls() {
    Team validTeam =
        team("analytics", "analytics@example.com")
            .withProfile(profileWithSlack("https://hooks.slack.com/services/T1/B1/ok"));
    Team invalidTeam =
        team("finance", "finance@example.com").withProfile(profileWithSlack("notaurl"));

    Set<String> receivers =
        SubscriptionUtil.getEmailOrWebhookEndpointForTeams(
            List.of(validTeam, invalidTeam), SubscriptionDestination.SubscriptionType.SLACK);

    assertEquals(Set.of("https://hooks.slack.com/services/T1/B1/ok"), receivers);
  }

  @Test
  void getOwnerOrFollowersCombinesUserAndTeamEmails() {
    UUID entityId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();
    UUID teamId = UUID.randomUUID();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.EntityRelationshipRecord userRecord =
        mock(CollectionDAO.EntityRelationshipRecord.class);
    CollectionDAO.EntityRelationshipRecord teamRecord =
        mock(CollectionDAO.EntityRelationshipRecord.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findFrom(entityId, "table", Relationship.OWNS.ordinal()))
        .thenReturn(List.of(userRecord, teamRecord));
    when(userRecord.getType()).thenReturn(USER);
    when(userRecord.getId()).thenReturn(userId);
    when(teamRecord.getType()).thenReturn(TEAM);
    when(teamRecord.getId()).thenReturn(teamId);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntity(USER, userId, "", NON_DELETED))
          .thenReturn(user("alice", "alice@example.com"));
      mockedEntity
          .when(() -> Entity.getEntity(TEAM, teamId, "id,profile,email", NON_DELETED))
          .thenReturn(team("analytics", "analytics@example.com"));

      Set<String> receivers =
          SubscriptionUtil.getOwnerOrFollowers(
              SubscriptionDestination.SubscriptionType.EMAIL,
              collectionDAO,
              entityId,
              "table",
              Relationship.OWNS);

      assertEquals(Set.of("alice@example.com", "analytics@example.com"), receivers);
    }
  }

  @Test
  void buildReceiversListFromActionsResolvesExplicitUsers() {
    SubscriptionAction action = new Webhook().withReceivers(Set.of("alice", "bob"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(USER, "alice", "", NON_DELETED))
          .thenReturn(user("alice", "alice@example.com"));
      mockedEntity
          .when(() -> Entity.getEntityByName(USER, "bob", "", NON_DELETED))
          .thenReturn(user("bob", "bob@example.com"));

      Set<String> receivers =
          SubscriptionUtil.buildReceiversListFromActions(
              action,
              SubscriptionDestination.SubscriptionCategory.USERS,
              SubscriptionDestination.SubscriptionType.EMAIL,
              null,
              UUID.randomUUID(),
              "table");

      assertEquals(Set.of("alice@example.com", "bob@example.com"), receivers);
    }
  }

  @Test
  void buildReceiversListFromActionsRejectsMissingTeamRecipients() {
    SubscriptionAction action = new Webhook().withReceivers(Set.of());

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                SubscriptionUtil.buildReceiversListFromActions(
                    action,
                    SubscriptionDestination.SubscriptionCategory.TEAMS,
                    SubscriptionDestination.SubscriptionType.EMAIL,
                    null,
                    UUID.randomUUID(),
                    "table"));

    assertTrue(exception.getMessage().contains("Teams Recipients List"));
  }

  @Test
  void buildReceiversListFromActionsResolvesExplicitTeams() {
    SubscriptionAction action = new Webhook().withReceivers(Set.of("analytics", "finance"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(TEAM, "analytics", "", NON_DELETED))
          .thenReturn(team("analytics", "analytics@example.com"));
      mockedEntity
          .when(() -> Entity.getEntityByName(TEAM, "finance", "", NON_DELETED))
          .thenReturn(team("finance", "finance@example.com"));

      Set<String> receivers =
          SubscriptionUtil.buildReceiversListFromActions(
              action,
              SubscriptionDestination.SubscriptionCategory.TEAMS,
              SubscriptionDestination.SubscriptionType.EMAIL,
              null,
              UUID.randomUUID(),
              "table");

      assertEquals(Set.of("analytics@example.com", "finance@example.com"), receivers);
    }
  }

  @Test
  void buildReceiversListFromActionsAddsAdminsOwnersFollowersAndExternalReceivers() {
    UUID entityId = UUID.randomUUID();
    UUID ownerId = UUID.randomUUID();
    UUID followerTeamId = UUID.randomUUID();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.EntityRelationshipRecord ownerRecord =
        mock(CollectionDAO.EntityRelationshipRecord.class);
    CollectionDAO.EntityRelationshipRecord followerTeamRecord =
        mock(CollectionDAO.EntityRelationshipRecord.class);
    UserRepository userRepository = mock(UserRepository.class);
    ResultList<User> adminPage = mock(ResultList.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findFrom(entityId, "table", Relationship.OWNS.ordinal()))
        .thenReturn(List.of(ownerRecord));
    when(relationshipDAO.findFrom(entityId, "table", Relationship.FOLLOWS.ordinal()))
        .thenReturn(List.of(followerTeamRecord));
    when(ownerRecord.getType()).thenReturn(USER);
    when(ownerRecord.getId()).thenReturn(ownerId);
    when(followerTeamRecord.getType()).thenReturn(TEAM);
    when(followerTeamRecord.getId()).thenReturn(followerTeamId);
    when(userRepository.getFields("email,profile"))
        .thenReturn(new EntityUtil.Fields(Set.of("email", "profile")));
    when(adminPage.getData()).thenReturn(List.of(user("admin", "admin@example.com")));
    when(adminPage.getPaging()).thenReturn(new Paging().withAfter(null));
    when(userRepository.listAfter(isNull(), any(), any(), eq(50), isNull())).thenReturn(adminPage);

    SubscriptionAction action =
        new Webhook()
            .withReceivers(Set.of("external@example.com"))
            .withSendToAdmins(true)
            .withSendToOwners(true)
            .withSendToFollowers(true);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(USER)).thenReturn(userRepository);
      mockedEntity
          .when(() -> Entity.getEntity(USER, ownerId, "", NON_DELETED))
          .thenReturn(user("owner", "owner@example.com"));
      mockedEntity
          .when(() -> Entity.getEntity(TEAM, followerTeamId, "id,profile,email", NON_DELETED))
          .thenReturn(team("followers", "followers@example.com"));

      Set<String> receivers =
          SubscriptionUtil.buildReceiversListFromActions(
              action,
              SubscriptionDestination.SubscriptionCategory.EXTERNAL,
              SubscriptionDestination.SubscriptionType.EMAIL,
              collectionDAO,
              entityId,
              "table");

      assertEquals(
          Set.of(
              "external@example.com",
              "admin@example.com",
              "owner@example.com",
              "followers@example.com"),
          receivers);
    }
  }

  @Test
  void appendHeadersAndQueryParamsToTargetReturnsPreparedBuilder() {
    Client client = mock(Client.class);
    WebTarget target = mock(WebTarget.class);
    Invocation.Builder builder = mock(Invocation.Builder.class);
    Webhook webhook =
        new Webhook()
            .withEndpoint(URI.create("https://hooks.example.com"))
            .withQueryParams(Map.of("env", "test"))
            .withAuthType(
                Map.of("type", WebhookBearerAuth.Type.BEARER.value(), "secretKey", "plain-secret"))
            .withHeaders(Map.of("X-Custom", "true"));
    Map<String, String> authHeaders = Map.of("X-Auth-Params-Email", "admin@open-metadata.org");

    when(client.target("https://hooks.example.com")).thenReturn(target);
    when(target.queryParam("env", "test")).thenReturn(target);

    try (MockedStatic<SecurityUtil> mockedSecurity = mockStatic(SecurityUtil.class);
        MockedStatic<Fernet> mockedFernet = mockStatic(Fernet.class)) {
      Fernet fernet = mock(Fernet.class);
      when(fernet.isKeyDefined()).thenReturn(false);
      mockedFernet.when(Fernet::getInstance).thenReturn(fernet);
      mockedSecurity
          .when(() -> SecurityUtil.authHeaders("admin@open-metadata.org"))
          .thenReturn(authHeaders);
      mockedSecurity.when(() -> SecurityUtil.addHeaders(target, authHeaders)).thenReturn(builder);

      Invocation.Builder returnedBuilder =
          SubscriptionUtil.appendHeadersAndQueryParamsToTarget(
              client, "https://hooks.example.com", webhook, "{\"ok\":true}");

      assertSame(builder, returnedBuilder);
      verify(target).queryParam("env", "test");
      verify(builder).header(eq("X-Custom"), eq("true"));
      verify(builder).header(eq("X-OM-Signature"), startsWith("sha256="));
      mockedSecurity.verify(() -> SecurityUtil.addHeaders(target, authHeaders), times(1));
    }
  }

  @Test
  void decryptWebhookSecretKeyUsesFernetWhenConfigured() {
    Fernet fernet = mock(Fernet.class);
    when(fernet.isKeyDefined()).thenReturn(true);
    when(fernet.decryptIfApplies("encrypted-secret")).thenReturn("plain-secret");

    try (MockedStatic<Fernet> mockedFernet = mockStatic(Fernet.class)) {
      mockedFernet.when(Fernet::getInstance).thenReturn(fernet);

      assertEquals("plain-secret", SubscriptionUtil.decryptWebhookSecretKey("encrypted-secret"));
    }
  }

  @Test
  void postWebhookMessageUsesDefaultPostMethod() throws EventPublisherException {
    Destination<org.openmetadata.schema.type.ChangeEvent> destination =
        mock(Destination.class, CALLS_REAL_METHODS);
    SubscriptionDestination subscriptionDestination =
        new SubscriptionDestination().withId(UUID.randomUUID());
    Invocation.Builder builder = mock(Invocation.Builder.class);
    Response response = mock(Response.class);
    Response.StatusType statusInfo = mock(Response.StatusType.class);

    when(destination.getSubscriptionDestination()).thenReturn(subscriptionDestination);
    when(statusInfo.getReasonPhrase()).thenReturn("Created");
    when(response.getStatus()).thenReturn(201);
    when(response.getStatusInfo()).thenReturn(statusInfo);
    when(response.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(response.hasEntity()).thenReturn(false);
    when(response.getMediaType()).thenReturn(null);
    when(builder.post(any())).thenReturn(response);

    SubscriptionUtil.postWebhookMessage(destination, builder, Map.of("ok", true));

    SubscriptionStatus status =
        (SubscriptionStatus) destination.getSubscriptionDestination().getStatusDetails();
    assertEquals(SubscriptionStatus.Status.ACTIVE, status.getStatus());
  }

  @Test
  void postWebhookMessageTracksSuccessAndFailureStatuses() throws EventPublisherException {
    Destination<org.openmetadata.schema.type.ChangeEvent> destination =
        mock(Destination.class, CALLS_REAL_METHODS);
    SubscriptionDestination subscriptionDestination =
        new SubscriptionDestination().withId(UUID.randomUUID());
    Invocation.Builder builder = mock(Invocation.Builder.class);
    Response successResponse = mock(Response.class);
    Response.StatusType successStatusInfo = mock(Response.StatusType.class);
    Response failureResponse = mock(Response.class);
    Response.StatusType failureStatusInfo = mock(Response.StatusType.class);

    when(destination.getSubscriptionDestination()).thenReturn(subscriptionDestination);
    when(successStatusInfo.getReasonPhrase()).thenReturn("Accepted");
    when(successResponse.getStatus()).thenReturn(202);
    when(successResponse.getStatusInfo()).thenReturn(successStatusInfo);
    when(successResponse.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(successResponse.hasEntity()).thenReturn(true);
    when(successResponse.readEntity(String.class)).thenReturn("{\"ok\":true}");
    when(successResponse.getMediaType()).thenReturn(MediaType.APPLICATION_JSON_TYPE);
    when(builder.put(any())).thenReturn(successResponse);

    SubscriptionUtil.postWebhookMessage(
        destination, builder, Map.of("ok", true), Webhook.HttpMethod.PUT);

    SubscriptionStatus successStatus =
        (SubscriptionStatus) destination.getSubscriptionDestination().getStatusDetails();
    assertEquals(SubscriptionStatus.Status.ACTIVE, successStatus.getStatus());
    assertNotNull(successStatus.getLastSuccessfulAt());

    when(failureStatusInfo.getReasonPhrase()).thenReturn("Internal Server Error");
    when(failureResponse.getStatus()).thenReturn(500);
    when(failureResponse.getStatusInfo()).thenReturn(failureStatusInfo);
    when(failureResponse.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(failureResponse.hasEntity()).thenReturn(true);
    when(failureResponse.readEntity(String.class)).thenReturn("boom");
    when(failureResponse.getMediaType()).thenReturn(MediaType.TEXT_PLAIN_TYPE);
    when(builder.post(any())).thenReturn(failureResponse);

    EventPublisherException exception =
        assertThrows(
            EventPublisherException.class,
            () ->
                SubscriptionUtil.postWebhookMessage(
                    destination, builder, Map.of("ok", false), Webhook.HttpMethod.POST));
    assertTrue(exception.getMessage().contains("HTTP 500"));

    SubscriptionStatus failedStatus =
        (SubscriptionStatus) destination.getSubscriptionDestination().getStatusDetails();
    assertEquals(SubscriptionStatus.Status.AWAITING_RETRY, failedStatus.getStatus());
    assertEquals(500, failedStatus.getLastFailedStatusCode());
    assertEquals("Internal Server Error", failedStatus.getLastFailedReason());
  }

  @Test
  void deliverTestWebhookMessageStoresDeliveryOutcome() {
    Destination<org.openmetadata.schema.type.ChangeEvent> destination =
        mock(Destination.class, CALLS_REAL_METHODS);
    SubscriptionDestination subscriptionDestination =
        new SubscriptionDestination().withId(UUID.randomUUID());
    Invocation.Builder builder = mock(Invocation.Builder.class);
    Response failureResponse = mock(Response.class);
    Response.StatusType failureStatusInfo = mock(Response.StatusType.class);
    when(destination.getSubscriptionDestination()).thenReturn(subscriptionDestination);
    when(failureStatusInfo.getReasonPhrase()).thenReturn("Bad Request");
    when(failureResponse.getStatus()).thenReturn(400);
    when(failureResponse.getStatusInfo()).thenReturn(failureStatusInfo);
    when(failureResponse.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(failureResponse.hasEntity()).thenReturn(true);
    when(failureResponse.readEntity(String.class)).thenReturn("bad request");
    when(failureResponse.getMediaType()).thenReturn(MediaType.TEXT_PLAIN_TYPE);
    when(builder.post(any())).thenReturn(failureResponse);

    SubscriptionUtil.deliverTestWebhookMessage(destination, builder, Map.of("ok", false));

    Object statusDetails = destination.getSubscriptionDestination().getStatusDetails();
    assertInstanceOf(TestDestinationStatus.class, statusDetails);
    TestDestinationStatus status = (TestDestinationStatus) statusDetails;
    assertEquals(TestDestinationStatus.Status.FAILED, status.getStatus());
    assertEquals(400, status.getStatusCode());
  }

  @Test
  void deliverTestWebhookMessageTracksPutSuccess() {
    Destination<org.openmetadata.schema.type.ChangeEvent> destination =
        mock(Destination.class, CALLS_REAL_METHODS);
    SubscriptionDestination subscriptionDestination =
        new SubscriptionDestination().withId(UUID.randomUUID());
    Invocation.Builder builder = mock(Invocation.Builder.class);
    Response response = mock(Response.class);
    Response.StatusType statusInfo = mock(Response.StatusType.class);

    when(destination.getSubscriptionDestination()).thenReturn(subscriptionDestination);
    when(statusInfo.getReasonPhrase()).thenReturn("No Content");
    when(response.getStatus()).thenReturn(204);
    when(response.getStatusInfo()).thenReturn(statusInfo);
    when(response.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(response.hasEntity()).thenReturn(false);
    when(response.getMediaType()).thenReturn(null);
    when(builder.put(any())).thenReturn(response);

    SubscriptionUtil.deliverTestWebhookMessage(
        destination, builder, Map.of("ok", true), Webhook.HttpMethod.PUT);

    TestDestinationStatus status =
        (TestDestinationStatus) destination.getSubscriptionDestination().getStatusDetails();
    assertEquals(TestDestinationStatus.Status.SUCCESS, status.getStatus());
    assertEquals(204, status.getStatusCode());
  }

  @Test
  void getClientClampsTimeouts() {
    ClientBuilder builder = mock(ClientBuilder.class);
    Client client = mock(Client.class);
    when(builder.connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)).thenReturn(builder);
    when(builder.readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)).thenReturn(builder);
    when(builder.build()).thenReturn(client);

    try (MockedStatic<ClientBuilder> mockedClientBuilder = mockStatic(ClientBuilder.class)) {
      mockedClientBuilder.when(ClientBuilder::newBuilder).thenReturn(builder);

      Client createdClient = SubscriptionUtil.getClient(1, 999);

      assertSame(client, createdClient);
      verify(builder).connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS);
      verify(builder).readTimeout(120, java.util.concurrent.TimeUnit.SECONDS);
    }
  }

  @Test
  void getTargetAppendsQueryParamsAndHeaders() {
    Client client = mock(Client.class);
    WebTarget target = mock(WebTarget.class);
    Invocation.Builder builder = mock(Invocation.Builder.class);
    Webhook webhook =
        new Webhook()
            .withEndpoint(URI.create("https://hooks.example.com"))
            .withQueryParams(Map.of("env", "test"))
            .withHeaders(Map.of("X-Custom", "true"))
            .withAuthType(
                Map.of("type", WebhookBearerAuth.Type.BEARER.value(), "secretKey", "plain-secret"));
    Map<String, String> authHeaders = Map.of("X-Auth-Params-Email", "admin@open-metadata.org");

    when(client.target(webhook.getEndpoint())).thenReturn(target);
    when(target.queryParam("env", "test")).thenReturn(target);

    try (MockedStatic<SecurityUtil> mockedSecurity = mockStatic(SecurityUtil.class);
        MockedStatic<Fernet> mockedFernet = mockStatic(Fernet.class)) {
      Fernet fernet = mock(Fernet.class);
      when(fernet.isKeyDefined()).thenReturn(false);
      mockedFernet.when(Fernet::getInstance).thenReturn(fernet);
      mockedSecurity
          .when(() -> SecurityUtil.authHeaders("admin@open-metadata.org"))
          .thenReturn(authHeaders);
      mockedSecurity.when(() -> SecurityUtil.addHeaders(target, authHeaders)).thenReturn(builder);

      Invocation.Builder returnedBuilder =
          SubscriptionUtil.getTarget(client, webhook, "{\"ok\":true}");

      assertSame(builder, returnedBuilder);
      verify(target).queryParam("env", "test");
      verify(builder).header(eq("X-Custom"), eq("true"));
      verify(builder).header(eq("X-OM-Signature"), startsWith("sha256="));
    }
  }

  @Test
  void getTaskAssigneesCollectsAssigneesMentionsAndPostAuthors() throws Exception {
    ChangeEvent event = new ChangeEvent().withEntityType(Entity.THREAD);
    UUID assigneeId = UUID.randomUUID();
    UUID teamId = UUID.randomUUID();
    EntityReference assigneeRef = new EntityReference().withId(assigneeId).withType(USER);
    EntityReference teamRef = new EntityReference().withId(teamId).withType(TEAM);
    Thread thread =
        new Thread()
            .withType(ThreadType.Task)
            .withMessage("thread-message")
            .withTask(new TaskDetails().withAssignees(List.of(assigneeRef, teamRef)))
            .withPosts(List.of(new Post().withFrom("bob").withMessage("post-message")));

    MessageParser.EntityLink threadMention = new MessageParser.EntityLink(USER, "charlie");
    MessageParser.EntityLink postMention = new MessageParser.EntityLink(TEAM, "platform");

    try (MockedStatic<AlertsRuleEvaluator> mockedAlerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<MessageParser> mockedParser = mockStatic(MessageParser.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAlerts.when(() -> AlertsRuleEvaluator.getThread(event)).thenReturn(thread);
      mockedParser
          .when(() -> MessageParser.getEntityLinks("thread-message"))
          .thenReturn(List.of(threadMention));
      mockedParser
          .when(() -> MessageParser.getEntityLinks("post-message"))
          .thenReturn(List.of(postMention));

      mockedEntity
          .when(() -> Entity.getEntity(USER, assigneeId, "profile", NON_DELETED))
          .thenReturn(user("alice", "alice@example.com"));
      mockedEntity
          .when(() -> Entity.getEntity(TEAM, teamId, "profile", NON_DELETED))
          .thenReturn(team("analytics", "analytics@example.com"));
      mockedEntity
          .when(() -> Entity.getEntity(threadMention, "profile", NON_DELETED))
          .thenReturn(user("charlie", "charlie@example.com"));
      mockedEntity
          .when(() -> Entity.getEntity(postMention, "profile", NON_DELETED))
          .thenReturn(team("platform", "platform@example.com"));
      mockedEntity
          .when(() -> Entity.getEntityByName(USER, "bob", "profile", NON_DELETED))
          .thenReturn(user("bob", "bob@example.com"));

      Set<String> receivers =
          invokePrivateStatic(
              "getTaskAssignees",
              new Class[] {
                SubscriptionAction.class,
                SubscriptionDestination.SubscriptionCategory.class,
                SubscriptionDestination.SubscriptionType.class,
                org.openmetadata.schema.type.ChangeEvent.class
              },
              new Webhook(),
              SubscriptionDestination.SubscriptionCategory.ASSIGNEES,
              SubscriptionDestination.SubscriptionType.EMAIL,
              event);

      assertEquals(
          Set.of(
              "alice@example.com",
              "analytics@example.com",
              "charlie@example.com",
              "platform@example.com",
              "bob@example.com"),
          receivers);
    }
  }

  @Test
  void handleConversationNotificationIncludesMentionsAndOwners() throws Exception {
    ChangeEvent event = new ChangeEvent().withEntityType(Entity.THREAD);
    Thread thread =
        new Thread()
            .withType(ThreadType.Conversation)
            .withCreatedBy("owner")
            .withMessage("thread-message")
            .withPosts(List.of(new Post().withFrom("bob").withMessage("post-message")));
    MessageParser.EntityLink threadMention = new MessageParser.EntityLink(USER, "charlie");
    MessageParser.EntityLink postMention = new MessageParser.EntityLink(TEAM, "platform");

    try (MockedStatic<AlertsRuleEvaluator> mockedAlerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<MessageParser> mockedParser = mockStatic(MessageParser.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAlerts.when(() -> AlertsRuleEvaluator.getThread(event)).thenReturn(thread);
      mockedParser
          .when(() -> MessageParser.getEntityLinks("thread-message"))
          .thenReturn(List.of(threadMention));
      mockedParser
          .when(() -> MessageParser.getEntityLinks("post-message"))
          .thenReturn(List.of(postMention));
      mockedEntity
          .when(() -> Entity.getEntity(threadMention, "profile", NON_DELETED))
          .thenReturn(user("charlie", "charlie@example.com"));
      mockedEntity
          .when(() -> Entity.getEntity(postMention, "profile", NON_DELETED))
          .thenReturn(team("platform", "platform@example.com"));
      mockedEntity
          .when(() -> Entity.getEntityByName(USER, "bob", "profile", NON_DELETED))
          .thenReturn(user("bob", "bob@example.com"));
      mockedEntity
          .when(() -> Entity.getEntityByName(USER, "owner", "profile", NON_DELETED))
          .thenReturn(user("owner", "owner@example.com"));

      Set<String> mentionedReceivers =
          invokePrivateStatic(
              "handleConversationNotification",
              new Class[] {
                SubscriptionAction.class,
                SubscriptionDestination.SubscriptionCategory.class,
                SubscriptionDestination.SubscriptionType.class,
                org.openmetadata.schema.type.ChangeEvent.class
              },
              new Webhook(),
              SubscriptionDestination.SubscriptionCategory.MENTIONS,
              SubscriptionDestination.SubscriptionType.EMAIL,
              event);

      Set<String> ownerReceivers =
          invokePrivateStatic(
              "handleConversationNotification",
              new Class[] {
                SubscriptionAction.class,
                SubscriptionDestination.SubscriptionCategory.class,
                SubscriptionDestination.SubscriptionType.class,
                org.openmetadata.schema.type.ChangeEvent.class
              },
              new Webhook(),
              SubscriptionDestination.SubscriptionCategory.OWNERS,
              SubscriptionDestination.SubscriptionType.EMAIL,
              event);

      assertEquals(
          Set.of("charlie@example.com", "platform@example.com", "bob@example.com"),
          mentionedReceivers);
      assertEquals(Set.of("owner@example.com"), ownerReceivers);
    }
  }

  @Test
  void getTargetsForAlertHandlesConversationAnnouncementAndEntityEvents() {
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withType(SubscriptionDestination.SubscriptionType.EMAIL)
            .withNotifyDownstream(false);
    Webhook webhook = new Webhook().withReceivers(Set.of("external@example.com"));
    CollectionDAO dao = mock(CollectionDAO.class);
    UUID announcementEntityId = UUID.randomUUID();
    ChangeEvent conversationEvent = new ChangeEvent().withEntityType(Entity.THREAD);
    ChangeEvent announcementEvent = new ChangeEvent().withEntityType(Entity.THREAD);
    ChangeEvent entityEvent = new ChangeEvent().withEntityType("table");
    Thread conversationThread = new Thread().withType(ThreadType.Conversation);
    Thread announcementThread =
        new Thread()
            .withType(ThreadType.Announcement)
            .withEntityRef(new EntityReference().withId(announcementEntityId).withType("table"));
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedStatic<AlertsRuleEvaluator> mockedAlerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAlerts
          .when(() -> AlertsRuleEvaluator.getThread(conversationEvent))
          .thenReturn(conversationThread);
      mockedAlerts
          .when(() -> AlertsRuleEvaluator.getThread(announcementEvent))
          .thenReturn(announcementThread);
      mockedAlerts.when(() -> AlertsRuleEvaluator.getEntity(entityEvent)).thenReturn(entity);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertEquals(
          Set.of("external@example.com"),
          SubscriptionUtil.getTargetsForAlert(webhook, destination, conversationEvent));
      assertEquals(
          Set.of("external@example.com"),
          SubscriptionUtil.getTargetsForAlert(webhook, destination, announcementEvent));
      assertEquals(
          Set.of("external@example.com"),
          SubscriptionUtil.getTargetsForAlert(webhook, destination, entityEvent));
    }
  }

  @Test
  void getTargetsForWebhookAlertBuildsBuildersForEachResolvedTarget() {
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withNotifyDownstream(false);
    Webhook webhook =
        new Webhook()
            .withReceivers(Set.of("https://hooks.example.com/a", "https://hooks.example.com/b"));
    Client client = mock(Client.class);
    WebTarget targetA = mock(WebTarget.class);
    WebTarget targetB = mock(WebTarget.class);
    Invocation.Builder builderA = mock(Invocation.Builder.class);
    Invocation.Builder builderB = mock(Invocation.Builder.class);
    ChangeEvent event = new ChangeEvent().withEntityType("table");
    EntityInterface entity = mock(EntityInterface.class);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    when(client.target("https://hooks.example.com/a")).thenReturn(targetA);
    when(client.target("https://hooks.example.com/b")).thenReturn(targetB);

    try (MockedStatic<AlertsRuleEvaluator> mockedAlerts = mockStatic(AlertsRuleEvaluator.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<SecurityUtil> mockedSecurity = mockStatic(SecurityUtil.class)) {
      mockedAlerts.when(() -> AlertsRuleEvaluator.getEntity(event)).thenReturn(entity);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);
      mockedSecurity
          .when(() -> SecurityUtil.authHeaders("admin@open-metadata.org"))
          .thenReturn(Map.of("X-Auth-Params-Email", "admin@open-metadata.org"));
      mockedSecurity
          .when(
              () ->
                  SecurityUtil.addHeaders(
                      targetA, Map.of("X-Auth-Params-Email", "admin@open-metadata.org")))
          .thenReturn(builderA);
      mockedSecurity
          .when(
              () ->
                  SecurityUtil.addHeaders(
                      targetB, Map.of("X-Auth-Params-Email", "admin@open-metadata.org")))
          .thenReturn(builderB);

      List<Invocation.Builder> builders =
          SubscriptionUtil.getTargetsForWebhookAlert(
              webhook, destination, client, event, "{\"ok\":true}");

      assertEquals(2, builders.size());
      assertEquals(Set.of(builderA, builderB), Set.copyOf(builders));
    }
  }

  @Test
  void addQueryParamsAppendsAllEntries() {
    WebTarget target = mock(WebTarget.class);
    when(target.queryParam("env", "test")).thenReturn(target);
    when(target.queryParam("team", "analytics")).thenReturn(target);

    WebTarget updated =
        SubscriptionUtil.addQueryParams(target, Map.of("env", "test", "team", "analytics"));

    assertSame(target, updated);
    verify(target).queryParam("env", "test");
    verify(target).queryParam("team", "analytics");
  }

  private User user(String name, String email) {
    return new User().withId(UUID.randomUUID()).withName(name).withEmail(email);
  }

  private Team team(String name, String email) {
    return new Team().withId(UUID.randomUUID()).withName(name).withEmail(email);
  }

  private Profile profileWithSlack(String endpoint) {
    return new Profile()
        .withSubscription(
            new SubscriptionConfig().withSlack(new Webhook().withEndpoint(URI.create(endpoint))));
  }

  @SuppressWarnings("unchecked")
  private <T> T invokePrivateStatic(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = SubscriptionUtil.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return (T) method.invoke(null, args);
  }
}
