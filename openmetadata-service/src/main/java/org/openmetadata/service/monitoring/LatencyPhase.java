package org.openmetadata.service.monitoring;

import jakarta.ws.rs.NameBinding;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Binds {@link LatencyPhaseFilter} to resource classes or methods.
 *
 * <p>Use {@code value} to override the default phase naming derived from HTTP method.
 */
@NameBinding
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface LatencyPhase {
  String value() default "";
}
