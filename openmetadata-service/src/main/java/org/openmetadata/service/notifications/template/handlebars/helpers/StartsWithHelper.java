package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

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

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("startsWith")
        .withDescription("Check if string starts with prefix")
        .withCursorOffset(13)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{startsWith }}")
                    .withExample(
                        "{{#if (startsWith fieldName \"columns.\")}}Field is a column{{/if}}")));
  }
}
