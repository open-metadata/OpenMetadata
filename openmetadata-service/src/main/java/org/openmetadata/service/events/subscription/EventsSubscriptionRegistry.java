package org.openmetadata.service.events.subscription;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.type.SubscriptionResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class EventsSubscriptionRegistry {
  private static final List<SubscriptionResourceDescriptor> SUB_RESOURCE_DESCRIPTORS =
      new ArrayList<>();

  private static final List<FilterResourceDescriptor> ENTITY_OBSERVABILITY_DESCRIPTORS =
      new ArrayList<>();

  private EventsSubscriptionRegistry() {}

  public static void initialize(
      List<SubscriptionResourceDescriptor> resourceDescriptors,
      List<FilterResourceDescriptor> filterResourceDescriptors) {
    SUB_RESOURCE_DESCRIPTORS.clear();
    SUB_RESOURCE_DESCRIPTORS.addAll(resourceDescriptors);
    SUB_RESOURCE_DESCRIPTORS.sort(Comparator.comparing(SubscriptionResourceDescriptor::getName));

    // Observability descriptors
    ENTITY_OBSERVABILITY_DESCRIPTORS.clear();
    ENTITY_OBSERVABILITY_DESCRIPTORS.addAll(filterResourceDescriptors);
    ENTITY_OBSERVABILITY_DESCRIPTORS.sort(Comparator.comparing(FilterResourceDescriptor::getName));
  }

  public static List<SubscriptionResourceDescriptor> listResourceDescriptors() {
    return Collections.unmodifiableList(SUB_RESOURCE_DESCRIPTORS);
  }

  public static List<FilterResourceDescriptor> listObservabilityDescriptors() {
    return Collections.unmodifiableList(ENTITY_OBSERVABILITY_DESCRIPTORS);
  }

  public static SubscriptionResourceDescriptor getResourceDescriptor(String resourceType) {
    SubscriptionResourceDescriptor rd =
        SUB_RESOURCE_DESCRIPTORS.stream()
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
        ENTITY_OBSERVABILITY_DESCRIPTORS.stream()
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
