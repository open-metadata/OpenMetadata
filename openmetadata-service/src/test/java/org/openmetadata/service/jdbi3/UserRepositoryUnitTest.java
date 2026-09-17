package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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

  /**
   * {@code UserUpdater.entitySpecificUpdate} reconciles these fields unconditionally on a PUT --
   * {@code shouldCompare} only short-circuits for PATCH -- and each reconciler deletes the stored
   * relationships before re-adding whatever the incoming entity carries. So any field listed here
   * that is missing from the PUT field set is silently wiped by every login that goes through
   * {@code UserUtil.addOrUpdateUser}, which is how LDAP logins used to drop a user's
   * manually-assigned teams.
   */
  @Test
  void test_putFieldSetCoversEveryFieldThePutUpdaterReconciles() {
    List<String> reconciledOnPut =
        List.of(
            "roles",
            "teams",
            "personas",
            "defaultPersona",
            "domains",
            "profile",
            "isEmailVerified",
            "personaPreferences",
            UserRepository.AUTH_MECHANISM_FIELD);

    Set<String> putFields =
        new HashSet<>(Arrays.asList(UserRepository.USER_UPDATE_FIELDS.split(",")));

    for (String field : reconciledOnPut) {
      assertTrue(
          putFields.contains(field),
          field
              + " is reconciled on PUT but is not in USER_UPDATE_FIELDS; a login that saves the "
              + "user will wipe it");
    }
  }
}
