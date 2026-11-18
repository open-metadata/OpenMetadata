package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler.PendingCount;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;

class EventSubscriptionPendingCountTest {

  private static final int CAP = EventSubscriptionScheduler.MAX_PENDING_EVALUATED;

  @Test
  void aSmallBacklogIsCountedExactly() {
    PendingCount counted = EventSubscriptionScheduler.countRelevant(rows(11, 3), 13L, e -> true);

    assertEquals(new PendingCount(3, false), counted);
  }

  @Test
  void aBacklogPastTheReadIsALowerBound() {
    PendingCount counted =
        EventSubscriptionScheduler.countRelevant(rows(11, CAP), 100_000L, e -> true);

    assertEquals(new PendingCount(CAP, true), counted);
  }

  // A read the byte budget cut short still leaves events unread before the latest offset.
  @Test
  void aReadCutShortByTheByteBudgetIsALowerBound() {
    PendingCount counted = EventSubscriptionScheduler.countRelevant(rows(11, 2), 20L, e -> true);

    assertEquals(new PendingCount(2, true), counted);
  }

  @Test
  void eventsWrittenAfterTheLatestOffsetAreNotCounted() {
    PendingCount counted = EventSubscriptionScheduler.countRelevant(rows(11, CAP), 12L, e -> true);

    assertEquals(new PendingCount(2, false), counted);
  }

  @Test
  void onlyEventsTheRulesLetThroughAreCounted() {
    PendingCount counted = EventSubscriptionScheduler.countRelevant(rows(11, 4), 14L, e -> false);

    assertEquals(new PendingCount(0, false), counted);
  }

  @Test
  void nothingUnreadCountsZero() {
    PendingCount counted = EventSubscriptionScheduler.countRelevant(List.of(), 10L, e -> true);

    assertEquals(new PendingCount(0, false), counted);
  }

  private static List<ChangeEventRecord> rows(long firstOffset, int count) {
    List<ChangeEventRecord> rows = new ArrayList<>();
    for (int index = 0; index < count; index++) {
      ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
      rows.add(new ChangeEventRecord(firstOffset + index, JsonUtils.pojoToJson(event)));
    }
    return rows;
  }
}
