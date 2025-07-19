package org.openmetadata.service.apps.bundles.searchIndex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

@Slf4j
public class SlackWebApiClient {

  private static final String SLACK_API_BASE = "https://slack.com/api";
  private static final int CONNECTION_TIMEOUT_SECONDS = 10;
  private static final int API_TIMEOUT_SECONDS = 30;
  private static final double PERCENTAGE_MULTIPLIER = 100.0;
  private static final long MILLIS_PER_SECOND = 1000L;
  private static final int MAX_ENTITIES_ALL = 50;
  private static final int MAX_ENTITIES_DEFAULT = 25;
  private static final int ENTITY_NAME_MAX_LENGTH = 25;
  private static final int ENTITY_NAME_TRUNCATE_LENGTH = 22;
  private static final int PROGRESS_BAR_LENGTH = 20;
  private static final int PERCENTAGE_PER_BAR = 5;
  private static final int HTTP_OK = 200;
  private static final int SECONDS_PER_MINUTE = 60;
  private static final int SECONDS_PER_HOUR = 3600;
  private static final long UPDATE_INTERVAL_MS = 10000; // 10 seconds for real-time updates
  private static final String DEFAULT_INSTANCE_URL = "http://localhost:8585";
  private static final String ENTITY_SCOPE_ALL = "All";

  // Slack API field names
  private static final String FIELD_TEXT = "text";
  private static final String FIELD_BLOCKS = "blocks";
  private static final String FIELD_CHANNEL = "channel";
  private static final String FIELD_OK = "ok";
  private static final String FIELD_TS = "ts";
  private static final String FIELD_TYPE = "type";
  private static final String FIELD_HEADER = "header";
  private static final String FIELD_PLAIN_TEXT = "plain_text";
  private static final String FIELD_MRKDWN = "mrkdwn";
  private static final String FIELD_SECTION = "section";
  private static final String FIELD_DIVIDER = "divider";
  private static final String FIELD_FIELDS = "fields";

  // Slack API methods
  private static final String SLACK_CHAT_POST_MESSAGE = "chat.postMessage";
  private static final String SLACK_CHAT_UPDATE = "chat.update";

  private final String botToken;
  private final String channel;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final String instanceUrl;

  // Message tracking
  private String messageTimestamp = null;
  private String channelId = null;
  private long lastUpdateTime = 0;

  // Store initial message data
  private String entities;
  private boolean isSmartReindexing;
  private int totalEntities;
  private long startTime;

