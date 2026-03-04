package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to check if any of the values are truthy.
 * Usage: {{#if (or value1 value2 value3)}}...{{/if}}
 */
public class OrHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "or";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          // Check if context is truthy
          if (isTruthy(context)) {
            return true;
          }

          // Check if any parameter is truthy
          if (options.params != null) {
            for (Object param : options.params) {
              if (isTruthy(param)) {
                return true;
              }
            }
          }

          return false;
        });
  }

  private boolean isTruthy(Object value) {
    if (value == null) {
      return false;
    }
    if (value instanceof Boolean) {
      return (Boolean) value;
    }
    if (value instanceof String) {
      return !((String) value).isEmpty();
    }
    if (value instanceof Number) {
      return ((Number) value).doubleValue() != 0;
    }
    // Non-null objects are considered truthy
    return true;
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("or")
        .withDescription("Logical OR operation on two values")
        .withCursorOffset(5)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{or }}")
                    .withExample("{{#if (or hasUpdates hasAdds)}}Changes detected{{/if}}")));
  }
}
