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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.security.AuthenticationException;

/**
 * The registration domain allow-list is only as strong as the proof that a registrant owns the
 * address, so a self-registered account signs in once it is confirmed.
 */
class BasicAuthenticatorConfirmationTest {

  private final TokenRepository tokenRepository = mock(TokenRepository.class);
  private final User user =
      new User().withId(UUID.randomUUID()).withName("jane").withEmail("jane@example.com");
  private BasicAuthenticator authenticator;

  @BeforeEach
  void setUp() throws Exception {
    authenticator = new BasicAuthenticator();
    Field tokenRepositoryField = BasicAuthenticator.class.getDeclaredField("tokenRepository");
    tokenRepositoryField.setAccessible(true);
    tokenRepositoryField.set(authenticator, tokenRepository);
  }

  @Test
  void aRegistrationAwaitingConfirmationCannotSignIn() {
    user.setIsEmailVerified(false);
    when(tokenRepository.findByUserIdAndType(user.getId(), TokenType.EMAIL_VERIFICATION.toString()))
        .thenReturn(List.of(mock(TokenInterface.class)));

    AuthenticationException refused =
        assertThrows(
            AuthenticationException.class, () -> authenticator.requireConfirmedRegistration(user));
    assertEquals(BasicAuthenticator.EMAIL_CONFIRMATION_PENDING, refused.getMessage());
  }

  @Test
  void aConfirmedAccountSignsIn() {
    user.setIsEmailVerified(true);

    assertDoesNotThrow(() -> authenticator.requireConfirmedRegistration(user));
    verifyNoInteractions(tokenRepository);
  }

  /** Accounts an admin created, or registered with no mail server, have nothing to confirm. */
  @Test
  void anAccountWithNoConfirmationPendingSignsIn() {
    when(tokenRepository.findByUserIdAndType(user.getId(), TokenType.EMAIL_VERIFICATION.toString()))
        .thenReturn(List.of());

    assertDoesNotThrow(() -> authenticator.requireConfirmedRegistration(user));
  }
}
