package org.openmetadata.service.events.subscription;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class EventsSubscriptionRegistry {

  private static final List<FilterResourceDescriptor> ENTITY_NOTIFICATION_DESCRIPTORS =
      new ArrayList<>();

  private static final List<FilterResourceDescriptor> OBSERVABILITY_DESCRIPTORS = new ArrayList<>();

  private EventsSubscriptionRegistry() {}

  public static void initialize(
      List<FilterResourceDescriptor> entityNotificationDescriptor,
      List<FilterResourceDescriptor> observabilityDescriptors) {
    // Entity notification descriptors
    ENTITY_NOTIFICATION_DESCRIPTORS.clear();
    ENTITY_NOTIFICATION_DESCRIPTORS.addAll(entityNotificationDescriptor);
    ENTITY_NOTIFICATION_DESCRIPTORS.sort(Comparator.comparing(FilterResourceDescriptor::getName));

    // Observability descriptors
    OBSERVABILITY_DESCRIPTORS.clear();
    OBSERVABILITY_DESCRIPTORS.addAll(observabilityDescriptors);
    OBSERVABILITY_DESCRIPTORS.sort(Comparator.comparing(FilterResourceDescriptor::getName));
  }

  public static List<FilterResourceDescriptor> listEntityNotificationDescriptors() {
    return Collections.unmodifiableList(ENTITY_NOTIFICATION_DESCRIPTORS);
  }

  public static List<FilterResourceDescriptor> listObservabilityDescriptors() {
    return Collections.unmodifiableList(OBSERVABILITY_DESCRIPTORS);
  }

  public static FilterResourceDescriptor getEntityNotificationDescriptor(String resourceType) {
    FilterResourceDescriptor rd =
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
