package org.openmetadata.service.events.subscription;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class EventsSubscriptionRegistry {

  private static final List<FilterResourceDescriptor> ENTITY_NOTIFICATION_DESCRIPTORS =
      new ArrayList<>();
  private static final List<FilterResourceDescriptor> OBSERVABILITY_DESCRIPTORS = new ArrayList<>();
  // With what earlier releases offered, so an alert saved then still builds. Never served.
  private static final List<FilterResourceDescriptor> BUILDABLE_NOTIFICATION = new ArrayList<>();
  private static final List<FilterResourceDescriptor> BUILDABLE_OBSERVABILITY = new ArrayList<>();

  private EventsSubscriptionRegistry() {}

  public static void initialize(AlertCatalog catalog) {
    replace(ENTITY_NOTIFICATION_DESCRIPTORS, catalog.served(AlertType.NOTIFICATION));
    replace(OBSERVABILITY_DESCRIPTORS, catalog.served(AlertType.OBSERVABILITY));
    replace(BUILDABLE_NOTIFICATION, catalog.buildable(AlertType.NOTIFICATION));
    replace(BUILDABLE_OBSERVABILITY, catalog.buildable(AlertType.OBSERVABILITY));
  }

  private static void replace(
      List<FilterResourceDescriptor> held, List<FilterResourceDescriptor> loaded) {
    held.clear();
    held.addAll(loaded);
    held.sort(Comparator.comparing(FilterResourceDescriptor::getName));
  }

  public static List<FilterResourceDescriptor> listEntityNotificationDescriptors() {
    return Collections.unmodifiableList(ENTITY_NOTIFICATION_DESCRIPTORS);
  }

  public static List<FilterResourceDescriptor> listObservabilityDescriptors() {
    return Collections.unmodifiableList(OBSERVABILITY_DESCRIPTORS);
  }

  public static FilterResourceDescriptor getEntityNotificationDescriptor(String resourceType) {
    return find(ENTITY_NOTIFICATION_DESCRIPTORS, resourceType);
  }

  public static FilterResourceDescriptor getObservabilityDescriptor(String resourceType) {
    return find(OBSERVABILITY_DESCRIPTORS, resourceType);
  }

  /** For a definition that is already stored. A new or changed one may only use what is served. */
  public static FilterResourceDescriptor getBuildableDescriptor(
      AlertType alertType, String resourceType) {
    return find(
        alertType == AlertType.OBSERVABILITY ? BUILDABLE_OBSERVABILITY : BUILDABLE_NOTIFICATION,
        resourceType);
  }

  private static FilterResourceDescriptor find(
      List<FilterResourceDescriptor> descriptors, String resourceType) {
    return descriptors.stream()
        .filter(descriptor -> descriptor.getName().equalsIgnoreCase(resourceType))
        .findAny()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    CatalogExceptionMessage.resourceTypeNotFound(resourceType)));
  }
}
