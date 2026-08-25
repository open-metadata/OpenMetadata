package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

class SlackWebApiClientTest {

  private static final String LONG_ENTITY_NAME = "aaa_very_long_entity_name_that_needs_truncation";

  private SlackWebApiClient client;
  private HttpClient httpClient;

  @BeforeEach
  void setUp() throws Exception {
    client = new SlackWebApiClient("xoxb-token", "C123", "http://om.local");
    httpClient = mock(HttpClient.class);
    setField(client, "httpClient", httpClient);
  }

  @Test
  void sendStartNotificationSkipsWhenBotTokenIsMissing() {
    SlackWebApiClient noTokenClient = new SlackWebApiClient("", "C123", "http://om.local");

    noTokenClient.sendStartNotification("All", true, 10);

    assertNull(getField(noTokenClient, "messageTimestamp"));
    assertNull(getField(noTokenClient, "channelId"));
  }

  @Test
  void sendStartNotificationPostsInitialMessageAndStoresSlackIdentifiers() throws Exception {
    setField(client, "configurationDetails", Map.of("batchSize", "100"));
    whenSendReturns(jsonResponse(200, "{\"ok\":true,\"ts\":\"111.222\",\"channel\":\"C999\"}"));

    client.sendStartNotification("All", true, 42);

    ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
    verifyHttpSend(requestCaptor);
    Map<String, String> formData = readFormData(requestCaptor.getValue());
    assertEquals(
        "https://slack.com/api/chat.postMessage", requestCaptor.getValue().uri().toString());
    assertEquals(
        "Bearer xoxb-token",
        requestCaptor.getValue().headers().firstValue("Authorization").orElseThrow());
    assertEquals("C123", formData.get("channel"));
    assertEquals("Reindexing started", formData.get("text"));
    assertTrue(formData.get("blocks").contains("Smart Reindexing"));
    assertTrue(formData.get("blocks").contains("batchSize"));
    assertEquals("111.222", getField(client, "messageTimestamp"));
    assertEquals("C999", getField(client, "channelId"));
    assertEquals("All", getField(client, "entities"));
    assertEquals(Boolean.TRUE, getField(client, "isSmartReindexing"));
    assertEquals(42, getField(client, "totalEntities"));
    assertNotNull(getField(client, "startTime"));
  }

  @Test
  void setConfigurationDetailsReplacesStoredConfigurationMap() {
    Map<String, String> details = new LinkedHashMap<>();
    details.put("batchSize", "100");

    client.setConfigurationDetails(details);

    assertEquals(details, getField(client, "configurationDetails"));
  }

  @Test
  void sendStartNotificationLeavesSlackIdentifiersUnsetWhenApiDoesNotAcknowledge()
      throws Exception {
    whenSendReturns(jsonResponse(200, "{\"ok\":false}"));

    client.sendStartNotification("All", false, 3);

    assertNull(getField(client, "messageTimestamp"));
    assertNull(getField(client, "channelId"));
  }

  @Test
  void sendStartNotificationHandlesInterruptedAndExceptionalHttpCalls() throws Exception {
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new InterruptedException("interrupted"));

    client.sendStartNotification("All", true, 10);

