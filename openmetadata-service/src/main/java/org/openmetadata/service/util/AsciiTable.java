package org.openmetadata.service.util;

import java.util.ArrayList;
import java.util.List;

public record AsciiTable(
    List<String> columns,
    List<List<String>> rows,
    boolean printHeader,
    String nullText,
    String emptyText) {
  private static final String DEFAULT_COLUMN_NAME = "(No column name)";
  private static final String DEFAULT_NO_VALUE = "-";

  public AsciiTable(
      List<String> columns,
      List<List<String>> rows,
      boolean printHeader,
      String nullText,
      String emptyText) {
    this.columns = ensureValidColumns(columns);
    this.rows = rows;
    this.printHeader = printHeader;
    this.nullText = nullText;
    this.emptyText = emptyText;
  }

  private static List<String> ensureValidColumns(List<String> columns) {
    List<String> validColumns = new ArrayList<>();
    for (String column : columns) {
      validColumns.add(column != null ? column : DEFAULT_COLUMN_NAME);
    }
    return validColumns;
  }

  /**
   * Return table rendered with column header and row data.
   */
  public String render() {
    List<Integer> widths = new ArrayList<>();
    for (String column : columns) {
      widths.add(column.length());
    }

    for (List<String> row : rows) {
      for (int i = 0; i < row.size(); i++) {
        widths.set(i, Math.max(widths.get(i), getValue(row, i).length()));
      }
    }

    StringBuilder ruler = new StringBuilder("+");
    for (Integer width : widths) {
      ruler.append("-").append(trimOrPad("", width, '-')).append("-+");
    }
    ruler.append("\n");

    StringBuilder result = new StringBuilder();

    if (printHeader) {
      StringBuilder header = new StringBuilder("|");
      for (int i = 0; i < widths.size(); i++) {
        header.append(" ").append(trimOrPad(columns.get(i), widths.get(i), ' ')).append(" |");
      }
      header.append("\n");

      result.append(ruler);
      result.append(header);
    }

    result.append(ruler);

    if (rows.isEmpty()) {
      result
          .append("| ")
          .append(trimOrPad(emptyText, ruler.length() - Math.min(ruler.length(), 5)))
          .append(" |\n");
    } else {
      for (List<String> row : rows) {
        StringBuilder r = new StringBuilder("|");
        for (int i = 0; i < widths.size(); i++) {
          r.append(" ").append(trimOrPad(getValue(row, i), widths.get(i), ' ')).append(" |");
        }
        r.append("\n");
        result.append(r);
      }
    }

    result.append(ruler);
    return result.toString();
  }

  private String getValue(List<String> row, int i) {
    try {
      String value = row.get(i);
      if (value == null) {
        value = nullText;
      }
      return value;
    } catch (IndexOutOfBoundsException e) {
      return DEFAULT_NO_VALUE;
    }
  }

  private String trimOrPad(String str, int length, char padChar) {
    StringBuilder result;
    if (str == null) {
      result = new StringBuilder();
    } else {
      result = new StringBuilder(str);
    }

    if (result.length() > length) {
      return result.substring(0, length);
    }

    while (result.length() < length) {
      result.append(padChar);
    }
    return result.toString();
  }

  private String trimOrPad(String str, int length) {
    return trimOrPad(str, length, ' ');
  }
}
