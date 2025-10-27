package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.Collection;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to get the length of an array or collection.
 * Usage: {{length list}}
 * Example: {{#if (gt (length failedTests) 0)}}...{{/if}}
 */
public class LengthHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "length";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return 0;
          }

          if (context instanceof Collection<?> collection) {
            return collection.size();
          }

          if (context instanceof Object[] array) {
            return array.length;
          }

          if (context instanceof String str) {
            return str.length();
          }

          return 0;
        });
  }
}
