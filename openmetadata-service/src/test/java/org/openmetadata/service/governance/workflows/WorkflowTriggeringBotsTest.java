/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;

class WorkflowTriggeringBotsTest {
  private static final String WORKFLOW = "GlossaryReview";

  private MockedStatic<Entity> entity;
  private EntityRepository<?> botRepository;

  @BeforeEach
  void setUp() {
    entity = mockStatic(Entity.class);
    botRepository = mock(EntityRepository.class);
    entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
    entity
        .when(() -> Entity.getEntityByName(eq(Entity.BOT), anyString(), anyString(), any()))
        .thenThrow(EntityNotFoundException.byName("missing"));
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void adminCreatedBotIsAccepted() {
    Bot bot = givenBot("scraper", ProviderType.USER, false);
    assertDoesNotThrow(
        () -> WorkflowTriggeringBots.requireAdminCreatedBots(WORKFLOW, List.of(bot.getName())));
  }

  @Test
  void systemBotIsRefused() {
    givenBot("ingestion-bot", ProviderType.SYSTEM, false);
    BadRequestException error =
        assertThrows(
            BadRequestException.class,
            () ->
                WorkflowTriggeringBots.requireAdminCreatedBots(WORKFLOW, List.of("ingestion-bot")));
    assertTrue(error.getMessage().contains("is a system bot"));
  }

  @Test
  void applicationsBotIsRefused() {
    givenBot("SearchIndexingApplicationBot", ProviderType.USER, true);
    BadRequestException error =
        assertThrows(
            BadRequestException.class,
            () ->
                WorkflowTriggeringBots.requireAdminCreatedBots(
                    WORKFLOW, List.of("SearchIndexingApplicationBot")));
    assertTrue(error.getMessage().contains("is an application's bot"));
  }

  @Test
  void botLeftBehindByAnUninstalledApplicationIsRefused() {
    givenBot("CacheWarmupApplicationBot", ProviderType.USER, false);
    entity
        .when(
            () ->
                Entity.findByNameOrNull(
                    Entity.APP_MARKET_PLACE_DEF, "CacheWarmupApplication", Include.ALL))
        .thenReturn(new Object());
    BadRequestException error =
        assertThrows(
            BadRequestException.class,
            () ->
                WorkflowTriggeringBots.requireAdminCreatedBots(
                    WORKFLOW, List.of("CacheWarmupApplicationBot")));
    assertTrue(error.getMessage().contains("is an application's bot"));
  }

  @Test
  void adminBotWhoseNameEndsInBotButNamesNoApplicationIsAccepted() {
    Bot bot = givenBot("ScraperBot", ProviderType.USER, false);
    assertDoesNotThrow(
        () -> WorkflowTriggeringBots.requireAdminCreatedBots(WORKFLOW, List.of(bot.getName())));
  }

  @Test
  void unknownBotIsRefused() {
    BadRequestException error =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowTriggeringBots.requireAdminCreatedBots(WORKFLOW, List.of("nobody")));
    assertTrue(error.getMessage().contains("does not exist"));
  }

  @Test
  void botUserNamesAreTheUsersTheBotsWriteAsAndSkipDeletedBots() {
    givenBot("scraper", ProviderType.USER, false);
    assertEquals(
        Set.of("scraper-user"), WorkflowTriggeringBots.botUserNames(List.of("scraper", "gone")));
  }

  private Bot givenBot(String name, ProviderType provider, boolean ownedByApplication) {
    Bot bot =
        new Bot()
            .withId(UUID.randomUUID())
            .withName(name)
            .withProvider(provider)
            .withBotUser(new EntityReference().withName("%s-user".formatted(name)));
    entity
        .when(() -> Entity.getEntityByName(Entity.BOT, name, "botUser", Include.NON_DELETED))
        .thenReturn(bot);
    List<EntityReference> applications =
        ownedByApplication
            ? List.of(new EntityReference().withType(Entity.APPLICATION))
            : List.of();
    when(botRepository.findFrom(
            bot.getId(), Entity.BOT, Relationship.CONTAINS, Entity.APPLICATION, Include.ALL))
        .thenReturn(applications);
    return bot;
  }
}
