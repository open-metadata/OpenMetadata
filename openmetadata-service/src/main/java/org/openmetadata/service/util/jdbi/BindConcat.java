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
import org.openmetadata.service.util.FullyQualifiedName;

/** Concatenate parts of a string to bind as a parameter, and avoid usage of CONCAT() in where clause */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER})
@SqlStatementCustomizingAnnotation(BindConcat.Factory.class)
public @interface BindConcat {
  String value(); // Name of the concatenated parameter to bind

  String original() default
      ""; // Optional: Use when both the original and concatenated values are needed

  String[] parts() default {}; // Parts to concatenate (placeholders or static values)

  boolean hash() default false; // Optional: Apply FullyQualifiedName.buildHash if true

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
        String[] partValues =
            (arg instanceof String[]) ? (String[]) arg : new String[] {String.valueOf(arg)};
        StringBuilder concatenatedResult = new StringBuilder();
        boolean containsNull = false;

        for (int i = 0; i < bind.parts().length; i++) {
          String part = bind.parts()[i];
          if (part.startsWith(":")) { // Dynamic value in argument list to replace placeholder
            if (i >= partValues.length)
              throw new IllegalArgumentException(
                  "Not enough values for placeholders in @BindConcat. Expected at least "
                      + (i + 1)
                      + " but got "
                      + partValues.length);
            String dynamicValue = partValues[i];
            if (dynamicValue == null) {
              containsNull = true;
              break;
            }
            concatenatedResult.append(
                bind.hash() ? FullyQualifiedName.buildHash(dynamicValue) : dynamicValue);
          } else { // Static part of the string, defined directly in the annotation
            concatenatedResult.append(part);
          }
        }

        String finalValue = containsNull ? null : concatenatedResult.toString();
        stmt.bind(bind.value(), finalValue);
        if (!bind.original().isEmpty() && partValues.length > 0) {
          String originalValue = partValues[0];
          stmt.bind(
              bind.original(),
              bind.hash() ? FullyQualifiedName.buildHash(originalValue) : originalValue);
        }
      };
    }
  }
}
