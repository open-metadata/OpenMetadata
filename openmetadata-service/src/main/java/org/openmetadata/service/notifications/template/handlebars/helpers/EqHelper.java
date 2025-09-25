package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.Objects;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to check if two values are equal.
 * Usage: {{#if (eq value1 value2)}}...{{/if}}
 */
public class EqHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "eq";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null || options.params.length == 0) {
            return false;
          }

          Object firstParam = options.param(0);

          // Compare the context with the first parameter
          return Objects.equals(context, firstParam);
        });
  }
}
