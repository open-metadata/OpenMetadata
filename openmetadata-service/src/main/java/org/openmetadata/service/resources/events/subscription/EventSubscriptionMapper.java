package org.openmetadata.service.resources.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.events.subscription.AlertUtil.validateAndBuildFilteringConditions;
import static org.openmetadata.service.fernet.Fernet.encryptWebhookSecretKey;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
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
        .withFilteringRules(
            validateAndBuildFilteringConditions(
                create.getResources(), create.getAlertType(), create.getInput()))
        .withDestinations(encryptWebhookSecretKey(getSubscriptions(create.getDestinations())))
        .withProvider(create.getProvider())
        .withRetries(create.getRetries())
        .withPollInterval(create.getPollInterval())
        .withInput(create.getInput())
        .withClassName(
            validateConsumerClass(
                Optional.ofNullable(create.getClassName())
                    .orElse(AlertPublisher.class.getCanonicalName())))
        .withConfig(create.getConfig());
  }

  private String validateConsumerClass(String className) {
    // Validate that the class belongs to our application package
    if (!className.startsWith("org.openmetadata.") && !className.contains("io.collate.")) {
      throw new BadRequestException(
          "Only classes from org.openmetadata or io.collate packages are allowed: " + className);
    }

    try {
      // Check if the class exists and is a subclass of AbstractEventConsumer
      Class<?> clazz = Class.forName(className);
      if (!AbstractEventConsumer.class.isAssignableFrom(clazz)) {
        throw new BadRequestException(
            "Class must be a subclass of AbstractEventConsumer: " + className);
      }
      return className;
    } catch (ClassNotFoundException e) {
      throw new BadRequestException("Consumer class not found: " + className);
    }
  }

  private List<SubscriptionDestination> getSubscriptions(
      List<SubscriptionDestination> subscriptions) {
    List<SubscriptionDestination> result = new ArrayList<>();
    subscriptions.forEach(
        subscription -> {
          if (nullOrEmpty(subscription.getId())) {
            subscription.withId(UUID.randomUUID());
          }
          result.add(subscription);
        });
    return result;
  }
}
