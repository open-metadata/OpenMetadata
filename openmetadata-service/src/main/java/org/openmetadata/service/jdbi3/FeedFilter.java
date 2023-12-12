package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.util.RestUtil.decodeCursor;

import lombok.Builder;
import lombok.Getter;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.FeedRepository.PaginationType;

@Builder
public class FeedFilter {

  @Getter
  private ThreadType threadType;

  @Getter
  private Boolean activeAnnouncement;

  @Getter
  private TaskStatus taskStatus;

  @Getter
  private Boolean resolved;

  @Getter
  private FilterType filterType;

  @Getter
  private PaginationType paginationType;

  @Getter
  private String before;

  @Getter
  private String after;

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
        long now = System.currentTimeMillis() / 1000; // epoch time in seconds
        String condition2 = activeAnnouncement
          ? String.format("%s BETWEEN announcementStart AND announcementEnd", now)
          : String.format("%s NOT BETWEEN announcementStart AND announcementEnd", now);
        condition1 = addCondition(condition1, condition2);
      } else if (ThreadType.Task.equals(threadType) && taskStatus != null) {
        String condition2 = String.format("taskStatus = '%s'", taskStatus);
        condition1 = addCondition(condition1, condition2);
      }
    }
    condition1 = addCondition(condition1, resolved == null ? "" : String.format("resolved = %s", resolved));
    if (paginationType != null && includePagination) {
      String paginationCondition = paginationType == PaginationType.BEFORE
        ? String.format("updatedAt > %s", Long.parseLong(decodeCursor(before)))
        : String.format("updatedAt < %s", after != null ? Long.parseLong(decodeCursor(after)) : Long.MAX_VALUE);
      condition1 = addCondition(condition1, paginationCondition);
    }
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
