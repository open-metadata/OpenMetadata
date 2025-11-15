package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to convert camelCase text to Title Case. Usage: {{camelCaseToTitle value}}
 *
 * <p>Examples:
 * <ul>
 *   <li>camelCase → Camel Case</li>
 *   <li>entityType → Entity Type</li>
 *   <li>testCase → Test Case</li>
 *   <li>dataContract → Data Contract</li>
 * </ul>
 */
public class CamelCaseToTitleHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "camelCaseToTitle";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return "";
          }

          return convertCamelCaseToTitle(context.toString());
        });
  }

  /**
   * Converts a camelCase string to Title Case with spaces.
   *
   * @param camelCase The camelCase string to convert
   * @return Title Case string with spaces
   */
  private String convertCamelCaseToTitle(String camelCase) {
    if (camelCase == null || camelCase.isEmpty()) {
      return camelCase;
    }

    // Insert space before each uppercase letter and capitalize first letter
    StringBuilder result = new StringBuilder();

    for (int i = 0; i < camelCase.length(); i++) {
      char currentChar = camelCase.charAt(i);

      // If uppercase and not the first character, add space before it
      if (Character.isUpperCase(currentChar) && i > 0) {
        result.append(' ');
      }

      // Capitalize first character, keep others as-is
      if (i == 0) {
        result.append(Character.toUpperCase(currentChar));
      } else {
        result.append(currentChar);
      }
    }

    return result.toString();
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("camelCaseToTitle")
        .withDescription("Convert camelCase to Title Case")
        .withCursorOffset(19)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{camelCaseToTitle }}")
                    .withExample("{{camelCaseToTitle \"entityType\"}}")));
  }
}
