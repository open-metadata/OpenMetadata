package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;

/** One read of change events stops at a byte budget, so large events cannot fill the heap. */
@Isolated
class ChangeEventReadBudgetIT {

  private static final int LARGE_EVENTS = 3;
  private static final int FIVE_MEGABYTES = 5 * 1024 * 1024;

  @Test
  void aReadOfLargeEventsStopsAtItsBudgetAndTheNextReadContinuesInOrder() {
    ChangeEventDAO changeEvents = Entity.getCollectionDAO().changeEventDAO();
    long latest = changeEvents.getLatestOffset();
    List<String> ids = insertLargeEvents(changeEvents);
    long beforeOurs = offsetOf(changeEvents, latest, ids.getFirst()) - 1;

    List<ChangeEventRecord> first = changeEvents.listWithOffset(100, beforeOurs);
    List<ChangeEventRecord> second = changeEvents.listWithOffset(100, first.getLast().offset());

    assertEquals(1, first.size(), "two 5 MB events do not fit an 8 MB read");
    assertEquals(ids.getFirst(), idOf(first.getFirst()));
    assertEquals(ids.get(1), idOf(second.getFirst()), "the next read starts where it stopped");
  }

  private static List<String> insertLargeEvents(ChangeEventDAO changeEvents) {
    List<String> ids = new ArrayList<>();
    for (int index = 0; index < LARGE_EVENTS; index++) {
      ChangeEvent event =
          new ChangeEvent()
              .withId(UUID.randomUUID())
              .withEventType(EventType.ENTITY_UPDATED)
              .withEntityType(Entity.TABLE)
              .withEntityId(UUID.randomUUID())
              .withUserName("admin")
              .withTimestamp(System.currentTimeMillis())
              .withEntity("{\"description\":\"" + "x".repeat(FIVE_MEGABYTES) + "\"}");
      changeEvents.insert(JsonUtils.pojoToJson(event));
      ids.add(event.getId().toString());
    }
    return ids;
  }

  // The server writes its own events too, so the reads start right before the first of these.
  private static long offsetOf(ChangeEventDAO changeEvents, long after, String id) {
    long cursor = after;
    List<ChangeEventRecord> page = changeEvents.listWithOffset(100, cursor);
    while (!page.isEmpty()) {
      for (ChangeEventRecord row : page) {
        if (id.equals(idOf(row))) {
          return row.offset();
        }
      }
      cursor = page.getLast().offset();
      page = changeEvents.listWithOffset(100, cursor);
    }
    throw new IllegalStateException("Inserted change event " + id + " was not found");
  }

  private static String idOf(ChangeEventRecord row) {
    return JsonUtils.readTree(row.json()).get("id").asText();
  }
}
