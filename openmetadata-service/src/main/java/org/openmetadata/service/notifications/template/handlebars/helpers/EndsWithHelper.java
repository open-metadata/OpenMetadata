package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to check if a string ends with a given suffix.
 * Usage: {{#if (endsWith name '.tags')}}...{{/if}}
 */
public class EndsWithHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "endsWith";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (Helper<String>)
            (text, options) -> {
              if (text == null || options.params.length == 0) {
                return false;
              }

              Object suffixParam = options.param(0);
              if (suffixParam == null) {
                return false;
              }

              return text.endsWith(suffixParam.toString());
            });
  }
}
