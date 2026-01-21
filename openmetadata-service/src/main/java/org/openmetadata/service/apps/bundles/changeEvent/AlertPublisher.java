package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.DIContainer;

@Slf4j
public class AlertPublisher extends AbstractEventConsumer {
  public AlertPublisher(DIContainer di) {
    super(di);
  }

  @Override
  public boolean sendAlert(UUID receiverId, ChangeEvent event) {
    if (destinationMap.containsKey(receiverId)) {
      Destination<ChangeEvent> destination = destinationMap.get(receiverId);
      if (destination.getEnabled()) {
        try {
          RecipientResolver resolver = new RecipientResolver();
          Set<Recipient> recipients =
              resolver.resolveRecipients(event, List.of(destination.getSubscriptionDestination()));
          destination.sendMessage(event, recipients);
          return true;
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
    return false;
  }

  @Override
  public boolean getEnabled() {
    return getEventSubscription().getEnabled();
  }
}
