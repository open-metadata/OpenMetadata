package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

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
}
