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
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

class McpUsageResourceTest {

  private Authorizer authorizer;
  private McpUsageResource resource;
  private MockedConstruction<AppRepository> appRepositoryConstruction;
  private MockedStatic<ApplicationContext> appContextStatic;
  private SecurityContext adminContext;
  private SecurityContext userContext;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    appRepositoryConstruction =
        Mockito.mockConstruction(AppRepository.class, (mock, ctx) -> stubRepo(mock));

    ApplicationContext appContext = mock(ApplicationContext.class);
    AbstractNativeApplication nativeApp = mock(AbstractNativeApplication.class);
    when(nativeApp.getApp())
        .thenReturn(new App().withId(UUID.randomUUID()).withName(McpAppConstants.MCP_APP_NAME));
    when(appContext.getAppIfExists(McpAppConstants.MCP_APP_NAME)).thenReturn(nativeApp);
    appContextStatic = Mockito.mockStatic(ApplicationContext.class);
    appContextStatic.when(ApplicationContext::getInstance).thenReturn(appContext);

    resource = new McpUsageResource(authorizer);
    adminContext = stubSecurityContext("admin");
    userContext = stubSecurityContext("alice");
  }

  @AfterEach
  void tearDown() {
    appRepositoryConstruction.close();
    appContextStatic.close();
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
    long toolsTotal =
        ((Map<String, Long>) toolsResp.getEntity())
            .values().stream().mapToLong(Long::longValue).sum();
    assertThat(toolsTotal).isEqualTo(summaryTotal);
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

    Map<String, Long> body = (Map<String, Long>) response.getEntity();
    assertThat(body).containsOnlyKeys("alice", "robot-overlord");
    assertThat(body.get("alice")).isEqualTo(1L);
    assertThat(body.get("robot-overlord")).isEqualTo(1L);
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

    Map<Long, Long> body = (Map<Long, Long>) response.getEntity();
    assertThat(body.get(twoDaysAgo)).isEqualTo(1L);
    assertThat(body.get(yesterday)).isEqualTo(0L);
    assertThat(body.get(today)).isEqualTo(2L);
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
  void mcpAppNotInitializedReturnsZeroCounts() {
    appContextStatic.close();
    ApplicationContext emptyContext = mock(ApplicationContext.class);
    when(emptyContext.getAppIfExists(McpAppConstants.MCP_APP_NAME)).thenReturn(null);
    appContextStatic = Mockito.mockStatic(ApplicationContext.class);
    appContextStatic.when(ApplicationContext::getInstance).thenReturn(emptyContext);

    Response response = resource.getSummary(adminContext, null, null);

    assertThat(bodyAsMap(response).get("total")).isEqualTo(0L);
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
