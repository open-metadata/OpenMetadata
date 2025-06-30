package org.openmetadata.service.migration.utils.v141;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class MigrationUtil {
  private static final long MAX_SECONDS_TIMESTAMP = 2147483647L;

  public static void migrateAnnouncementsTimeFormat(Handle handle, boolean postgresDbFlag) {
    // Fetch all threads of type Announcement from the database
    List<Thread> threads = fetchAnnouncementThreads(handle);

    threads.forEach(
        thread -> {
          Optional<AnnouncementDetails> announcementOpt =
              Optional.ofNullable(thread.getAnnouncement());
          boolean updated =
              announcementOpt
                  .map(
                      announcement -> {
                        boolean startUpdated =
                            Optional.ofNullable(announcement.getStartTime())
                                .filter(MigrationUtil::isInSeconds)
                                .map(MigrationUtil::convertSecondsToMilliseconds)
                                .map(
                                    startTime -> {
                                      announcement.setStartTime(startTime);
                                      return true;
                                    })
                                .orElse(false);

                        boolean endUpdated =
                            Optional.ofNullable(announcement.getEndTime())
                                .filter(MigrationUtil::isInSeconds)
                                .map(MigrationUtil::convertSecondsToMilliseconds)
                                .map(
                                    endTime -> {
                                      announcement.setEndTime(endTime);
                                      return true;
                                    })
                                .orElse(false);

                        return startUpdated || endUpdated;
                      })
                  .orElse(false);

          // If we made any updates, persist the changes back to the database
          if (updated) {
            if (postgresDbFlag) {
              updateThreadPostgres(handle, thread);
            } else {
              updateThreadMySql(handle, thread);
            }
          }
        });
  }

  private static List<Thread> fetchAnnouncementThreads(Handle handle) {
    String query = "SELECT json FROM thread_entity WHERE type = 'Announcement'";

    return handle
        .createQuery(query)
        .map((rs, ctx) -> JsonUtils.readValue(rs.getString("json"), Thread.class))
        .list();
  }

  private static boolean isInSeconds(Long timestamp) {
    return timestamp != null && timestamp <= MAX_SECONDS_TIMESTAMP;
  }

  private static void updateThreadMySql(Handle handle, Thread thread) {
    String updateQuery = "UPDATE thread_entity SET json = :json WHERE id = :id";
    handle
        .createUpdate(updateQuery)
        .bind("json", JsonUtils.pojoToJson(thread))
        .bind("id", thread.getId().toString())
        .execute();
  }

  private static void updateThreadPostgres(Handle handle, Thread thread) {
    String updateQuery = "UPDATE thread_entity SET json = CAST(:json AS jsonb) WHERE id = :id";
    handle
        .createUpdate(updateQuery)
        .bind("json", JsonUtils.pojoToJson(thread))
        .bind("id", thread.getId().toString())
        .execute();
  }

  private static long convertSecondsToMilliseconds(long seconds) {
    return LocalDateTime.ofEpochSecond(seconds, 0, ZoneOffset.UTC)
        .toInstant(ZoneOffset.UTC)
        .toEpochMilli();
  }
}
