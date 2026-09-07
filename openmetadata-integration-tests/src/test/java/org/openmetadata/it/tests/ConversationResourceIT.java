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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.feed.CreateConversation;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ConversationFilterType;
import org.openmetadata.schema.type.ConversationSource;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ConversationResourceIT {
  private static final String CONVERSATIONS_PATH = "/v1/conversations";
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
  private static final RequestOptions PATCH_OPTIONS =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void testCompleteConversationCrudAndBoundedHydration(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "crud");
    String about = entityLink(table);
    Conversation conversation = createConversation(about, "Root message");

    assertNotNull(conversation.getId());
    assertEquals(ConversationSource.User, conversation.getSource());
    assertEquals(about, conversation.getAbout());
    assertEquals(table.getId(), conversation.getEntityRef().getId());
    assertNotNull(conversation.getHref());
    assertEquals(0, conversation.getReplyCount());

    List<ConversationReply> createdReplies = new ArrayList<>();
    for (int i = 0; i < 4; i++) {
      createdReplies.add(addReply(conversation.getId(), "Reply " + i));
    }

    Conversation hydrated = getConversation(conversation.getId());
    assertEquals(4, hydrated.getReplyCount());
    assertEquals(3, hydrated.getReplies().size(), "Only three recent replies are embedded");

    ConversationReplyList replies = listReplies(conversation.getId(), 100, null, null);
    assertEquals(4, replies.getPaging().getTotal());
    assertEquals(
        createdReplies.stream().map(ConversationReply::getId).toList(),
        replies.getData().stream().map(ConversationReply::getId).toList());

    ConversationReply patchedReply =
        patchReply(
            conversation.getId(),
            createdReplies.getFirst().getId(),
            patch("/message", "Edited reply"));
    assertEquals("Edited reply", patchedReply.getMessage());

    Conversation patchedRoot = patchConversation(conversation.getId(), patch("/resolved", true));
    assertTrue(patchedRoot.getResolved());

    deleteReply(conversation.getId(), createdReplies.getLast().getId());
    assertEquals(3, getConversation(conversation.getId()).getReplyCount());

    deleteConversation(conversation.getId());
    assertThrows(ApiException.class, () -> getConversation(conversation.getId()));
  }

  @Test
  void testListingFiltersAndKeysetPagination(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "listing");
    String about = entityLink(table);
    Conversation first = createConversation(about, "First root");
    Conversation second = createConversation(about, "Second root");
    Conversation third = createConversation(about, "Third root");

    ConversationList firstPage = listConversations(about, 2, null, null, null);
    assertEquals(3, firstPage.getPaging().getTotal());
    assertEquals(2, firstPage.getData().size());
    assertNotNull(firstPage.getPaging().getAfter());

    ConversationList secondPage =
        listConversations(about, 2, firstPage.getPaging().getAfter(), null, null);
    assertEquals(1, secondPage.getData().size());
    assertFalse(
        firstPage.getData().stream()
            .map(Conversation::getId)
            .anyMatch(secondPage.getData().getFirst().getId()::equals));

    patchConversation(second.getId(), patch("/resolved", true));
    ConversationList resolved = listConversations(about, 10, null, null, true);
    assertEquals(
        List.of(second.getId()), resolved.getData().stream().map(Conversation::getId).toList());

    deleteConversation(first.getId());
    deleteConversation(second.getId());
    deleteConversation(third.getId());
  }

  @Test
  void testReplyPaginationUsesIndependentCursor(TestNamespace ns) throws Exception {
    Conversation conversation =
        createConversation(entityLink(createTestTable(ns, "reply-cursor")), "Cursor root");
    for (int i = 0; i < 5; i++) {
      addReply(conversation.getId(), "Reply " + i);
    }

    ConversationReplyList firstPage = listReplies(conversation.getId(), 2, null, null);
    ConversationReplyList secondPage =
        listReplies(conversation.getId(), 2, firstPage.getPaging().getAfter(), null);

    assertEquals(2, firstPage.getData().size());
    assertEquals(2, secondPage.getData().size());
    assertTrue(
        firstPage.getData().stream()
            .map(ConversationReply::getId)
            .noneMatch(
                secondPage.getData().stream().map(ConversationReply::getId).toList()::contains));
    assertThrows(
        InvalidRequestException.class,
        () ->
            listReplies(
                conversation.getId(),
                2,
                secondPage.getPaging().getAfter(),
                secondPage.getPaging().getBefore()));
  }

  @Test
  void testRootAndReplyReactionsArePerUser(TestNamespace ns) throws Exception {
    Conversation conversation =
        createConversation(entityLink(createTestTable(ns, "reaction")), "Reaction root");
    ConversationReply reply = addReply(conversation.getId(), "Reaction reply");

    Conversation reactedRoot =
        putRootReaction(SdkClients.adminClient(), conversation.getId(), ReactionType.ROCKET);
    ConversationReply reactedReply =
        putReplyReaction(
            SdkClients.adminClient(), conversation.getId(), reply.getId(), ReactionType.HEART);
    assertEquals(1, reactedRoot.getReactions().size());
    assertEquals(1, reactedReply.getReactions().size());

    List<CompletableFuture<Conversation>> duplicateWrites =
        IntStream.range(0, 6)
            .mapToObj(
                ignored ->
                    CompletableFuture.supplyAsync(
                        () -> {
                          try {
                            return putRootReaction(
                                SdkClients.adminClient(),
                                conversation.getId(),
                                ReactionType.ROCKET);
                          } catch (Exception exception) {
                            throw new IllegalStateException(exception);
                          }
                        }))
            .toList();
    CompletableFuture.allOf(duplicateWrites.toArray(CompletableFuture[]::new)).join();
    assertEquals(
        1,
        getConversation(conversation.getId()).getReactions().stream()
            .filter(
                reaction ->
                    reaction.getReactionType() == ReactionType.ROCKET
                        && "admin".equals(reaction.getUser().getName()))
            .count(),
        "concurrent duplicate reactions must remain idempotent");

    Conversation concurrentReactionConversation =
        createConversation(
            entityLink(createTestTable(ns, "distinct-reactions")), "Concurrent root");
    List<Map.Entry<OpenMetadataClient, ReactionType>> reactionsByUser =
        List.of(
            Map.entry(SdkClients.adminClient(), ReactionType.HEART),
            Map.entry(SdkClients.user2Client(), ReactionType.ROCKET),
            Map.entry(SdkClients.testUserClient(), ReactionType.THUMBS_UP));
    List<CompletableFuture<Conversation>> distinctWrites =
        reactionsByUser.stream()
            .map(
                reaction ->
                    CompletableFuture.supplyAsync(
                        () -> {
                          try {
                            return putRootReaction(
                                reaction.getKey(),
                                concurrentReactionConversation.getId(),
                                reaction.getValue());
                          } catch (Exception exception) {
                            throw new IllegalStateException(exception);
                          }
                        }))
            .toList();
    CompletableFuture.allOf(distinctWrites.toArray(CompletableFuture[]::new)).join();
    Conversation afterDistinctWrites = getConversation(concurrentReactionConversation.getId());
    assertEquals(
        reactionsByUser.size(),
        afterDistinctWrites.getReactions().size(),
        "concurrent reactions from different users must not overwrite each other");

    putRootReaction(SdkClients.user2Client(), conversation.getId(), ReactionType.ROCKET);
    Conversation afterAdminRemoval =
        deleteRootReaction(SdkClients.adminClient(), conversation.getId(), ReactionType.ROCKET);
    assertEquals(1, afterAdminRemoval.getReactions().size());
    assertEquals("shared_user2", afterAdminRemoval.getReactions().getFirst().getUser().getName());

    ConversationReply afterReplyRemoval =
        deleteReplyReaction(
            SdkClients.adminClient(), conversation.getId(), reply.getId(), ReactionType.HEART);
    assertTrue(afterReplyRemoval.getReactions().isEmpty());
  }

  @Test
  void testRootPatchPreservesReactions(TestNamespace ns) throws Exception {
    Conversation conversation =
        createConversation(entityLink(createTestTable(ns, "patch-reactions")), "Original root");
    putRootReaction(SdkClients.adminClient(), conversation.getId(), ReactionType.HEART);

    Conversation patchedMessage =
        patchConversation(conversation.getId(), patch("/message", "Updated root"));
    assertEquals("Updated root", patchedMessage.getMessage());
    assertEquals(1, patchedMessage.getReactions().size());
    assertEquals(ReactionType.HEART, patchedMessage.getReactions().getFirst().getReactionType());

    Conversation patchedResolved =
        patchConversation(conversation.getId(), patch("/resolved", true));
    assertTrue(patchedResolved.getResolved());
    assertEquals(1, patchedResolved.getReactions().size());
    assertEquals(ReactionType.HEART, patchedResolved.getReactions().getFirst().getReactionType());
  }

  @Test
  void testConcurrentRepliesDoNotLoseRowsOrCounters(TestNamespace ns) throws Exception {
    Conversation conversation =
        createConversation(entityLink(createTestTable(ns, "concurrent")), "Concurrent root");
    int replyCount = 12;
    List<CompletableFuture<ConversationReply>> writes =
        IntStream.range(0, replyCount)
            .mapToObj(
                index ->
                    CompletableFuture.supplyAsync(
                        () -> {
                          try {
                            return addReply(conversation.getId(), "Concurrent " + index);
                          } catch (Exception exception) {
                            throw new IllegalStateException(exception);
                          }
                        }))
            .toList();
    CompletableFuture.allOf(writes.toArray(CompletableFuture[]::new)).join();

    assertEquals(replyCount, getConversation(conversation.getId()).getReplyCount());
    assertEquals(replyCount, listReplies(conversation.getId(), 100, null, null).getData().size());
  }

  @Test
  void testValidationAndPatchAllowlist(TestNamespace ns) throws Exception {
    String about = entityLink(createTestTable(ns, "validation"));
    assertThrows(InvalidRequestException.class, () -> createConversation(about, "   "));

    Conversation conversation = createConversation(about, "Valid root");
    assertThrows(
        InvalidRequestException.class,
        () -> patchConversation(conversation.getId(), patch("/source", "Activity")));
    assertThrows(InvalidRequestException.class, () -> addReply(conversation.getId(), "\n\t"));
  }

  @Test
  void testColumnConversationValidationAndNotFoundResponses(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "column-validation");
    String columnLink =
        "<#E::table::" + table.getFullyQualifiedName() + "::columns::id::description>";
    Conversation columnConversation =
        createConversation(columnLink, "Comment on the column description");
    assertEquals(columnLink, columnConversation.getAbout());

    assertThrows(
        InvalidRequestException.class,
        () -> createConversation(new CreateConversation().withMessage("Missing target")));
    assertThrows(
        InvalidRequestException.class,
        () -> createConversation(new CreateConversation().withAbout(entityLink(table))));
    assertThrows(InvalidRequestException.class, () -> createConversation("<>", "Invalid target"));
    assertThrows(
        ApiException.class,
        () -> createConversation("<#E::table::missing.database.schema.table>", "Missing target"));
    assertThrows(InvalidRequestException.class, () -> addReply(columnConversation.getId(), null));

    UUID missingId = UUID.randomUUID();
    assertThrows(ApiException.class, () -> getConversation(missingId));
    assertThrows(ApiException.class, () -> listReplies(missingId, 20, null, null));
    assertThrows(ApiException.class, () -> deleteConversation(missingId));
    assertThrows(
        ApiException.class, () -> deleteReply(columnConversation.getId(), UUID.randomUUID()));
  }

  @Test
  void testOwnerFollowsAndMentionsFilters(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "user-filters");
    User admin = SdkClients.adminClient().users().getByName("admin");
    User testUser = SdkClients.adminClient().users().getByName("test");
    Conversation ownerConversation = createConversation(entityLink(table), "Owner conversation");
    Conversation mentionConversation =
        createConversation(entityLink(table), "Hello <#E::user::test>");
    addTableFollower(table.getId(), testUser.getId());

    ConversationList owned =
        listConversations(
            SdkClients.adminClient(),
            null,
            admin.getId(),
            ConversationFilterType.OWNER,
            100,
            null,
            null,
            null);
    ConversationList followed =
        listConversations(
            SdkClients.adminClient(),
            null,
            testUser.getId(),
            ConversationFilterType.FOLLOWS,
            100,
            null,
            null,
            null);
    ConversationList mentioned =
        listConversations(
            SdkClients.adminClient(),
            null,
            testUser.getId(),
            ConversationFilterType.MENTIONS,
            100,
            null,
            null,
            null);
    ConversationList ownedOrFollowed =
        listConversations(
            SdkClients.adminClient(),
            null,
            testUser.getId(),
            ConversationFilterType.OWNER_OR_FOLLOWS,
            100,
            null,
            null,
            null);

    assertContainsConversation(owned, ownerConversation.getId());
    assertContainsConversation(followed, ownerConversation.getId());
    assertContainsConversation(mentioned, mentionConversation.getId());
    assertContainsConversation(ownedOrFollowed, ownerConversation.getId());
    assertThrows(InvalidRequestException.class, () -> listWithInvalidFilter(testUser.getId()));
  }

  @Test
  void testCreatorAndReplyAuthorAuthorization(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "authorization");
    Conversation adminConversation = createConversation(entityLink(table), "Admin root");
    assertThrows(
        ForbiddenException.class,
        () ->
            patchConversation(
                SdkClients.user2Client(),
                adminConversation.getId(),
                patch("/message", "Unauthorized edit")));

    Conversation userConversation =
        createConversation(SdkClients.user2Client(), entityLink(table), "User root");
    Conversation updatedRoot =
        patchConversation(
            SdkClients.user2Client(),
            userConversation.getId(),
            patch("/message", "User-edited root"));
    assertEquals("shared_user2", updatedRoot.getUpdatedBy());
    Conversation adminUpdatedRoot =
        patchConversation(
            SdkClients.adminClient(),
            userConversation.getId(),
            patch("/message", "Administrator-edited root"));
    assertEquals("admin", adminUpdatedRoot.getUpdatedBy());

    ConversationReply reply =
        addReply(SdkClients.user2Client(), adminConversation.getId(), "User reply");
    ConversationReply updatedReply =
        patchReply(
            SdkClients.user2Client(),
            adminConversation.getId(),
            reply.getId(),
            patch("/message", "User-edited reply"));
    assertEquals("shared_user2", updatedReply.getUpdatedBy());
    assertThrows(
        ForbiddenException.class,
        () ->
            patchReply(
                SdkClients.testUserClient(),
                adminConversation.getId(),
                reply.getId(),
                patch("/message", "Unauthorized reply edit")));
    ConversationReply adminUpdatedReply =
        patchReply(
            SdkClients.adminClient(),
            adminConversation.getId(),
            reply.getId(),
            patch("/message", "Administrator-edited reply"));
    assertEquals("admin", adminUpdatedReply.getUpdatedBy());
    assertThrows(
        ForbiddenException.class,
        () -> deleteReply(SdkClients.testUserClient(), adminConversation.getId(), reply.getId()));
    deleteReply(SdkClients.adminClient(), adminConversation.getId(), reply.getId());
  }

  @Test
  void testDomainVisibilityAndEntityDeletionCleanup(TestNamespace ns) throws Exception {
    Domain allowedDomain = createDomain(ns, "conversation-allowed-domain");
    Domain blockedDomain = createDomain(ns, "conversation-blocked-domain");
    Table allowedTable = createTableInDomain(ns, "conversation-allowed-table", allowedDomain);
    Table blockedTable = createTableInDomain(ns, "conversation-blocked-table", blockedDomain);
    Conversation allowed = createConversation(entityLink(allowedTable), "Allowed conversation");
    Conversation blocked = createConversation(entityLink(blockedTable), "Blocked conversation");
    OpenMetadataClient domainClient = createDomainOnlyConversationClient(ns, allowedDomain);

    ConversationList visible =
        listConversations(domainClient, null, null, null, 100, null, null, null);
    assertContainsConversation(visible, allowed.getId());
    assertFalse(containsConversation(visible, blocked.getId()));
    assertEquals(allowed.getId(), getConversation(domainClient, allowed.getId()).getId());
    ApiException hidden =
        assertThrows(ApiException.class, () -> getConversation(domainClient, blocked.getId()));
    assertEquals(404, hidden.getStatusCode());

    SdkClients.adminClient()
        .tables()
        .delete(allowedTable.getId().toString(), Map.of("hardDelete", "true"));
    assertThrows(ApiException.class, () -> getConversation(allowed.getId()));
  }

  @Test
  void testDomainChangesSynchronizeConversationVisibility(TestNamespace ns) throws Exception {
    Domain allowedDomain = createDomain(ns, "conversation-domain-sync-allowed");
    Domain blockedDomain = createDomain(ns, "conversation-domain-sync-blocked");
    Table table = createTableInDomain(ns, "conversation-domain-sync-table", blockedDomain);
    Conversation conversation = createConversation(entityLink(table), "Domain sync conversation");
    OpenMetadataClient domainClient = createDomainOnlyConversationClient(ns, allowedDomain);

    assertHidden(domainClient, conversation.getId());
    patchTableDomains(table.getId(), List.of(allowedDomain));
    Awaitility.await("conversation moves into the allowed domain")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              Conversation visible = getConversation(domainClient, conversation.getId());
              assertEquals(
                  List.of(allowedDomain.getId()),
                  visible.getDomains().stream().map(reference -> reference.getId()).toList());
            });

    patchTableDomains(table.getId(), List.of(blockedDomain));
    Awaitility.await("conversation leaves the allowed domain")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertHidden(domainClient, conversation.getId()));
  }

  private static Table createTestTable(TestNamespace ns, String suffix) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix("conversation-db-" + suffix))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("conversation-schema-" + suffix))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createWithName(
        ns, schema.getFullyQualifiedName(), "conversation-table-" + suffix);
  }

  private static String entityLink(Table table) {
    return "<#E::table::" + table.getFullyQualifiedName() + ">";
  }

  private static Conversation createConversation(String about, String message) throws Exception {
    return createConversation(
        SdkClients.adminClient(), new CreateConversation().withAbout(about).withMessage(message));
  }

  private static Conversation createConversation(
      OpenMetadataClient client, String about, String message) throws Exception {
    return createConversation(
        client, new CreateConversation().withAbout(about).withMessage(message));
  }

  private static Conversation createConversation(CreateConversation request) throws Exception {
    return createConversation(SdkClients.adminClient(), request);
  }

  private static Conversation createConversation(
      OpenMetadataClient client, CreateConversation request) throws Exception {
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, CONVERSATIONS_PATH, request, Conversation.class);
  }

  private static Conversation getConversation(UUID id) throws Exception {
    return getConversation(SdkClients.adminClient(), id);
  }

  private static Conversation getConversation(OpenMetadataClient client, UUID id) throws Exception {
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, CONVERSATIONS_PATH + "/" + id, null, Conversation.class);
  }

  private static ConversationList listConversations(
      String about, int limit, String after, String before, Boolean resolved) throws Exception {
    return listConversations(
        SdkClients.adminClient(), about, null, null, limit, after, before, resolved);
  }

  private static ConversationList listConversations(
      OpenMetadataClient client,
      String about,
      UUID userId,
      ConversationFilterType filterType,
      int limit,
      String after,
      String before,
      Boolean resolved)
      throws Exception {
    RequestOptions.Builder options =
        RequestOptions.builder().queryParam("limit", String.valueOf(limit));
    if (about != null) {
      options.queryParam("entityLink", about);
    }
    if (userId != null) {
      options.queryParam("userId", userId.toString());
    }
    if (filterType != null) {
      options.queryParam("filterType", filterType.value());
    }
    if (after != null) {
      options.queryParam("after", after);
    }
    if (before != null) {
      options.queryParam("before", before);
    }
    if (resolved != null) {
      options.queryParam("resolved", resolved.toString());
    }
    String json =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, CONVERSATIONS_PATH, null, options.build());
    return MAPPER.readValue(json, ConversationList.class);
  }

  private static ConversationReply addReply(UUID conversationId, String message) throws Exception {
    return addReply(SdkClients.adminClient(), conversationId, message);
  }

  private static ConversationReply addReply(
      OpenMetadataClient client, UUID conversationId, String message) throws Exception {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            CONVERSATIONS_PATH + "/" + conversationId + "/replies",
            new CreatePost().withMessage(message),
            ConversationReply.class);
  }

  private static ConversationReplyList listReplies(
      UUID conversationId, int limit, String after, String before) throws Exception {
    RequestOptions.Builder options =
        RequestOptions.builder().queryParam("limit", String.valueOf(limit));
    if (after != null) {
      options.queryParam("after", after);
    }
    if (before != null) {
      options.queryParam("before", before);
    }
    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                CONVERSATIONS_PATH + "/" + conversationId + "/replies",
                null,
                options.build());
    return MAPPER.readValue(json, ConversationReplyList.class);
  }

  private static Conversation patchConversation(UUID conversationId, JsonNode patch)
      throws Exception {
    return patchConversation(SdkClients.adminClient(), conversationId, patch);
  }

  private static Conversation patchConversation(
      OpenMetadataClient client, UUID conversationId, JsonNode patch) throws Exception {
    String json =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PATCH, CONVERSATIONS_PATH + "/" + conversationId, patch, PATCH_OPTIONS);
    return MAPPER.readValue(json, Conversation.class);
  }

  private static ConversationReply patchReply(UUID conversationId, UUID replyId, JsonNode patch)
      throws Exception {
    return patchReply(SdkClients.adminClient(), conversationId, replyId, patch);
  }

  private static ConversationReply patchReply(
      OpenMetadataClient client, UUID conversationId, UUID replyId, JsonNode patch)
      throws Exception {
    String json =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PATCH,
                CONVERSATIONS_PATH + "/" + conversationId + "/replies/" + replyId,
                patch,
                PATCH_OPTIONS);
    return MAPPER.readValue(json, ConversationReply.class);
  }

  private static void deleteConversation(UUID conversationId) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            CONVERSATIONS_PATH + "/" + conversationId,
            null,
            RequestOptions.builder().build());
  }

  private static void deleteReply(UUID conversationId, UUID replyId) throws Exception {
    deleteReply(SdkClients.adminClient(), conversationId, replyId);
  }

  private static void deleteReply(OpenMetadataClient client, UUID conversationId, UUID replyId)
      throws Exception {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            CONVERSATIONS_PATH + "/" + conversationId + "/replies/" + replyId,
            null,
            RequestOptions.builder().build());
  }

  private static void addTableFollower(UUID tableId, UUID userId) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/tables/" + tableId + "/followers", userId, ChangeEvent.class);
  }

  private static void patchTableDomains(UUID tableId, List<Domain> domains) throws Exception {
    List<Map<String, String>> references =
        domains.stream()
            .map(domain -> Map.of("id", domain.getId().toString(), "type", "domain"))
            .toList();
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/domains\",\"value\":"
            + MAPPER.writeValueAsString(references)
            + "}]";
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PATCH, "/v1/tables/" + tableId, patch, PATCH_OPTIONS);
  }

  private static void assertHidden(OpenMetadataClient client, UUID conversationId) {
    ApiException hidden =
        assertThrows(ApiException.class, () -> getConversation(client, conversationId));
    assertEquals(404, hidden.getStatusCode());
  }

  private static void listWithInvalidFilter(UUID userId) throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("userId", userId.toString())
            .queryParam("filterType", "INVALID")
            .build();
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.GET, CONVERSATIONS_PATH, null, options);
  }

  private static boolean containsConversation(ConversationList conversations, UUID id) {
    return conversations.getData().stream()
        .anyMatch(conversation -> id.equals(conversation.getId()));
  }

  private static void assertContainsConversation(ConversationList conversations, UUID id) {
    assertTrue(containsConversation(conversations, id), "Expected conversation " + id);
  }

  private static Domain createDomain(TestNamespace ns, String name) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(name))
                .withDescription("Conversation integration test domain")
                .withDomainType(CreateDomain.DomainType.AGGREGATE));
  }

  private static Table createTableInDomain(TestNamespace ns, String name, Domain domain)
      throws Exception {
    CreateDatabaseService serviceRequest =
        new CreateDatabaseService()
            .withName(ns.prefix(name + "-service"))
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Postgres)
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DatabaseService service = SdkClients.adminClient().databaseServices().create(serviceRequest);
    Database database =
        Databases.create()
            .name(ns.prefix(name + "-database"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix(name + "-schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), name);
  }

  private static OpenMetadataClient createDomainOnlyConversationClient(
      TestNamespace ns, Domain allowedDomain) {
    Role domainOnlyRole = SdkClients.adminClient().roles().getByName("DomainOnlyAccessRole");
    Role dataStewardRole = SdkClients.adminClient().roles().getByName("DataSteward");
    String userName = ns.shortPrefix("domain_conversation");
    String email = userName + "@test.om.org";
    CreateUser request =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withDescription("Domain-only conversation test user")
            .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
            .withRoles(List.of(domainOnlyRole.getId(), dataStewardRole.getId()));
    SdkClients.adminClient().users().create(request);
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static Conversation putRootReaction(
      OpenMetadataClient client, UUID conversationId, ReactionType reactionType) throws Exception {
    return rootReaction(client, HttpMethod.PUT, conversationId, reactionType);
  }

  private static Conversation deleteRootReaction(
      OpenMetadataClient client, UUID conversationId, ReactionType reactionType) throws Exception {
    return rootReaction(client, HttpMethod.DELETE, conversationId, reactionType);
  }

  private static Conversation rootReaction(
      OpenMetadataClient client, HttpMethod method, UUID conversationId, ReactionType reactionType)
      throws Exception {
    String json =
        client
            .getHttpClient()
            .executeForString(
                method,
                CONVERSATIONS_PATH + "/" + conversationId + "/reaction/" + reactionType.value(),
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(json, Conversation.class);
  }

  private static ConversationReply putReplyReaction(
      OpenMetadataClient client, UUID conversationId, UUID replyId, ReactionType reactionType)
      throws Exception {
    return replyReaction(client, HttpMethod.PUT, conversationId, replyId, reactionType);
  }

  private static ConversationReply deleteReplyReaction(
      OpenMetadataClient client, UUID conversationId, UUID replyId, ReactionType reactionType)
      throws Exception {
    return replyReaction(client, HttpMethod.DELETE, conversationId, replyId, reactionType);
  }

  private static ConversationReply replyReaction(
      OpenMetadataClient client,
      HttpMethod method,
      UUID conversationId,
      UUID replyId,
      ReactionType reactionType)
      throws Exception {
    String json =
        client
            .getHttpClient()
            .executeForString(
                method,
                CONVERSATIONS_PATH
                    + "/"
                    + conversationId
                    + "/replies/"
                    + replyId
                    + "/reaction/"
                    + reactionType.value(),
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(json, ConversationReply.class);
  }

  private static JsonNode patch(String path, Object value) {
    return MAPPER
        .createArrayNode()
        .add(
            MAPPER
                .createObjectNode()
                .put("op", "replace")
                .put("path", path)
                .set("value", MAPPER.valueToTree(value)));
  }

  public static class ConversationList {
    @JsonProperty("data")
    private List<Conversation> data;

    @JsonProperty("paging")
    private Paging paging;

    public List<Conversation> getData() {
      return data;
    }

    public void setData(List<Conversation> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }

  public static class ConversationReplyList {
    @JsonProperty("data")
    private List<ConversationReply> data;

    @JsonProperty("paging")
    private Paging paging;

    public List<ConversationReply> getData() {
      return data;
    }

    public void setData(List<ConversationReply> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }
}
