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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.ws.rs.core.Response;
import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.postgresql.util.PSQLState;

/**
 * Regression coverage for {@link CatalogGenericExceptionMapper}'s handling of JDBI-wrapped
 * database integrity violations. Duplicate-key violations map to 409 and every other
 * integrity-constraint violation (foreign-key, NOT NULL, check) maps to a 4xx, symmetrically
 * across PostgreSQL ({@link PSQLException}) and MySQL
 * ({@link SQLIntegrityConstraintViolationException}); non-integrity {@link SQLException}s keep
 * falling through to the generic 5xx.
 */
class IntegrityConstraintMapperTest {

  private static final String DUPLICATE_KEY_MESSAGE = "Entity already exists";
  private static final String CONSTRAINT_VIOLATION_MESSAGE =
      "Request violates a database constraint";

  private static Response map(Throwable cause) {
    UnableToExecuteStatementException ex =
        new UnableToExecuteStatementException("statement execution failed", cause, null);
    return new CatalogGenericExceptionMapper().toResponse(ex);
  }

  @Test
  void postgresDuplicateKeyMapsToConflict() {
    Response response =
        map(
            psqlException(
                PSQLState.UNIQUE_VIOLATION,
                "ERROR: duplicate key value violates unique constraint \"entity_name_key\""));

    assertEquals(409, response.getStatus());
    assertErrorMessage(response, 409, DUPLICATE_KEY_MESSAGE);
  }

  @Test
  void mysqlDuplicateKeyMapsToConflict() {
    Response response = map(mysqlException(1062, "23000", "Duplicate entry 'x' for key 'name'"));

    assertEquals(409, response.getStatus());
    assertErrorMessage(response, 409, DUPLICATE_KEY_MESSAGE);
  }

  @Test
  void postgresForeignKeyViolationMapsToBadRequest() {
    Response response =
        map(
            psqlException(
                PSQLState.FOREIGN_KEY_VIOLATION,
                "insert or update on table \"conversation_reply\" violates foreign key constraint"
                    + " \"fk_conversation_reply_conversation\""));

    assertEquals(400, response.getStatus());
    assertErrorMessage(response, 400, CONSTRAINT_VIOLATION_MESSAGE);
  }

  @Test
  void postgresNotNullViolationMapsToBadRequest() {
    Response response =
        map(
            psqlException(
                PSQLState.NOT_NULL_VIOLATION,
                "null value in column \"id\" of relation \"entity\" violates not-null constraint"));

    assertEquals(400, response.getStatus());
    assertErrorMessage(response, 400, CONSTRAINT_VIOLATION_MESSAGE);
  }

  @Test
  void postgresCheckViolationMapsToBadRequest() {
    Response response =
        map(
            psqlException(
                PSQLState.CHECK_VIOLATION,
                "new row for relation \"entity\" violates check constraint \"ck_status\""));

    assertEquals(400, response.getStatus());
    assertErrorMessage(response, 400, CONSTRAINT_VIOLATION_MESSAGE);
  }

  @Test
  void mysqlForeignKeyViolationMapsToBadRequest() {
    Response response =
        map(
            mysqlException(
                1452, "23000", "Cannot add or update a child row: a foreign key constraint fails"));

    assertEquals(400, response.getStatus());
    assertErrorMessage(response, 400, CONSTRAINT_VIOLATION_MESSAGE);
  }

  @Test
  void mysqlNotNullViolationMapsToBadRequest() {
    Response response = map(mysqlException(1048, "23000", "Column 'id' cannot be null"));

    assertEquals(400, response.getStatus());
    assertErrorMessage(response, 400, CONSTRAINT_VIOLATION_MESSAGE);
  }

  @Test
  void mysqlCheckViolationMapsToBadRequest() {
    Response response =
        map(mysqlException(3819, "23000", "Check constraint 'ck_status' is violated."));

    assertEquals(400, response.getStatus());
    assertErrorMessage(response, 400, CONSTRAINT_VIOLATION_MESSAGE);
  }

  @Test
  void nonIntegritySqlExceptionStaysServerError() {
    Response response = map(new SQLException("connection refused", "08001"));

    assertEquals(500, response.getStatus());
  }

  @Test
  void unableToExecuteStatementExceptionWithNonSqlCauseStaysServerError() {
    Response response = map(new IllegalStateException("jdbi internal failure"));

    assertEquals(500, response.getStatus());
  }

  @Test
  void badRequestResponseDoesNotLeakSqlDetails() {
    String constraintName = "fk_conversation_reply_conversation";
    Response response =
        map(
            psqlException(
                PSQLState.FOREIGN_KEY_VIOLATION,
                "insert or update on table \"conversation_reply\" violates foreign key constraint"
                    + " \""
                    + constraintName
                    + "\""));

    assertTrue(response.getEntity() instanceof ErrorMessage);
    ErrorMessage error = (ErrorMessage) response.getEntity();
    assertEquals(400, error.getCode());
    assertFalse(error.getMessage().contains("conversation_reply"));
    assertFalse(error.getMessage().contains(constraintName));
    assertEquals(CONSTRAINT_VIOLATION_MESSAGE, error.getMessage());
  }

  private static PSQLException psqlException(PSQLState state, String message) {
    return new PSQLException(message, state);
  }

  private static SQLIntegrityConstraintViolationException mysqlException(
      int vendorCode, String sqlState, String reason) {
    return new SQLIntegrityConstraintViolationException(reason, sqlState, vendorCode);
  }

  private static void assertErrorMessage(
      Response response, int expectedStatus, String expectedMessage) {
    assertTrue(response.getEntity() instanceof ErrorMessage, "entity is a Dropwizard ErrorMessage");
    ErrorMessage error = (ErrorMessage) response.getEntity();
    assertEquals(expectedStatus, error.getCode());
    assertEquals(expectedMessage, error.getMessage());
  }
}
