package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

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
}
