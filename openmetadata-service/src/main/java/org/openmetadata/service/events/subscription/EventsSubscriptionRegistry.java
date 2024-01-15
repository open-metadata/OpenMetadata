package org.openmetadata.service.events.subscription;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.type.NotificationResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class EventsSubscriptionRegistry {

  private static final List<NotificationResourceDescriptor> ENTITY_NOTIFICATION_DESCRIPTORS =
      new ArrayList<>();
  private static final List<EventFilterRule> NOTIFICATIONS_FUNCTIONS_DESCRIPTORS =
      new ArrayList<>();

  private static final List<FilterResourceDescriptor> OBSERVABILITY_DESCRIPTORS = new ArrayList<>();

  private EventsSubscriptionRegistry() {}

  public static void initialize(
      List<NotificationResourceDescriptor> entityNotificationDescriptor,
      List<EventFilterRule> notificationFunctionsDescriptors,
      List<FilterResourceDescriptor> observabilityDescriptors) {
    // Entity notification descriptors
    ENTITY_NOTIFICATION_DESCRIPTORS.clear();
    ENTITY_NOTIFICATION_DESCRIPTORS.addAll(entityNotificationDescriptor);
    ENTITY_NOTIFICATION_DESCRIPTORS.sort(
        Comparator.comparing(NotificationResourceDescriptor::getName));

    // Notification Function descriptors
    NOTIFICATIONS_FUNCTIONS_DESCRIPTORS.clear();
    NOTIFICATIONS_FUNCTIONS_DESCRIPTORS.addAll(notificationFunctionsDescriptors);
    NOTIFICATIONS_FUNCTIONS_DESCRIPTORS.sort(Comparator.comparing(EventFilterRule::getName));

    // Observability descriptors
    OBSERVABILITY_DESCRIPTORS.clear();
    OBSERVABILITY_DESCRIPTORS.addAll(observabilityDescriptors);
    OBSERVABILITY_DESCRIPTORS.sort(Comparator.comparing(FilterResourceDescriptor::getName));
  }

  public static List<NotificationResourceDescriptor> listEntityNotificationDescriptors() {
    return Collections.unmodifiableList(ENTITY_NOTIFICATION_DESCRIPTORS);
  }

  public static List<EventFilterRule> listNotificationsFunctionsDescriptors() {
    return Collections.unmodifiableList(NOTIFICATIONS_FUNCTIONS_DESCRIPTORS);
  }

  public static List<FilterResourceDescriptor> listObservabilityDescriptors() {
    return Collections.unmodifiableList(OBSERVABILITY_DESCRIPTORS);
  }

  public static NotificationResourceDescriptor getEntityNotificationDescriptor(
      String resourceType) {
    NotificationResourceDescriptor rd =
        ENTITY_NOTIFICATION_DESCRIPTORS.stream()
            .filter(r -> r.getName().equalsIgnoreCase(resourceType))
            .findAny()
            .orElse(null);
    if (rd == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.resourceTypeNotFound(resourceType));
    }
    return rd;
  }

  public static EventFilterRule getNotificationsDescriptor(String resourceType) {
    EventFilterRule rd =
        NOTIFICATIONS_FUNCTIONS_DESCRIPTORS.stream()
            .filter(r -> r.getName().equalsIgnoreCase(resourceType))
            .findAny()
            .orElse(null);
    if (rd == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.resourceTypeNotFound(resourceType));
    }
    return rd;
  }

  public static FilterResourceDescriptor getObservabilityDescriptor(String resourceType) {
    FilterResourceDescriptor rd =
        OBSERVABILITY_DESCRIPTORS.stream()
            .filter(r -> r.getName().equalsIgnoreCase(resourceType))
            .findAny()
            .orElse(null);
    if (rd == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.resourceTypeNotFound(resourceType));
    }
    return rd;
  }
}
