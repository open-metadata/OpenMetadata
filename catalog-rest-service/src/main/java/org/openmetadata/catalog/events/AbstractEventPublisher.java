package org.openmetadata.catalog.events;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.events.errors.RetriableException;
import org.openmetadata.catalog.filter.BasicFilter;
import org.openmetadata.catalog.filter.Filter;
import org.openmetadata.catalog.filter.FiltersType;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.util.FilterUtil;

@Slf4j
public abstract class AbstractEventPublisher implements EventPublisher {
  // Backoff timeout in seconds. Delivering events is retried 5 times.
  protected static final int BACKOFF_NORMAL = 0;
  protected static final int BACKOFF_3_SECONDS = 3 * 1000;
  protected static final int BACKOFF_30_SECONDS = 30 * 1000;
  protected static final int BACKOFF_5_MINUTES = 5 * 60 * 1000;
  protected static final int BACKOFF_1_HOUR = 60 * 60 * 1000;
  protected static final int BACKOFF_24_HOUR = 24 * 60 * 60 * 1000;

  protected int currentBackoffTime = BACKOFF_NORMAL;
  protected final List<ChangeEvent> batch = new ArrayList<>();
  protected final ConcurrentHashMap<String, Map<FiltersType, BasicFilter>> filter = new ConcurrentHashMap<>();
  private final int batchSize;

  protected AbstractEventPublisher(int batchSize, List<Filter> filters) {
    updateFilter(filters);
    this.batchSize = batchSize;
  }

  protected void updateFilter(List<Filter> filters) {
    filters.forEach(
        (f) -> {
          String entityType = f.getEntityType();
          Map<FiltersType, BasicFilter> eventFilterMap = new HashMap<>();
          if (f.getEventFilter() != null) {
            f.getEventFilter()
                .forEach(
                    (eventFilter) -> {
                      eventFilterMap.put(eventFilter.getFilterType(), eventFilter);
                    });
          }
          filter.put(entityType, eventFilterMap);
        });
  }

  @Override
  public void onEvent(EventPubSub.ChangeEventHolder changeEventHolder, long sequence, boolean endOfBatch)
      throws Exception {
    // Ignore events that don't match the webhook event filters
    ChangeEvent changeEvent = changeEventHolder.get();
    if (!filter.isEmpty()) {
      Map<FiltersType, BasicFilter> entityFilter = filter.get(changeEvent.getEntityType());
      if (entityFilter != null && !FilterUtil.shouldProcessRequest(changeEvent, entityFilter)) {
        return;
      }
    }

    // Batch until either the batch has ended or batch size has reached the max size
    batch.add(changeEventHolder.get());
    if (!endOfBatch && batch.size() < batchSize) {
      return;
    }

    ChangeEventList list = new ChangeEventList(batch, null, null, batch.size());
    try {
      publish(list);
      batch.clear();
    } catch (RetriableException ex) {
      setNextBackOff();
      LOG.error("Failed to publish event {} due to {}, will try again in {} ms", changeEvent, ex, currentBackoffTime);
      Thread.sleep(currentBackoffTime);
    } catch (Exception e) {
      LOG.error(
          "Failed to publish event type {} for entity {}", changeEvent.getEventType(), changeEvent.getEntityType());
      LOG.error(e.getMessage(), e);
    }
  }

  protected void setNextBackOff() {
    if (currentBackoffTime == BACKOFF_NORMAL) {
      currentBackoffTime = BACKOFF_3_SECONDS;
    } else if (currentBackoffTime == BACKOFF_3_SECONDS) {
      currentBackoffTime = BACKOFF_30_SECONDS;
    } else if (currentBackoffTime == BACKOFF_30_SECONDS) {
      currentBackoffTime = BACKOFF_5_MINUTES;
    } else if (currentBackoffTime == BACKOFF_5_MINUTES) {
      currentBackoffTime = BACKOFF_1_HOUR;
    } else if (currentBackoffTime == BACKOFF_1_HOUR) {
      currentBackoffTime = BACKOFF_24_HOUR;
    }
  }
}
