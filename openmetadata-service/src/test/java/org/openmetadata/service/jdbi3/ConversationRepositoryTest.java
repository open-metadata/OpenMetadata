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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ConversationSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.security.policyevaluator.ConversationReplyResourceContext;
import org.openmetadata.service.security.policyevaluator.ConversationResourceContext;

class ConversationRepositoryTest {
  private final ConversationRepository repository = new ConversationRepository(null, null);

  @Test
  void validatesUserAndActivitySourceInvariants() {
    UUID userConversationId = UUID.randomUUID();
    Conversation userConversation =
        baseConversation(userConversationId)
            .withSource(ConversationSource.User)
            .withMessage("User root")
            .withCreatedBy(userReference());
    repository.validateSourceInvariants(userConversation);

    UUID activityId = UUID.randomUUID();
    Conversation activityConversation =
        baseConversation(activityId)
            .withSource(ConversationSource.Activity)
            .withActivityEventId(activityId);
    repository.validateSourceInvariants(activityConversation);

    assertThrows(
        BadRequestException.class,
        () ->
            repository.validateSourceInvariants(
                baseConversation(UUID.randomUUID())
                    .withSource(ConversationSource.User)
                    .withMessage("Missing creator")));
    assertThrows(
        BadRequestException.class,
        () ->
            repository.validateSourceInvariants(
                activityConversation.withMessage("Synthetic activity root")));
  }

  @Test
  void buildsCompatibilityEventWithConversationIdentityAndBoundedReplies() {
    UUID conversationId = UUID.randomUUID();
    Conversation conversation =
        baseConversation(conversationId)
            .withSource(ConversationSource.User)
            .withMessage("Root")
            .withCreatedBy(userReference())
            .withReplies(
                IntStream.range(0, 6)
                    .mapToObj(
                        index ->
                            new ConversationReply()
                                .withId(UUID.randomUUID())
                                .withConversationId(conversationId)
                                .withMessage("Reply " + index)
                                .withAuthor(userReference())
                                .withCreatedAt((long) index)
                                .withUpdatedAt((long) index))
                    .toList());

    ChangeEvent event = repository.buildChangeEvent("admin", EventType.POST_CREATED, conversation);
    Conversation payload = (Conversation) event.getEntity();

    assertEquals(EventType.POST_CREATED, event.getEventType());
    assertEquals(Entity.CONVERSATION, event.getEntityType());
    assertEquals(conversationId, event.getEntityId());
    assertEquals(conversation.getAbout(), event.getEntityFullyQualifiedName());
    assertEquals(
        List.of("Reply 3", "Reply 4", "Reply 5"),
        payload.getReplies().stream().map(ConversationReply::getMessage).toList());
    assertEquals(
        6, conversation.getReplies().size(), "Event bounding must not mutate the response");
  }

  @Test
  void activityContainerCannotBeResolvedOrOwned() {
    UUID activityId = UUID.randomUUID();
    Conversation activityConversation =
        baseConversation(activityId)
            .withSource(ConversationSource.Activity)
            .withActivityEventId(activityId)
            .withResolved(true);

    assertThrows(
        BadRequestException.class, () -> repository.validateSourceInvariants(activityConversation));
    assertNull(activityConversation.getCreatedBy());
  }

  @Test
  void authorizationContextsExposeRootCreatorAndReplyAuthorAsOwners() {
    EntityReference creator = userReference();
    EntityReference author = userReference();
    EntityReference domain =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN).withName("domain");
    Conversation conversation =
        baseConversation(UUID.randomUUID())
            .withSource(ConversationSource.User)
            .withMessage("Root")
            .withCreatedBy(creator)
            .withDomains(List.of(domain));
    ConversationReply reply =
        new ConversationReply()
            .withId(UUID.randomUUID())
            .withConversationId(conversation.getId())
            .withMessage("Reply")
            .withAuthor(author)
            .withCreatedAt(conversation.getCreatedAt())
            .withUpdatedAt(conversation.getUpdatedAt());

    ConversationResourceContext rootContext = new ConversationResourceContext(conversation);
    ConversationReplyResourceContext replyContext =
        new ConversationReplyResourceContext(conversation, reply);

    assertEquals(List.of(creator), rootContext.getOwners());
    assertEquals(List.of(author), replyContext.getOwners());
    assertEquals(List.of(domain), rootContext.getDomains());
    assertEquals(List.of(domain), replyContext.getDomains());
  }

  @Test
  void hydrationQueryCountIsConstantWithPageSize() {
    CollectionDAO.ConversationDAO dao = mock(CollectionDAO.ConversationDAO.class);
    ConversationRepository queryRepository = new ConversationRepository(dao, null);
    when(dao.listRecentReplies(anyList(), eq(ConversationRepository.EMBEDDED_REPLY_LIMIT)))
        .thenReturn(List.of());
    when(dao.listDomains(anyList())).thenReturn(List.of());

    assertHydrationQueryCount(queryRepository, dao, 1);
    clearInvocations(dao);
    assertHydrationQueryCount(queryRepository, dao, 100);
  }

  private void assertHydrationQueryCount(
      ConversationRepository queryRepository, CollectionDAO.ConversationDAO dao, int pageSize) {
    List<Conversation> page =
        IntStream.range(0, pageSize)
            .mapToObj(index -> baseConversation(UUID.randomUUID()))
            .toList();

    queryRepository.hydrate(page, ConversationRepository.EMBEDDED_REPLY_LIMIT);

    verify(dao).listRecentReplies(anyList(), eq(ConversationRepository.EMBEDDED_REPLY_LIMIT));
    verify(dao).listDomains(anyList());
  }

  @Test
  void reactionsAreIdempotentAndRemovedOnlyForTheMatchingUser() {
    EntityReference firstUser = userReference();
    EntityReference secondUser = userReference();

    List<Reaction> reactions =
        repository.updatedReactions(List.of(), firstUser, ReactionType.HEART, true);
    reactions = repository.updatedReactions(reactions, firstUser, ReactionType.HEART, true);
    reactions = repository.updatedReactions(reactions, secondUser, ReactionType.HEART, true);

    assertEquals(2, reactions.size());

    reactions = repository.updatedReactions(reactions, firstUser, ReactionType.HEART, false);

    assertEquals(1, reactions.size());
    assertEquals(secondUser.getId(), reactions.getFirst().getUser().getId());
  }

  private Conversation baseConversation(UUID id) {
    long now = System.currentTimeMillis();
    return new Conversation()
        .withId(id)
        .withAbout("<#E::table::service.database.schema.table>")
        .withEntityRef(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.TABLE)
                .withName("table"))
        .withCreatedAt(now)
        .withUpdatedAt(now)
        .withResolved(false)
        .withReplyCount(0)
        .withReplies(List.of());
  }

  private EntityReference userReference() {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("admin");
  }
}
