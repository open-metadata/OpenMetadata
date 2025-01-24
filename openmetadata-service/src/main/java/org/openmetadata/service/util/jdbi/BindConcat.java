package org.openmetadata.service.util.jdbi;

import java.lang.annotation.Annotation;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER})
@SqlStatementCustomizingAnnotation(BindConcat.Factory.class)
public @interface BindConcat {
  String value(); // Name of the concatenated parameter to bind

  String original() default
      ""; // Optional: Use when both the original and concatenated values are needed

  String[] parts() default {}; // Parts to concatenate (placeholders or static values)

  class Factory implements SqlStatementCustomizerFactory {

    @Override
    public SqlStatementParameterCustomizer createForParameter(
        Annotation annotation,
        Class<?> sqlObjectType,
        Method method,
        Parameter param,
        int index,
        Type type) {
      BindConcat bind = (BindConcat) annotation;

      return (stmt, arg) -> {
        String[] placeholders =
            (arg instanceof String[]) ? (String[]) arg : new String[] {String.valueOf(arg)};
        StringBuilder concatenatedResult = new StringBuilder();
        boolean containsNull = false;

        int placeholderIndex = 0;
        for (String part : bind.parts()) {
          if (part.startsWith(":")) { // Dynamic value in argument list to replace placeholder
            if (placeholderIndex >= placeholders.length) {
              throw new IllegalArgumentException(
                  "Not enough values for placeholders in @BindConcat. Expected at least "
                      + (placeholderIndex + 1)
                      + " but got "
                      + placeholders.length);
            }
            String dynamicValue = placeholders[placeholderIndex++];
            if (dynamicValue == null) {
              containsNull = true;
              break;
            }
            concatenatedResult.append(dynamicValue);
          } else { // Static part of the string, defined directly in the annotation
            concatenatedResult.append(part);
          }
        }

        String finalValue = containsNull ? null : concatenatedResult.toString();
        stmt.bind(bind.value(), finalValue);
        if (!bind.original().isEmpty() && placeholders.length > 0) {
          String originalValue = placeholders[0];
          stmt.bind(bind.original(), originalValue);
        }
      };
    }
  }
}
