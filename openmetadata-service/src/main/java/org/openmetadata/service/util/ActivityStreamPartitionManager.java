/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.util;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Manages time-based partitions for the activity_stream table.
 *
 * <p>This class handles:
 * <ul>
 *   <li>Creating new monthly partitions ahead of time (e.g., next 3 months)</li>
 *   <li>Dropping old partitions based on retention policy</li>
 *   <li>Handling MySQL vs PostgreSQL partition syntax differences</li>
 * </ul>
 *
 * <p>Called by DataRetention app on a scheduled basis.
 */
@Slf4j
public class ActivityStreamPartitionManager {

  private static final String TABLE_NAME = "activity_stream";
  private static final DateTimeFormatter PARTITION_NAME_FORMAT =
      DateTimeFormatter.ofPattern("yyyy_MM");

  private final Jdbi jdbi;
  private final ConnectionType connectionType;

  public ActivityStreamPartitionManager() {
    this.jdbi = Entity.getJdbi();
    String driverClass =
        OpenMetadataApplicationConfigHolder.getInstance().getDataSourceFactory().getDriverClass();
    this.connectionType = ConnectionType.from(driverClass);
  }

  public ActivityStreamPartitionManager(Jdbi jdbi, ConnectionType connectionType) {
    this.jdbi = jdbi;
    this.connectionType = connectionType;
  }

  /**
   * Ensures partitions exist for the next N months and drops partitions older than retention days.
   *
   * @param monthsAhead Number of months to create partitions for (e.g., 3)
   * @param retentionDays Days to retain activity data (e.g., 30)
   * @return Summary of partition operations
   */
  public PartitionMaintenanceResult maintainPartitions(int monthsAhead, int retentionDays) {
    List<String> created = new ArrayList<>();
    List<String> dropped = new ArrayList<>();
    List<String> errors = new ArrayList<>();

    try {
      // Create future partitions
      YearMonth currentMonth = YearMonth.now(ZoneOffset.UTC);
      for (int i = 0; i <= monthsAhead; i++) {
        YearMonth targetMonth = currentMonth.plusMonths(i);
        try {
          if (createPartitionIfNotExists(targetMonth)) {
            created.add(getPartitionName(targetMonth));
          }
        } catch (Exception e) {
          String error =
              String.format("Failed to create partition for %s: %s", targetMonth, e.getMessage());
          LOG.error(error, e);
          errors.add(error);
        }
      }

      // Drop old partitions
      long cutoffTimestamp =
          Instant.now().minusSeconds(retentionDays * 24L * 60 * 60).toEpochMilli();
      YearMonth cutoffMonth =
          YearMonth.from(Instant.ofEpochMilli(cutoffTimestamp).atZone(ZoneOffset.UTC));

      // Go back up to 24 months to find old partitions to drop
      for (int i = 1; i <= 24; i++) {
        YearMonth oldMonth = cutoffMonth.minusMonths(i);
        try {
          if (dropPartitionIfExists(oldMonth)) {
            dropped.add(getPartitionName(oldMonth));
          }
        } catch (Exception e) {
          String error =
              String.format("Failed to drop partition for %s: %s", oldMonth, e.getMessage());
          LOG.error(error, e);
          errors.add(error);
        }
      }

    } catch (Exception e) {
      LOG.error("Partition maintenance failed", e);
      errors.add("Partition maintenance failed: " + e.getMessage());
    }

    return new PartitionMaintenanceResult(created, dropped, errors);
  }

  /**
   * Creates a partition for the given month if it doesn't already exist.
   *
   * @return true if partition was created, false if it already existed
   */
  public boolean createPartitionIfNotExists(YearMonth month) {
    String partitionName = getPartitionName(month);

    if (partitionExists(partitionName)) {
      LOG.debug("Partition {} already exists", partitionName);
      return false;
    }

    long startTs = month.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
    long endTs =
        month.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();

    if (connectionType == ConnectionType.POSTGRES) {
      createPostgresPartition(partitionName, startTs, endTs);
    } else {
      createMysqlPartition(partitionName, endTs);
    }

    LOG.info("Created partition {} for {} (range: {} to {})", partitionName, month, startTs, endTs);
    return true;
  }

  /**
   * Drops a partition for the given month if it exists.
   *
   * @return true if partition was dropped, false if it didn't exist
   */
  public boolean dropPartitionIfExists(YearMonth month) {
    String partitionName = getPartitionName(month);

    if (!partitionExists(partitionName)) {
      return false;
    }

    if (connectionType == ConnectionType.POSTGRES) {
      dropPostgresPartition(partitionName);
    } else {
      dropMysqlPartition(partitionName);
    }

    LOG.info("Dropped partition {} for {}", partitionName, month);
    return true;
  }

