package org.openmetadata.service.notifications.channels;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * An upper bound of the cells the tables in a Markdown text parse into, read line by line without
 * parsing. A table never crosses a blank line or a code fence, and it needs a delimiter row such as
 * {@code |---|---|}, so each run of lines that holds one can hold at most its line count times its
 * widest line's cell count. Lines inside fenced code are never part of a table. A fence inside a
 * quote or a list is not recognised, so its lines are counted, which can only overestimate.
 */
final class TableCells {

  // At most three spaces, then three or more backticks or tildes; a backtick fence's info string
  // holds no backtick.
  private static final Pattern OPENING_FENCE =
      Pattern.compile("^ {0,3}+(`{3,}+(?=[^`]*+$)|~{3,}+)");
  private static final int MAX_FENCE_INDENT = 3;

  private long cells;
  private long linesInRun;
  private long widestRow;
  private boolean runHasDelimiterRow;
  private String openFence;

  private TableCells() {}

  static long in(String markdown) {
    TableCells tables = new TableCells();
    markdown.lines().forEach(tables::read);
    tables.endRun();
    return tables.cells;
  }

  private void read(String line) {
    if (openFence != null) {
      openFence = closes(openFence, line) ? null : openFence;
    } else {
      readOutsideFence(line);
    }
  }

  private void readOutsideFence(String line) {
    String fence = openingFence(line);
    if (fence != null || line.isBlank()) {
      endRun();
      openFence = fence;
    } else {
      addToRun(line);
    }
  }

  private void addToRun(String line) {
    linesInRun++;
    widestRow = Math.max(widestRow, pipesIn(line) + 1L);
    runHasDelimiterRow |= isDelimiterRow(line);
  }

  private void endRun() {
    cells += runHasDelimiterRow ? linesInRun * widestRow : 0;
    linesInRun = 0;
    widestRow = 0;
    runHasDelimiterRow = false;
  }

  private static String openingFence(String line) {
    Matcher fence = OPENING_FENCE.matcher(line);
    return fence.find() ? fence.group(1) : null;
  }

  private static boolean closes(String fence, String line) {
    String rest = withoutFenceIndent(line);
    int run = leadingRunOf(rest, fence.charAt(0));
    return run >= fence.length() && rest.substring(run).isBlank();
  }

  // Up to three leading spaces; a line indented further is left as it is, so it closes nothing.
  private static String withoutFenceIndent(String line) {
    int spaces = leadingRunOf(line, ' ');
    return spaces <= MAX_FENCE_INDENT ? line.substring(spaces) : line;
  }

  private static int leadingRunOf(String text, char repeated) {
    int run = 0;
    while (run < text.length() && text.charAt(run) == repeated) {
      run++;
    }
    return run;
  }

  // Quote markers and spacing aside, only pipes, dashes and colons, with at least one dash.
  private static boolean isDelimiterRow(String line) {
    String cells = line.replaceAll("[\\s>]", "");
    return cells.indexOf('-') >= 0 && cells.chars().allMatch(c -> c == '|' || c == '-' || c == ':');
  }

  private static long pipesIn(String line) {
    return line.chars().filter(c -> c == '|').count();
  }
}
