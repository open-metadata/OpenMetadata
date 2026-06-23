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

package org.openmetadata.service.resources.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

class McpUsageResourceTest {

  private Authorizer authorizer;
  private McpUsageResource resource;
  private MockedConstruction<AppRepository> appRepositoryConstruction;
  private SecurityContext adminContext;
  private SecurityContext userContext;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    appRepositoryConstruction =
        Mockito.mockConstruction(AppRepository.class, (mock, ctx) -> stubRepo(mock));

    resource = new McpUsageResource(authorizer);
    adminContext = stubSecurityContext("admin");
    userContext = stubSecurityContext("alice");
  }

  @AfterEach
  void tearDown() {
    appRepositoryConstruction.close();
  }

  @Test
  void summaryAggregatesCountsAndExcludesBotsFromUniqueUsers() {
    stubRows(
        row("search_metadata", "alice", true, daysAgo(2)),
        row("search_metadata", "alice", true, daysAgo(1)),
        row("create_glossary", "bob", false, daysAgo(1)),
        row("search_metadata", "McpApplicationBot", true, daysAgo(1)),
        row("search_metadata", "ingestion-bot", true, daysAgo(1)));

    Response response = resource.getSummary(adminContext, null, null);

    Map<String, Object> body = bodyAsMap(response);
    assertThat(body.get("total")).isEqualTo(5L);
    assertThat(body.get("totalSuccess")).isEqualTo(4L);
    assertThat(body.get("totalFailed")).isEqualTo(1L);
    assertThat(body.get("uniqueUsers")).isEqualTo(2);
  }

  @Test
  void summaryDeniesNonAdmin() {
    doThrow(new AuthorizationException("forbidden")).when(authorizer).authorizeAdmin(userContext);
    try {
      resource.getSummary(userContext, null, null);
    } catch (AuthorizationException expected) {
      return;
    }
    throw new AssertionError("expected AuthorizationException");
  }

  @Test
  void breakdownByToolMatchesSummaryTotal() {
    stubRows(
        row("search_metadata", "alice", true, daysAgo(1)),
        row("search_metadata", "bob", true, daysAgo(1)),
        row("create_glossary", "alice", true, daysAgo(1)));

    Response summaryResp = resource.getSummary(adminContext, null, null);
    Response toolsResp = resource.getByTool(adminContext, null, null);

    long summaryTotal = ((Number) bodyAsMap(summaryResp).get("total")).longValue();
    Map<String, Map<String, Object>> tools =
        (Map<String, Map<String, Object>>) toolsResp.getEntity();
    long toolsTotal =
        tools.values().stream().mapToLong(row -> ((Number) row.get("calls")).longValue()).sum();
    assertThat(toolsTotal).isEqualTo(summaryTotal);
    assertThat(tools.get("search_metadata").get("errors")).isEqualTo(0L);
  }

  @Test
  void breakdownByUserExcludesBots() {
    stubRows(
        row("search_metadata", "alice", true, daysAgo(1)),
        row("search_metadata", "McpApplicationBot", true, daysAgo(1)),
        row("search_metadata", "SystemBot", true, daysAgo(1)),
        row("search_metadata", "ingestion-bot", true, daysAgo(1)),
        row("search_metadata", "profiler-bot", true, daysAgo(1)),
        row("search_metadata", "robot-overlord", true, daysAgo(1)));

    Response response = resource.getByUser(adminContext, null, null);

    Map<String, Map<String, Object>> body = (Map<String, Map<String, Object>>) response.getEntity();
    assertThat(body).containsOnlyKeys("alice", "robot-overlord");
    assertThat(body.get("alice").get("calls")).isEqualTo(1L);
    assertThat(body.get("robot-overlord").get("calls")).isEqualTo(1L);
  }

  @Test
  void historyBucketsByUtcDayAndFillsEmptyDays() {
    long today = McpUsageResource.startOfDay(Instant.now().toEpochMilli());
    long yesterday = today - Duration.ofDays(1).toMillis();
    long twoDaysAgo = today - Duration.ofDays(2).toMillis();
    stubRows(
        row("a", "alice", true, today + 1000),
        row("a", "alice", true, today + 2000),
        row("a", "alice", true, twoDaysAgo + 500));

    Response response =
        resource.getHistory(adminContext, twoDaysAgo, today + Duration.ofDays(1).toMillis());

    Map<String, Map<String, Long>> body = (Map<String, Map<String, Long>>) response.getEntity();
    String todayIso = McpUsageResource.isoDate(today);
    String yesterdayIso = McpUsageResource.isoDate(yesterday);
    String twoDaysAgoIso = McpUsageResource.isoDate(twoDaysAgo);
    assertThat(body.get(twoDaysAgoIso)).containsEntry("ok", 1L).containsEntry("fail", 0L);
    assertThat(body.get(yesterdayIso)).containsEntry("ok", 0L).containsEntry("fail", 0L);
    assertThat(body.get(todayIso)).containsEntry("ok", 2L).containsEntry("fail", 0L);
  }

  @Test
  void historySplitsOkAndFail() {
    long today = McpUsageResource.startOfDay(Instant.now().toEpochMilli());
    stubRows(
        row("a", "alice", true, today + 1000),
        row("a", "alice", false, today + 2000),
        row("a", "alice", false, today + 3000));

    Response response =
        resource.getHistory(adminContext, today, today + Duration.ofDays(1).toMillis());

    Map<String, Map<String, Long>> body = (Map<String, Map<String, Long>>) response.getEntity();
    Map<String, Long> bucket = body.get(McpUsageResource.isoDate(today));
    assertThat(bucket).containsEntry("ok", 1L).containsEntry("fail", 2L);
  }

  @Test
  void summaryAggregatesLatencyAndErrorCategory() {
    long now = Instant.now().toEpochMilli();
    stubRows(
        rowWithMetadata("search_metadata", "alice", true, daysAgo(1), 120L, null, "Claude Desktop"),
        rowWithMetadata("search_metadata", "alice", true, daysAgo(1), 240L, null, "Claude Desktop"),
        rowWithMetadata(
            "search_metadata",
            "bob",
            false,
            daysAgo(1),
            500L,
            McpToolCallUsage.ErrorCategory.AUTH,
            "Cursor"),
        rowWithMetadata(
            "search_metadata",
            "bob",
            false,
            daysAgo(1),
            null,
            McpToolCallUsage.ErrorCategory.AUTH,
            "Cursor"));

    Response response = resource.getSummary(adminContext, null, null);

    Map<String, Object> body = bodyAsMap(response);
    assertThat(body.get("total")).isEqualTo(4L);
    assertThat(body.get("totalSuccess")).isEqualTo(2L);
    assertThat(body.get("totalFailed")).isEqualTo(2L);
    // Latencies present on three of four rows; avg = (120+240+500)/3 = 286.7
    assertThat((Double) body.get("avgLatencyMs"))
        .isCloseTo(286.7, org.assertj.core.data.Offset.offset(0.1));
    assertThat(body.get("p95LatencyMs")).isEqualTo(500L);
    @SuppressWarnings("unchecked")
    Map<String, Long> errorByCategory = (Map<String, Long>) body.get("errorByCategory");
    assertThat(errorByCategory).containsEntry("AUTH", 2L);
    // Suppress unused-variable warning for the explicit timestamp we built the rows around.
    assertThat(now).isPositive();
  }

  @Test
  void byUserCarriesLatestClient() {
    stubRows(
        rowWithMetadata("a", "alice", true, daysAgo(2), 100L, null, "Cursor"),
        rowWithMetadata("a", "alice", true, daysAgo(1), 120L, null, "Claude Desktop"));

    Response response = resource.getByUser(adminContext, null, null);

    Map<String, Map<String, Object>> body = (Map<String, Map<String, Object>>) response.getEntity();
    assertThat(body.get("alice").get("calls")).isEqualTo(2L);
    assertThat(body.get("alice").get("client")).isEqualTo("Claude Desktop");
  }

  @Test
  void byToolReportsErrorsAndLatencyPercentiles() {
    stubRows(
        rowWithMetadata("search_metadata", "alice", true, daysAgo(1), 100L, null, null),
        rowWithMetadata("search_metadata", "alice", true, daysAgo(1), 200L, null, null),
        rowWithMetadata("search_metadata", "alice", true, daysAgo(1), 300L, null, null),
        rowWithMetadata(
            "search_metadata",
            "bob",
            false,
            daysAgo(1),
            null,
            McpToolCallUsage.ErrorCategory.VALIDATION,
            null));

    Response response = resource.getByTool(adminContext, null, null);

    Map<String, Map<String, Object>> body = (Map<String, Map<String, Object>>) response.getEntity();
    Map<String, Object> row = body.get("search_metadata");
    assertThat(row.get("calls")).isEqualTo(4L);
    assertThat(row.get("errors")).isEqualTo(1L);
    assertThat(row.get("latencyP95")).isEqualTo(300L);
  }

  @Test
  void meReturnsOnlyCallerRows() {
    stubRows(
        row("search_metadata", "alice", true, daysAgo(1)),
        row("search_metadata", "alice", false, daysAgo(1)),
        row("create_glossary", "bob", true, daysAgo(1)));

    Response response = resource.getMine(userContext, null, null);

    Map<String, Object> body = bodyAsMap(response);
    assertThat(body.get("total")).isEqualTo(2L);
    Map<String, Long> byTool = (Map<String, Long>) body.get("byTool");
    assertThat(byTool).containsEntry("search_metadata", 2L);
    assertThat(byTool).doesNotContainKey("create_glossary");
  }

  @Test
  void invalidWindowReturnsBadRequest() {
    long now = Instant.now().toEpochMilli();
    Response response = resource.getSummary(adminContext, now, now - 1);

    assertThat(response.getStatus()).isEqualTo(400);
    Map<String, Object> body = bodyAsMap(response);
    assertThat(body.get("error")).isEqualTo("startTs must be before endTs");
  }

  @Test
  void equalStartAndEndAlsoRejected() {
    long now = Instant.now().toEpochMilli();
    Response response = resource.getByTool(adminContext, now, now);

    assertThat(response.getStatus()).isEqualTo(400);
  }

  @Test
  void historySkipsRowsWithNullTimestamp() {
    long today = McpUsageResource.startOfDay(Instant.now().toEpochMilli());
    McpToolCallUsage rowWithoutTs =
        new McpToolCallUsage()
            .withAppId(UUID.randomUUID())
            .withAppName(McpAppConstants.MCP_APP_NAME)
            .withExtension(AppExtension.ExtensionType.LIMITS)
            .withToolName("search_metadata")
            .withUserName("alice")
            .withSuccess(true);
    stubRows(rowWithoutTs, row("search_metadata", "alice", true, today + 1000));

    Response response =
        resource.getHistory(adminContext, today, today + Duration.ofDays(1).toMillis());

    Map<String, Map<String, Long>> body = (Map<String, Map<String, Long>>) response.getEntity();
    assertThat(body.get(McpUsageResource.isoDate(today)))
        .containsEntry("ok", 1L)
        .containsEntry("fail", 0L);
  }

  @Test
  void latencySampleBoundsMemoryViaReservoirSampling() {
    McpUsageResource.LatencySample sample = new McpUsageResource.LatencySample();
    int feed = McpUsageResource.MAX_LATENCY_SAMPLES * 5;
    for (int i = 0; i < feed; i++) {
      sample.add(i);
    }

    assertThat(sample.values()).hasSize(McpUsageResource.MAX_LATENCY_SAMPLES);
  }

  private void stubRepo(AppRepository mock) {
    lenient()
        .when(
            mock.listAppExtensionInWindowByName(
                any(App.class),
                anyLong(),
                anyLong(),
                anyInt(),
                anyInt(),
                eq(McpToolCallUsage.class),
                eq(AppExtension.ExtensionType.LIMITS)))
        .thenReturn(new ArrayList<>());
  }

  private void stubRows(McpToolCallUsage... rows) {
    AppRepository repo = appRepositoryConstruction.constructed().getFirst();
    when(repo.listAppExtensionInWindowByName(
            any(App.class),
            anyLong(),
            anyLong(),
            anyInt(),
            eq(0),
            eq(McpToolCallUsage.class),
            eq(AppExtension.ExtensionType.LIMITS)))
        .thenReturn(new ArrayList<>(Arrays.asList(rows)));
    when(repo.listAppExtensionInWindowByName(
            any(App.class),
            anyLong(),
            anyLong(),
            anyInt(),
            eq(rows.length),
            eq(McpToolCallUsage.class),
            eq(AppExtension.ExtensionType.LIMITS)))
        .thenReturn(new ArrayList<>());
  }

  private static McpToolCallUsage row(String tool, String user, boolean success, long ts) {
    return new McpToolCallUsage()
        .withAppId(UUID.randomUUID())
        .withAppName(McpAppConstants.MCP_APP_NAME)
        .withExtension(AppExtension.ExtensionType.LIMITS)
        .withToolName(tool)
        .withUserName(user)
        .withSuccess(success)
        .withTimestamp(ts);
  }

  private static McpToolCallUsage rowWithMetadata(
      String tool,
      String user,
      boolean success,
      long ts,
      Long latencyMs,
      McpToolCallUsage.ErrorCategory errorCategory,
      String clientName) {
    return row(tool, user, success, ts)
        .withLatencyMs(latencyMs)
        .withErrorCategory(errorCategory)
        .withClientName(clientName);
  }

  private static long daysAgo(int days) {
    return Instant.now().minus(Duration.ofDays(days)).toEpochMilli();
  }

  private static SecurityContext stubSecurityContext(String name) {
    SecurityContext ctx = mock(SecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(name);
    when(ctx.getUserPrincipal()).thenReturn(principal);
    return ctx;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> bodyAsMap(Response response) {
    return (Map<String, Object>) response.getEntity();
  }
}
