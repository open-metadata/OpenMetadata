package org.openmetadata.service.jdbi3.locator;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.jdbi.v3.core.extension.annotation.UseExtensionHandler;
import org.jdbi.v3.sqlobject.SqlObjectFactory;
import org.jdbi.v3.sqlobject.statement.internal.SqlBatchHandler;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD})
@UseExtensionHandler(id = SqlObjectFactory.EXTENSION_ID, value = SqlBatchHandler.class)
public @interface ConnectionAwareSqlBatchContainer {
  ConnectionAwareSqlBatch[] value();
}
