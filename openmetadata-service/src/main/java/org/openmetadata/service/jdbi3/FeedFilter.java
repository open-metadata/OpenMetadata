package org.openmetadata.service.jdbi3;

import lombok.Builder;
import lombok.Getter;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;

@Builder
public class FeedFilter {
  @Getter private ThreadType threadType;
  @Getter private Boolean activeAnnouncement;
  @Getter private TaskStatus taskStatus;
  @Getter private Boolean resolved;
  @Getter private FilterType filterType;

  public String getCondition() {
    String condition1 = "";
    if (threadType != null) {
      condition1 = String.format("type = '%s'", threadType.value());
      if (ThreadType.Announcement.equals(threadType) && activeAnnouncement != null) {
        long now = System.currentTimeMillis() / 1000; // epoch time in seconds
        String condition2 = String.valueOf(now);
        condition2 +=
            activeAnnouncement
                ? " BETWEEN announcementStart AND announcementEnd"
                : " NOT BETWEEN announcementStart AND announcementEnd";
        condition1 = addCondition(condition1, condition2);
      } else if (ThreadType.Task.equals(threadType) && taskStatus != null) {
        String condition2 = String.format("taskStatus = '%s'", taskStatus);
        condition1 = addCondition(condition1, condition2);
      }
    }
    condition1 = addCondition(condition1, resolved == null ? "" : String.format("resolved = %s", resolved));
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
