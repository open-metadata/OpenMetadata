package org.openmetadata.service.events.subscription;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;

@Slf4j
public class ActivityFeedAlertCache {
  private static final ActivityFeedAlertCache INSTANCE = new ActivityFeedAlertCache();
  private static volatile boolean initialized = false;
  protected static LoadingCache<String, EventSubscription> eventSubCache;
  protected static EventSubscriptionRepository eventSubscriptionRepository;
  private static String activityFeedAlertName;

  public static void initialize(String alertName, EventSubscriptionRepository repo) {
    if (!initialized) {
      eventSubCache =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterWrite(3, TimeUnit.MINUTES)
              .build(new ActivityFeedAlertLoader());
      eventSubscriptionRepository = repo;
      initialized = true;
      activityFeedAlertName = alertName;
    }
  }

  public static ActivityFeedAlertCache getInstance() {
    return INSTANCE;
  }

  public EventSubscription getActivityFeedAlert() throws EntityNotFoundException {
    try {
      return eventSubCache.get(activityFeedAlertName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  static class ActivityFeedAlertLoader extends CacheLoader<String, EventSubscription> {
    @Override
    public EventSubscription load(@CheckForNull String alertName) throws IOException {
      EventSubscription alert =
          eventSubscriptionRepository.getByName(null, alertName, eventSubscriptionRepository.getFields("*"));
      LOG.debug("Loaded Alert {}", alert);
      return alert;
    }
  }
}
