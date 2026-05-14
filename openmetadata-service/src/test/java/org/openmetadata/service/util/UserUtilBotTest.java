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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Unit coverage for the boot-time bot-team-strip loop.
 *
 * <p>{@code BotResource.initialize()} calls {@link UserUtil#addOrUpdateBotUser(User)} for every
 * bot on every OM boot. The in-memory User built by {@code UserUtil.user(...)} does not have
 * the {@code teams} field populated, so without the short-circuit guard the call falls through
 * to {@code userRepository.createOrUpdate}, which runs {@code UserUpdater.updateTeams} with
 * {@code updated.teams == null} and wipes the bot's stored team relationships, bumps the
 * version, and triggers an Elasticsearch reindex on every boot.
 */
class UserUtilBotTest {

  @Test
  void addOrUpdateBotUserShortCircuitsWhenNothingChanged() {
    UserRepository userRepository = mock(UserRepository.class);

    User stored =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("ingestion-bot")
            .withDescription(null)
            .withIsBot(true)
            .withRoles(new ArrayList<>())
            // Pre-populate authMechanism so that if the short-circuit guard regresses, the
            // fall-through path doesn't immediately blow up in JWTTokenGenerator (which
            // isn't initialized in a pure unit test). With the bug present, the test still
            // proceeds into addOrUpdateUser and the `never()` verify below fires the
            // regression signal.
            .withAuthenticationMechanism(new AuthenticationMechanism().withAuthType(AuthType.JWT));
    User incoming =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("ingestion-bot")
            .withDescription(null)
            .withIsBot(true)
            .withRoles(null);

    when(userRepository.getByName(any(), eq("ingestion-bot"), any())).thenReturn(stored);

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      User result = UserUtil.addOrUpdateBotUser(incoming);
      assertSame(
          stored,
          result,
          "Short-circuit must return the original user without going through the PUT path");
    }

    // The whole point of the fix: never hit createOrUpdate when nothing changed.
    verify(userRepository, never()).createOrUpdate(any(), any(), any());
  }

  @Test
  void addOrUpdateBotUserGoesThroughUpsertWhenDisplayNameChanged() {
    UserRepository userRepository = mock(UserRepository.class);

    User stored =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("Old Display Name")
            .withIsBot(true)
            // Provide an authMechanism on the persisted row so the upsert path doesn't try
            // to generate a fresh JWT via JWTTokenGenerator (which isn't initialized in a
            // pure unit test).
            .withAuthenticationMechanism(new AuthenticationMechanism().withAuthType(AuthType.JWT));
    User incoming =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("New Display Name")
            .withIsBot(true);

    when(userRepository.getByName(any(), eq("ingestion-bot"), any())).thenReturn(stored);
    when(userRepository.findByNameOrNull(any(), any())).thenReturn(null);
    // Stub createOrUpdate so addOrUpdateUser completes normally and the test can assert on
    // the returned User instead of swallowing a downstream exception.
    when(userRepository.createOrUpdate(any(), any(User.class), any()))
        .thenReturn(new PutResponse<>(Response.Status.OK, incoming, EventType.ENTITY_UPDATED));

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      User result = UserUtil.addOrUpdateBotUser(incoming);
      assertNotEquals(
          stored,
          result,
          "When fields differ the upsert path must run and produce a different User");
    }

    verify(userRepository).createOrUpdate(any(), any(User.class), any());
  }

  /**
   * Role lookup goes through relationshipDAO().findTo(...) which has no ORDER BY clause, so the
   * same role set can come back in different orders across boots. The short-circuit must compare
   * roles as a set, otherwise the boot-time bot-team-strip loop returns under role reordering.
   */
  @Test
  void addOrUpdateBotUserShortCircuitsWhenRolesInDifferentOrder() {
    UserRepository userRepository = mock(UserRepository.class);

    UUID roleA = UUID.randomUUID();
    UUID roleB = UUID.randomUUID();
    EntityReference refA = new EntityReference().withId(roleA).withName("a").withType("role");
    EntityReference refB = new EntityReference().withId(roleB).withName("b").withType("role");

    User stored =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("ingestion-bot")
            .withIsBot(true)
            .withRoles(List.of(refA, refB))
            .withAuthenticationMechanism(new AuthenticationMechanism().withAuthType(AuthType.JWT));
    User incoming =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("ingestion-bot")
            .withIsBot(true)
            .withRoles(List.of(refB, refA));

    when(userRepository.getByName(any(), eq("ingestion-bot"), any())).thenReturn(stored);

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      User result = UserUtil.addOrUpdateBotUser(incoming);
      assertSame(
          stored,
          result,
          "Reordered role lists must still short-circuit — DB read has no ORDER BY guarantee");
    }

    verify(userRepository, never()).createOrUpdate(any(), any(), any());
  }

  /**
   * If the persisted bot row has no authMechanism, the short-circuit must NOT fire — the doc for
   * addOrUpdateBotUser promises to seed a fresh JWT/SSO mechanism in that case.
   */
  @Test
  void addOrUpdateBotUserFallsThroughWhenStoredAuthMechanismMissing() {
    UserRepository userRepository = mock(UserRepository.class);

    User stored =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("ingestion-bot")
            .withIsBot(true)
            .withRoles(new ArrayList<>())
            .withAuthenticationMechanism(null);
    User incoming =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withEmail("ingestion-bot@open-metadata.org")
            .withDisplayName("ingestion-bot")
            .withIsBot(true);

    JWTTokenGenerator jwtGenerator = mock(JWTTokenGenerator.class);
    when(jwtGenerator.generateJWTToken(any(User.class), eq(JWTTokenExpiry.Unlimited)))
        .thenReturn(new JWTAuthMechanism().withJWTToken("stub-token"));

    when(userRepository.getByName(any(), eq("ingestion-bot"), any())).thenReturn(stored);
    when(userRepository.findByNameOrNull(any(), any())).thenReturn(null);
    when(userRepository.createOrUpdate(any(), any(User.class), any()))
        .thenReturn(new PutResponse<>(Response.Status.OK, incoming, EventType.ENTITY_UPDATED));

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class);
        MockedStatic<JWTTokenGenerator> jwtStatic = mockStatic(JWTTokenGenerator.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      jwtStatic.when(JWTTokenGenerator::getInstance).thenReturn(jwtGenerator);
      UserUtil.addOrUpdateBotUser(incoming);
    }

    verify(userRepository).createOrUpdate(any(), any(User.class), any());
  }
}
