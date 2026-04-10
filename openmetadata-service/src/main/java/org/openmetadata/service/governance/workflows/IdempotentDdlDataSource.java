/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.governance.workflows;

import java.io.PrintWriter;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Statement;
import java.util.logging.Logger;
import javax.sql.DataSource;

/**
 * A {@link DataSource} that wraps each {@link Connection} in a proxy so that
 * {@link Connection#createStatement()} returns an {@link IdempotentDdlStatement}.
 * Only used in migration context so Flowable upgrade scripts skip already-existing
 * DDL objects instead of failing.
 */
final class IdempotentDdlDataSource implements DataSource {

  private final String url;
  private final String user;
  private final String password;
  private PrintWriter logWriter;
  private int loginTimeout;

  IdempotentDdlDataSource(String url, String user, String password) {
    this.url = url;
    this.user = user;
    this.password = password;
  }

  @Override
  public Connection getConnection() throws SQLException {
    return wrapConnection(DriverManager.getConnection(url, user, password));
  }

  @Override
  public Connection getConnection(String username, String password) throws SQLException {
    return wrapConnection(DriverManager.getConnection(url, username, password));
  }

  private Connection wrapConnection(Connection real) {
    return (Connection)
        Proxy.newProxyInstance(
            real.getClass().getClassLoader(),
            new Class<?>[] {Connection.class},
            new ConnectionHandler(real));
  }

  private static final class ConnectionHandler implements InvocationHandler {
    private final Connection real;

    ConnectionHandler(Connection real) {
      this.real = real;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
      if ("createStatement".equals(method.getName()) && (args == null || args.length == 0)) {
        Statement delegate = real.createStatement();
        return new IdempotentDdlStatement(delegate, real);
      }
      return method.invoke(real, args);
    }
  }

  @Override
  public PrintWriter getLogWriter() {
    return logWriter;
  }

  @Override
  public void setLogWriter(PrintWriter out) {
    this.logWriter = out;
  }

  @Override
  public void setLoginTimeout(int seconds) {
    this.loginTimeout = seconds;
  }

  @Override
  public int getLoginTimeout() {
    return loginTimeout;
  }

  @Override
  public Logger getParentLogger() throws SQLFeatureNotSupportedException {
    throw new SQLFeatureNotSupportedException();
  }

  @Override
  public <T> T unwrap(Class<T> iface) throws SQLException {
    throw new SQLException("Not a wrapper for " + iface);
  }

  @Override
  public boolean isWrapperFor(Class<?> iface) {
    return false;
  }
}
