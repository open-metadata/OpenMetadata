package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import java.util.LinkedList;
import org.bitbucket.cowwoc.diffmatchpatch.DiffMatchPatch;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to generate inline diff with add/remove markers. Usage: {{diff oldValue newValue}}
 *
 * <p>Shows differences like: "This is <s>old</s> <b>new</b> text"
 */
public class DiffHelper implements HandlebarsHelper {

  private static final String INSERT_OPEN = "<b>";
  private static final String INSERT_CLOSE = "</b> ";
  private static final String DELETE_OPEN = "<s>";
  private static final String DELETE_CLOSE = "</s> ";
  private static final String SPACE = " ";

  @Override
  public String getName() {
    return "diff";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          String oldValue = context != null ? context.toString() : "";
          String newValue = extractNewValue(options);

          return generateDiff(oldValue, newValue);
        });
  }

  /**
   * Extracts the new value from Handlebars options parameters.
   *
   * @param options Handlebars options containing parameters
   * @return The new value string, or empty string if not present
   */
  private String extractNewValue(Options options) {
    if (options.params.length > 0 && options.param(0) != null) {
      return options.param(0).toString();
    }
    return "";
  }

  /**
   * Generates an inline diff between old and new values using DiffMatchPatch.
   * Inserts are marked with <b> tags, deletions with <s> tags.
   *
   * @param oldValue The original text
   * @param newValue The new text
   * @return HTML formatted diff string
   */
  private String generateDiff(String oldValue, String newValue) {
    DiffMatchPatch diffEngine = new DiffMatchPatch();
    LinkedList<DiffMatchPatch.Diff> diffs = diffEngine.diffMain(oldValue, newValue);
    diffEngine.diffCleanupSemantic(diffs);

    StringBuilder diffResult = new StringBuilder();

    for (DiffMatchPatch.Diff diff : diffs) {
      String trimmedText = diff.text.trim();

      if (trimmedText.isEmpty()) {
        continue;
      }

      String formattedDiff =
          switch (diff.operation) {
            case EQUAL -> trimmedText + SPACE;
            case INSERT -> INSERT_OPEN + trimmedText + INSERT_CLOSE;
            case DELETE -> DELETE_OPEN + trimmedText + DELETE_CLOSE;
          };

      diffResult.append(formattedDiff);
    }

    return diffResult.toString().trim();
  }
}
