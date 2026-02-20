package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to perform binary mathematical operations.
 * Usage: {{math value1 operator value2}}
 * Operators: +, -, *, /, %, round
 * Examples:
 *   {{math @index '+' 1}} - Add 1 to index
 *   {{math (math success '*' 100) '/' total}} - Calculate percentage (nested)
 *   {{math 3.14159 'round' 2}} - Round to 2 decimal places (returns 3.14)
 */
public class MathHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "math";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null || options.params.length < 2) {
            return 0;
          }

          try {
            // Parse first operand
            double value1 = parseNumber(context);

            // Parse operator
            String operator = options.param(0).toString();

            // Parse second operand
            double value2 = parseNumber(options.param(1));

            // Perform operation
            double result =
                switch (operator) {
                  case "+" -> value1 + value2;
                  case "-" -> value1 - value2;
                  case "*" -> value1 * value2;
                  case "/" -> {
                    if (value2 == 0) {
                      throw new ArithmeticException("Division by zero");
                    }
                    yield value1 / value2;
                  }
                  case "%" -> value1 % value2;
                  case "round" -> {
                    int decimalPlaces = (int) value2;
                    if (decimalPlaces < 0) {
                      decimalPlaces = 0;
                    }
                    BigDecimal bd = BigDecimal.valueOf(value1);
                    bd = bd.setScale(decimalPlaces, RoundingMode.HALF_UP);
                    yield bd.doubleValue();
                  }
                  default -> throw new IllegalArgumentException(
                      "Unsupported operator: " + operator);
                };

            // Return as integer if no decimal part, otherwise as double
            if (result == Math.floor(result)) {
              return (int) result;
            }
            return result;

          } catch (Exception e) {
            return 0;
          }
        });
  }

  private double parseNumber(Object value) {
    if (value instanceof Number number) {
      return number.doubleValue();
    }
    return Double.parseDouble(value.toString());
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("math")
        .withDescription("Perform mathematical operations")
        .withCursorOffset(8)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{math }}")
                    .withExample("{{math @index '+' 1}}"),
                new HandlebarsHelperUsage()
                    .withSyntax("{{math }}")
                    .withExample("{{math 3.14159 'round' 2}}")));
  }
}
