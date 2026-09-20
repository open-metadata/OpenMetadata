package org.openmetadata.service.events.subscription.matching;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertMatcherMode;
import org.openmetadata.schema.entity.events.AlertMatcherSetting;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/**
 * Which engine decides matching, one value for the whole cluster, so an alert is never decided by
 * one engine on one server and by the other on the next. It lives in one row under a fixed id in
 * the table alerts keep their own rows in, not in the settings store: a server of the previous
 * release refuses to start reading a settings type it does not know, and never reads this row.
 */
@Slf4j
public final class MatcherModes {

  static final String ROW_ID = "ALERT_MATCHER_SETTING";
  static final String ROW_KEY = "alertMatcher.setting";
  private static final String ROW_SCHEMA = "alertMatcherSetting";
  private static final long REREAD_AFTER_MS = 30_000;

  private static volatile AlertMatcherSetting lastRead;
  private static volatile long lastReadAt;

  private MatcherModes() {}

  /** At most thirty seconds old, so a change reaches every server without a restart. */
  public static AlertMatcherMode of(AlertType alertType) {
    long now = System.currentTimeMillis();
    if (lastRead == null || now - lastReadAt >= REREAD_AFTER_MS) {
      lastRead = readOrKeep(lastRead);
      lastReadAt = now;
    }
    return modeOf(lastRead, alertType);
  }

  public static AlertMatcherSetting read() {
    String stored = dao().getSubscriberExtension(ROW_ID, ROW_KEY);
    return stored == null ? defaults() : JsonUtils.readValue(stored, AlertMatcherSetting.class);
  }

  public static AlertMatcherSetting write(AlertType alertType, AlertMatcherMode mode, String by) {
    AlertMatcherSetting setting =
        read().withUpdatedBy(by).withTimestamp(System.currentTimeMillis());
    if (alertType == AlertType.OBSERVABILITY) {
      setting.setObservability(mode);
    } else if (alertType == AlertType.NOTIFICATION) {
      setting.setNotification(mode);
    } else {
      throw new IllegalArgumentException(
          "Alerts of type "
              + alertType.value()
              + " carry rules written by hand; nothing decides them but those rules");
    }
    dao().upsertSubscriberExtension(ROW_ID, ROW_KEY, ROW_SCHEMA, JsonUtils.pojoToJson(setting));
    lastRead = setting;
    lastReadAt = System.currentTimeMillis();
    return setting;
  }

  public static AlertMatcherMode modeOf(AlertMatcherSetting setting, AlertType alertType) {
    return alertType == AlertType.OBSERVABILITY
        ? setting.getObservability()
        : setting.getNotification();
  }

  // A database that cannot be read for a moment must not change who decides.
  private static AlertMatcherSetting readOrKeep(AlertMatcherSetting known) {
    AlertMatcherSetting setting = known;
    try {
      setting = read();
    } catch (RuntimeException e) {
      LOG.warn("Could not read the alert matcher setting; keeping what was known", e);
    }
    return setting == null ? defaults() : setting;
  }

  private static AlertMatcherSetting defaults() {
    return new AlertMatcherSetting()
        .withNotification(AlertMatcherMode.SHADOW)
        .withObservability(AlertMatcherMode.SHADOW)
        .withTimestamp(0L);
  }

  private static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }
}
