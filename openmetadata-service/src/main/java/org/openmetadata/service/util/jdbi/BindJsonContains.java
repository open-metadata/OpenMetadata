package org.openmetadata.service.util.jdbi;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;

// The annotation
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER})
@SqlStatementCustomizingAnnotation(JsonContainsFilterFactory.class)
public @interface BindJsonContains {
  /**
   * Parameter name to bind to
   */
  String value() default Bind.NO_VALUE;

  /**
   * JSON path to filter on
   */
  String path();

  /**
   * Property to compare with
   */
  String property();

  /**
   * If the value is null, use this value. Useful for chaining multiple filters with AND/OR
   */
  String ifNull() default "TRUE";
}
