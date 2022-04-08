package org.openmetadata.catalog.jdbi3.locator;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.jdbi.v3.sqlobject.SqlOperation;
import org.jdbi.v3.sqlobject.statement.internal.SqlUpdateHandler;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD})
@SqlOperation(SqlUpdateHandler.class)
public @interface ConnectionAwareSqlUpdateContainer {
  ConnectionAwareSqlUpdate[] value();
}