  private boolean partitionExists(String partitionName) {
    return jdbi.withHandle(
        handle -> {
          if (connectionType == ConnectionType.POSTGRES) {
            return handle
                    .createQuery("SELECT COUNT(*) FROM pg_tables WHERE tablename = :partitionName")
                    .bind("partitionName", partitionName)
                    .mapTo(Integer.class)
                    .one()
                > 0;
          } else {
            return handle
                    .createQuery(
                        "SELECT COUNT(*) FROM information_schema.partitions "
                            + "WHERE table_schema = DATABASE() "
                            + "AND table_name = :tableName "
                            + "AND partition_name = :partitionName")
                    .bind("tableName", TABLE_NAME)
                    .bind("partitionName", partitionName)
                    .mapTo(Integer.class)
                    .one()
                > 0;
          }
        });
  }

  private void createPostgresPartition(String partitionName, long startTs, long endTs) {
    jdbi.useHandle(
        handle -> {
          // First, we need to detach the default partition, create the new one, then reattach
          // This is because PostgreSQL won't allow overlapping partitions

          // Check if default partition has data in our range
          boolean hasDataInRange =
              handle
                      .createQuery(
                          "SELECT COUNT(*) FROM activity_stream_default "
                              + "WHERE timestamp >= :start AND timestamp < :end")
                      .bind("start", startTs)
                      .bind("end", endTs)
                      .mapTo(Integer.class)
                      .one()
                  > 0;

          if (hasDataInRange) {
            // Need to move data: detach default, create new partition, move data, reattach default
            handle.execute("ALTER TABLE activity_stream DETACH PARTITION activity_stream_default");

            handle.execute(
                String.format(
                    "CREATE TABLE %s PARTITION OF activity_stream FOR VALUES FROM (%d) TO (%d)",
                    partitionName, startTs, endTs));

            // Move data from default to new partition
            handle.execute(
                String.format(
                    "INSERT INTO %s SELECT * FROM activity_stream_default "
                        + "WHERE timestamp >= %d AND timestamp < %d",
                    partitionName, startTs, endTs));

            handle.execute(
                String.format(
                    "DELETE FROM activity_stream_default WHERE timestamp >= %d AND timestamp < %d",
                    startTs, endTs));

            // Reattach default partition
            handle.execute(
                "ALTER TABLE activity_stream ATTACH PARTITION activity_stream_default DEFAULT");
          } else {
            // No data conflict, just detach default, create, reattach
            handle.execute("ALTER TABLE activity_stream DETACH PARTITION activity_stream_default");

            handle.execute(
                String.format(
                    "CREATE TABLE %s PARTITION OF activity_stream FOR VALUES FROM (%d) TO (%d)",
                    partitionName, startTs, endTs));

            handle.execute(
                "ALTER TABLE activity_stream ATTACH PARTITION activity_stream_default DEFAULT");
          }
        });
  }

  private void createMysqlPartition(String partitionName, long endTs) {
    jdbi.useHandle(
        handle -> {
          // MySQL: REORGANIZE the p_max partition to split it
          // This moves any existing data in p_max that belongs to the new partition

          handle.execute(
              String.format(
                  "ALTER TABLE %s REORGANIZE PARTITION p_max INTO ("
                      + "PARTITION %s VALUES LESS THAN (%d), "
                      + "PARTITION p_max VALUES LESS THAN MAXVALUE"
                      + ")",
                  TABLE_NAME, partitionName, endTs));
        });
  }

  private void dropPostgresPartition(String partitionName) {
    jdbi.useHandle(
        handle -> {
          // Detach and drop the partition
          handle.execute(
              String.format("ALTER TABLE %s DETACH PARTITION %s", TABLE_NAME, partitionName));
          handle.execute(String.format("DROP TABLE %s", partitionName));
        });
  }

  private void dropMysqlPartition(String partitionName) {
    jdbi.useHandle(
        handle -> {
          handle.execute(
              String.format("ALTER TABLE %s DROP PARTITION %s", TABLE_NAME, partitionName));
        });
  }

  private String getPartitionName(YearMonth month) {
    return TABLE_NAME + "_p_" + month.format(PARTITION_NAME_FORMAT);
  }

  /** Result of partition maintenance operation. */
  public record PartitionMaintenanceResult(
      List<String> created, List<String> dropped, List<String> errors) {

    public boolean hasErrors() {
      return !errors.isEmpty();
    }

    public int totalOperations() {
      return created.size() + dropped.size();
    }

    @Override
    public String toString() {
      return String.format(
          "PartitionMaintenanceResult{created=%d, dropped=%d, errors=%d}",
          created.size(), dropped.size(), errors.size());
    }
  }
}
