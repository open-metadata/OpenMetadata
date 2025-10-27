package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to check if all values are truthy.
 * Usage: {{#if (and value1 value2 value3)}}...{{/if}}
 */
public class AndHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "and";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          // Check if context is falsy - short circuit
          if (!isTruthy(context)) {
            return false;
          }

          // Check if all parameters are truthy
          if (options.params != null) {
            for (Object param : options.params) {
              if (!isTruthy(param)) {
                return false;
              }
            }
          }

          return true;
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
}
