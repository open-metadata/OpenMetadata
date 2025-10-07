package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to check if one value is greater than another.
 * Usage: {{#if (gt value1 value2)}}...{{/if}}
 * Example: {{#if (gt entity.summary.total 0)}}...{{/if}}
 */
public class GtHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "gt";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null || options.params.length == 0) {
            return false;
          }

          try {
            double value1 = parseNumber(context);
            double value2 = parseNumber(options.param(0));

            return value1 > value2;
          } catch (Exception e) {
            return false;
          }
        });
  }

  private double parseNumber(Object value) {
    if (value instanceof Number number) {
      return number.doubleValue();
    }
    return Double.parseDouble(value.toString());
  }
}
