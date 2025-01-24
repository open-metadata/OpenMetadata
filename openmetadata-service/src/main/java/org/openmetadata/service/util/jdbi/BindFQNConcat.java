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

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER})
@SqlStatementCustomizingAnnotation(BindFQNConcat.Factory.class)
public @interface BindFQNConcat {
  String value(); // Name of the concatenated parameter to bind

  String original() default
      ""; // Optional: Use when both the original and concatenated values are needed

  String[] parts() default {}; // argument list containing parts to concatenate

  class Factory implements SqlStatementCustomizerFactory {
    @Override
    public SqlStatementParameterCustomizer createForParameter(
        Annotation annotation,
        Class<?> sqlObjectType,
        Method method,
        Parameter param,
        int index,
        Type type) {
      BindFQNConcat bind = (BindFQNConcat) annotation;

      return (stmt, arg) -> {
        String[] partsValues =
            (arg instanceof String[]) ? (String[]) arg : new String[] {String.valueOf(arg)};
        boolean hasNull = false;

        StringBuilder concatenatedResult = new StringBuilder();
        int partIndex = 0;
        for (String part : bind.parts()) {
          if (part.startsWith(":")) { // Dynamic value in argument list to replace placeholder
            if (partIndex >= partsValues.length) {
              throw new IllegalArgumentException(
                  "Not enough values for placeholders in @BindFQNConcat. Expected at least "
                      + (partIndex + 1)
                      + " but got "
                      + partsValues.length);
            }
            String dynamicValue = partsValues[partIndex++];
            if (dynamicValue == null) { // If any part is null, the whole concatenated value is null
              hasNull = true;
              break;
            }
            concatenatedResult.append(FullyQualifiedName.buildHash(dynamicValue));
          } else { // Static part of the string, defined directly in the annotation
            concatenatedResult.append(part);
          }
        }

        stmt.bind(bind.value(), hasNull ? null : concatenatedResult.toString());
        if (!bind.original().isEmpty()) {
          String originalValue = partsValues[0];
          stmt.bind(
              bind.original(),
              originalValue == null ? null : FullyQualifiedName.buildHash(originalValue));
        }
      };
    }
  }
}
