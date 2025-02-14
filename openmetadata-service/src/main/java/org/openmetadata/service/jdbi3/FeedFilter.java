package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.RestUtil.decodeCursor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.FeedRepository.PaginationType;
import org.openmetadata.service.util.JsonUtils;

@Builder
@Slf4j
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

    // Add pagination filter
    if (paginationType != null && includePagination) {
      Map<String, String> cursorMap =
          paginationType == PaginationType.BEFORE
              ? parseCursorMap(decodeCursor(before))
              : parseCursorMap(decodeCursor(after));

      String updatedAt = cursorMap.get("updatedAt");
      String id = cursorMap.get("id");

      String paginationCondition =
          paginationType == PaginationType.BEFORE
              ? String.format(
                  "((updatedAt > %s) OR (updatedAt = %s AND id > '%s')) ", updatedAt, updatedAt, id)
              : String.format(
                  "((updatedAt < %s) OR (updatedAt = %s AND id < '%s')) ",
                  updatedAt != null ? updatedAt : Long.MAX_VALUE,
                  updatedAt != null ? updatedAt : Long.MAX_VALUE,
                  id);

      condition1 = addCondition(condition1, paginationCondition);
    }

    // Only Domain Listing based thread can be fetched
    String domainCondition = "";
    if (applyDomainFilter) {
      if (domains != null && !domains.isEmpty()) {
        domainCondition =
            String.format(
                "domain IN ('%s')",
                domains.stream().map(UUID::toString).reduce((a, b) -> a + "','" + b).get());
      } else {
        domainCondition = "domain is null";
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

  Map<String, String> parseCursorMap(String param) {
    Map<String, String> cursorMap = new HashMap<>();
    cursorMap.put("updatedAt", null);
    cursorMap.put("id", null);

    if (nullOrEmpty(param)) {
      return cursorMap;
    }

    try {
      return JsonUtils.readValue(param, Map.class);
    } catch (Exception e) {
      LOG.error("Failed to parse cursor map", e);
      return cursorMap;
    }
  }

  public String getSortingOrder() {
    if (paginationType == null) {
      return "ORDER BY updatedAt DESC, id DESC";
    } else {
      return paginationType == PaginationType.BEFORE
          ? "ORDER BY updatedAt ASC,id ASC"
          : "ORDER BY updatedAt DESC,id DESC";
    }
  }
}
