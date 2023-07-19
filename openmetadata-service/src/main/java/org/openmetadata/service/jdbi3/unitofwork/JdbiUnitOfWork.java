package org.openmetadata.service.jdbi3.unitofwork;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

/**
 * When annotating a Jersey resource method, wraps the method in a Jdbi transaction context associated with a valid
 * handle. <br>
 * <br>
 * A transaction will automatically {@code begin} before the resource method is invoked, {@code commit} if the method
 * returned without throwing any exception and {@code rollback} if an exception was thrown.
 */
@Target(METHOD)
@Retention(RUNTIME)
@Documented
public @interface JdbiUnitOfWork {}
