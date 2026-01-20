package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

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

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("gt")
        .withDescription("Check if first value is greater than second")
        .withCursorOffset(5)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{gt }}")
                    .withExample(
                        "{{#if (gt entity.summary.total 0)}}Total: {{entity.summary.total}}{{/if}}")));
  }
}
