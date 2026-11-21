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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.lang.reflect.Method;
import java.util.Set;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.service.security.ChangeActor;

/**
 * Structural guard against re-introducing the inert-{@code @Transaction} pattern on the Data
 * Product bulk-ports write path. Repositories are plain classes instantiated via reflection, not
 * JDBI SQL-object proxies, so {@link org.jdbi.v3.sqlobject.transaction.Transaction} on a repository
 * method does not create a transaction. The real boundary must be a runtime
 * {@code executeInTransaction(...)} call at the public entry points, mirroring
 * {@code EntityRepository.restoreEntity} and the approval path. See the bug report for the
 * Data Product bulk-ports partial-commit bug.
 */
class DataProductRepositoryTransactionTest {

  private static final String BULK_PORTS_OPERATION = "bulkPortsOperation";
  private static final Set<String> BULK_PUBLIC_ENTRY_POINTS =
      Set.of(
          "bulkAddInputPorts",
          "bulkRemoveInputPorts",
          "bulkAddOutputPorts",
          "bulkRemoveOutputPorts");

  /**
   * The private {@code bulkPortsOperation} must NOT carry the inert {@code @Transaction} annotation.
   * The transaction boundary is the runtime {@code executeInTransaction(...)} call on the public
   * entry points, not an annotation on a plain (non-SQL-object) class.
   */
  @Test
  void bulkPortsOperationIsNotAnnotatedWithInertTransaction() throws NoSuchMethodException {
    Method method =
        DataProductRepository.class.getDeclaredMethod(
            BULK_PORTS_OPERATION,
            String.class,
            BulkAssets.class,
            Relationship.class,
            boolean.class,
            ChangeActor.class);
    assertFalse(
        isTransactionAnnotated(method),
        BULK_PORTS_OPERATION
            + " must not carry @Transaction: repositories are plain classes, not JDBI SQL-object"
            + " proxies, so the annotation is inert and the multi-statement write would"
            + " auto-commit per statement. Use executeInTransaction(...) at the public entry"
            + " points instead.");
  }

  /**
   * The four public bulk-port entry points must be present, public, return
   * {@code BulkOperationResult}, and NOT carry @Transaction — the boundary is the runtime
   * {@code executeInTransaction(...)} call wired inside them, which the behavioral tests verify.
   */
  @Test
  void publicBulkPortEntryPointsAreNotAnnotatedWithTransaction() {
    for (String name : BULK_PUBLIC_ENTRY_POINTS) {
      Method method;
      try {
        method =
            DataProductRepository.class.getMethod(
                name, String.class, BulkAssets.class, ChangeActor.class);
      } catch (NoSuchMethodException e) {
        fail("Missing public bulk-port entry point: %s".formatted(name));
        return;
      }
      assertEquals(
          BulkOperationResult.class,
          method.getReturnType(),
          "%s must return BulkOperationResult".formatted(name));
      assertFalse(
          isTransactionAnnotated(method),
          "%s must not carry @Transaction; the runtime executeInTransaction(...) boundary"
              + " inside it is the real transaction".formatted(name));
    }
  }

  /** Sanity check: a {@code Transaction} annotation is on the classpath to detect. */
  @Test
  void transactionAnnotationIsResolvable() {
    assertNotNull(
        Transaction.class,
        "org.jdbi.v3.sqlobject.transaction.Transaction must be resolvable for this guard");
    assertTrue(
        BulkOperationResult.class != null, "BulkOperationResult schema class must be resolvable");
  }

  private static boolean isTransactionAnnotated(Method method) {
    return method.getAnnotation(Transaction.class) != null;
  }
}
