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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class UserUtilTest {

  @Test
  void testGenerateUsernameFromEmail_basic() {
    String username = UserUtil.generateUsernameFromEmail("john.doe@company.com", name -> false);

    assertEquals("john.doe", username);
  }

  @Test
  void testGenerateUsernameFromEmail_withCollision() {
    AtomicInteger callCount = new AtomicInteger(0);
    String username =
        UserUtil.generateUsernameFromEmail(
            "john.doe@company.com",
            name -> {
              return callCount.getAndIncrement() == 0;
            });

    assertTrue(username.startsWith("john.doe_"));
    assertTrue(username.length() > "john.doe_".length());
  }

  @Test
  void testGenerateUsernameFromEmail_lowercases() {
    String username = UserUtil.generateUsernameFromEmail("John.Doe@Company.COM", name -> false);

    assertEquals("john.doe", username);
  }

  @Test
  void testGenerateUsernameFromEmail_handlesSpecialChars() {
    String username = UserUtil.generateUsernameFromEmail("john+test@company.com", name -> false);

    assertEquals("john+test", username);
  }

  @Test
  void testGenerateUsernameFromEmail_nullEmail() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> UserUtil.generateUsernameFromEmail(null, name -> false));

    assertEquals("Email cannot be null or empty", exception.getMessage());
  }

  @Test
  void testGenerateUsernameFromEmail_emptyEmail() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> UserUtil.generateUsernameFromEmail("", name -> false));

    assertEquals("Email cannot be null or empty", exception.getMessage());
  }

  @Test
  void testGenerateUsernameFromEmail_nullExistsChecker() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> UserUtil.generateUsernameFromEmail("john@company.com", null));

    assertEquals("ExistsChecker predicate cannot be null", exception.getMessage());
  }

  @Test
  void testGenerateUsernameFromEmail_maxRetryLimitExceeded() {
    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> UserUtil.generateUsernameFromEmail("john@company.com", name -> true));

    assertTrue(exception.getMessage().contains("Unable to generate unique username"));
    assertTrue(exception.getMessage().contains("john@company.com"));
    assertTrue(exception.getMessage().contains("100 attempts"));
  }

  @Test
  void testIsAdminEmail_inList() {
    List<String> adminEmails = List.of("admin@company.com", "super@company.com");

    assertTrue(UserUtil.isAdminEmail("admin@company.com", adminEmails));
    assertTrue(UserUtil.isAdminEmail("super@company.com", adminEmails));
  }

  @Test
  void testIsAdminEmail_notInList() {
    List<String> adminEmails = List.of("admin@company.com");

    assertFalse(UserUtil.isAdminEmail("user@company.com", adminEmails));
  }

  @Test
  void testIsAdminEmail_caseInsensitive() {
    List<String> adminEmails = List.of("Admin@Company.COM");

    assertTrue(UserUtil.isAdminEmail("admin@company.com", adminEmails));
  }

  @Test
  void testIsAdminEmail_emptyList() {
    List<String> adminEmails = List.of();

    assertFalse(UserUtil.isAdminEmail("admin@company.com", adminEmails));
  }

  @Test
  void testIsAdminEmail_nullList() {
    assertFalse(UserUtil.isAdminEmail("admin@company.com", null));
  }

  @Test
  void testIsAdminEmail_nullEmail() {
    List<String> adminEmails = List.of("admin@company.com");

    assertFalse(UserUtil.isAdminEmail(null, adminEmails));
  }

  @Test
  void testIsAdminEmail_emptyEmail() {
    List<String> adminEmails = List.of("admin@company.com");

    assertFalse(UserUtil.isAdminEmail("", adminEmails));
  }
}
