package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertCatalogFile;
import org.openmetadata.schema.entity.events.AlertCatalogLabels;
import org.openmetadata.schema.entity.events.AlertCatalogSource;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil;

/**
 * What an alert can watch and the conditions it can use, read from one file in which every filter
 * and trigger is written once and sources name the ones they support.
 *
 * <p>The catalog is read two ways. Clients are served what can be chosen today. Saved alerts are
 * built from everything any release has offered, because an alert saved years ago may name a
 * source, a filter or a trigger that is no longer offered, and it must still build.
 */
public final class AlertCatalog {

  public static final String FILE = "AlertCatalog.json";
  private static final String ALL_SOURCES = "all";

  private final String file;
  private final AlertCatalogFile content;
  private final Map<String, EventFilterRule> filters;
  private final Map<String, EventFilterRule> triggers;

  private AlertCatalog(String file, AlertCatalogFile content) {
    this.file = file;
    this.content = content;
    this.filters = byName("filter", listOrEmpty(content.getFilters()), List.of());
    this.triggers =
        byName(
            "trigger",
            listOrEmpty(content.getTriggers()),
            listOrEmpty(content.getRemovedTriggers()));
    sourcesOf(AlertType.NOTIFICATION).forEach(source -> validate(AlertType.NOTIFICATION, source));
    sourcesOf(AlertType.OBSERVABILITY).forEach(source -> validate(AlertType.OBSERVABILITY, source));
    rejectDuplicateSources(AlertType.NOTIFICATION);
    rejectDuplicateSources(AlertType.OBSERVABILITY);
    requireRecipientsInsideThePlatform();
  }

  /** The catalog this server ships with. Throws when it cannot be read or does not hold together. */
  public static AlertCatalog load() {
    List<String> found;
    try {
      found = EntityUtil.getJsonDataResources(String.format(".*json/data/%s$", FILE));
    } catch (IOException e) {
      throw new AlertCatalogException(FILE, "could not be looked up", e);
    }
    if (found.size() != 1) {
      throw new AlertCatalogException(
          FILE, "the file", "expected exactly one on the classpath, found " + found.size());
    }
    return parse(found.getFirst(), readResource(found.getFirst()));
  }

  public static AlertCatalog parse(String file, String json) {
    AlertCatalogFile content;
    try {
      content = JsonUtils.readValue(json, AlertCatalogFile.class);
    } catch (RuntimeException e) {
      throw new AlertCatalogException(file, "is not a valid catalog file", e);
    }
    if (content == null) {
      throw new AlertCatalogException(file, "the file", "is empty");
    }
    return new AlertCatalog(file, content);
  }

  private static String readResource(String path) {
    try {
      return CommonUtil.getResourceAsStream(AlertCatalog.class.getClassLoader(), path);
    } catch (IOException e) {
      throw new AlertCatalogException(path, "could not be read", e);
    }
  }

  /** What clients may choose from, in the shape this endpoint has always had. */
  public List<FilterResourceDescriptor> served(AlertType alertType) {
    List<FilterResourceDescriptor> served =
        sourcesOf(alertType).stream()
            .filter(source -> !Boolean.TRUE.equals(source.getRemoved()))
            .map(source -> descriptor(alertType, source, false))
            .toList();
    if (alertType == AlertType.NOTIFICATION) {
      giveTheWildcardEveryContainer(served);
    }
    return served;
  }

  /** What saved alerts are built from: everything served, and everything that once was. */
  public List<FilterResourceDescriptor> buildable(AlertType alertType) {
    return sourcesOf(alertType).stream()
        .map(source -> descriptor(alertType, source, true))
        .toList();
  }

  public List<AlertCatalogSource> sourcesOf(AlertType alertType) {
    return alertType == AlertType.NOTIFICATION
        ? listOrEmpty(content.getNotificationSources())
        : listOrEmpty(content.getObservabilitySources());
  }

  /** Who alerts can be sent to inside the platform, for a source that does not say. */
  public List<SubscriptionCategory> defaultRecipientCategories() {
    return listOrEmpty(content.getRecipientCategories());
  }

  // A source that lists no one takes the default: every source reaches someone.
  public List<SubscriptionCategory> recipientCategoriesOf(AlertCatalogSource source) {
    return listOrEmpty(source.getRecipientCategories()).isEmpty()
        ? defaultRecipientCategories()
        : source.getRecipientCategories();
  }

  public Set<String> definitionNames() {
    Set<String> names = new TreeSet<>(filters.keySet());
    names.addAll(triggers.keySet());
    return names;
  }

  public List<EventFilterRule> definitions() {
    List<EventFilterRule> all = new ArrayList<>(filters.values());
    all.addAll(triggers.values());
    return all;
  }

