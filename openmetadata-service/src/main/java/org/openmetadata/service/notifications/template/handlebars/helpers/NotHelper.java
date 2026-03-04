package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

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

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("not")
        .withDescription("Logical NOT operation on a value")
        .withCursorOffset(6)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{not }}")
                    .withExample("{{#if (not hasErrors)}}All tests passed{{/if}}")));
  }
}
