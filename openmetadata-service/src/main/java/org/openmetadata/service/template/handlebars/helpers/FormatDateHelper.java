package org.openmetadata.service.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.text.SimpleDateFormat;
import java.util.Date;
import org.openmetadata.service.template.handlebars.HandlebarsHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Helper to format dates in a readable format. Usage: {{formatDate timestamp}}
 *
 * <p>Handles Long timestamps, Date objects, and String timestamps.
 */
public class FormatDateHelper implements HandlebarsHelper {
  private static final Logger LOG = LoggerFactory.getLogger(FormatDateHelper.class);
  private static final String DATE_FORMAT_PATTERN = "yyyy-MM-dd HH:mm:ss";
  private static final ThreadLocal<SimpleDateFormat> DATE_FORMATTER =
      ThreadLocal.withInitial(() -> new SimpleDateFormat(DATE_FORMAT_PATTERN));

  @Override
  public String getName() {
    return "formatDate";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return "";
          }

          try {
            Date dateToFormat = parseToDate(context);
            if (dateToFormat != null) {
              return DATE_FORMATTER.get().format(dateToFormat);
            }
          } catch (Exception e) {
            LOG.warn("Error formatting date for value '{}': {}", context, e.getMessage());
          }

          return context.toString();
        });
  }

  /**
   * Parses various input types to a Date object.
   * Supports Long timestamps, Date objects, and String representations of timestamps.
   *
   * @param input The input object to parse
   * @return Date object if parsing successful, null otherwise
   */
  private Date parseToDate(Object input) {
    return switch (input) {
      case Long timestamp -> new Date(timestamp);
      case Date date -> date;
      case String stringValue -> parseStringToDate(stringValue);
      default -> null;
    };
  }

  /**
   * Attempts to parse a string as a timestamp.
   *
   * @param stringValue The string to parse
   * @return Date object if string is a valid timestamp, null otherwise
   */
  private Date parseStringToDate(String stringValue) {
    try {
      long timestamp = Long.parseLong(stringValue);
      return new Date(timestamp);
    } catch (NumberFormatException e) {
      // Not a timestamp string, return null to fall back to string representation
      return null;
    }
  }
}
