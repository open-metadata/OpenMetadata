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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import at.favre.lib.crypto.bcrypt.BCrypt;
import freemarker.core.Environment;
import freemarker.template.TemplateException;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.HashSet;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.email.EmailUtil;

/**
 * Regression coverage for the three basic-auth email-failure paths in {@link BasicAuthenticator}.
 * Each one catches a FreeMarker {@link TemplateException} and rethrows it as {@code
 * CustomExceptionMessage(424, FAILED_SEND_EMAIL, EMAIL_SENDING_ISSUE)}. Before the fix, the int
 * status was coerced through {@code Response.Status.fromStatusCode(424)} (returns null), so the
 * exception carried a null status — {@link
 * org.openmetadata.sdk.exception.WebServiceException#getResponse()} then threw {@link
 * IllegalArgumentException} inside the mapper and the client received a generic 500 instead of the
 * typed 424. These tests pin the thrown exception's status so the typed 424 reaches the client (see
 * commit bb1395fc72 / PR #23239).
 */
class BasicAuthenticatorEmailFailureTest {

  private final TokenRepository tokenRepository = mock(TokenRepository.class);
  private final UserRepository userRepository = mock(UserRepository.class);
  private final User user =
      new User()
          .withId(UUID.randomUUID())
          .withName("reset_user")
          .withFullyQualifiedName("reset_user")
          .withEmail("reset@example.com");

  private BasicAuthenticator authenticator;

  @BeforeEach
  void setUp() throws Exception {
    authenticator = new BasicAuthenticator();
    setField(authenticator, "tokenRepository", tokenRepository);
    setField(authenticator, "userRepository", userRepository);
  }

  /** SMTP-enabled path: a {@link TemplateException} from {@link EmailUtil#sendEmailVerification}
   * must surface as a typed 424, and no email-verification token may be persisted afterwards. */
  @Test
  void sendEmailVerificationThrows424FailedSendEmailOnTemplateFailure() throws Exception {
    try (MockedStatic<Entity> entity = mockEntityWithoutStoredSmtpSettings();
        MockedStatic<EmailUtil> email = mockStatic(EmailUtil.class)) {
      email
          .when(EmailUtil::getSmtpSettings)
          .thenReturn(new SmtpSettings().withEnableSmtpServer(true));
      email.when(EmailUtil::getOMBaseURL).thenReturn("http://localhost:8585");
      email
          .when(() -> EmailUtil.sendEmailVerification(anyString(), any()))
          .thenThrow(new TemplateException("template parse error", (Environment) null));

      CustomExceptionMessage failure =
          assertThrows(
              CustomExceptionMessage.class, () -> authenticator.sendEmailVerification(null, user));

      assertEquals(424, failure.getResponse().getStatus());
      assertEquals("FAILED_SEND_EMAIL", failure.getErrorType());
      verify(tokenRepository, never()).insertToken(any());
    }
  }

  /** SMTP-enabled path: a {@link TemplateException} from {@link EmailUtil#sendPasswordResetLink}
   * must surface as a typed 424, and a reset token — which alone can take over the account — must
   * never be persisted when the mail could not be sent. */
  @Test
  void sendPasswordResetLinkThrows424FailedSendEmailOnTemplateFailure() throws Exception {
    try (MockedStatic<Entity> entity = mockEntityWithoutStoredSmtpSettings();
        MockedStatic<EmailUtil> email = mockStatic(EmailUtil.class)) {
      email
          .when(EmailUtil::getSmtpSettings)
          .thenReturn(new SmtpSettings().withEnableSmtpServer(true));
      email.when(EmailUtil::getOMBaseURL).thenReturn("http://localhost:8585");
      email
          .when(() -> EmailUtil.sendPasswordResetLink(anyString(), any(), anyString(), anyString()))
          .thenThrow(new TemplateException("template parse error", (Environment) null));

      CustomExceptionMessage failure =
          assertThrows(
              CustomExceptionMessage.class,
              () -> authenticator.sendPasswordResetLink(null, user, "Reset", "reset-template"));

      assertEquals(424, failure.getResponse().getStatus());
      assertEquals("FAILED_SEND_EMAIL", failure.getErrorType());
      verify(tokenRepository, never()).insertToken(any());
    }
  }

