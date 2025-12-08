package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to limit an array to the first N items.
 * Usage: {{#each (limit list 5)}}...{{/each}}
 * Example: {{#each (limit failedTests 5)}}...{{/each}}
 */
public class LimitHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "limit";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null || !(context instanceof Collection<?>)) {
            return new ArrayList<>();
          }

          if (options.params.length == 0) {
            return new ArrayList<>((Collection<?>) context);
          }

          Collection<?> collection = (Collection<?>) context;
          int limit;

          try {
            Object limitParam = options.param(0);
            if (limitParam instanceof Number number) {
              limit = number.intValue();
            } else {
              limit = Integer.parseInt(limitParam.toString());
            }
          } catch (NumberFormatException e) {
            return new ArrayList<>(collection);
          }

          if (limit <= 0) {
            return new ArrayList<>();
          }

          List<Object> limited = new ArrayList<>();
          int count = 0;
          for (Object item : collection) {
            if (count >= limit) {
              break;
            }
            limited.add(item);
            count++;
          }

          return limited;
        });
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("limit")
        .withDescription("Limit array to first N items")
        .withCursorOffset(8)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{limit }}")
                    .withExample("{{#each (limit failedTests 5)}}{{name}}{{/each}}")));
  }
}
