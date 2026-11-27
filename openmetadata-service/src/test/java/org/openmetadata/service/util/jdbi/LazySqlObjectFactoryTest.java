/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util.jdbi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.management.ThreadMXBean;
import java.lang.management.ManagementFactory;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicReference;
import org.jdbi.v3.core.ConnectionException;
import org.jdbi.v3.core.ConnectionFactory;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDataDAOs;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;

/** Uses OpenMetadata's real {@link CollectionDAO}; no statement ever reaches a database. */
class LazySqlObjectFactoryTest {

  private static final String MYSQL_DRIVER = "com.mysql.cj.jdbc.Driver";
  private static final int WARM_UP_CALLS = 50;
  private static final int MEASURED_CALLS = 200;

  @Test
  void aDaoAttachedOnAHandleBuildsOnlyTheHandlersItCalls() {
    long eagerBytes = bytesPerNestedDaoAttach(jdbi(false));
    long lazyBytes = bytesPerNestedDaoAttach(jdbi(true));

    assertTrue(
        lazyBytes * 5 < eagerBytes,
        "attaching CollectionDAO.tableDAO() allocated %d bytes lazily vs %d eagerly"
            .formatted(lazyBytes, eagerBytes));
  }

  @Test
  void anOnDemandDaoCallAllocatesAFractionOfTheEagerAttach() {
    long eagerBytes = bytesPerOnDemandQuery(jdbi(false));
    long lazyBytes = bytesPerOnDemandQuery(jdbi(true));

    assertTrue(
        lazyBytes * 3 < eagerBytes,
        "an on-demand tableDAO() query allocated %d bytes lazily vs %d eagerly"
            .formatted(lazyBytes, eagerBytes));
  }

  @Test
  void anOnDemandQueryRendersTheSameSqlAsJdbisOwnFactory() {
    assertEquals(sqlOfOnDemandQuery(false), sqlOfOnDemandQuery(true));
  }

  @Test
  void aQueryInsideATransactionRendersTheSameSqlAsJdbisOwnFactory() {
    assertEquals(sqlOfQueryOnHandle(false), sqlOfQueryOnHandle(true));
  }

  @Test
  void nestedDaosKeepTheirTypeAndProxyIdentity() {
    Jdbi jdbi = jdbi(true);

    jdbi.useExtension(
        CollectionDAO.class,
        collectionDAO -> {
          EntityDataDAOs.TableDAO tableDAO = collectionDAO.tableDAO();
          EntityDataDAOs.TableDAO otherTableDAO = collectionDAO.tableDAO();
          assertInstanceOf(EntityDataDAOs.TableDAO.class, tableDAO);
          assertEquals(tableDAO, tableDAO);
          assertNotEquals(tableDAO, otherTableDAO);
          assertEquals(System.identityHashCode(tableDAO), tableDAO.hashCode());
          assertTrue(tableDAO.toString().contains(EntityDataDAOs.TableDAO.class.getName()));
        });
  }

  @Test
  void installingWithoutTheSqlObjectPluginFails() {
    Jdbi jdbi = Jdbi.create(LazySqlObjectFactoryTest::noDatabase);

    assertThrows(IllegalStateException.class, () -> LazySqlObjectFactory.install(jdbi));
  }

  private static Jdbi jdbi(boolean lazy) {
    return jdbi(lazy, LazySqlObjectFactoryTest::noDatabase);
  }

  private static Jdbi jdbi(boolean lazy, ConnectionFactory connections) {
    Jdbi jdbi = Jdbi.create(connections);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(MYSQL_DRIVER));
    if (lazy) {
      LazySqlObjectFactory.install(jdbi);
    }
    return jdbi;
  }

  private static long bytesPerNestedDaoAttach(Jdbi jdbi) {
    Runnable attach =
        () -> jdbi.withExtension(CollectionDAO.class, dao -> dao.tableDAO().hashCode());
    return bytesPerCall(attach);
  }

  private static long bytesPerOnDemandQuery(Jdbi jdbi) {
    CollectionDAO collectionDAO = jdbi.onDemand(CollectionDAO.class);
    Runnable query =
        () ->
            assertThrows(
                ConnectionException.class,
                () -> collectionDAO.tableDAO().listIdFqnByPrefixHash("t", "h", "p%"));
    return bytesPerCall(query);
  }

  private static long bytesPerCall(Runnable call) {
    for (int i = 0; i < WARM_UP_CALLS; i++) {
      call.run();
    }
    ThreadMXBean threads = (ThreadMXBean) ManagementFactory.getThreadMXBean();
    long before = threads.getCurrentThreadAllocatedBytes();
    for (int i = 0; i < MEASURED_CALLS; i++) {
      call.run();
    }
    return (threads.getCurrentThreadAllocatedBytes() - before) / MEASURED_CALLS;
  }

  private static String sqlOfOnDemandQuery(boolean lazy) {
    AtomicReference<String> preparedSql = new AtomicReference<>();
    Jdbi jdbi = jdbi(lazy, () -> recordingConnection(preparedSql));

    assertThrows(
        Exception.class,
        () ->
            jdbi.onDemand(CollectionDAO.class)
                .tableDAO()
                .listIdFqnByPrefixHash("table_entity", "fqnHash", "abc%"));
    return preparedSql.get();
  }

  private static String sqlOfQueryOnHandle(boolean lazy) {
    AtomicReference<String> preparedSql = new AtomicReference<>();
    Jdbi jdbi = jdbi(lazy, () -> recordingConnection(preparedSql));

    assertThrows(
        Exception.class,
        () ->
            jdbi.useExtension(
                CollectionDAO.class,
                dao -> dao.tableDAO().listIdFqnByPrefixHash("table_entity", "fqnHash", "abc%")));
    return preparedSql.get();
  }

  private static Connection noDatabase() throws SQLException {
    throw new SQLException("no database in this test");
  }

  // Records the SQL a statement is prepared with, then fails it: the test only needs to know what
  // Jdbi would have sent.
  private static Connection recordingConnection(AtomicReference<String> preparedSql) {
    return (Connection)
        Proxy.newProxyInstance(
            Connection.class.getClassLoader(),
            new Class<?>[] {Connection.class},
            (proxy, method, args) -> {
              if (method.getName().startsWith("prepare")) {
                preparedSql.set((String) args[0]);
                throw new SQLException("recorded");
              }
              return defaultValue(method.getReturnType(), method.getName());
            });
  }

  private static Object defaultValue(Class<?> returnType, String methodName) {
    Object value = null;
    if (returnType == boolean.class) {
      value = "getAutoCommit".equals(methodName);
    } else if (returnType == int.class) {
      value = 0;
    }
    return value;
  }
}
