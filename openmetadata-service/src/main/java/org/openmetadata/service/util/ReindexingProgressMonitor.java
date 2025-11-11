package org.openmetadata.service.util;

import java.text.DecimalFormat;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

/**
 * Progress monitor for reindexing operations that provides clean, formatted console output
 * with real-time progress tracking and summary tables.
 */
@Slf4j
public class ReindexingProgressMonitor {

  private final List<String> changedEntities;
  private final Map<String, EntityProgress> entityProgress;
  private final Instant startTime;
  private final AtomicLong totalProcessed;
  private final AtomicLong totalRecords;
  private final AtomicInteger currentEntityIndex;
  private String currentEntity;
  private boolean isCompleted;

  public ReindexingProgressMonitor(List<String> changedEntities) {
    this.changedEntities = changedEntities;
    this.entityProgress = new HashMap<>();
    this.startTime = Instant.now();
    this.totalProcessed = new AtomicLong(0);
    this.totalRecords = new AtomicLong(0);
    this.currentEntityIndex = new AtomicInteger(0);
    this.isCompleted = false;

    // Initialize progress for each entity
    for (String entity : changedEntities) {
      entityProgress.put(entity, new EntityProgress());
    }
  }

  public void printInitialSummary() {
    LOG.info("");
    LOG.info("🔄 Smart Reindexing Summary");
    LOG.info("═".repeat(80));
    LOG.info("📊 Entities with mapping changes: {}", changedEntities.size());
    LOG.info("🎯 Entities to reindex: {}", String.join(", ", changedEntities));
    LOG.info(
        "⏱️  Started at: {}",
        java.time.LocalDateTime.now()
            .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
    LOG.info("");
    LOG.info("⏳ Reindexing in progress...");
    LOG.info("   This may take several minutes depending on the number of entities.");
    LOG.info("");
  }

  public void updateEntityProgress(String entityType, long processed, long total, long failed) {
    EntityProgress progress = entityProgress.get(entityType);
    if (progress != null) {
      progress.processed = processed;
      progress.total = total;
      progress.failed = failed;
      progress.isActive = true;
      this.currentEntity = entityType;

      // Update totals
      updateTotals();
      printProgressTable();
    }
  }

  public void markEntityCompleted(String entityType) {
    EntityProgress progress = entityProgress.get(entityType);
    if (progress != null) {
      progress.isCompleted = true;
      progress.isActive = false;
      currentEntityIndex.incrementAndGet();
    }
  }

  public void markCompleted() {
    this.isCompleted = true;
    printFinalSummary();
  }

  public void markCompleted(long totalRecords, long successRecords, long failedRecords) {
    this.isCompleted = true;
    this.totalProcessed.set(successRecords + failedRecords);
    this.totalRecords.set(totalRecords);
    printFinalSummary(successRecords, failedRecords);
  }

  private void updateTotals() {
    long totalProc = 0;
    long totalRec = 0;

    for (EntityProgress progress : entityProgress.values()) {
      totalProc += progress.processed;
      totalRec += progress.total;
    }

    this.totalProcessed.set(totalProc);
    this.totalRecords.set(totalRec);
  }

  private void printProgressTable() {
    if (isCompleted) return;

    Duration elapsed = Duration.between(startTime, Instant.now());
    String elapsedStr = formatDuration(elapsed);

    LOG.info("📈 Reindexing Progress");
    LOG.info("─".repeat(80));
    LOG.info(
        "⏱️  Elapsed: {} | 🎯 Current: {} | 📊 Overall: {}/{} ({})",
        elapsedStr,
        currentEntity != null ? currentEntity : "Starting...",
        String.format("%,d", totalProcessed.get()),
        String.format("%,d", totalRecords.get()),
        formatPercentage(totalProcessed.get(), totalRecords.get()));
    LOG.info("");

    // Table header
    LOG.info(
        String.format(
            "%-20s %-12s %-15s %-12s %-10s", "Entity", "Status", "Progress", "Records", "Failed"));
    LOG.info("─".repeat(80));

    // Table rows
    for (String entity : changedEntities) {
      EntityProgress progress = entityProgress.get(entity);
      String status = getStatusIcon(progress);
      String progressStr = formatProgress(progress.processed, progress.total);
      String recordsStr = String.format("%,d", progress.total);
      String failedStr = progress.failed > 0 ? String.format("%,d", progress.failed) : "-";

      LOG.info(
          String.format(
              "%-20s %-12s %-15s %-12s %-10s",
              entity.length() > 18 ? entity.substring(0, 18) + ".." : entity,
              status,
              progressStr,
              recordsStr,
              failedStr));
    }

    LOG.info("");
  }

  private void printFinalSummary() {
    Duration elapsed = Duration.between(startTime, Instant.now());
    long totalFailed = entityProgress.values().stream().mapToLong(p -> p.failed).sum();

    LOG.info("");
    LOG.info("✅ Reindexing Completed");
    LOG.info("═".repeat(80));
    LOG.info("⏱️  Total time: {}", formatDuration(elapsed));
    LOG.info("📊 Records processed: {}", String.format("%,d", totalProcessed.get()));
    LOG.info(
        "✅ Successfully indexed: {}", String.format("%,d", totalProcessed.get() - totalFailed));
    if (totalFailed > 0) {
      LOG.info("❌ Failed: {}", String.format("%,d", totalFailed));
    }

    // Show entities with issues
    boolean hasIssues = false;
    for (Map.Entry<String, EntityProgress> entry : entityProgress.entrySet()) {
      if (entry.getValue().failed > 0) {
        if (!hasIssues) {
          LOG.info("");
          LOG.info("⚠️  Entities with indexing issues:");
          hasIssues = true;
        }
        LOG.info(
            "   • {}: {} failed", entry.getKey(), String.format("%,d", entry.getValue().failed));
      }
    }

    LOG.info("✅ Index mapping versions updated for future change detection");
    LOG.info("");
  }

  private void printFinalSummary(long successRecords, long failedRecords) {
    Duration elapsed = Duration.between(startTime, Instant.now());

    LOG.info("");
    LOG.info("✅ Reindexing Completed");
    LOG.info("═".repeat(80));
    LOG.info("⏱️  Total time: {}", formatDuration(elapsed));
    LOG.info("📊 Total entities: {}", changedEntities.size());
    LOG.info("✅ Successfully indexed: {}", String.format("%,d", successRecords));
    if (failedRecords > 0) {
      LOG.info("❌ Failed: {}", String.format("%,d", failedRecords));
    }
    LOG.info("✅ Index mapping versions updated for future change detection");
    LOG.info("");
  }

  private String getStatusIcon(EntityProgress progress) {
    if (progress.isCompleted) {
      return progress.failed > 0 ? "⚠️  Done" : "✅ Done";
    } else if (progress.isActive) {
      return "🔄 Active";
    } else if (progress.total > 0) {
      return "⏳ Queued";
    } else {
      return "⏸️  Pending";
    }
  }

  private String formatProgress(long processed, long total) {
    if (total == 0) return "0%";

    double percentage = ((double) processed / total) * 100;
    int bars = (int) (percentage / 5); // 20 bars total

    StringBuilder progress = new StringBuilder();
    progress.append("█".repeat(Math.max(0, bars)));
    progress.append("░".repeat(Math.max(0, 20 - bars)));
    progress.append(String.format(" %s", formatPercentage(processed, total)));

    return progress.toString();
  }

  private String formatPercentage(long processed, long total) {
    if (total == 0) return "0%";
    double percentage = ((double) processed / total) * 100;
    return new DecimalFormat("#0.0").format(percentage) + "%";
  }

  private String formatDuration(Duration duration) {
    long seconds = duration.getSeconds();
    if (seconds < 60) {
      return seconds + "s";
    } else if (seconds < 3600) {
      return String.format("%dm %ds", seconds / 60, seconds % 60);
    } else {
      return String.format("%dh %dm", seconds / 3600, (seconds % 3600) / 60);
    }
  }

  private static class EntityProgress {
    long processed = 0;
    long total = 0;
    long failed = 0;
    boolean isActive = false;
    boolean isCompleted = false;
  }
}
