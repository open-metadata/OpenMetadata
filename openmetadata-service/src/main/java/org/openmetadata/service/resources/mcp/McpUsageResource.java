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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
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

  /**
   * Upper bound on latency samples retained per aggregation bucket (summary and per-tool). Above
   * this size we switch to reservoir sampling so percentile estimates stay statistically valid
   * without inflating heap usage when a single tool gets millions of calls in the window.
   */
  static final int MAX_LATENCY_SAMPLES = 10_000;

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
          "Returns a map keyed by ISO date string (YYYY-MM-DD, UTC) to an object with 'ok' and"
              + " 'fail' counters. Empty days are seeded with zeros so the series is continuous."
              + " Admin access required.")
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
      summary = "Per-tool call counts with errors + latency",
      description =
          "Returns per-tool aggregates in the form { tool: { calls, errors, latencyP50, "
              + "latencyP95 } }. Latency fields are present once rows recorded by the Phase 3 "
              + "DefaultToolContext are in the window; otherwise the fields are omitted. Admin "
              + "only.")
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
    return Response.ok(buildToolBreakdown(from, to)).build();
  }

  @GET
  @Path("/breakdown/users")
  @Operation(
      operationId = "getMcpUsageByUser",
      summary = "Per-user call counts with client name",
      description =
          "Returns per-user aggregates in the form { user: { calls, client } } where client is "
              + "the most-recent MCP client (Claude Desktop / Cursor / VS Code / CLI) the user "
              + "connected with. Bot principals (suffix 'Bot') are excluded. Admin only.")
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
    return Response.ok(buildUserBreakdown(from, to)).build();
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
    LatencySample latencies = new LatencySample();
    Map<String, Long> errorByCategory = new LinkedHashMap<>();
    forEachRow(
        from,
        to,
        usage -> {
          total.incrementAndGet();
          if (Boolean.TRUE.equals(usage.getSuccess())) {
            success.incrementAndGet();
          } else if (usage.getErrorCategory() != null) {
            errorByCategory.merge(usage.getErrorCategory().value(), 1L, Long::sum);
          }
          if (usage.getUserName() != null && !isBot(usage.getUserName())) {
            users.add(usage.getUserName());
          }
          if (usage.getLatencyMs() != null && usage.getLatencyMs() >= 0) {
            latencies.add(usage.getLatencyMs());
          }
        });
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("total", total.get());
    body.put("totalSuccess", success.get());
    body.put("totalFailed", total.get() - success.get());
    body.put("uniqueUsers", users.size());
    body.put("startTs", from);
    body.put("endTs", to);
    List<Long> latencyValues = latencies.values();
    if (!latencyValues.isEmpty()) {
      body.put("avgLatencyMs", average(latencyValues));
      body.put("p95LatencyMs", percentile(latencyValues, 95));
    }
    if (!errorByCategory.isEmpty()) {
      body.put("errorByCategory", errorByCategory);
    }
    // Week-over-week trend: re-aggregate a same-sized window immediately prior. Only emit when
    // the prior window has data so the UI doesn't display a spurious "+100%".
    long priorFrom = from - (to - from);
    if (priorFrom > 0) {
      AtomicLong priorTotal = new AtomicLong();
      forEachRow(priorFrom, from, u -> priorTotal.incrementAndGet());
      if (priorTotal.get() > 0) {
        double change = ((double) (total.get() - priorTotal.get()) / priorTotal.get()) * 100.0;
        body.put("wowChangePct", Math.round(change * 10.0) / 10.0);
      }
    }
    return body;
  }

  /**
   * Daily ok/fail tallies. Returns a TreeMap keyed by ISO date string (YYYY-MM-DD) — the
   * redesigned MCP page reads this shape directly to render a stacked bar chart of successful
   * vs. failed requests. Days with no traffic are seeded with zeros so the chart renders a
   * continuous series. Rows with a null timestamp are skipped — the schema doesn't require it
   * so legacy or partial rows would otherwise NPE the {@link #isoDate} call.
   */
  private Map<String, Map<String, Long>> buildDailyHistory(long from, long to) {
    Map<String, Map<String, Long>> daily = new TreeMap<>();
    seedEmptyOkFailDays(daily, from, to);
    forEachRow(
        from,
        to,
        usage -> {
          Long ts = usage.getTimestamp();
          if (ts == null) {
            return;
          }
          String day = isoDate(ts);
          Map<String, Long> bucket =
              daily.computeIfAbsent(
                  day,
                  k -> {
                    Map<String, Long> m = new LinkedHashMap<>();
                    m.put("ok", 0L);
                    m.put("fail", 0L);
                    return m;
                  });
          if (Boolean.TRUE.equals(usage.getSuccess())) {
            bucket.merge("ok", 1L, Long::sum);
          } else {
            bucket.merge("fail", 1L, Long::sum);
          }
        });
    return daily;
  }

  private Map<String, Map<String, Object>> buildToolBreakdown(long from, long to) {
    Map<String, Long> calls = new LinkedHashMap<>();
    Map<String, Long> errors = new HashMap<>();
    Map<String, LatencySample> latencies = new HashMap<>();
    forEachRow(
        from,
        to,
        usage -> {
          String tool = usage.getToolName();
          if (tool == null) {
            return;
          }
          calls.merge(tool, 1L, Long::sum);
          if (!Boolean.TRUE.equals(usage.getSuccess())) {
            errors.merge(tool, 1L, Long::sum);
          }
          if (usage.getLatencyMs() != null && usage.getLatencyMs() >= 0) {
            latencies.computeIfAbsent(tool, k -> new LatencySample()).add(usage.getLatencyMs());
          }
        });
    Map<String, Map<String, Object>> result = new LinkedHashMap<>();
    calls.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .forEach(
            e -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("calls", e.getValue());
              row.put("errors", errors.getOrDefault(e.getKey(), 0L));
              LatencySample toolLatencies = latencies.get(e.getKey());
              if (toolLatencies != null && !toolLatencies.isEmpty()) {
                List<Long> values = toolLatencies.values();
                row.put("latencyP50", percentile(values, 50));
                row.put("latencyP95", percentile(values, 95));
              }
              result.put(e.getKey(), row);
            });
    return result;
  }

  private Map<String, Map<String, Object>> buildUserBreakdown(long from, long to) {
    Map<String, Long> calls = new LinkedHashMap<>();
    Map<String, String> latestClient = new HashMap<>();
    Map<String, Long> latestClientTs = new HashMap<>();
    forEachRow(
        from,
        to,
        usage -> {
          String user = usage.getUserName();
          if (user == null || isBot(user)) {
            return;
          }
          calls.merge(user, 1L, Long::sum);
          String client = usage.getClientName();
          if (client != null && !client.isBlank() && usage.getTimestamp() != null) {
            // Keep the client name from the user's most-recent call in the window. Rolls forward
            // naturally if a user switches IDE mid-window.
            Long previousTs = latestClientTs.get(user);
            if (previousTs == null || usage.getTimestamp() > previousTs) {
              latestClient.put(user, client);
              latestClientTs.put(user, usage.getTimestamp());
            }
          }
        });
    Map<String, Map<String, Object>> result = new LinkedHashMap<>();
    calls.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .forEach(
            e -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("calls", e.getValue());
              String client = latestClient.get(e.getKey());
              if (client != null) {
                row.put("client", client);
              }
              result.put(e.getKey(), row);
            });
    return result;
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

  static String isoDate(long epochMillis) {
    return LocalDate.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneOffset.UTC).toString();
  }

  static boolean isBot(String principal) {
    if (principal == null) {
      return false;
    }
    return principal.endsWith(BOT_SUFFIX_PASCAL) || principal.endsWith(BOT_SUFFIX_KEBAB);
  }

  private static void seedEmptyOkFailDays(
      Map<String, Map<String, Long>> daily, long from, long to) {
    long cursor = startOfDay(from);
    long lastDay = startOfDay(to - 1);
    while (cursor <= lastDay) {
      Map<String, Long> row = new LinkedHashMap<>();
      row.put("ok", 0L);
      row.put("fail", 0L);
      daily.put(isoDate(cursor), row);
      cursor = cursor + Duration.ofDays(1).toMillis();
    }
  }

  static double average(List<Long> samples) {
    if (samples.isEmpty()) {
      return 0.0;
    }
    long sum = 0;
    for (Long s : samples) {
      sum += s;
    }
    return Math.round((double) sum / samples.size() * 10.0) / 10.0;
  }

  /**
   * Nearest-rank percentile over an unsorted list. Sort is local so the caller doesn't have to
   * pre-order; samples list is bounded by {@link #MAX_LATENCY_SAMPLES} entries, so the O(n log n)
   * cost is dominated by the surrounding aggregation pass.
   */
  static long percentile(List<Long> samples, int p) {
    if (samples.isEmpty()) {
      return 0L;
    }
    List<Long> sorted = new ArrayList<>(samples);
    Collections.sort(sorted);
    int idx =
        Math.min(sorted.size() - 1, Math.max(0, (int) Math.ceil((p / 100.0) * sorted.size()) - 1));
    return sorted.get(idx);
  }

  /**
   * Bounded latency accumulator that switches to reservoir sampling once it sees more than
   * {@link #MAX_LATENCY_SAMPLES} entries. Caps heap usage at ~80KB per bucket while keeping
   * percentile estimates statistically valid even for tools that handle millions of calls in the
   * aggregation window. Not thread-safe; one instance is owned per aggregation bucket and only
   * touched on the request thread.
   */
  static final class LatencySample {
    private final List<Long> samples = new ArrayList<>();
    private long seen = 0L;

    void add(long value) {
      seen++;
      if (samples.size() < MAX_LATENCY_SAMPLES) {
        samples.add(value);
      } else {
        long idx = ThreadLocalRandom.current().nextLong(seen);
        if (idx < MAX_LATENCY_SAMPLES) {
          samples.set((int) idx, value);
        }
      }
    }

    boolean isEmpty() {
      return samples.isEmpty();
    }

    List<Long> values() {
      return samples;
    }
  }
}
