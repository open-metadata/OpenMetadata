package org.openmetadata.service.events.subscription;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertCatalogSource;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class EventsSubscriptionRegistry {

  private static final List<FilterResourceDescriptor> ENTITY_NOTIFICATION_DESCRIPTORS =
      new ArrayList<>();
  private static final List<FilterResourceDescriptor> OBSERVABILITY_DESCRIPTORS = new ArrayList<>();
  // With what earlier releases offered, so an alert saved then still builds. Never served.
  private static final List<FilterResourceDescriptor> BUILDABLE_NOTIFICATION = new ArrayList<>();
  private static final List<FilterResourceDescriptor> BUILDABLE_OBSERVABILITY = new ArrayList<>();

  private static final Map<String, List<SubscriptionCategory>> RECIPIENTS = new HashMap<>();
  private static final List<SubscriptionCategory> DEFAULT_RECIPIENTS = new ArrayList<>();

  private EventsSubscriptionRegistry() {}

  public static void initialize(AlertCatalog catalog) {
    replace(ENTITY_NOTIFICATION_DESCRIPTORS, catalog.served(AlertType.NOTIFICATION));
    replace(OBSERVABILITY_DESCRIPTORS, catalog.served(AlertType.OBSERVABILITY));
    replace(BUILDABLE_NOTIFICATION, catalog.buildable(AlertType.NOTIFICATION));
    replace(BUILDABLE_OBSERVABILITY, catalog.buildable(AlertType.OBSERVABILITY));
    RECIPIENTS.clear();
    for (AlertType alertType : List.of(AlertType.NOTIFICATION, AlertType.OBSERVABILITY)) {
      for (AlertCatalogSource source : catalog.sourcesOf(alertType)) {
        RECIPIENTS.put(kindKey(alertType, source.getName()), catalog.recipientCategoriesOf(source));
      }
    }
    DEFAULT_RECIPIENTS.clear();
    DEFAULT_RECIPIENTS.addAll(catalog.defaultRecipientCategories());
  }

  /**
   * Who alerts on the source can be sent to inside the platform, removed sources included, so an
   * alert saved with one still shows its recipients. Offered in the form, never enforced on save.
   */
  public static List<SubscriptionCategory> recipientCategoriesOf(
      AlertType alertType, String source) {
    return Collections.unmodifiableList(
        RECIPIENTS.getOrDefault(kindKey(alertType, source), DEFAULT_RECIPIENTS));
  }

  public static List<SubscriptionCategory> defaultRecipientCategories() {
    return Collections.unmodifiableList(DEFAULT_RECIPIENTS);
  }

  private static String kindKey(AlertType alertType, String source) {
    return alertType.value() + "/" + source.toLowerCase(Locale.ROOT);
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
