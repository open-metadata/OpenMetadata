package org.openmetadata.service.resources.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Optional;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.service.events.consumer.Consumers;
import org.openmetadata.service.mapper.EntityMapper;

public class EventSubscriptionMapper
    implements EntityMapper<EventSubscription, CreateEventSubscription> {
  @Override
  public EventSubscription createToEntity(CreateEventSubscription create, String user) {
    return copy(new EventSubscription(), create, user)
        .withAlertType(create.getAlertType())
        .withTrigger(create.getTrigger())
        .withEnabled(create.getEnabled())
        .withBatchSize(create.getBatchSize())
        // A request has no place for rules, so it carries none: a save keeps the stored ones.
        .withFilteringRules(
            new FilteringRules()
                .withResources(create.getResources())
                .withRules(null)
                .withActions(null))
        .withDestinations(new ArrayList<>(listOrEmpty(create.getDestinations())))
        .withProvider(create.getProvider())
        .withRetries(create.getRetries())
        .withPollInterval(create.getPollInterval())
        .withInput(create.getInput())
        .withNotificationTemplate(create.getNotificationTemplate())
        .withClassName(consumerId(create.getClassName()))
        .withConfig(create.getConfig());
  }

  // An alert stores its consumer's id. A class name a consumer was once stored under is still
  // accepted, and stored as that consumer's id.
  private static String consumerId(String requested) {
    String named = Optional.ofNullable(requested).orElse(Consumers.DEFAULT);
    return Consumers.idOf(named)
        .orElseThrow(() -> new BadRequestException("No consumer is registered as " + named));
  }
}
