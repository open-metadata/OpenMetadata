package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import java.util.Objects;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

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

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("eq")
        .withDescription("Check if two values are equal")
        .withCursorOffset(5)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{eq }}")
                    .withExample("{{#if (eq status \"Success\")}}Test passed{{/if}}")));
  }
}
