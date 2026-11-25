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
package org.openmetadata.it.tests.migration;

import java.lang.reflect.Method;
import java.util.stream.Stream;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.InvocationInterceptor;
import org.junit.jupiter.api.extension.ReflectiveInvocationContext;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Runs each test method against its own empty {@link ScratchDatabase}, dropped when the method
 * returns, so SQL and migration tests that build their own schema neither share one nor outlive it.
 * A test reads its database through {@link #jdbi()}, or receives it before the method runs when the
 * test class implements {@link Target}.
 */
public final class ScratchDatabasePerTest implements InvocationInterceptor {
  private static final ThreadLocal<Jdbi> CURRENT = new ThreadLocal<>();

  /** A test class that prepares its schema before each method, where a {@code @BeforeEach} cannot. */
  public interface Target {
    void useScratchDatabase(Jdbi jdbi);
  }

  public static Jdbi jdbi() {
    Jdbi jdbi = CURRENT.get();
    if (jdbi == null) {
      throw new IllegalStateException(
          "No scratch database: add @ExtendWith(ScratchDatabasePerTest)");
    }
    return jdbi;
  }

  /** The dialect names a test parameterized over dialects runs: only the lane's. */
  public static Stream<String> laneDialect() {
    return Stream.of(ScratchDatabase.dialect() == ConnectionType.MYSQL ? "mysql" : "postgres");
  }

  @Override
  public void interceptTestMethod(
      Invocation<Void> invocation,
      ReflectiveInvocationContext<Method> invocationContext,
      ExtensionContext extensionContext)
      throws Throwable {
    runOnScratchDatabase(invocation, extensionContext);
  }

  @Override
  public void interceptTestTemplateMethod(
      Invocation<Void> invocation,
      ReflectiveInvocationContext<Method> invocationContext,
      ExtensionContext extensionContext)
      throws Throwable {
    runOnScratchDatabase(invocation, extensionContext);
  }

  private static void runOnScratchDatabase(
      Invocation<Void> invocation, ExtensionContext extensionContext) throws Throwable {
    Throwable[] failure = new Throwable[1];
    ScratchDatabase.withJdbi(
        jdbi -> {
          CURRENT.set(jdbi);
          try {
            if (extensionContext.getRequiredTestInstance() instanceof Target target) {
              target.useScratchDatabase(jdbi);
            }
            invocation.proceed();
          } catch (Throwable t) {
            failure[0] = t;
          } finally {
            CURRENT.remove();
          }
        });
    if (failure[0] != null) {
      throw failure[0];
    }
  }
}
