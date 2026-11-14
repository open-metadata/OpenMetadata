package org.openmetadata.service.jdbi3.locator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import org.jdbi.v3.core.config.ConfigRegistry;
import org.jdbi.v3.core.extension.annotation.UseExtensionHandler;
import org.jdbi.v3.sqlobject.SqlObjectFactory;
import org.jdbi.v3.sqlobject.statement.internal.SqlBatchHandler;
import org.jdbi.v3.sqlobject.statement.internal.SqlQueryHandler;
import org.jdbi.v3.sqlobject.statement.internal.SqlUpdateHandler;
import org.junit.jupiter.api.Test;

class ConnectionAwareAnnotationSqlLocatorTest {

  interface TestDao {
    @ConnectionAwareSqlBatch(value = "BATCH_MYSQL", connectionType = ConnectionType.MYSQL)
    void singleBatch();

    @ConnectionAwareSqlQuery(value = "QUERY_POSTGRES", connectionType = ConnectionType.POSTGRES)
    String singleQuery();

    @ConnectionAwareSqlUpdate(value = "UPDATE_MYSQL", connectionType = ConnectionType.MYSQL)
    @ConnectionAwareSqlUpdate(value = "UPDATE_POSTGRES", connectionType = ConnectionType.POSTGRES)
    void repeatedUpdate();
  }

  @Test
  void everyAnnotationRegistersItsSqlObjectStatementHandler() {
    assertStatementHandler(ConnectionAwareSqlBatch.class, SqlBatchHandler.class);
    assertStatementHandler(ConnectionAwareSqlBatchContainer.class, SqlBatchHandler.class);
    assertStatementHandler(ConnectionAwareSqlQuery.class, SqlQueryHandler.class);
    assertStatementHandler(ConnectionAwareSqlQueryContainer.class, SqlQueryHandler.class);
    assertStatementHandler(ConnectionAwareSqlUpdate.class, SqlUpdateHandler.class);
    assertStatementHandler(ConnectionAwareSqlUpdateContainer.class, SqlUpdateHandler.class);
  }

  private static void assertStatementHandler(
      Class<? extends Annotation> annotationType, Class<?> expectedHandler) {
    UseExtensionHandler handler = annotationType.getAnnotation(UseExtensionHandler.class);
    assertNotNull(handler, annotationType.getSimpleName() + " has no SQL object handler");
    assertEquals(SqlObjectFactory.EXTENSION_ID, handler.id());
    assertEquals(expectedHandler, handler.value());
  }

  @Test
  void locatesSingleBatchAnnotation() throws Exception {
    ConnectionAwareAnnotationSqlLocator locator =
        new ConnectionAwareAnnotationSqlLocator("com.mysql.cj.jdbc.Driver");
    Method method = TestDao.class.getMethod("singleBatch");

    String sql = locator.locate(TestDao.class, method, new ConfigRegistry());
    assertEquals("BATCH_MYSQL", sql);
  }

  @Test
  void locatesSingleQueryAnnotation() throws Exception {
    ConnectionAwareAnnotationSqlLocator locator =
        new ConnectionAwareAnnotationSqlLocator("org.postgresql.Driver");
    Method method = TestDao.class.getMethod("singleQuery");

    String sql = locator.locate(TestDao.class, method, new ConfigRegistry());
    assertEquals("QUERY_POSTGRES", sql);
  }

  @Test
  void locatesRepeatedAnnotationByConnectionType() throws Exception {
    ConnectionAwareAnnotationSqlLocator mysqlLocator =
        new ConnectionAwareAnnotationSqlLocator("com.mysql.cj.jdbc.Driver");
    ConnectionAwareAnnotationSqlLocator postgresLocator =
        new ConnectionAwareAnnotationSqlLocator("org.postgresql.Driver");
    Method method = TestDao.class.getMethod("repeatedUpdate");

    assertEquals("UPDATE_MYSQL", mysqlLocator.locate(TestDao.class, method, new ConfigRegistry()));
    assertEquals(
        "UPDATE_POSTGRES", postgresLocator.locate(TestDao.class, method, new ConfigRegistry()));
  }
}
