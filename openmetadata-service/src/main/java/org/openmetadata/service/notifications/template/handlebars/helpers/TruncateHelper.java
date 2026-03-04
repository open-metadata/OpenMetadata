package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to truncate a string to a maximum length.
 * Usage: {{truncate text maxLength}}
 * Example: {{truncate entity.description 100}}
 *
 * If the text exceeds maxLength, it will be truncated to (maxLength - 3) characters
 * and "..." will be appended.
 */
public class TruncateHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "truncate";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return "";
          }

          String text = context.toString();
          if (text.isEmpty()) {
            return text;
          }

          if (options.params.length == 0) {
            return text;
          }

          int maxLength;
          try {
            Object maxLengthParam = options.param(0);
            if (maxLengthParam instanceof Number number) {
              maxLength = number.intValue();
            } else {
              maxLength = Integer.parseInt(maxLengthParam.toString());
            }
          } catch (NumberFormatException e) {
            return text;
          }

          if (maxLength <= 0) {
            return "";
          }

          if (text.length() <= maxLength) {
            return text;
          }

          return text.substring(0, maxLength - 3) + "…";
        });
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("truncate")
        .withDescription("Truncate string to maximum length with ellipsis")
        .withCursorOffset(11)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{truncate }}")
                    .withExample("{{truncate entity.description 100}}")));
  }
}
