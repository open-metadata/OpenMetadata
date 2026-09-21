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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.entity.events.authentication.WebhookBearerAuth;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.SecurityUtil;

class SubscriptionUtilTest {

  @Test
  void getAdminEmailsAggregatesAcrossPages() {
    UserRepository userRepository = mock(UserRepository.class);
    ResultList<User> firstPage = mock(ResultList.class);
    ResultList<User> secondPage = mock(ResultList.class);
    Paging firstPaging = new Paging().withAfter("cursor-1");
    Paging secondPaging = new Paging().withAfter(null);

    when(firstPage.getData()).thenReturn(List.of(user("alice", "alice@example.com")));
    when(firstPage.getPaging()).thenReturn(firstPaging);
    when(secondPage.getData()).thenReturn(List.of(user("bob", "bob@example.com")));
    when(secondPage.getPaging()).thenReturn(secondPaging);
    when(userRepository.getFields("email")).thenReturn(new EntityUtil.Fields(Set.of("email")));
    when(userRepository.listAfter(isNull(), any(), any(), eq(50), isNull())).thenReturn(firstPage);
    when(userRepository.listAfter(isNull(), any(), any(), eq(50), eq("cursor-1")))
        .thenReturn(secondPage);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(USER)).thenReturn(userRepository);

      Set<String> admins = SubscriptionUtil.getAdminEmails();

      assertEquals(Set.of("alice@example.com", "bob@example.com"), admins);
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
}
