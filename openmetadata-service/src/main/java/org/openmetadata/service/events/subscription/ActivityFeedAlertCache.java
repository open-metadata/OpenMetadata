package org.openmetadata.service.events.subscription;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

@Slf4j
public class ActivityFeedAlertCache {
  protected static final LoadingCache<String, EventSubscription> EVENT_SUB_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(1000)
          .expireAfterWrite(3, TimeUnit.MINUTES)
          .build(new ActivityFeedAlertLoader());
  private static final String ACTIVITY_FEED_ALERT = "ActivityFeedAlert";

  private ActivityFeedAlertCache() {
    // Private constructor for static class
  }

  public static EventSubscription getActivityFeedAlert() {
    try {
      return EVENT_SUB_CACHE.get(ACTIVITY_FEED_ALERT);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  static class ActivityFeedAlertLoader extends CacheLoader<String, EventSubscription> {
    @Override
    public EventSubscription load(@CheckForNull String alertName) {
      EventSubscription alert =
          Entity.getEntityByName(Entity.EVENT_SUBSCRIPTION, alertName, "*", Include.NON_DELETED);
      LOG.debug("Loaded Alert {}", alert);
      return alert;
    }
  }
}
