package org.openmetadata.service.alerts;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AlertRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class ActivityFeedAlertCache {
  private static final ActivityFeedAlertCache INSTANCE = new ActivityFeedAlertCache();
  private static volatile boolean INITIALIZED = false;
  protected static LoadingCache<String, Alert> ALERTS_CACHE;
  protected static AlertRepository ALERT_REPOSITORY;
  private static String activityFeedAlertName;

  public static void initialize(String alertName, CollectionDAO dao) {
    if (!INITIALIZED) {
      ALERTS_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterWrite(3, TimeUnit.MINUTES)
              .build(new ActivityFeedAlertLoader());
      ALERT_REPOSITORY = new AlertRepository(dao);
      INITIALIZED = true;
      activityFeedAlertName = alertName;
    }
  }

  public static ActivityFeedAlertCache getInstance() {
    return INSTANCE;
  }

  public Alert getActivityFeedAlert() throws EntityNotFoundException {
    try {
      return ALERTS_CACHE.get(activityFeedAlertName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  static class ActivityFeedAlertLoader extends CacheLoader<String, Alert> {
    @Override
    public Alert load(@CheckForNull String alertName) throws IOException {
      Alert alert = ALERT_REPOSITORY.getByName(null, alertName, ALERT_REPOSITORY.getFields("*"));
      LOG.debug("Loaded Alert {}", alert);
      return alert;
    }
  }
}
