package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.DuplicateEmailException;

class UserRepositoryUnitTest {

  @Test
  void test_taskCleanupRetryDelayBacksOffExponentially() {
    assertEquals(100L, UserRepository.getTaskCleanupRetryDelayMillis(1));
    assertEquals(200L, UserRepository.getTaskCleanupRetryDelayMillis(2));
    assertEquals(400L, UserRepository.getTaskCleanupRetryDelayMillis(3));
  }

  @Test
  void test_taskCleanupRetryDelayIsCapped() {
    assertEquals(1000L, UserRepository.getTaskCleanupRetryDelayMillis(5));
    assertEquals(1000L, UserRepository.getTaskCleanupRetryDelayMillis(8));
  }

  @Test
  void test_duplicateEmailIsAConflictNotAnAuthFailure() {
    // getByEmail serves admin/API callers too, so a case-variant duplicate must surface as a
    // 409 data-integrity conflict; only the auth wrapper turns it into a 401.
    DuplicateEmailException ex = DuplicateEmailException.byEmail("John@x.com", 2);

    assertEquals(Response.Status.CONFLICT.getStatusCode(), ex.getResponse().getStatus());
    assertTrue(ex.getMessage().contains("John@x.com"));
    assertTrue(ex.getMessage().contains("2 user accounts"));
    assertTrue(ex.getMessage().contains("merge or rename"));
  }
}
