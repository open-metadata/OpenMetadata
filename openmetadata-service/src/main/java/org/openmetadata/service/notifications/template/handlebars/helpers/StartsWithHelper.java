package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to check if a string starts with a prefix.
 * Usage: {{#if (startsWith name 'columns.')}}...{{/if}}
 */
public class StartsWithHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "startsWith";
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
          if (firstParam == null) {
            return false;
          }

          String textToCheck = context.toString();
          String prefix = firstParam.toString();

          return textToCheck.startsWith(prefix);
        });
  }
}
