package org.openmetadata.service.apps.managers;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.quartz.SchedulerException;

@Slf4j
public class UninstallManager {

  private final EventSubscriptionRepository eventSubscriptionRepository;

  public UninstallManager() {
    this.eventSubscriptionRepository = new EventSubscriptionRepository();
  }

  public void deleteEventSubscriptions(App app, String deletedBy) {
    AppBoundConfigurationUtil.getEventSubscriptions(app)
        .forEach(
            eventSubscriptionReference -> {
              try {
                EventSubscription eventSub =
                    eventSubscriptionRepository.find(
                        eventSubscriptionReference.getId(), Include.ALL);
                EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSub);
                eventSubscriptionRepository.delete(deletedBy, eventSub.getId(), false, true);

              } catch (EntityNotFoundException e) {
                LOG.debug("Event subscription {} not found", eventSubscriptionReference.getId());
              } catch (SchedulerException e) {
                throw new RuntimeException(e);
              }
            });
  }
}
