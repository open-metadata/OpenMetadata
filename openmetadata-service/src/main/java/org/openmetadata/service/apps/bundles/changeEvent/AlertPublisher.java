package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.DIContainer;

@Slf4j
public class AlertPublisher extends AbstractEventConsumer {
  public AlertPublisher(DIContainer di) {
    super(di);
  }

  @Override
  public void sendAlert(UUID receiverId, ChangeEvent event) throws EventPublisherException {
    if (destinationMap.containsKey(receiverId)) {
      Destination<ChangeEvent> destination = destinationMap.get(receiverId);
      if (Boolean.TRUE.equals(destination.getEnabled())) {
        try {
          destination.sendMessage(event);
        } catch (EventPublisherException ex) {
          handleFailedEvent(ex, true);
        }
      } else {
        LOG.debug(
            "Event Subscription:{} Skipping sending message since, disabled subscription with Id: {}",
            eventSubscription.getName(),
            receiverId);
      }
    } else {
      LOG.debug(
          "Event Subscription:{} Cannot find Destination Subscription With Id: {}",
          eventSubscription.getName(),
          receiverId);
    }
  }

  @Override
  public boolean getEnabled() {
    return getEventSubscription().getEnabled();
  }
}
