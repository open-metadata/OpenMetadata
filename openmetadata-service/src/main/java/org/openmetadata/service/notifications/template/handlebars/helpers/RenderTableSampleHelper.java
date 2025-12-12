/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.Options;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to render failedRowsSample data as an HTML table. The input object is expected to have:
 * - columns: List of column names - rows: List of row data (each row is a list of values)
 *
 * <p>Template usage: {{{renderTableSample entity.failedRowsSample}}}
 *
 * <p>Note: Use triple braces {{{ }}} to prevent HTML escaping.
 */
public class RenderTableSampleHelper implements HandlebarsHelper {

  private static final int MAX_ROWS = 10;
  private static final int MAX_CELL_LENGTH = 100;

  @Override
  public String getName() {
    return "renderTableSample";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(getName(), (Helper<Object>) this::renderTable);
  }

  @SuppressWarnings("unchecked")
  private CharSequence renderTable(Object context, Options options) throws IOException {
    if (context == null) {
      return "";
    }

    List<String> columns;
    List<List<Object>> rows;

    if (context instanceof Map<?, ?> map) {
      columns = (List<String>) map.get("columns");
      rows = (List<List<Object>>) map.get("rows");
    } else {
      return "";
    }

    if (columns == null || columns.isEmpty()) {
      return "";
    }

    StringBuilder html = new StringBuilder();
    html.append(
        "<table style=\"border-collapse:collapse;width:100%;margin:8px 0;font-size:13px;\">\n");

    html.append("<thead>\n<tr style=\"background:#f5f5f5;\">\n");
    for (String col : columns) {
      html.append(
          "<th style=\"border:1px solid #ddd;padding:8px 12px;text-align:left;font-weight:600;\">");
      html.append(escapeHtml(col));
      html.append("</th>\n");
    }
    html.append("</tr>\n</thead>\n");

    html.append("<tbody>\n");
    if (rows != null && !rows.isEmpty()) {
      int rowCount = 0;
      for (List<Object> row : rows) {
        if (rowCount >= MAX_ROWS) {
          html.append("<tr>\n");
          html.append("<td colspan=\"")
              .append(columns.size())
              .append(
                  "\" style=\"border:1px solid #ddd;padding:8px 12px;text-align:center;font-style:italic;color:#666;\">")
              .append("... and ")
              .append(rows.size() - MAX_ROWS)
              .append(" more row(s)")
              .append("</td>\n");
          html.append("</tr>\n");
          break;
        }

        html.append("<tr>\n");
        for (int i = 0; i < columns.size(); i++) {
          Object value = (i < row.size()) ? row.get(i) : "";
          String cellValue = formatCellValue(value);
          html.append("<td style=\"border:1px solid #ddd;padding:8px 12px;\">");
          html.append(escapeHtml(cellValue));
          html.append("</td>\n");
        }
        html.append("</tr>\n");
        rowCount++;
      }
    } else {
      html.append("<tr>\n");
      html.append("<td colspan=\"")
          .append(columns.size())
          .append(
              "\" style=\"border:1px solid #ddd;padding:8px 12px;text-align:center;font-style:italic;color:#666;\">")
          .append("No data")
          .append("</td>\n");
      html.append("</tr>\n");
    }
    html.append("</tbody>\n");

    html.append("</table>");

    return new Handlebars.SafeString(html.toString());
  }

  private String formatCellValue(Object value) {
    if (value == null) {
      return "null";
    }
    String str = String.valueOf(value);
    if (str.length() > MAX_CELL_LENGTH) {
      return str.substring(0, MAX_CELL_LENGTH - 3) + "...";
    }
    return str;
  }

  private String escapeHtml(String text) {
    if (text == null) return "";
    return text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("renderTableSample")
        .withDescription("Render failedRowsSample as an HTML table")
        .withCursorOffset(19)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{{renderTableSample object}}}")
                    .withExample("{{{renderTableSample entity.failedRowsSample}}}")));
  }
}
