package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.Collection;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

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

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("length")
        .withDescription("Get length of array or string")
        .withCursorOffset(10)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{length }}")
                    .withExample(
                        "{{#if (gt (length failedTests) 0)}}Found {{length failedTests}} failures{{/if}}")));
  }
}
