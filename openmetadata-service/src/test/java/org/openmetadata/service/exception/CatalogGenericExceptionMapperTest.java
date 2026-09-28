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

package org.openmetadata.service.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.ws.rs.core.Response;
import java.sql.SQLException;
import org.jdbi.v3.core.transaction.TransactionException;
import org.junit.jupiter.api.Test;

class CatalogGenericExceptionMapperTest {

  @Test
  void aDatabaseLockConflictIsATemporaryFailureTheCallerCanRetry() {
    CatalogGenericExceptionMapper mapper = new CatalogGenericExceptionMapper();
    SQLException deadlock =
        new SQLException(
            "Deadlock found when trying to get lock; try restarting transaction", "40001", 1213);
    SQLException lockWaitTimeout =
        new SQLException("Lock wait timeout exceeded; try restarting transaction", "40001", 1205);

    assertRetryableConflict(
        mapper.toResponse(new RuntimeException(deadlock.getMessage(), deadlock)), "Deadlock");
    assertRetryableConflict(
        mapper.toResponse(new RuntimeException(lockWaitTimeout.getMessage(), lockWaitTimeout)),
        "Lock wait timeout");
    assertRetryableConflict(
        mapper.toResponse(
            new TransactionException("rolled back: " + deadlock.getMessage(), deadlock)),
        "Deadlock");
  }

  private static void assertRetryableConflict(Response response, String expectedMessage) {
    assertEquals(503, response.getStatus());
    assertEquals("1", String.valueOf(response.getHeaderString("Retry-After")));
    ErrorMessage error = (ErrorMessage) response.getEntity();
    assertTrue(
        error.getMessage().contains(expectedMessage),
        "the database's message must reach the caller");
  }
}
