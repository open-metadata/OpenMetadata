package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to filter arrays by property value.
 * Usage: {{#with (filter list propertyName=value) as |filtered|}}...{{/with}}
 * Example: {{#with (filter testCaseResultSummary status='Failed') as |failedTests|}}
 */
public class FilterHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "filter";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null || !(context instanceof Collection<?>)) {
            return new ArrayList<>();
          }

          Collection<?> collection = (Collection<?>) context;

          // Check if we have property=value hash parameters
          if (options.hash.isEmpty()) {
            return new ArrayList<>(collection);
          }

          // Filter based on hash parameters
          List<Object> filtered = new ArrayList<>();
          for (Object item : collection) {
            if (matchesFilter(item, options.hash)) {
              filtered.add(item);
            }
          }

          return filtered;
        });
  }

  private boolean matchesFilter(Object item, Map<String, Object> filterParams) {
    if (item == null) {
      return false;
    }

    // Item must be a Map to extract properties
    if (!(item instanceof Map<?, ?> itemMap)) {
      return false;
    }

    // Check if all filter parameters match
    for (Map.Entry<String, Object> filter : filterParams.entrySet()) {
      String propertyName = filter.getKey();
      Object expectedValue = filter.getValue();
      Object actualValue = itemMap.get(propertyName);

      // Compare values
      if (actualValue == null || !actualValue.equals(expectedValue)) {
        return false;
      }
    }

    return true;
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("filter")
        .withDescription("Filter array by property values")
        .withCursorOffset(9)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{filter }}")
                    .withExample(
                        "{{#with (filter testResults status=\"Failed\") as |failed|}}{{length failed}} failed{{/with}}")));
  }
}
