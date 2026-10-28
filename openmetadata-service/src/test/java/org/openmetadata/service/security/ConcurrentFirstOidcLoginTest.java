/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.exception.UserCreationException;
import org.openmetadata.service.exception.EntityNotFoundException;

/** The account a losing first login falls back to when a concurrent one created it first. */
class ConcurrentFirstOidcLoginTest {
  private static final String EMAIL = "erin@example.com";
  private static final UserCreationException DUPLICATE_EMAIL =
      new UserCreationException(
          "User Creation Exception [erin] due to [Duplicate entry 'erin@example.com' for key"
              + " 'user_entity.email']");

  @Test
  void returnsTheAccountItCreated() {
    User created = user("erin", EMAIL);

    User signedIn =
        AuthenticationCodeFlowHandler.createOrAdoptConcurrentlyCreatedUser(
            () -> created, failIfLoaded(), EMAIL);

    assertSame(created, signedIn);
  }

  @Test
  void signsInToTheAccountAConcurrentLoginCreatedForTheSameEmail() {
    User createdByTheOtherLogin = user("erin", "Erin@Example.com");

    User signedIn =
        AuthenticationCodeFlowHandler.createOrAdoptConcurrentlyCreatedUser(
            () -> {
              throw DUPLICATE_EMAIL;
            },
            () -> createdByTheOtherLogin,
            EMAIL);

    assertSame(createdByTheOtherLogin, signedIn);
  }

  @Test
  void refusesAnAccountOfTheSameNameWithAnotherEmail() {
    User someoneElse = user("erin", "erin@another-company.com");

    UserCreationException thrown =
        assertThrows(
            UserCreationException.class,
            () ->
                AuthenticationCodeFlowHandler.createOrAdoptConcurrentlyCreatedUser(
                    () -> {
                      throw DUPLICATE_EMAIL;
                    },
                    () -> someoneElse,
                    EMAIL));

    assertSame(DUPLICATE_EMAIL, thrown);
  }

  @Test
  void keepsTheConflictWhenNoAccountHasTheName() {
    UserCreationException thrown =
        assertThrows(
            UserCreationException.class,
            () ->
                AuthenticationCodeFlowHandler.createOrAdoptConcurrentlyCreatedUser(
                    () -> {
                      throw DUPLICATE_EMAIL;
                    },
                    () -> {
                      throw EntityNotFoundException.byName("erin");
                    },
                    EMAIL));

    assertSame(DUPLICATE_EMAIL, thrown);
  }

  @Test
  void keepsFailuresThatAreNotCreateConflicts() {
    UserCreationException databaseDown = new UserCreationException("Connection refused");

    UserCreationException thrown =
        assertThrows(
            UserCreationException.class,
            () ->
                AuthenticationCodeFlowHandler.createOrAdoptConcurrentlyCreatedUser(
                    () -> {
                      throw databaseDown;
                    },
                    failIfLoaded(),
                    EMAIL));

    assertSame(databaseDown, thrown);
  }

  private static Supplier<User> failIfLoaded() {
    return () -> {
      throw new AssertionError("No existing account should be looked up");
    };
  }

  private static User user(String name, String email) {
    return new User().withName(name).withEmail(email);
  }
}
