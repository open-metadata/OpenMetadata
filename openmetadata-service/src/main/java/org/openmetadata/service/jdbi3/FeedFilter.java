package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.util.RestUtil.decodeCursor;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.Getter;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.FeedRepository.PaginationType;
import org.openmetadata.service.resources.databases.DatasourceConfig;

@Builder
public class FeedFilter {
  @Getter private ThreadType threadType;
  @Getter private Boolean activeAnnouncement;
  @Getter private TaskStatus taskStatus;
  @Getter private Boolean resolved;
  @Getter private FilterType filterType;
  @Getter private PaginationType paginationType;
  @Getter private String before;
  @Getter private String after;
  @Getter private boolean applyDomainFilter;
  @Getter private List<UUID> domains;

  public String getCondition() {
    return getCondition(true);
  }

  public String getCondition(boolean includePagination) {
    String condition1 = "";
    // Add threadType filter
    if (threadType != null) {
      condition1 = String.format("type = '%s'", threadType.value());
      if (ThreadType.Announcement.equals(threadType) && activeAnnouncement != null) {
        // Add activeAnnouncement filter
        long now = System.currentTimeMillis(); // epoch time in milliseconds
        String condition2 =
            activeAnnouncement
                ? String.format("%s BETWEEN announcementStart AND announcementEnd", now)
                : String.format("%s NOT BETWEEN announcementStart AND announcementEnd", now);
        condition1 = addCondition(condition1, condition2);
      } else if (ThreadType.Task.equals(threadType) && taskStatus != null) {
        String condition2 = String.format("taskStatus = '%s'", taskStatus);
        condition1 = addCondition(condition1, condition2);
      }
    }
    condition1 =
        addCondition(condition1, resolved == null ? "" : String.format("resolved = %s", resolved));
    if (paginationType != null && includePagination) {
      String paginationCondition =
          paginationType == PaginationType.BEFORE
              ? String.format("updatedAt > %s", Long.parseLong(decodeCursor(before)))
              : String.format(
                  "updatedAt < %s",
                  after != null ? Long.parseLong(decodeCursor(after)) : Long.MAX_VALUE);
      condition1 = addCondition(condition1, paginationCondition);
    }

    // Only Domain Listing based thread can be fetched
    String domainCondition = "";
    if (applyDomainFilter) {
      if (domains != null && !domains.isEmpty()) {
        if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
          // MySQL: generate JSON array string: ["id1", "id2", ...]
          String jsonArray =
              domains.stream()
                  .map(uuid -> "\"" + uuid.toString() + "\"")
                  .collect(Collectors.joining(",", "[", "]"));

          domainCondition =
              "EXISTS ("
                  + "SELECT 1 FROM JSON_TABLE("
                  + "'"
                  + jsonArray
                  + "', '$[*]' "
                  + "COLUMNS (domainId VARCHAR(64) PATH '$')) d "
                  + "WHERE JSON_CONTAINS(domains, JSON_QUOTE(d.domainId))"
                  + ")";
        } else {
          // PostgreSQL: generate ARRAY['id1','id2',...]
          String arrayLiteral =
              domains.stream()
                  .map(uuid -> "'" + uuid.toString() + "'")
                  .collect(Collectors.joining(",", "ARRAY[", "]"));

          domainCondition =
              "EXISTS ("
                  + "SELECT 1 FROM unnest("
                  + arrayLiteral
                  + ") AS d(domainId) "
                  + "WHERE domainId = ANY (SELECT jsonb_array_elements_text(domains::jsonb))"
                  + ")";
        }

      } else {
        domainCondition = "domains IS NULL";
      }
    }
    condition1 = addCondition(condition1, domainCondition);

    return condition1.isEmpty() ? "WHERE TRUE" : "WHERE " + condition1;
  }

  private String addCondition(String condition1, String condition2) {
    if (condition1.isEmpty()) {
      return condition2;
    }
    if (condition2.isEmpty()) {
      return condition1;
    }
    return condition1 + " AND " + condition2;
  }
}