  /**
   * The most impactful path: the password has already been changed and persisted before the
   * notification email is sent, so the client must learn that the change succeeded-but-mail-failed
   * (424 {@code FAILED_SEND_EMAIL}) rather than receiving a 500 and believing the change failed.
   * The notification {@link TemplateException} must surface as the typed 424.
   */
  @Test
  void resetUserPasswordWithTokenThrows424FailedSendEmailOnTemplateFailure() throws Exception {
    PasswordResetToken resetToken =
        new PasswordResetToken()
            .withToken(UUID.randomUUID())
            .withUserId(user.getId())
            .withTokenType(TokenType.PASSWORD_RESET)
            .withExpiryDate(Instant.now().toEpochMilli() + 60_000L)
            .withIsActive(true);
    when(tokenRepository.findByToken("reset-token")).thenReturn(resetToken);
    when(userRepository.getAllowedFieldsCopy()).thenReturn(new HashSet<>());
    // uriInfo is null in the call, so use nullable (any(Class) does NOT match null in Mockito).
    when(userRepository.getByName(
            nullable(UriInfo.class), anyString(), any(EntityUtil.Fields.class)))
        .thenReturn(user);
    when(userRepository.createOrUpdate(nullable(UriInfo.class), any(User.class), anyString()))
        .thenReturn(null);

    PasswordResetRequest request =
        new PasswordResetRequest()
            .withUsername(user.getName())
            .withToken("reset-token")
            .withPassword("Password123!")
            .withConfirmPassword("Password123!");

    try (MockedStatic<Entity> entity = mockEntityWithoutStoredSmtpSettings();
        MockedStatic<EmailUtil> email = mockStatic(EmailUtil.class)) {
      email
          .when(
              () -> EmailUtil.sendAccountStatus(anyString(), anyString(), anyString(), anyString()))
          .thenThrow(new TemplateException("template parse error", (Environment) null));

      CustomExceptionMessage failure =
          assertThrows(
              CustomExceptionMessage.class,
              () -> authenticator.resetUserPasswordWithToken(null, request));

      assertEquals(424, failure.getResponse().getStatus());
      assertEquals("FAILED_SEND_EMAIL", failure.getErrorType());
      // The password IS persisted before the notification email, so the change is durable. Assert
      // on
      // the observable outcome — the User actually handed to createOrUpdate carries a BCrypt hash
      // of
      // the new password — not just that createOrUpdate was called.
      ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
      verify(userRepository)
          .createOrUpdate(nullable(UriInfo.class), savedUser.capture(), anyString());
      User persisted = savedUser.getValue();
      assertNotNull(persisted.getAuthenticationMechanism(), "auth mechanism must be set");
      BasicAuthMechanism config =
          (BasicAuthMechanism) persisted.getAuthenticationMechanism().getConfig();
      assertNotNull(config, "basic-auth config must be set on the persisted user");
      assertTrue(
          BCrypt.verifyer()
              .verify("Password123!".toCharArray(), config.getPassword().toCharArray())
              .verified,
          "the persisted password must be a BCrypt hash of the requested new password");
      verify(tokenRepository)
          .deleteTokenByUserAndType(user.getId(), TokenType.PASSWORD_RESET.toString());
    }
  }

  /** EmailUtil reads SMTP settings while it initializes, which needs a system repository. */
  private static MockedStatic<Entity> mockEntityWithoutStoredSmtpSettings() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    when(systemRepository.getEmailConfigInternal()).thenReturn(null);
    MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
    return entity;
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
