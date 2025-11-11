package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import java.util.regex.Pattern;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to split a string by a delimiter.
 * Usage: {{#with (split fieldName '.')}}{{.[1]}}{{/with}}
 */
public class SplitHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "split";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null || options.params.length == 0) {
            return new String[0];
          }

          String textToSplit = context.toString();
          Object delimiterParam = options.param(0);

          if (delimiterParam == null) {
            return new String[] {textToSplit};
          }

          String delimiter = delimiterParam.toString();
          return textToSplit.split(Pattern.quote(delimiter));
        });
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("split")
        .withDescription("Split string into array by delimiter")
        .withCursorOffset(8)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{split }}")
                    .withExample("{{#each (split fieldName \".\")}}{{this}}{{/each}}")));
  }
}
