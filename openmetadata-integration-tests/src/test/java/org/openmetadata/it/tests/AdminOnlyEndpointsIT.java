package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatusFor;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Endpoints that expose deployment internals, every user's activity, or act on the whole
 * installation answer only admins, plus bots where an integration legitimately reads them.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AdminOnlyEndpointsIT {

  private static final String WEB_ANALYTICS_COLLECT_PATH = "/v1/analytics/web/events/collect";

  // The data consumer resolves through SubjectCache; create it up front so an authorization
  // check answers 403 rather than 404 for a user this JVM has not seen yet.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  void emailTemplateReset_isAdminOnly() {
    assertHttpStatusFor(
        SdkClients.dataConsumerClient(),
        403,
        HttpMethod.POST,
        "/v1/docStore/resetEmailTemplate",
        null);
  }

  @Test
  void reindexFailures_areAdminOnlyAndPaged() {
    String path = "/v1/search/reindex/failures";

    assertHttpStatusFor(SdkClients.dataConsumerClient(), 403, HttpMethod.GET, path, null);
    assertNotNull(get(SdkClients.adminClient(), path));
    assertHttpStatusFor(SdkClients.adminClient(), 400, HttpMethod.GET, path + "?limit=1001", null);
  }

  @Test
  void changeEventFeed_isLimitedToAdminsAndBots() {
    String path = "/v1/events?entityCreated=*&timestamp=" + System.currentTimeMillis();

    assertHttpStatusFor(SdkClients.dataConsumerClient(), 403, HttpMethod.GET, path, null);
    assertNotNull(get(SdkClients.ingestionBotClient(), path));
  }

  @Test
  void deploymentStatus_isLimitedToAdminsAndBots() {
    assertHttpStatusFor(
        SdkClients.dataConsumerClient(), 403, HttpMethod.GET, "/v1/system/status", null);
  }

  @Test
  void catalogCounts_areLimitedToAdminsAndBots() {
    for (String path : new String[] {"/v1/system/entities/count", "/v1/system/services/count"}) {
      assertHttpStatusFor(SdkClients.dataConsumerClient(), 403, HttpMethod.GET, path, null);
      assertNotNull(get(SdkClients.ingestionBotClient(), path));
    }
  }

  @Test
  void rawWebAnalyticEvents_areLimitedToAdminsAndBots() {
    assertHttpStatusFor(
        SdkClients.dataConsumerClient(),
        403,
        HttpMethod.GET,
        WEB_ANALYTICS_COLLECT_PATH
            + "?eventType=PageView&startTs=0&endTs="
            + System.currentTimeMillis(),
        null);
  }

  @Test
  void recognizerFeedbackReviewQueue_isAdminOnly() {
    assertHttpStatusFor(
        SdkClients.dataConsumerClient(), 403, HttpMethod.GET, "/v1/tags/feedback/pending", null);
    assertNotNull(get(SdkClients.adminClient(), "/v1/tags/feedback/pending"));
  }

  @Test
  void pageView_isRecordedForTheCallerWhateverUserItNames(TestNamespace ns) {
    UUID someoneElse = SharedEntities.get().USER1.getId();
    WebAnalyticEventData pageView =
        new WebAnalyticEventData()
            .withTimestamp(
                System.currentTimeMillis() + Integer.toUnsignedLong(ns.shortPrefix().hashCode()))
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withHostname("http://localhost:8585")
                    .withUserId(someoneElse)
                    .withSessionId(UUID.randomUUID())
                    .withFullUrl("http://localhost:8585/explore")
                    .withUrl("/explore"));

    WebAnalyticEventData recorded =
        SdkClients.user2Client()
            .getHttpClient()
            .execute(
                HttpMethod.PUT, WEB_ANALYTICS_COLLECT_PATH, pageView, WebAnalyticEventData.class);

    PageViewData recordedView = JsonUtils.convertValue(recorded.getEventData(), PageViewData.class);
    assertEquals(SharedEntities.get().USER2.getId(), recordedView.getUserId());
  }

  private static String get(OpenMetadataClient client, String path) {
    return client.getHttpClient().executeForString(HttpMethod.GET, path, null);
  }
}
