package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to negate a boolean value.
 * Usage: {{#if (not value)}}...{{/if}}
 */
public class NotHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "not";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          return !isTruthy(context);
        });
  }

  private boolean isTruthy(Object value) {
    return switch (value) {
      case null -> false;
      case Boolean b -> b;
      case String s -> !s.isEmpty();
      case Number number -> number.doubleValue() != 0;
      default -> true;
    };
  }
}
