package org.openmetadata.service.jdbi3;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.CONSTRUCTOR})
public @interface Repository {
  /** Order of initialization of repository starting from 0. Only order from 0 to 9 (inclusive) are allowed */
  int order() default 9;
}