    assertTrue(Thread.interrupted());
    assertNull(getField(client, "messageTimestamp"));

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new IOException("network"));

    client.sendStartNotification("All", true, 10);

    assertNull(getField(client, "messageTimestamp"));
  }

  @Test
  void sendProgressUpdateSkipsWithoutIdentifiersOrWhenThrottled() throws Exception {
    Stats stats = buildStats(10, 0, 20);

    client.sendProgressUpdate(stats);
    verifyNoInteractions(httpClient);

    setField(client, "messageTimestamp", "111.222");
    setField(client, "channelId", "C999");
    setField(client, "lastUpdateTime", System.currentTimeMillis());

    client.sendProgressUpdate(stats);
    verifyNoInteractions(httpClient);
  }

  @Test
  void sendProgressUpdateSkipsWhenStatsAreMissing() throws Exception {
    seedMessageState();

    client.sendProgressUpdate(null);
    client.sendProgressUpdate(new Stats());

    verifyNoInteractions(httpClient);
  }

  @Test
  void sendProgressUpdateUpdatesSlackMessageWhenEligible() throws Exception {
    seedMessageState();
    whenSendReturns(jsonResponse(200, "{\"ok\":true}"));

    client.sendProgressUpdate(buildStats(40, 5, 100));

    ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
    verifyHttpSend(requestCaptor);
    Map<String, String> formData = readFormData(requestCaptor.getValue());
    assertEquals("https://slack.com/api/chat.update", requestCaptor.getValue().uri().toString());
    assertEquals("C999", formData.get("channel"));
    assertEquals("111.222", formData.get("ts"));
    assertEquals("Reindexing in progress", formData.get("text"));
    assertTrue(formData.get("blocks").contains("Entity Breakdown"));
    assertTrue(((Long) getField(client, "lastUpdateTime")) > 0L);
  }

  @Test
  void sendProgressUpdateDoesNotAdvanceTimestampWhenSlackRejectsOrThrows() throws Exception {
    seedMessageState();
    whenSendReturns(jsonResponse(200, "{\"ok\":false}"));

    client.sendProgressUpdate(buildStats(40, 5, 100));

    assertEquals(0L, getField(client, "lastUpdateTime"));

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new InterruptedException("interrupted"));

    client.sendProgressUpdate(buildStats(40, 5, 100));

    assertTrue(Thread.interrupted());
    assertEquals(0L, getField(client, "lastUpdateTime"));

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new IOException("network"));

    client.sendProgressUpdate(buildStats(40, 5, 100));

    assertEquals(0L, getField(client, "lastUpdateTime"));
  }

  @Test
  void sendCompletionNotificationIncludesDurationAndErrorStatus() throws Exception {
    seedMessageState();
    whenSendReturns(jsonResponse(200, "{\"ok\":true}"));

    client.sendCompletionNotification(buildStats(100, 7, 100), 3661L, true);

    ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
    verifyHttpSend(requestCaptor);
    Map<String, String> formData = readFormData(requestCaptor.getValue());
    assertEquals("Reindexing completed", formData.get("text"));
    assertTrue(formData.get("blocks").contains("Completed with Errors"));
    assertTrue(formData.get("blocks").contains("1h 1m 1s"));
  }

  @Test
  void sendCompletionNotificationHandlesSuccessfulStatusAndExceptions() throws Exception {
    seedMessageState();
    whenSendReturns(jsonResponse(200, "{\"ok\":true}"));

    client.sendCompletionNotification(buildStats(100, 0, 100), 61L, false);

    ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
    verifyHttpSend(requestCaptor);
    assertTrue(
        readFormData(requestCaptor.getValue()).get("blocks").contains("Completed Successfully"));

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new InterruptedException("interrupted"));

    client.sendCompletionNotification(buildStats(100, 0, 100), 61L, false);

    assertTrue(Thread.interrupted());

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new IOException("network"));

    client.sendCompletionNotification(buildStats(100, 0, 100), 61L, false);
  }

  @Test
  void sendNoChangesNotificationPostsStandaloneMessage() throws Exception {
    whenSendReturns(jsonResponse(200, "{\"ok\":true}"));

    client.sendNoChangesNotification();

    ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
    verifyHttpSend(requestCaptor);
    Map<String, String> formData = readFormData(requestCaptor.getValue());
    assertEquals("No reindexing needed", formData.get("text"));
    assertTrue(formData.get("blocks").contains("No Reindexing Needed"));
  }

  @Test
  void sendNoChangesNotificationHandlesInterruptedAndExceptionalHttpCalls() throws Exception {
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new InterruptedException("interrupted"));

    client.sendNoChangesNotification();

    assertTrue(Thread.interrupted());

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new IOException("network"));

    client.sendNoChangesNotification();
  }

  @Test
  void sendErrorNotificationUpdatesExistingSlackMessage() throws Exception {
    setField(client, "messageTimestamp", "111.222");
    setField(client, "channelId", "C999");
    whenSendReturns(jsonResponse(200, "{\"ok\":true}"));

    client.sendErrorNotification("bulk indexing failed");

    ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
    verifyHttpSend(requestCaptor);
    Map<String, String> formData = readFormData(requestCaptor.getValue());
    assertEquals("❌Reindexing failed", formData.get("text"));
    assertTrue(formData.get("blocks").contains("bulk indexing failed"));
  }

  @Test
  void sendErrorNotificationSkipsWithoutIdentifiersAndHandlesFailures() throws Exception {
    client.sendErrorNotification("ignored");
    verifyNoInteractions(httpClient);

    setField(client, "messageTimestamp", "111.222");
    setField(client, "channelId", "C999");
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new InterruptedException("interrupted"));

    client.sendErrorNotification("broken");

    assertTrue(Thread.interrupted());

    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new IOException("network"));

    client.sendErrorNotification("broken");
  }

  @Test
  void callSlackApiParsesSuccessfulResponsesAndReturnsNullForFailures() throws Exception {
    whenSendReturns(jsonResponse(200, "{\"ok\":true,\"ts\":\"111.222\"}"));

    JsonNode success =
        (JsonNode)
            invokePrivateMethod(
                client,
                "callSlackApi",
                new Class<?>[] {String.class, Map.class},
                "chat.postMessage",
                Map.of("channel", "C123", "text", "hello world"));

    assertTrue(success.get("ok").asBoolean());

    whenSendReturns(jsonResponse(500, "{\"ok\":false}"));
    Object failure =
        invokePrivateMethod(
            client,
            "callSlackApi",
            new Class<?>[] {String.class, Map.class},
            "chat.update",
            Map.of("channel", "C123", "text", "hello world"));
    assertNull(failure);
  }

  @Test
  void privateFormattingHelpersCoverEntityOrderingTruncationAndHiddenSummary() throws Exception {
    setField(client, "entities", "tables");
    setField(client, "isSmartReindexing", false);
    setField(client, "totalEntities", 30);
    setField(client, "startTime", System.currentTimeMillis() - 5_000L);
    setField(client, "configurationDetails", Map.of());

    Stats stats = buildDenseStatsForBreakdown();

    ArrayNode progress =
        (ArrayNode)
            invokePrivateMethod(
                client,
                "createProgressMessage",
                new Class<?>[] {Stats.class, String.class, String.class},
                stats,
                "🔄 Processing...",
                "5s");

    String rendered = progress.toString();
    int failedIndex = rendered.indexOf("failed_entity");
    int incompleteIndex = rendered.indexOf("incomplete_entity");
    String expectedTruncated = LONG_ENTITY_NAME.substring(0, 22) + "...";
    int longNameIndex = rendered.indexOf(expectedTruncated);
    assertTrue(failedIndex >= 0);
    assertTrue(incompleteIndex > failedIndex);
    assertTrue(longNameIndex > incompleteIndex);
    assertTrue(rendered.contains(expectedTruncated));
    assertTrue(rendered.contains("... and 3 more successful entities"));
    assertTrue(rendered.contains("❌ *1 entities with failures*"));
    assertTrue(rendered.contains("⚠️ *1 entities incomplete*"));
    assertTrue(rendered.contains("• Duration: `5s`"));
  }

  @Test
  void privateFormattingHelpersBuildExpectedSlackContent() throws Exception {
    seedMessageState();

    ArrayNode initial =
        (ArrayNode) invokePrivateMethod(client, "createInitialMessage", new Class<?>[0]);
    ArrayNode progress =
        (ArrayNode)
            invokePrivateMethod(
                client,
                "createProgressMessage",
                new Class<?>[] {Stats.class, String.class, String.class},
                buildStats(25, 2, 50),
                "🔄 Processing...",
                null);
    ObjectNode noChanges =
        wrapArrayNode(
            (ArrayNode) invokePrivateMethod(client, "createNoChangesMessage", new Class<?>[0]));
    ObjectNode error =
        (ObjectNode)
            invokePrivateMethod(
                client, "createErrorMessage", new Class<?>[] {String.class}, "fatal failure");

    assertTrue(initial.toString().contains("Reindexing Started"));
    assertTrue(initial.toString().contains("Settings"));
    assertTrue(progress.toString().contains("Entity Breakdown"));
    assertTrue(progress.toString().contains("records/sec"));
    assertTrue(noChanges.toString().contains("No Reindexing Needed"));
    assertTrue(error.toString().contains("fatal failure"));
  }

  @Test
  void privateHelpersFormatDurationHeadersProgressAndInstanceUrl() throws Exception {
    setField(client, "instanceUrl", null);

    assertEquals(
        "▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░",
        invokePrivateMethod(
            client, "createVisualProgressBar", new Class<?>[] {double.class}, 50.0));
    assertEquals(
        "✅ Reindexing Completed",
        invokePrivateMethod(
            client, "getHeaderText", new Class<?>[] {String.class}, "Completed Successfully"));
    assertEquals(
        "59s", invokePrivateMethod(client, "formatDuration", new Class<?>[] {long.class}, 59L));
    assertEquals(
        "2m 5s", invokePrivateMethod(client, "formatDuration", new Class<?>[] {long.class}, 125L));
    assertEquals(
        "1h 1m 1s",
        invokePrivateMethod(client, "formatDuration", new Class<?>[] {long.class}, 3661L));
    assertEquals(
        "*Instance:* <http://localhost:8585|http://localhost:8585>",
        invokePrivateMethod(client, "formatInstanceUrl", new Class<?>[0]));
    assertEquals(
        "❌ Reindexing Failed",
        invokePrivateMethod(client, "getHeaderText", new Class<?>[] {String.class}, "Error"));
    assertEquals(
        "🔄 Reindexing in Progress",
        invokePrivateMethod(client, "getHeaderText", new Class<?>[] {String.class}, "Processing"));
    assertEquals(
        "🚀 Reindexing",
        invokePrivateMethod(client, "getHeaderText", new Class<?>[] {String.class}, "Queued"));

    ObjectNode instanceStatus =
        (ObjectNode)
            invokePrivateMethod(
                client, "createInstanceStatusSection", new Class<?>[] {String.class}, "Processing");
    ObjectNode divider =
        (ObjectNode) invokePrivateMethod(client, "createDividerBlock", new Class<?>[0]);
    ObjectNode header =
        (ObjectNode)
            invokePrivateMethod(
                client, "createHeaderBlock", new Class<?>[] {String.class}, "Header");

    assertInstanceOf(ArrayNode.class, instanceStatus.get("fields"));
    assertEquals("divider", divider.get("type").asText());
    assertEquals("Header", header.get("text").get("text").asText());
  }

  private void seedMessageState() throws Exception {
    setField(client, "messageTimestamp", "111.222");
    setField(client, "channelId", "C999");
    setField(client, "lastUpdateTime", 0L);
    setField(client, "entities", "All");
    setField(client, "isSmartReindexing", true);
    setField(client, "totalEntities", 50);
    setField(client, "startTime", System.currentTimeMillis() - 10_000L);
    setField(client, "configurationDetails", Map.of("batchSize", "100", "mode", "smart"));
  }

  private Stats buildStats(int success, int failed, int total) {
    Stats stats = new Stats();
    StepStats jobStats = new StepStats();
    jobStats.setSuccessRecords(success);
    jobStats.setFailedRecords(failed);
    jobStats.setTotalRecords(total);
    stats.setJobStats(jobStats);

    EntityStats entityStats = new EntityStats();
    StepStats tableStats = new StepStats();
    tableStats.setSuccessRecords(success / 2);
    tableStats.setFailedRecords(failed);
    tableStats.setTotalRecords(total / 2);
    entityStats.getAdditionalProperties().put("table", tableStats);

    StepStats dashboardStats = new StepStats();
    dashboardStats.setSuccessRecords(success / 2);
    dashboardStats.setFailedRecords(0);
    dashboardStats.setTotalRecords(total / 2);
    entityStats.getAdditionalProperties().put("dashboard", dashboardStats);
    stats.setEntityStats(entityStats);
    return stats;
  }

  @SuppressWarnings("unchecked")
  private void whenSendReturns(HttpResponse<String> response) throws Exception {
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);
  }

  @SuppressWarnings("unchecked")
  private void verifyHttpSend(ArgumentCaptor<HttpRequest> requestCaptor) throws Exception {
    org.mockito.Mockito.verify(httpClient)
        .send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
  }

  @SuppressWarnings("unchecked")
  private HttpResponse<String> jsonResponse(int statusCode, String body) {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(statusCode);
    when(response.body()).thenReturn(body);
    return response;
  }

  private Map<String, String> readFormData(HttpRequest request) throws Exception {
    String body = readBody(request);
    Map<String, String> formData = new LinkedHashMap<>();
    for (String pair : body.split("&")) {
      String[] parts = pair.split("=", 2);
      formData.put(
          URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
          parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "");
    }
    return formData;
  }

  private String readBody(HttpRequest request) throws Exception {
    HttpRequest.BodyPublisher publisher = request.bodyPublisher().orElseThrow();
    CompletableFuture<String> result = new CompletableFuture<>();
    StringBuilder body = new StringBuilder();
    publisher.subscribe(
        new Flow.Subscriber<>() {
          @Override
          public void onSubscribe(Flow.Subscription subscription) {
            subscription.request(Long.MAX_VALUE);
          }

          @Override
          public void onNext(ByteBuffer item) {
            body.append(StandardCharsets.UTF_8.decode(item.duplicate()));
          }

          @Override
          public void onError(Throwable throwable) {
            result.completeExceptionally(throwable);
          }

          @Override
          public void onComplete() {
            result.complete(body.toString());
          }
        });
    return result.get(5, TimeUnit.SECONDS);
  }

  private Object invokePrivateMethod(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = SlackWebApiClient.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(target, args);
  }

  private void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = SlackWebApiClient.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  private Object getField(Object target, String fieldName) {
    try {
      Field field = SlackWebApiClient.class.getDeclaredField(fieldName);
      field.setAccessible(true);
      return field.get(target);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private ObjectNode wrapArrayNode(ArrayNode arrayNode) {
    ObjectNode wrapper = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
    wrapper.set("blocks", arrayNode);
    return wrapper;
  }

  private Stats buildDenseStatsForBreakdown() {
    Stats stats = new Stats();
    StepStats jobStats = new StepStats();
    jobStats.setSuccessRecords(29);
    jobStats.setFailedRecords(1);
    jobStats.setTotalRecords(31);
    stats.setJobStats(jobStats);

    EntityStats entityStats = new EntityStats();

    StepStats failed = new StepStats();
    failed.setSuccessRecords(0);
    failed.setFailedRecords(1);
    failed.setTotalRecords(1);
    entityStats.getAdditionalProperties().put("failed_entity", failed);

    StepStats incomplete = new StepStats();
    incomplete.setSuccessRecords(1);
    incomplete.setFailedRecords(0);
    incomplete.setTotalRecords(2);
    entityStats.getAdditionalProperties().put("incomplete_entity", incomplete);

    StepStats longNamedSuccess = new StepStats();
    longNamedSuccess.setSuccessRecords(1);
    longNamedSuccess.setFailedRecords(0);
    longNamedSuccess.setTotalRecords(1);
    entityStats.getAdditionalProperties().put(LONG_ENTITY_NAME, longNamedSuccess);

    for (int i = 0; i < 27; i++) {
      StepStats success = new StepStats();
      success.setSuccessRecords(1);
      success.setFailedRecords(0);
      success.setTotalRecords(1);
      entityStats.getAdditionalProperties().put(String.format("success_%02d", i), success);
    }

    stats.setEntityStats(entityStats);
    return stats;
  }
}
