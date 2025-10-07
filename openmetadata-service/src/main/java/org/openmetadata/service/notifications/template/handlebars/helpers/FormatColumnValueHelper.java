package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.Map;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to format column values based on their type. Usage: {{formatColumnValue columnData}}
 *
 * <p>Formats column definitions as: columnName (type, constraints)
 */
public class FormatColumnValueHelper implements HandlebarsHelper {

  private static final String EMPTY_VALUE = "<em>empty</em>";

  @Override
  public String getName() {
    return "formatColumnValue";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return EMPTY_VALUE;
          }

          return switch (context) {
            case Map<?, ?> columnMap -> formatColumnData(columnMap);
            default -> context.toString();
          };
        });
  }

  /**
   * Formats column data into a readable string representation.
   * Format: columnName (dataType, constraint) or just columnName if no metadata.
   *
   * @param columnData Map containing column metadata
   * @return Formatted column string
   */
  private String formatColumnData(Map<?, ?> columnData) {
    Object nameValue = columnData.get("name");
    Object dataTypeValue = columnData.get("dataType");
    Object constraintValue = columnData.get("constraint");

    String columnName = nameValue != null ? nameValue.toString() : "";

    if (dataTypeValue == null) {
      return columnName;
    }

    StringBuilder formattedColumn = new StringBuilder(columnName);
    formattedColumn.append(" (").append(dataTypeValue);

    if (constraintValue != null) {
      formattedColumn.append(", ").append(constraintValue);
    }

    formattedColumn.append(")");
    return formattedColumn.toString();
  }
}
