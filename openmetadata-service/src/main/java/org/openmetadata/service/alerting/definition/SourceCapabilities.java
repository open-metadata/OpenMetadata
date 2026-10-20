package org.openmetadata.service.alerting.definition;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.events.AlertCapabilities;
import org.openmetadata.schema.api.events.AlertCapabilitiesRequest;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.AlertSourceCapability;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.type.FilterResourceDescriptor;

/**
 * What a selection of sources supports, derived where the save derives it, so the form cannot
 * offer something the save would reject. A source that would break a rule is
 * listed with the reason, to be shown disabled rather than fail on save.
 */
public final class SourceCapabilities {

  private SourceCapabilities() {}

  public static AlertCapabilities of(AlertCapabilitiesRequest request) {
    AlertType alertType = request.getAlertType();
    if (alertType != AlertType.NOTIFICATION && alertType != AlertType.OBSERVABILITY) {
      throw new BadRequestException(
          "Alerts of type " + alertType.value() + " have no catalog to choose sources from.");
    }
    List<String> selected = SeveralSources.distinct(listOrEmpty(request.getSources()));
    if (!selected.isEmpty()) {
      SeveralSources.requireCombinable(alertType, selected);
    }
    List<FilterResourceDescriptor> chosen = chosen(alertType, selected);
    AlertFilteringInput input =
        request.getInput() == null ? new AlertFilteringInput() : request.getInput();
    return new AlertCapabilities()
        .withAlertType(alertType)
        .withSources(everySource(alertType, selected, input))
        .withFilters(SharedConditions.filtersOfEvery(chosen))
        .withTriggers(SharedConditions.triggersOfAny(chosen))
        .withContainerEntities(union(chosen, FilterResourceDescriptor::getContainerEntities))
        .withEventTypes(
            union(
                chosen,
                source ->
                    ResourceEventTypes.forResource(source.getName()).stream()
                        .map(eventType -> eventType.value())
                        .toList()))
        .withRecipientCategories(recipientCategoriesAnySourceOffers(alertType, selected));
  }

  // Offered, never enforced on save. With no source chosen yet, the catalog's default.
  private static List<SubscriptionCategory> recipientCategoriesAnySourceOffers(
      AlertType alertType, List<String> selected) {
    Set<SubscriptionCategory> offered = EnumSet.noneOf(SubscriptionCategory.class);
    if (selected.isEmpty()) {
      offered.addAll(EventsSubscriptionRegistry.defaultRecipientCategories());
    }
    selected.forEach(
        source ->
            offered.addAll(EventsSubscriptionRegistry.recipientCategoriesOf(alertType, source)));
    return new ArrayList<>(offered);
  }

  private static List<AlertSourceCapability> everySource(
      AlertType alertType, List<String> selected, AlertFilteringInput input) {
    List<FilterResourceDescriptor> all =
        alertType == AlertType.OBSERVABILITY
            ? EventsSubscriptionRegistry.listObservabilityDescriptors()
            : EventsSubscriptionRegistry.listEntityNotificationDescriptors();
    List<AlertSourceCapability> capabilities = new ArrayList<>();
    for (FilterResourceDescriptor source : all) {
      boolean isSelected = selected.stream().anyMatch(source.getName()::equalsIgnoreCase);
      AlertSourceCapability capability =
          new AlertSourceCapability()
              .withName(source.getName())
              .withKind(EventsSubscriptionRegistry.kindOf(alertType, source.getName()))
              .withSelected(isSelected);
      if (isSelected) {
        capability.setWarning(UnreachableSource.reason(source, input));
      } else {
        capability.setReason(whyItCannotJoin(alertType, selected, source.getName()));
        capability.setCanJoin(capability.getReason() == null);
      }
      capabilities.add(capability);
    }
    return capabilities;
  }

  private static String whyItCannotJoin(AlertType alertType, List<String> selected, String source) {
    String reason = null;
    List<String> withIt = new ArrayList<>(selected);
    withIt.add(source);
    try {
      SeveralSources.requireCombinable(alertType, withIt);
    } catch (BadRequestException e) {
      reason = e.getMessage();
    }
    return reason;
  }

  // In name order, so the answer is the same whatever order the sources were picked in.
  private static List<FilterResourceDescriptor> chosen(AlertType alertType, List<String> selected) {
    return selected.stream()
        .map(source -> offered(alertType, source))
        .sorted(Comparator.comparing(FilterResourceDescriptor::getName))
        .toList();
  }

  private interface ListOf {
    List<String> of(FilterResourceDescriptor source);
  }

  private static List<String> union(List<FilterResourceDescriptor> chosen, ListOf values) {
    Set<String> all = new LinkedHashSet<>();
    chosen.forEach(source -> all.addAll(listOrEmpty(values.of(source))));
    return new ArrayList<>(all);
  }

  // A source the catalog no longer offers is still described for an alert that already has it, so
  // opening that alert shows what it holds; changing its definition is refused on save.
  private static FilterResourceDescriptor offered(AlertType alertType, String source) {
    FilterResourceDescriptor descriptor;
    try {
      descriptor =
          alertType == AlertType.OBSERVABILITY
              ? EventsSubscriptionRegistry.getObservabilityDescriptor(source)
              : EventsSubscriptionRegistry.getEntityNotificationDescriptor(source);
    } catch (IllegalArgumentException notOffered) {
      descriptor = EventsSubscriptionRegistry.getBuildableDescriptor(alertType, source);
    }
    return descriptor;
  }
}