  private FilterResourceDescriptor descriptor(
      AlertType alertType, AlertCatalogSource source, boolean withRemoved) {
    List<String> filterNames = new ArrayList<>(listOrEmpty(source.getFilters()));
    List<String> triggerNames = new ArrayList<>(listOrEmpty(source.getTriggers()));
    if (withRemoved) {
      filterNames.addAll(listOrEmpty(source.getRemovedFilters()));
      triggerNames.addAll(listOrEmpty(source.getRemovedTriggers()));
    }
    FilterResourceDescriptor descriptor =
        new FilterResourceDescriptor()
            .withName(source.getName())
            .withContainerEntities(source.getContainerEntities())
            .withSupportedFilters(labelled(source, filterNames, filters));
    // Each alert type has always carried its own extra: triggers for one, event types for the
    // other.
    return alertType == AlertType.OBSERVABILITY
        ? descriptor.withSupportedActions(labelled(source, triggerNames, triggers))
        : descriptor.withSupportedEventTypes(ResourceEventTypes.forResource(source.getName()));
  }

  private static List<EventFilterRule> labelled(
      AlertCatalogSource source, List<String> names, Map<String, EventFilterRule> definitions) {
    List<EventFilterRule> rules = new ArrayList<>();
    for (String name : names) {
      EventFilterRule rule = JsonUtils.deepCopy(definitions.get(name), EventFilterRule.class);
      AlertCatalogLabels labels = source.getLabels() == null ? null : source.getLabels().get(name);
      if (labels != null && labels.getDisplayName() != null) {
        rule.setDisplayName(labels.getDisplayName());
      }
      if (labels != null && labels.getDescription() != null) {
        rule.setDescription(labels.getDescription());
      }
      rules.add(rule);
    }
    return rules;
  }

  // The wildcard spans every entity type, so a name filter on it can be scoped to any container.
  private static void giveTheWildcardEveryContainer(List<FilterResourceDescriptor> served) {
    List<String> everyContainer =
        served.stream()
            .map(FilterResourceDescriptor::getContainerEntities)
            .filter(Objects::nonNull)
            .flatMap(List::stream)
            .distinct()
            .toList();
    served.stream()
        .filter(descriptor -> ALL_SOURCES.equals(descriptor.getName()))
        .findFirst()
        .ifPresent(descriptor -> descriptor.setContainerEntities(everyContainer));
  }

  private Map<String, EventFilterRule> byName(
      String what, List<EventFilterRule> offered, List<EventFilterRule> removed) {
    Map<String, EventFilterRule> byName = new LinkedHashMap<>();
    List<EventFilterRule> all = new ArrayList<>(offered);
    all.addAll(removed);
    for (EventFilterRule definition : all) {
      String entry = what + " " + definition.getName();
      require(definition.getName() != null, what + " without a name", "every one needs a name");
      require(definition.getCondition() != null, entry, "has no condition");
      require(byName.put(definition.getName(), definition) == null, entry, "is defined twice");
    }
    return byName;
  }

  private void validate(AlertType alertType, AlertCatalogSource source) {
    String entry = alertType.value() + " source " + source.getName();
    require(source.getName() != null, alertType.value() + " source without a name", "needs a name");
    require(source.getKind() != null, entry, "does not say which kind of source it is");
    requireDefined(entry, "filter", source.getFilters(), filters);
    requireDefined(entry, "filter", source.getRemovedFilters(), filters);
    requireDefined(entry, "trigger", source.getTriggers(), triggers);
    requireDefined(entry, "trigger", source.getRemovedTriggers(), triggers);
    Set<String> supported = new TreeSet<>(listOrEmpty(source.getFilters()));
    supported.addAll(listOrEmpty(source.getTriggers()));
    for (String labelled :
        source.getLabels() == null ? Set.<String>of() : source.getLabels().keySet()) {
      require(
          supported.contains(labelled),
          entry,
          "labels " + labelled + ", which it does not support");
    }
  }

  private void requireDefined(
      String entry, String what, List<String> names, Map<String, EventFilterRule> definitions) {
    for (String name : listOrEmpty(names)) {
      require(
          definitions.containsKey(name),
          entry,
          "names the " + what + " " + name + ", which is not defined");
    }
  }

  // Recipients outside the platform are what a destination configures, never a source's offer.
  private void requireRecipientsInsideThePlatform() {
    require(
        !defaultRecipientCategories().isEmpty(),
        "recipientCategories",
        "offers no one to send alerts to");
    requireInsideThePlatform("recipientCategories", content.getRecipientCategories());
    for (AlertType alertType : List.of(AlertType.NOTIFICATION, AlertType.OBSERVABILITY)) {
      sourcesOf(alertType)
          .forEach(
              source ->
                  requireInsideThePlatform(
                      alertType.value() + " source " + source.getName(),
                      source.getRecipientCategories()));
    }
  }

  private void requireInsideThePlatform(String entry, List<SubscriptionCategory> categories) {
    require(
        !listOrEmpty(categories).contains(SubscriptionCategory.EXTERNAL),
        entry,
        "offers External recipients, which only a destination configures");
  }

  private void rejectDuplicateSources(AlertType alertType) {
    Set<String> seen = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    for (AlertCatalogSource source : sourcesOf(alertType)) {
      require(
          seen.add(source.getName()),
          alertType.value() + " source " + source.getName(),
          "is listed twice");
    }
  }

  private void require(boolean holds, String entry, String problem) {
    if (!holds) {
      throw new AlertCatalogException(file, entry, problem);
    }
  }
}
