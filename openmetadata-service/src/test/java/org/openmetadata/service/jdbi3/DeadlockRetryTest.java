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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;

class DeadlockRetryTest {

  @Test
  void onlyAStatementWhoseOwnErrorRolledBackTheTransactionCounts() {
    SQLException postgresDeadlock = new SQLException("deadlock detected", "40P01");
    SQLException lockWaitTimeout = new SQLException("Lock wait timeout exceeded", "40001", 1205);
    SQLException rejectedAfterDeadlock =
        new SQLException("current transaction is aborted", "25P02", postgresDeadlock);

    assertTrue(
        DeadlockRetry.rollsBackTransaction(
            new SQLException(
                "Deadlock found when trying to get lock; try restarting transaction",
                "40001",
                1213)),
        "MySQL deadlock, errno 1213");
    assertTrue(DeadlockRetry.rollsBackTransaction(postgresDeadlock), "Postgres deadlock");
    assertTrue(
        DeadlockRetry.rollsBackTransaction(new SQLException("could not serialize", "40001")),
        "Postgres serialization failure");
    assertFalse(
        DeadlockRetry.rollsBackTransaction(lockWaitTimeout),
        "a MySQL lock wait timeout rolls back only its statement, although Connector/J reports"
            + " it as 40001");
    assertFalse(
        DeadlockRetry.rollsBackTransaction(rejectedAfterDeadlock),
        "the Postgres driver chains the deadlock into every statement it rejects afterwards");
    assertTrue(DeadlockRetry.isLockWaitTimeout(lockWaitTimeout), "MySQL errno 1205");
    assertFalse(DeadlockRetry.isLockWaitTimeout(postgresDeadlock), "not a lock wait timeout");
  }
}
