package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** A chat notification that would render past its budget fails alone; the next one is sent. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ChatRenderBudgetIT {

  private static final int EVERY_ROW = 100;
  private static final int COLUMNS = 300;
  private static final int ROWS = 300;

  @Test
  void aDescriptionThatWouldRenderPastTheBudgetFailsAndTheNextEventIsSent(TestNamespace ns)
      throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "render_budget",
              null,
              List.of(AlertFixtures.external(SLACK, receiver.url("/slack"))));
      QuietAlert.settle(alert);
      String described = FixtureEvents.tableEvents().get(1);

      FixtureEvents.insert(List.of(describedWith(described, lopsidedTable()), described));
      DirectTick.run(alert);

      List<FailedEventResponse> failures = failuresOf(alert);
      assertEquals(1, failures.size(), "only the oversized notification fails");
      String reason = failures.getFirst().getReason();
      assertTrue(reason.contains("render budget"), reason);
      assertEquals(1, receiver.received().size(), "the next event is still sent");
    }
  }

  // One wide row over many one-cell rows: every row is padded to the widest one.
  private static String lopsidedTable() {
    return "<table><tr>"
        + "<td>x</td>".repeat(COLUMNS)
        + "</tr>"
        + "<tr><td>y</td></tr>".repeat(ROWS)
        + "</table>";
  }

  private static String describedWith(String event, String description) {
    ObjectNode node = (ObjectNode) JsonUtils.readTree(event);
    node.put("id", UUID.randomUUID().toString());
    ObjectNode change = (ObjectNode) node.get("changeDescription");
    ArrayNode added = change.putArray("fieldsAdded");
    added.addObject().put("name", "description").put("newValue", description);
    change.putArray("fieldsUpdated");
    return node.toString();
  }

  private static List<FailedEventResponse> failuresOf(EventSubscription alert) {
    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listFailedEventsById(alert.getId().toString(), EVERY_ROW, 0);
  }
}
