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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.Test;

class QuartzConnectionProviderTest {

  @Test
  void borrowsFromTheWrappedPool() throws SQLException {
    HikariDataSource pool = mock(HikariDataSource.class);
    Connection connection = mock(Connection.class);
    when(pool.getConnection()).thenReturn(connection);

    assertSame(connection, new QuartzConnectionProvider(pool).getConnection());
  }

  @Test
  void shutdownClosesThePool() {
    // Quartz calls this from JobStoreSupport#shutdown. If it did not close the pool, every
    // scheduler restart would strand a pool's worth of database sessions and its housekeeping
    // threads for the life of the JVM.
    HikariDataSource pool = mock(HikariDataSource.class);
    when(pool.isClosed()).thenReturn(false);

    new QuartzConnectionProvider(pool).shutdown();

    verify(pool).close();
  }

  @Test
  void shutdownIsIdempotent() {
    HikariDataSource pool = mock(HikariDataSource.class);
    when(pool.isClosed()).thenReturn(true);

    QuartzConnectionProvider provider = new QuartzConnectionProvider(pool);
    assertDoesNotThrow(provider::shutdown);

    verify(pool, never()).close();
  }
}
