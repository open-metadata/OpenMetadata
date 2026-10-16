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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.lang.reflect.Field;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.util.email.EmailUtil;
import org.slf4j.LoggerFactory;

/**
 * A password reset token is enough on its own to take over the account, so it may only ever reach
 * the user's mailbox: never the server log, and never the database when no mail can be sent.
 */
class BasicAuthenticatorTokenTest {

  private final TokenRepository tokenRepository = mock(TokenRepository.class);
  private final User user =
      new User().withId(UUID.randomUUID()).withName("reset_user").withEmail("reset@example.com");
  private final ListAppender<ILoggingEvent> logEvents = new ListAppender<>();
  private final Logger logger = (Logger) LoggerFactory.getLogger(BasicAuthenticator.class);
  private Level originalLevel;
  private BasicAuthenticator authenticator;

  @BeforeEach
  void setUp() throws Exception {
    authenticator = new BasicAuthenticator();
    Field tokenRepositoryField = BasicAuthenticator.class.getDeclaredField("tokenRepository");
    tokenRepositoryField.setAccessible(true);
    tokenRepositoryField.set(authenticator, tokenRepository);
    // Capture INFO and below even if the test logging config is quieter, or a leak goes unseen.
    originalLevel = logger.getLevel();
    logger.setLevel(Level.DEBUG);
    logEvents.start();
    logger.addAppender(logEvents);
  }

  @AfterEach
  void tearDown() {
    logger.detachAppender(logEvents);
    logEvents.stop();
    logger.setLevel(originalLevel);
  }

  @Test
  void resetTokenIsMailedButNeverLogged() throws Exception {
    try (MockedStatic<Entity> entity = mockEntityWithoutStoredSmtpSettings();
        MockedStatic<EmailUtil> email = mockStatic(EmailUtil.class)) {
      email
          .when(EmailUtil::getSmtpSettings)
          .thenReturn(new SmtpSettings().withEnableSmtpServer(true));
      email.when(EmailUtil::getOMBaseURL).thenReturn("http://localhost:8585");

      authenticator.sendPasswordResetLink(null, user, "Reset", "reset-template");
    }

    ArgumentCaptor<PasswordResetToken> stored = ArgumentCaptor.forClass(PasswordResetToken.class);
    verify(tokenRepository).insertToken(stored.capture());
    String token = stored.getValue().getToken().toString();
    assertTrue(
        logEvents.list.stream().noneMatch(event -> event.getFormattedMessage().contains(token)),
        "the reset token must not appear in the server log");
  }

  @Test
  void noResetTokenIsStoredWhenMailCannotBeSent() throws Exception {
    try (MockedStatic<Entity> entity = mockEntityWithoutStoredSmtpSettings();
        MockedStatic<EmailUtil> email = mockStatic(EmailUtil.class)) {
      email
          .when(EmailUtil::getSmtpSettings)
          .thenReturn(new SmtpSettings().withEnableSmtpServer(false));

      authenticator.sendPasswordResetLink(null, user, "Reset", "reset-template");
    }

    verify(tokenRepository, never()).insertToken(any());
  }

  /** EmailUtil reads SMTP settings while it initializes, which needs a system repository. */
  private static MockedStatic<Entity> mockEntityWithoutStoredSmtpSettings() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    when(systemRepository.getEmailConfigInternal()).thenReturn(null);
    MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
    return entity;
  }
}
