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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;

/**
 * A term an automation proposed is published only by a person's decision, whatever the approval
 * workflow is configured to do: a bot, or a workflow writing for one, never moves it to Approved.
 */
class GlossaryTermRepositoryStageDecisionTest {
  private static final String BOT = "ingestion-bot";
  private static final String GOVERNANCE_BOT = "governance-bot";
  private static final String PERSON = "alice";
  private static final String DRAFT = EntityStatus.DRAFT.value();
  private static final String IN_REVIEW = EntityStatus.IN_REVIEW.value();
  private static final String APPROVED = EntityStatus.APPROVED.value();
  private static final String REJECTED = EntityStatus.REJECTED.value();

  private GlossaryTermRepository repository;

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    repository = new GlossaryTermRepository(false);
    registerUsers(
        new User().withName(BOT).withIsBot(true),
        new User().withName(GOVERNANCE_BOT).withIsBot(true),
        new User().withName(PERSON).withIsBot(false));
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
    Entity.cleanup();
  }

  @Test
  void aWorkflowAutoApprovingForTheProposingBotIsRefused() {
    GlossaryTerm change = writtenBy(BOT).withImpersonatedBy(GOVERNANCE_BOT);

    assertThrows(
        AuthorizationException.class,
        () -> repository.checkStageDecision(proposal(), change, DRAFT, APPROVED));
  }

  @Test
  void aWorkflowWritingAsItselfNeverApprovesAProposal() {
    assertThrows(
        AuthorizationException.class,
        () ->
            repository.checkStageDecision(
                proposal(), writtenBy(GOVERNANCE_BOT), IN_REVIEW, APPROVED));
  }

  @Test
  void thePersonWhoApprovesTheTaskPublishesTheProposal() {
    GlossaryTerm change = writtenBy(PERSON).withImpersonatedBy(GOVERNANCE_BOT);

    assertDoesNotThrow(
        () -> repository.checkStageDecision(proposal(), change, IN_REVIEW, APPROVED));
  }

  @Test
  void aBotStillMovesAProposalAnywhereButApproved() {
    GlossaryTerm change = writtenBy(BOT).withImpersonatedBy(GOVERNANCE_BOT);

    assertDoesNotThrow(() -> repository.checkStageDecision(proposal(), change, DRAFT, IN_REVIEW));
    assertDoesNotThrow(
        () -> repository.checkStageDecision(proposal(), change, IN_REVIEW, REJECTED));
  }

  @Test
  void aPersonsTermFollowsItsWorkflowWhoeverWrites() {
    GlossaryTerm personsTerm = proposal().withProvider(ProviderType.USER);

    assertDoesNotThrow(
        () ->
            repository.checkStageDecision(personsTerm, writtenBy(GOVERNANCE_BOT), DRAFT, APPROVED));
  }

  private static GlossaryTerm proposal() {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("GDPR")
        .withFullyQualifiedName("Compliance.GDPR")
        .withProvider(ProviderType.AUTOMATION);
  }

  private static GlossaryTerm writtenBy(String userName) {
    return proposal().withUpdatedBy(userName);
  }

  @SuppressWarnings("unchecked")
  private static void registerUsers(User... users) {
    EntityRepository<User> userRepository = mock(EntityRepository.class);
    for (User user : users) {
      when(userRepository.findByNameOrNull(user.getName(), Include.NON_DELETED)).thenReturn(user);
    }
    Entity.registerEntity(User.class, Entity.USER, userRepository);
  }
}
