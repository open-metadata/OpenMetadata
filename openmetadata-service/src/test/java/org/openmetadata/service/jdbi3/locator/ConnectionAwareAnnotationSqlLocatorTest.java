package org.openmetadata.service.jdbi3.locator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import org.jdbi.v3.core.config.ConfigRegistry;
import org.jdbi.v3.sqlobject.SqlOperation;
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
  void singleAnnotationCarriesSqlOperationMetadata() {
    assertTrue(ConnectionAwareSqlBatch.class.isAnnotationPresent(SqlOperation.class));
    assertTrue(ConnectionAwareSqlQuery.class.isAnnotationPresent(SqlOperation.class));
    assertTrue(ConnectionAwareSqlUpdate.class.isAnnotationPresent(SqlOperation.class));
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
