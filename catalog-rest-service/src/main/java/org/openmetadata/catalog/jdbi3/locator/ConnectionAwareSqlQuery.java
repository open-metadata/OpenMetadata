package org.openmetadata.catalog.jdbi3.locator;

import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD})
@Repeatable(ConnectionAwareSqlQueryContainer.class)
public @interface ConnectionAwareSqlQuery {
  String value() default "";

  ConnectionType connectionType();
}
