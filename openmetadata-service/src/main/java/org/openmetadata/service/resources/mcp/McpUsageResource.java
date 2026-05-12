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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

/**
 * Read-only API for MCP tool-call usage. Backed by the {@code apps_extension_time_series} table
 * reading from the {@code limits} extension scoped to {@code appName='McpApplication'} — same
 * per-app usage bucket CollateAI writes to, isolated by appName. Counts only. No billing, no
 * rate-limiting.
 */
@Path("/v1/mcp/usage")
@Tag(name = "MCP Usage", description = "MCP tool-call usage counters and breakdowns.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "mcpUsage")
public class McpUsageResource {

  /**
   * Suffixes used to identify bot principals so they can be excluded from unique-user counts and
   * per-user breakdowns. Covers both the PascalCase app bot pattern (e.g. {@code
   * McpApplicationBot}) and OpenMetadata's lowercase-kebab bot pattern (e.g. {@code
   * ingestion-bot}, {@code profiler-bot}, {@code metadata-bot}). Word-boundary aware to avoid
   * false positives like {@code robot}.
   */
  static final String BOT_SUFFIX_PASCAL = "Bot";

  static final String BOT_SUFFIX_KEBAB = "-bot";
  static final long DEFAULT_WINDOW_DAYS = 30L;
  private static final int PAGE_SIZE = 1000;

  private final Authorizer authorizer;
  private final AppRepository appRepository;

  public McpUsageResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.appRepository = new AppRepository();
  }

  @GET
  @Path("/summary")
  @Operation(
      operationId = "getMcpUsageSummary",
      summary = "Get aggregate MCP usage counters",
      description =
          "Returns total/success/failed counts and unique-user count for the supplied window."
              + " Defaults to the last 30 days. Admin access required.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Aggregate counters",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "403", description = "Forbidden. Admin only.")
      })
  public Response getSummary(
      @Context SecurityContext securityContext,
      @Parameter(description = "Window start (epoch millis). Defaults to 30 days ago.")
          @QueryParam("startTs")
          Long startTs,
      @Parameter(description = "Window end exclusive (epoch millis). Defaults to now.")
          @QueryParam("endTs")
          Long endTs) {
    authorizer.authorizeAdmin(securityContext);
    long from = resolveStart(startTs);
    long to = resolveEnd(endTs);
    Response invalid = validateWindow(from, to);
    if (invalid != null) {
      return invalid;
    }
    return Response.ok(buildSummary(from, to)).build();
  }

  @GET
  @Path("/history")
  @Operation(
      operationId = "getMcpUsageHistory",
      summary = "Daily MCP usage counts",
      description =
          "Returns a map of UTC start-of-day (epoch millis) to call count. Empty days are filled"
              + " with 0 so the series is continuous. Admin access required.")
  public Response getHistory(
      @Context SecurityContext securityContext,
      @QueryParam("startTs") Long startTs,
      @QueryParam("endTs") Long endTs) {
    authorizer.authorizeAdmin(securityContext);
    long from = resolveStart(startTs);
    long to = resolveEnd(endTs);
    Response invalid = validateWindow(from, to);
    if (invalid != null) {
      return invalid;
    }
    return Response.ok(buildDailyHistory(from, to)).build();
  }

  @GET
  @Path("/breakdown/tools")
  @Operation(
      operationId = "getMcpUsageByTool",
      summary = "Per-tool call counts",
      description = "Counts MCP requests per tool name in the supplied window. Admin only.")
  public Response getByTool(
      @Context SecurityContext securityContext,
      @QueryParam("startTs") Long startTs,
      @QueryParam("endTs") Long endTs) {
    authorizer.authorizeAdmin(securityContext);
    long from = resolveStart(startTs);
    long to = resolveEnd(endTs);
    Response invalid = validateWindow(from, to);
    if (invalid != null) {
      return invalid;
    }
    Map<String, Long> counts = groupByCount(from, to, McpToolCallUsage::getToolName, true);
    return Response.ok(counts).build();
  }

  @GET
  @Path("/breakdown/users")
  @Operation(
      operationId = "getMcpUsageByUser",
      summary = "Per-user call counts",
      description =
          "Counts MCP requests per principal in the supplied window. Bot principals"
              + " (suffix 'Bot') are excluded. Admin only.")
  public Response getByUser(
      @Context SecurityContext securityContext,
      @QueryParam("startTs") Long startTs,
      @QueryParam("endTs") Long endTs) {
    authorizer.authorizeAdmin(securityContext);
    long from = resolveStart(startTs);
    long to = resolveEnd(endTs);
    Response invalid = validateWindow(from, to);
    if (invalid != null) {
      return invalid;
    }
    Map<String, Long> counts = groupByCount(from, to, McpToolCallUsage::getUserName, false);
    return Response.ok(counts).build();
  }

  @GET
  @Path("/me")
  @Operation(
      operationId = "getMcpUsageForMe",
      summary = "Self-service MCP usage counters",
      description =
          "Returns the calling user's total MCP call count and per-tool breakdown for the"
              + " supplied window. Any authenticated user.")
  public Response getMine(
      @Context SecurityContext securityContext,
      @QueryParam("startTs") Long startTs,
      @QueryParam("endTs") Long endTs) {
    String me = securityContext.getUserPrincipal().getName();
    long from = resolveStart(startTs);
    long to = resolveEnd(endTs);
    Response invalid = validateWindow(from, to);
    if (invalid != null) {
      return invalid;
    }
    return Response.ok(buildSelf(me, from, to)).build();
  }

  private Map<String, Object> buildSummary(long from, long to) {
    AtomicLong total = new AtomicLong();
    AtomicLong success = new AtomicLong();
    Set<String> users = new LinkedHashSet<>();
    forEachRow(
        from,
        to,
        usage -> {
          total.incrementAndGet();
          if (Boolean.TRUE.equals(usage.getSuccess())) {
            success.incrementAndGet();
          }
          if (usage.getUserName() != null && !isBot(usage.getUserName())) {
            users.add(usage.getUserName());
          }
        });
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("total", total.get());
    body.put("totalSuccess", success.get());
    body.put("totalFailed", total.get() - success.get());
    body.put("uniqueUsers", users.size());
    body.put("startTs", from);
    body.put("endTs", to);
    return body;
  }

  private Map<Long, Long> buildDailyHistory(long from, long to) {
    Map<Long, Long> daily = new TreeMap<>();
    seedEmptyDays(daily, from, to);
    forEachRow(from, to, usage -> daily.merge(startOfDay(usage.getTimestamp()), 1L, Long::sum));
    return daily;
  }

  private Map<String, Object> buildSelf(String userName, long from, long to) {
    AtomicLong total = new AtomicLong();
    Map<String, Long> byTool = new LinkedHashMap<>();
    forEachRow(
        from,
        to,
        usage -> {
          if (!userName.equals(usage.getUserName())) {
            return;
          }
          total.incrementAndGet();
          if (usage.getToolName() != null) {
            byTool.merge(usage.getToolName(), 1L, Long::sum);
          }
        });
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("total", total.get());
    body.put("byTool", byTool);
    body.put("startTs", from);
    body.put("endTs", to);
    return body;
  }

  private Map<String, Long> groupByCount(
      long from, long to, Function<McpToolCallUsage, String> classifier, boolean includeBots) {
    Map<String, Long> counts = new LinkedHashMap<>();
    forEachRow(
        from,
        to,
        usage -> {
          String key = classifier.apply(usage);
          if (key == null) {
            return;
          }
          if (!includeBots && isBot(key)) {
            return;
          }
          counts.merge(key, 1L, Long::sum);
        });
    return counts;
  }

  /**
   * Pages through rows in the half-open window {@code [from, to)} using the upper-bounded SQL
   * helper. The SQL filter pins the result set so OFFSET pagination stays consistent across pages
   * even if new MCP tool calls are recorded mid-request, preventing duplicate or skipped rows.
   */
  private void forEachRow(long from, long to, Consumer<McpToolCallUsage> visit) {
    App app = resolveMcpApp();
    if (app == null) {
      return;
    }
    int offset = 0;
    while (true) {
      List<McpToolCallUsage> page =
          appRepository.listAppExtensionInWindowByName(
              app,
              from,
              to,
              PAGE_SIZE,
              offset,
              McpToolCallUsage.class,
              AppExtension.ExtensionType.LIMITS);
      if (page.isEmpty()) {
        return;
      }
      page.forEach(visit);
      if (page.size() < PAGE_SIZE) {
        return;
      }
      offset += PAGE_SIZE;
    }
  }

  private App resolveMcpApp() {
    AbstractNativeApplication app =
        ApplicationContext.getInstance().getAppIfExists(McpAppConstants.MCP_APP_NAME);
    return app != null ? app.getApp() : null;
  }

  static long resolveStart(Long startTs) {
    if (startTs != null) {
      return startTs;
    }
    return Instant.now().minus(Duration.ofDays(DEFAULT_WINDOW_DAYS)).toEpochMilli();
  }

  static long resolveEnd(Long endTs) {
    return endTs != null ? endTs : Instant.now().toEpochMilli();
  }

  /**
   * Returns a 400 Response if the resolved window is empty or reversed, otherwise {@code null}.
   * Endpoints invoke this before aggregation so callers get an explicit error rather than a
   * silently empty payload when they pass a bogus {@code startTs >= endTs}.
   */
  static Response validateWindow(long from, long to) {
    if (from >= to) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(Map.of("error", "startTs must be before endTs"))
          .build();
    }
    return null;
  }

  static long startOfDay(long epochMillis) {
    return LocalDate.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneOffset.UTC)
        .atStartOfDay(ZoneOffset.UTC)
        .toInstant()
        .toEpochMilli();
  }

  static boolean isBot(String principal) {
    if (principal == null) {
      return false;
    }
    return principal.endsWith(BOT_SUFFIX_PASCAL) || principal.endsWith(BOT_SUFFIX_KEBAB);
  }

  private static void seedEmptyDays(Map<Long, Long> daily, long from, long to) {
    long cursor = startOfDay(from);
    long lastDay = startOfDay(to - 1);
    while (cursor <= lastDay) {
      daily.put(cursor, 0L);
      cursor = cursor + Duration.ofDays(1).toMillis();
    }
  }
}
