package org.openmetadata.service.events.subscription.matching;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertShadowReport;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/**
 * The report row of each alert. One tick owns an alert at a time, so its tally is added with a
 * plain read and write. The report is evidence, not state: a write that fails is counted and
 * forgotten, and never costs the tick anything.
 */
@Slf4j
public final class ShadowReports {

  private ShadowReports() {}

  public static AlertShadowReport of(UUID alertId) {
    String stored = dao().getSubscriberExtension(alertId.toString(), LedgerKeys.SHADOW_REPORT);
    return stored == null ? null : JsonUtils.readValue(stored, AlertShadowReport.class);
  }

  public static void add(UUID alertId, ShadowTally tally) {
    if (tally != null && !tally.isEmpty()) {
      try {
        dao()
            .upsertSubscriberExtension(
                alertId.toString(),
                LedgerKeys.SHADOW_REPORT,
                LedgerKeys.SHADOW_REPORT_SCHEMA,
                JsonUtils.pojoToJson(tally.addedTo(of(alertId))));
      } catch (RuntimeException e) {
        LOG.warn("Could not write the shadow report of alert {}", alertId, e);
        AlertTelemetry.absorbed(AlertTelemetry.SHADOW_REPORT_WRITE_FAILED);
      }
    }
  }

  private static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }
}