  public SlackWebApiClient(String botToken, String channel, String instanceUrl) {
    this.botToken = botToken;
    this.channel = channel;
    this.instanceUrl = instanceUrl;
    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(CONNECTION_TIMEOUT_SECONDS))
            .build();
    this.objectMapper = new ObjectMapper();
  }

  public void sendStartNotification(String entities, boolean isSmartReindexing, int totalEntities) {
    if (botToken == null || botToken.isEmpty()) return;

    this.entities = entities;
    this.isSmartReindexing = isSmartReindexing;
    this.totalEntities = totalEntities;
    this.startTime = System.currentTimeMillis();

    try {
      Map<String, String> params = new HashMap<>();
      params.put(FIELD_CHANNEL, channel);
      params.put(FIELD_BLOCKS, createInitialMessage().toString());
      params.put(FIELD_TEXT, "Reindexing started"); // Fallback text

      JsonNode response = callSlackApi(SLACK_CHAT_POST_MESSAGE, params);

      if (response != null && response.has(FIELD_OK) && response.get(FIELD_OK).asBoolean()) {
        messageTimestamp = response.get(FIELD_TS).asText();
        channelId = response.get(FIELD_CHANNEL).asText();
        LOG.info("Slack initial message posted successfully. Message ts: {}", messageTimestamp);
      } else {
        LOG.warn("Failed to post Slack message: {}", response);
      }

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while sending Slack start notification", e);
    } catch (Exception e) {
      LOG.warn("Failed to send Slack start notification", e);
    }
  }

  public void sendProgressUpdate(Stats stats) {
    if (botToken == null || botToken.isEmpty()) return;
    if (messageTimestamp == null || channelId == null) return;

    long currentTime = System.currentTimeMillis();
    if (currentTime - lastUpdateTime < UPDATE_INTERVAL_MS) {
      return; // Throttle updates
    }

    if (stats == null || stats.getJobStats() == null) return;

    try {
      Map<String, String> params = new HashMap<>();
      params.put(FIELD_CHANNEL, channelId);
      params.put(FIELD_TS, messageTimestamp);
      params.put(FIELD_BLOCKS, createProgressMessage(stats, "🔄 Processing...", null).toString());
      params.put(FIELD_TEXT, "Reindexing in progress"); // Fallback text

      JsonNode response = callSlackApi(SLACK_CHAT_UPDATE, params);

      if (response != null && response.get("ok").asBoolean()) {
        lastUpdateTime = currentTime;
        LOG.debug("Slack message updated successfully");
      } else {
        LOG.warn("Failed to update Slack message: {}", response);
      }

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while sending Slack progress update", e);
    } catch (Exception e) {
      LOG.warn("Failed to send Slack progress update", e);
    }
  }

  public void sendCompletionNotification(Stats finalStats, long elapsedSeconds, boolean hasErrors) {
    if (botToken == null || botToken.isEmpty()) return;
    if (messageTimestamp == null || channelId == null) return;

    try {
      String status = hasErrors ? "⚠️ Completed with Errors" : "✅ Completed Successfully";

      Map<String, String> params = new HashMap<>();
      params.put(FIELD_CHANNEL, channelId);
      params.put(FIELD_TS, messageTimestamp);
      params.put(
          FIELD_BLOCKS,
          createProgressMessage(finalStats, status, formatDuration(elapsedSeconds)).toString());
      params.put(FIELD_TEXT, "Reindexing completed"); // Fallback text

      callSlackApi(SLACK_CHAT_UPDATE, params);

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while sending Slack completion notification", e);
    } catch (Exception e) {
      LOG.warn("Failed to send Slack completion notification", e);
    }
  }

  public void sendNoChangesNotification() {
    if (botToken == null || botToken.isEmpty()) return;

    try {
      Map<String, String> params = new HashMap<>();
      params.put(FIELD_CHANNEL, channel);
      params.put(FIELD_BLOCKS, createNoChangesMessage().toString());
      params.put(FIELD_TEXT, "No reindexing needed"); // Fallback text

      callSlackApi(SLACK_CHAT_POST_MESSAGE, params);

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while sending Slack no changes notification", e);
    } catch (Exception e) {
      LOG.warn("Failed to send Slack no changes notification", e);
    }
  }

  public void sendErrorNotification(String error) {
    if (botToken == null || botToken.isEmpty()) return;
    if (messageTimestamp == null || channelId == null) return;

    try {
      ObjectNode errorMessage = createErrorMessage(error);
      Map<String, String> params = new HashMap<>();
      params.put(FIELD_CHANNEL, channelId);
      params.put(FIELD_TS, messageTimestamp);
      params.put(FIELD_BLOCKS, errorMessage.toString());
      params.put(FIELD_TEXT, "❌Reindexing failed");
      callSlackApi(SLACK_CHAT_UPDATE, params);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while sending Slack error notification", e);
    } catch (Exception e) {
      LOG.warn("Failed to send Slack error notification", e);
    }
  }

  private ArrayNode createInitialMessage() {
    ArrayNode blocks = objectMapper.createArrayNode();

    // Header
    ObjectNode headerBlock = objectMapper.createObjectNode();
    headerBlock.put(FIELD_TYPE, FIELD_HEADER);
    ObjectNode headerText = objectMapper.createObjectNode();
    headerText.put(FIELD_TYPE, FIELD_PLAIN_TEXT);
    headerText.put(FIELD_TEXT, "🚀 Reindexing Started");
    headerBlock.set(FIELD_TEXT, headerText);
    blocks.add(headerBlock);

    // Instance URL section - always show it prominently
    ObjectNode instanceSection = objectMapper.createObjectNode();
    instanceSection.put(FIELD_TYPE, FIELD_SECTION);
    ObjectNode instanceText = objectMapper.createObjectNode();
    instanceText.put(FIELD_TYPE, FIELD_MRKDWN);
    instanceText.put(FIELD_TEXT, formatInstanceUrl());
    instanceSection.set(FIELD_TEXT, instanceText);
    blocks.add(instanceSection);

    // Divider
    blocks.add(createDividerBlock());

    // Configuration section
    ObjectNode configSection = objectMapper.createObjectNode();
    configSection.put(FIELD_TYPE, FIELD_SECTION);
    ObjectNode configText = objectMapper.createObjectNode();
    configText.put(FIELD_TYPE, FIELD_MRKDWN);
    configText.put(
        FIELD_TEXT,
        String.format(
            "*Configuration*\n"
                + "• Type: `%s`\n"
                + "• Entities: `%d` entities\n"
                + "• Scope: %s\n"
                + "• Status: ⏳ Initializing...",
            isSmartReindexing ? "Smart Reindexing" : "Full Reindexing", totalEntities, entities));
    configSection.set(FIELD_TEXT, configText);
    blocks.add(configSection);

    return blocks;
  }

  private ArrayNode createProgressMessage(Stats stats, String status, String duration) {
    ArrayNode blocks = objectMapper.createArrayNode();

    blocks.add(createHeaderBlock(getHeaderText(status)));
    blocks.add(createInstanceStatusSection(status));
    blocks.add(createDividerBlock());
    blocks.add(createConfigurationSection(duration));

    if (stats != null && stats.getJobStats() != null) {
      long processed =
          stats.getJobStats().getSuccessRecords() != null
              ? stats.getJobStats().getSuccessRecords()
              : 0;
      long total =
          stats.getJobStats().getTotalRecords() != null ? stats.getJobStats().getTotalRecords() : 0;
      long failed =
          stats.getJobStats().getFailedRecords() != null
              ? stats.getJobStats().getFailedRecords()
              : 0;

      double percentage = total > 0 ? (processed * PERCENTAGE_MULTIPLIER / total) : 0;
      blocks.add(createDividerBlock());

      ObjectNode progressSection = objectMapper.createObjectNode();
      progressSection.put(FIELD_TYPE, FIELD_SECTION);

      ObjectNode progressText = objectMapper.createObjectNode();
      progressText.put(FIELD_TYPE, FIELD_MRKDWN);
      progressText.put(FIELD_TEXT, "*Progress*");
      progressSection.set(FIELD_TEXT, progressText);

      ArrayNode progressFields = objectMapper.createArrayNode();

      String progressBar = createVisualProgressBar(percentage);
      ObjectNode progressField = objectMapper.createObjectNode();
      progressField.put(FIELD_TYPE, FIELD_MRKDWN);
      progressField.put(
          FIELD_TEXT,
          String.format(
              "*Overall Progress*\n%s\n`%,d / %,d` (%.1f%%)",
              progressBar, processed, total, percentage));
      progressFields.add(progressField);

      // Throughput and ETA
      if (processed > 0) {
        long elapsedSeconds = (System.currentTimeMillis() - startTime) / MILLIS_PER_SECOND;
        if (elapsedSeconds > 0) {
          double throughput = processed / (double) elapsedSeconds;

          ObjectNode metricsField = objectMapper.createObjectNode();
          metricsField.put(FIELD_TYPE, FIELD_MRKDWN);

          StringBuilder metrics = new StringBuilder("*Performance* \n");
          metrics.append(String.format("⚡ `%.0f` records/sec\n", throughput));

          if (total > processed) {
            long remaining = total - processed;
            long etaSeconds = (long) (remaining / throughput);
            metrics.append(String.format("⏱️ ETA: `%s`", formatDuration(etaSeconds)));
          }

          metricsField.put(FIELD_TEXT, metrics.toString());
          progressFields.add(metricsField);
        }
      }

      if (failed > 0) {
        ObjectNode failedField = objectMapper.createObjectNode();
        failedField.put(FIELD_TYPE, FIELD_MRKDWN);
        failedField.put("text", String.format("*Issues*\n⚠️ `%,d` failed records", failed));
        progressFields.add(failedField);
      }

      progressSection.set(FIELD_FIELDS, progressFields);
      blocks.add(progressSection);

      if (stats.getEntityStats() != null
          && stats.getEntityStats().getAdditionalProperties() != null
          && stats.getEntityStats().getAdditionalProperties().size() > 1) {

        blocks.add(createDividerBlock());

        ObjectNode entitySection = objectMapper.createObjectNode();
        entitySection.put(FIELD_TYPE, FIELD_SECTION);
        ObjectNode entityText = objectMapper.createObjectNode();
        entityText.put(FIELD_TYPE, FIELD_MRKDWN);

        AtomicInteger entitiesWithFailures = new AtomicInteger(0);
        AtomicInteger entitiesIncomplete = new AtomicInteger(0);
        AtomicInteger entityCount = new AtomicInteger(0);

        StringBuilder entityBreakdown = new StringBuilder("*Entity Breakdown* \n```\n");

        // Sort entities: failures first, then incomplete, then successful (alphabetically within
        // each group)
        stats.getEntityStats().getAdditionalProperties().entrySet().stream()
            .sorted(
                (e1, e2) -> {
                  // Extract stats for comparison
                  StepStats stats1 = e1.getValue();
                  StepStats stats2 = e2.getValue();

                  long failed1 = stats1.getFailedRecords() != null ? stats1.getFailedRecords() : 0;
                  long failed2 = stats2.getFailedRecords() != null ? stats2.getFailedRecords() : 0;
                  long processed1 =
                      stats1.getSuccessRecords() != null ? stats1.getSuccessRecords() : 0;
                  long processed2 =
                      stats2.getSuccessRecords() != null ? stats2.getSuccessRecords() : 0;
                  long total1 = stats1.getTotalRecords() != null ? stats1.getTotalRecords() : 0;
                  long total2 = stats2.getTotalRecords() != null ? stats2.getTotalRecords() : 0;

                  if (failed1 > 0 && failed2 == 0) return -1;
                  if (failed1 == 0 && failed2 > 0) return 1;

                  boolean incomplete1 = total1 > 0 && processed1 < total1;
                  boolean incomplete2 = total2 > 0 && processed2 < total2;
                  if (incomplete1 && !incomplete2) return -1;
                  if (!incomplete1 && incomplete2) return 1;

                  return e1.getKey().compareTo(e2.getKey());
                })
            .forEach(
                entry -> {
                  String entity = entry.getKey();
                  Object entityStatsObj = entry.getValue();

                  if (entityStatsObj instanceof StepStats entityStats) {
                    long entityProcessed =
                        entityStats.getSuccessRecords() != null
                            ? entityStats.getSuccessRecords()
                            : 0;
                    long entityFailed =
                        entityStats.getFailedRecords() != null ? entityStats.getFailedRecords() : 0;
                    long entityTotal =
                        entityStats.getTotalRecords() != null ? entityStats.getTotalRecords() : 0;

                    if (entityTotal > 0) {
                      entityCount.incrementAndGet();

                      // Limit entities to avoid Slack's 3000 character limit
                      // Show more entities when "All" is selected, but still have a reasonable
                      // limit
                      boolean showAllEntities = entities.equals(ENTITY_SCOPE_ALL);
                      int maxEntities = showAllEntities ? MAX_ENTITIES_ALL : MAX_ENTITIES_DEFAULT;
                      if (entityCount.get() <= maxEntities) {
                        String statusEmoji;
                        if (entityFailed > 0) {
                          statusEmoji = "❌"; // Has failures
                          entitiesWithFailures.incrementAndGet();
                        } else if (entityProcessed < entityTotal) {
                          statusEmoji = "⚠️"; // Incomplete
                          entitiesIncomplete.incrementAndGet();
                        } else {
                          statusEmoji = "✅"; // Complete success
                        }

                        String displayEntity =
                            entity.length() > ENTITY_NAME_MAX_LENGTH
                                ? entity.substring(0, ENTITY_NAME_TRUNCATE_LENGTH) + "..."
                                : entity;

                        entityBreakdown.append(
                            String.format(
                                "%s %-25s %,7d / %,7d",
                                statusEmoji, displayEntity, entityProcessed, entityTotal));

                        double entityPercentage =
                            (entityProcessed * PERCENTAGE_MULTIPLIER) / entityTotal;
                        entityBreakdown.append(String.format("  %6.1f%%", entityPercentage));

                        if (entityFailed > 0) {
                          entityBreakdown.append(String.format(" [%d failed]", entityFailed));
                        }

                        entityBreakdown.append("\n");
                      } else {
                        if (entityFailed > 0) {
                          entitiesWithFailures.incrementAndGet();
                        } else if (entityProcessed < entityTotal) {
                          entitiesIncomplete.incrementAndGet();
                        }
                      }
                    }
                  }
                });

        int maxEntities = entities.equals("All") ? 50 : 25;
        if (entityCount.get() > maxEntities) {
          int hiddenSuccessful =
              Math.max(
                  0,
                  entityCount.get()
                      - maxEntities
                      - entitiesWithFailures.get()
                      - entitiesIncomplete.get());
          if (hiddenSuccessful > 0) {
            entityBreakdown.append(
                String.format("... and %d more successful entities\n", hiddenSuccessful));
          }
        }

        entityBreakdown.append("```");

        // Add summary if there are issues
        if (entitiesWithFailures.get() > 0 || entitiesIncomplete.get() > 0) {
          entityBreakdown.append("\n");
          if (entitiesWithFailures.get() > 0) {
            entityBreakdown.append(
                String.format("❌ *%d entities with failures*\n", entitiesWithFailures.get()));
          }
          if (entitiesIncomplete.get() > 0) {
            entityBreakdown.append(
                String.format("⚠️ *%d entities incomplete*\n", entitiesIncomplete.get()));
          }
        }

        entityText.put(FIELD_TEXT, entityBreakdown.toString());
        entitySection.set(FIELD_TEXT, entityText);
        blocks.add(entitySection);
      }
    }

    return blocks;
  }

  private ObjectNode createErrorMessage(String error) {
    ObjectNode payload = objectMapper.createObjectNode();
    ArrayNode blocks = objectMapper.createArrayNode();

    ObjectNode headerBlock = objectMapper.createObjectNode();
    headerBlock.put(FIELD_TYPE, FIELD_HEADER);
    ObjectNode headerText = objectMapper.createObjectNode();
    headerText.put(FIELD_TYPE, FIELD_PLAIN_TEXT);
    headerText.put(FIELD_TEXT, "❌ Reindexing Failed");
    headerBlock.set(FIELD_TEXT, headerText);
    blocks.add(headerBlock);

    ObjectNode errorSection = objectMapper.createObjectNode();
    errorSection.put(FIELD_TYPE, FIELD_SECTION);
    ObjectNode errorText = objectMapper.createObjectNode();
    errorText.put(FIELD_TYPE, FIELD_MRKDWN);
    errorText.put(FIELD_TEXT, String.format("*Error Details*\n```\n%s\n```", error));
    errorSection.set(FIELD_TEXT, errorText);
    blocks.add(errorSection);

    payload.set(FIELD_BLOCKS, blocks);
    return payload;
  }

  private ArrayNode createNoChangesMessage() {
    ArrayNode blocks = objectMapper.createArrayNode();

    ObjectNode headerBlock = objectMapper.createObjectNode();
    headerBlock.put(FIELD_TYPE, FIELD_HEADER);
    ObjectNode headerText = objectMapper.createObjectNode();
    headerText.put(FIELD_TYPE, FIELD_PLAIN_TEXT);
    headerText.put(FIELD_TEXT, "✅ No Reindexing Needed");
    headerBlock.set("text", headerText);
    blocks.add(headerBlock);

    ObjectNode instanceSection = objectMapper.createObjectNode();
    instanceSection.put(FIELD_TYPE, FIELD_SECTION);
    ObjectNode instanceText = objectMapper.createObjectNode();
    instanceText.put(FIELD_TYPE, FIELD_MRKDWN);
    instanceText.put(FIELD_TEXT, formatInstanceUrl());
    instanceSection.set(FIELD_TEXT, instanceText);
    blocks.add(instanceSection);

    blocks.add(createDividerBlock());

    ObjectNode messageSection = objectMapper.createObjectNode();
    messageSection.put(FIELD_TYPE, FIELD_SECTION);
    ObjectNode messageText = objectMapper.createObjectNode();
    messageText.put(FIELD_TYPE, FIELD_MRKDWN);
    messageText.put(
        "text",
        "*Smart Reindexing Check*\n"
            + "No index mapping changes detected since the last reindexing.\n\n"
            + "_All search indexes are up to date. Reindexing has been skipped._");
    messageSection.set("text", messageText);
    blocks.add(messageSection);

    return blocks;
  }

  private String createVisualProgressBar(double percentage) {
    int filledBars = (int) (percentage / PERCENTAGE_PER_BAR);

    StringBuilder bar = new StringBuilder();

    for (int i = 0; i < filledBars && i < PROGRESS_BAR_LENGTH; i++) {
      bar.append("▓");
    }

    bar.append("░".repeat(Math.max(0, PROGRESS_BAR_LENGTH - filledBars)));

    return bar.toString();
  }

  private String getHeaderText(String status) {
    if (status.contains("Completed")) return "✅ Reindexing Completed";
    if (status.contains("Failed") || status.contains("Error")) return "❌ Reindexing Failed";
    if (status.contains("Processing")) return "🔄 Reindexing in Progress";
    return "🚀 Reindexing";
  }

  private JsonNode callSlackApi(String method, Map<String, String> params)
      throws IOException, InterruptedException {
    StringBuilder formData = new StringBuilder();
    for (Map.Entry<String, String> entry : params.entrySet()) {
      if (!formData.isEmpty()) {
        formData.append("&");
      }
      formData.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
      formData.append("=");
      formData.append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
    }

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SLACK_API_BASE + "/" + method))
            .header("Authorization", "Bearer " + botToken)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formData.toString()))
            .timeout(Duration.ofSeconds(API_TIMEOUT_SECONDS))
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != HTTP_OK) {
      LOG.warn("Slack API returned status {}: {}", response.statusCode(), response.body());
      return null;
    }

    return objectMapper.readTree(response.body());
  }

  private String formatDuration(long seconds) {
    if (seconds < SECONDS_PER_MINUTE) {
      return seconds + "s";
    } else if (seconds < SECONDS_PER_HOUR) {
      return String.format("%dm %ds", seconds / SECONDS_PER_MINUTE, seconds % SECONDS_PER_MINUTE);
    } else {
      return String.format(
          "%dh %dm %ds",
          seconds / SECONDS_PER_HOUR,
          (seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
          seconds % SECONDS_PER_MINUTE);
    }
  }

  private String formatInstanceUrl() {
    String url = instanceUrl != null ? instanceUrl : DEFAULT_INSTANCE_URL;
    return String.format("*Instance:* <%s|%s>", url, url);
  }

  private ObjectNode createDividerBlock() {
    ObjectNode divider = objectMapper.createObjectNode();
    divider.put(FIELD_TYPE, FIELD_DIVIDER);
    return divider;
  }

  private ObjectNode createHeaderBlock(String text) {
    ObjectNode headerBlock = objectMapper.createObjectNode();
    headerBlock.put(FIELD_TYPE, FIELD_HEADER);
    ObjectNode headerText = objectMapper.createObjectNode();
    headerText.put(FIELD_TYPE, FIELD_PLAIN_TEXT);
    headerText.put(FIELD_TEXT, text);
    headerBlock.set(FIELD_TEXT, headerText);
    return headerBlock;
  }

  private ObjectNode createInstanceStatusSection(String status) {
    ObjectNode section = objectMapper.createObjectNode();
    section.put(FIELD_TYPE, FIELD_SECTION);
    ArrayNode fields = objectMapper.createArrayNode();

    ObjectNode instanceField = objectMapper.createObjectNode();
    instanceField.put(FIELD_TYPE, FIELD_MRKDWN);
    String url = instanceUrl != null ? instanceUrl : DEFAULT_INSTANCE_URL;
    instanceField.put(FIELD_TEXT, String.format("*Instance*\n<%s|%s>", url, url));
    fields.add(instanceField);

    ObjectNode statusField = objectMapper.createObjectNode();
    statusField.put(FIELD_TYPE, FIELD_MRKDWN);
    statusField.put(FIELD_TEXT, String.format("*Status*\n%s", status));
    fields.add(statusField);

    section.set(FIELD_FIELDS, fields);
    return section;
  }

  private ObjectNode createConfigurationSection(String duration) {
    ObjectNode configSection = objectMapper.createObjectNode();
    configSection.put(FIELD_TYPE, FIELD_SECTION);
    ObjectNode configText = objectMapper.createObjectNode();
    configText.put(FIELD_TYPE, FIELD_MRKDWN);

    StringBuilder config = new StringBuilder();
    config.append("*Configuration*\n");
    config.append(
        String.format(
            "• Type: `%s`\n", isSmartReindexing ? "Smart Reindexing" : "Full Reindexing"));
    config.append(String.format("• Entities: `%d` entities\n", totalEntities));
    config.append(String.format("• Scope: %s\n", entities));
    if (duration != null) {
      config.append(String.format("• Duration: `%s`\n", duration));
    }

    configText.put(FIELD_TEXT, config.toString());
    configSection.set(FIELD_TEXT, configText);
    return configSection;
  }
}
