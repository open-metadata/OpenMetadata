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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CreateConversation;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ConversationFilterType;
import org.openmetadata.schema.type.ConversationSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.ConversationReplyResourceContext;
import org.openmetadata.service.security.policyevaluator.ConversationResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

/** Repository for bounded conversation roots and normalized replies. */
@Slf4j
@Repository
public class ConversationRepository {
  public static final String COLLECTION_PATH = "/v1/conversations/";
  public static final int MAX_ROOT_PAGE_SIZE = 100;
  public static final int MAX_REPLY_PAGE_SIZE = 100;
  public static final int EMBEDDED_REPLY_LIMIT = 3;
  static final String ROOT_TARGET = "Root";
  static final String REPLY_TARGET = "Reply";
  private static final String DELETED_USER_NAME = "DeletedUser";
  private static final String DELETED_USER_DISPLAY = "User was deleted";

  private final CollectionDAO.ConversationDAO conversationDAO;
  private final ActivityStreamRepository activityStreamRepository;

  public ConversationRepository() {
    this(Entity.getCollectionDAO().conversationDAO(), new ActivityStreamRepository());
    Entity.setConversationRepository(this);
    ResourceRegistry.addResource(
        Entity.CONVERSATION, List.of(), Entity.getEntityFields(Conversation.class));
  }

  public ConversationRepository(
      CollectionDAO.ConversationDAO conversationDAO,
      ActivityStreamRepository activityStreamRepository) {
    this.conversationDAO = conversationDAO;
    this.activityStreamRepository = activityStreamRepository;
  }

  public ResultList<Conversation> list(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Authorizer authorizer,
      String entityLink,
      UUID userId,
      ConversationFilterType filterType,
      Boolean resolved,
      Long startTs,
      Long endTs,
      String before,
      String after,
      int requestedLimit) {
    validateTimeRange(startTs, endTs);
    authorizeList(securityContext, authorizer);
    int limit = Math.min(requestedLimit, MAX_ROOT_PAGE_SIZE);
    ConversationFilter filter =
        buildFilter(
            securityContext,
            entityLink,
            userId,
            filterType,
            resolved,
            startTs,
            endTs,
            before,
            after);
    ConversationFilter.Sql pageSql = filter.build(true);
    List<String> jsons =
        conversationDAO.list(pageSql.condition(), pageSql.order(), pageSql.params(), limit + 1);
    boolean hasMore = jsons.size() > limit;
    if (hasMore) {
      jsons = new ArrayList<>(jsons.subList(0, limit));
    }
    List<Conversation> conversations = JsonUtils.readObjects(jsons, Conversation.class);
    if (before != null) {
      Collections.reverse(conversations);
    }
    hydrate(conversations, EMBEDDED_REPLY_LIMIT);
    conversations.forEach(conversation -> withHref(uriInfo, conversation));
    ConversationFilter.Sql countSql = filter.build(false);
    int total = conversationDAO.count(countSql.condition(), countSql.params());
    return rootResult(conversations, before, after, hasMore, total);
  }

  public Conversation create(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Authorizer authorizer,
      CreateConversation request) {
    validateMessage(request.getMessage());
    Target target = resolveTarget(request.getAbout(), NON_DELETED);
    EntityReference creator = currentUser(securityContext);
    long now = System.currentTimeMillis();
    Conversation conversation =
        new Conversation()
            .withId(UUID.randomUUID())
            .withSource(ConversationSource.User)
            .withAbout(request.getAbout())
            .withEntityRef(target.reference())
            .withDomains(target.domains())
            .withMessage(request.getMessage())
            .withCreatedBy(creator)
            .withCreatedAt(now)
            .withUpdatedAt(now)
            .withUpdatedBy(creator.getName())
            .withResolved(false)
            .withReplyCount(0)
            .withReplies(List.of())
            .withImpersonatedBy(ImpersonationContext.getImpersonatedBy());
    validateSourceInvariants(conversation);
    authorizeRootCreate(securityContext, authorizer, conversation, target.reference());
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              CollectionDAO.ConversationDAO dao =
                  handle.attach(CollectionDAO.ConversationDAO.class);
              insertRoot(dao, conversation, false);
              storeDomains(dao, conversation);
              replaceMentions(
                  dao,
                  conversation.getId(),
                  ROOT_TARGET,
                  conversation.getId(),
                  conversation.getMessage(),
                  now);
            });
    return withHref(uriInfo, conversation);
  }

  public Conversation get(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId) {
    Conversation conversation = findPublicRoot(conversationId);
    authorizeHiddenRead(securityContext, authorizer, conversation);
    hydrate(List.of(conversation), EMBEDDED_REPLY_LIMIT);
    return withHref(uriInfo, conversation);
  }

  public boolean exists(UUID conversationId) {
    return conversationDAO.exists(conversationId.toString());
  }

  public Conversation patch(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      JsonPatch patch) {
    Conversation original = findPublicRoot(conversationId);
    authorizeHiddenRead(securityContext, authorizer, original);
    validatePatchPaths(patch, Set.of("/message", "/resolved"));
    authorizeMutation(
        securityContext,
        authorizer,
        MetadataOperation.EDIT_ALL,
        new ConversationResourceContext(original));
    long now = System.currentTimeMillis();
    String userName = currentUserName(securityContext);
    Conversation updated =
        inWriteTransaction(
            handle -> {
              CollectionDAO.ConversationDAO dao =
                  handle.attach(CollectionDAO.ConversationDAO.class);
              Conversation current = findRootForUpdate(dao, conversationId);
              if (current.getSource() != ConversationSource.User) {
                throw conversationNotFound(conversationId);
              }
              Conversation patched = JsonUtils.applyPatch(current, patch, Conversation.class);
              validateMessage(patched.getMessage());
              restoreRootImmutableFields(current, patched);
              patched.withUpdatedAt(now).withUpdatedBy(userName);
              validateSourceInvariants(patched);
              dao.update(patched.getId().toString(), boundedJson(patched));
              if (!Objects.equals(current.getMessage(), patched.getMessage())) {
                replaceMentions(
                    dao, patched.getId(), ROOT_TARGET, patched.getId(), patched.getMessage(), now);
              }
              return patched;
            });
    hydrate(List.of(updated), EMBEDDED_REPLY_LIMIT);
    return withHref(uriInfo, updated);
  }

  public Conversation delete(
      SecurityContext securityContext, Authorizer authorizer, UUID conversationId) {
    Conversation conversation = findPublicRoot(conversationId);
    authorizeHiddenRead(securityContext, authorizer, conversation);
    authorizeMutation(
        securityContext,
        authorizer,
        MetadataOperation.DELETE,
        new ConversationResourceContext(conversation));
    conversationDAO.delete(conversationId.toString());
    return conversation;
  }

  public ResultList<ConversationReply> listReplies(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      String before,
      String after,
      int requestedLimit) {
    Conversation conversation = findPublicRoot(conversationId);
    authorizeHiddenRead(securityContext, authorizer, conversation);
    return listRepliesInternal(conversationId, before, after, requestedLimit);
  }

  public ConversationReply addReply(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      CreatePost request) {
    validateMessage(request.getMessage());
    Conversation conversation = findPublicRoot(conversationId);
    authorizeReplyOrReaction(securityContext, authorizer, conversation);
    ConversationReply reply = newReply(securityContext, conversationId, request.getMessage());
    persistReply(conversation, reply);
    return reply;
  }

  public ConversationReply patchReply(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      UUID replyId,
      JsonPatch patch) {
    Conversation conversation = findRoot(conversationId);
    authorizeReplyContainerRead(securityContext, authorizer, conversation);
    requireWritableContainer(conversation);
    ConversationReply original = findReply(conversationId, replyId);
    validatePatchPaths(patch, Set.of("/message"));
    authorizeMutation(
        securityContext,
        authorizer,
        MetadataOperation.EDIT_ALL,
        new ConversationReplyResourceContext(conversation, original));
    long now = System.currentTimeMillis();
    String userName = currentUserName(securityContext);
    ConversationReply updated =
        inWriteTransaction(
            handle -> {
              CollectionDAO.ConversationDAO dao =
                  handle.attach(CollectionDAO.ConversationDAO.class);
              findRootForUpdate(dao, conversationId);
              CollectionDAO.ConversationReplyRow row =
                  dao.findReplyForUpdate(conversationId.toString(), replyId.toString());
              if (row == null) {
                throw replyNotFound(replyId);
              }
              ConversationReply current = toReply(row);
              ConversationReply patched =
                  JsonUtils.applyPatch(current, patch, ConversationReply.class);
              validateMessage(patched.getMessage());
              restoreReplyImmutableFields(current, patched);
              patched.withUpdatedAt(now).withUpdatedBy(userName);
              dao.updateReply(
                  conversationId.toString(), replyId.toString(), JsonUtils.pojoToJson(patched));
              dao.updateReplyCount(conversationId.toString(), 0, now);
              replaceMentions(
                  dao, conversationId, REPLY_TARGET, replyId, patched.getMessage(), now);
              return patched;
            });
    hydrateReplies(List.of(updated));
    return updated;
  }

  public ConversationReply deleteReply(
      SecurityContext securityContext, Authorizer authorizer, UUID conversationId, UUID replyId) {
    Conversation conversation = findRoot(conversationId);
    authorizeReplyContainerRead(securityContext, authorizer, conversation);
    requireWritableContainer(conversation);
    ConversationReply reply = findReply(conversationId, replyId);
    authorizeMutation(
        securityContext,
        authorizer,
        MetadataOperation.DELETE,
        new ConversationReplyResourceContext(conversation, reply));
    long now = System.currentTimeMillis();
    inWriteTransaction(
        handle -> {
          CollectionDAO.ConversationDAO dao = handle.attach(CollectionDAO.ConversationDAO.class);
          findRootForUpdate(dao, conversationId);
          if (dao.deleteReply(conversationId.toString(), replyId.toString()) == 0) {
            throw replyNotFound(replyId);
          }
          dao.deleteMentions(REPLY_TARGET, replyId.toString());
          dao.updateReplyCount(conversationId.toString(), -1, now);
          return null;
        });
    return reply;
  }

  public Conversation putRootReaction(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      ReactionType reactionType) {
    Conversation conversation = findPublicRoot(conversationId);
    authorizeReplyOrReaction(securityContext, authorizer, conversation);
    putReaction(
        conversationId, ROOT_TARGET, conversationId, currentUser(securityContext), reactionType);
    conversation = findPublicRoot(conversationId);
    hydrate(List.of(conversation), EMBEDDED_REPLY_LIMIT);
    return withHref(uriInfo, conversation);
  }

  public Conversation deleteRootReaction(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      ReactionType reactionType) {
    Conversation conversation = findPublicRoot(conversationId);
    authorizeReplyOrReaction(securityContext, authorizer, conversation);
    deleteReaction(
        conversationId, ROOT_TARGET, conversationId, currentUser(securityContext), reactionType);
    conversation = findPublicRoot(conversationId);
    hydrate(List.of(conversation), EMBEDDED_REPLY_LIMIT);
    return withHref(uriInfo, conversation);
  }

  public ConversationReply putReplyReaction(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      UUID replyId,
      ReactionType reactionType) {
    Conversation conversation = findRoot(conversationId);
    authorizeReplyOrReaction(securityContext, authorizer, conversation);
    findReply(conversationId, replyId);
    putReaction(conversationId, REPLY_TARGET, replyId, currentUser(securityContext), reactionType);
    return findReply(conversationId, replyId);
  }

  public ConversationReply deleteReplyReaction(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID conversationId,
      UUID replyId,
      ReactionType reactionType) {
    Conversation conversation = findRoot(conversationId);
    authorizeReplyOrReaction(securityContext, authorizer, conversation);
    findReply(conversationId, replyId);
    deleteReaction(
        conversationId, REPLY_TARGET, replyId, currentUser(securityContext), reactionType);
    return findReply(conversationId, replyId);
  }

  public ResultList<ConversationReply> listActivityReplies(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID activityId,
      String before,
      String after,
      int requestedLimit) {
    ActivityContext context = resolveActivityContext(activityId);
    authorizeActivityRead(securityContext, authorizer, context);
    if (conversationDAO.findById(activityId.toString()) == null) {
      return new ResultList<>(List.of(), null, null, 0);
    }
    return listRepliesInternal(activityId, before, after, requestedLimit);
  }

  public ConversationReply addActivityReply(
      SecurityContext securityContext, Authorizer authorizer, UUID activityId, CreatePost request) {
    validateMessage(request.getMessage());
    ActivityContext context = resolveActivityContext(activityId);
    authorizeActivityRead(securityContext, authorizer, context);
    requireWritableActivity(context);
    Conversation container = activityContainer(context.event(), context.target());
    authorizeConversationCreate(securityContext, authorizer, container);
    ConversationReply reply = newReply(securityContext, activityId, request.getMessage());
    inWriteTransaction(
        handle -> {
          CollectionDAO.ConversationDAO dao = handle.attach(CollectionDAO.ConversationDAO.class);
          int inserted = insertRoot(dao, container, true);
          if (inserted > 0) {
            storeDomains(dao, container);
          }
          findRootForUpdate(dao, activityId);
          insertReply(dao, reply);
          replaceMentions(
              dao,
              activityId,
              REPLY_TARGET,
              reply.getId(),
              reply.getMessage(),
              reply.getCreatedAt());
          dao.updateReplyCount(activityId.toString(), 1, reply.getCreatedAt());
          return null;
        });
    return reply;
  }

  public int deleteByEntity(String entityType, List<UUID> entityIds) {
    if (nullOrEmpty(entityIds)) {
      return 0;
    }
    return conversationDAO.deleteByEntity(
        entityType, entityIds.stream().map(UUID::toString).toList());
  }

  public int updateEntityReference(EntityReference entityReference, String oldFqn) {
    String newFqn = entityReference.getFullyQualifiedName();
    return conversationDAO.updateEntityReference(
        entityReference.getType(),
        entityReference.getId().toString(),
        oldFqn,
        newFqn,
        FullyQualifiedName.buildHash(newFqn),
        JsonUtils.pojoToJson(entityReference));
  }

  public int updateEntityFqn(String entityType, UUID entityId, String oldFqn, String newFqn) {
    return conversationDAO.updateEntityFqn(
        entityType, entityId.toString(), oldFqn, newFqn, FullyQualifiedName.buildHash(newFqn));
  }

  public int syncDomainsForEntity(
      UUID entityId, String entityType, List<EntityReference> newDomains) {
    List<EntityReference> domains = List.copyOf(emptyIfNull(newDomains));
    return Entity.getJdbi()
        .inTransaction(
            handle ->
                syncDomains(
                    handle.attach(CollectionDAO.ConversationDAO.class),
                    entityId,
                    entityType,
                    domains));
  }

  public int deleteExpiredUserConversations(long cutoffTimestamp, int limit) {
    List<String> conversationIds =
        conversationDAO.listExpiredUserConversationIds(cutoffTimestamp, limit);
    return conversationIds.isEmpty() ? 0 : conversationDAO.deleteByIds(conversationIds);
  }

  public int deleteExpiredActivityConversations(long cutoffTimestamp, int limit) {
    List<String> conversationIds =
        conversationDAO.listExpiredActivityConversationIds(cutoffTimestamp, limit);
    return conversationIds.isEmpty() ? 0 : conversationDAO.deleteByIds(conversationIds);
  }

  public Conversation getEventPayload(UUID conversationId) {
    Conversation conversation = findRoot(conversationId);
    hydrate(List.of(conversation), EMBEDDED_REPLY_LIMIT);
    return conversation;
  }

  public ChangeEvent buildChangeEvent(
      String updateBy, EventType eventType, Conversation conversation) {
    Conversation payload = boundedEventPayload(conversation);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityId(payload.getId())
        .withEntityType(Entity.CONVERSATION)
        .withEntityFullyQualifiedName(payload.getAbout())
        .withDomains(
            payload.getDomains() == null
                ? null
                : payload.getDomains().stream().map(EntityReference::getId).toList())
        .withUserName(updateBy)
        .withImpersonatedBy(payload.getImpersonatedBy())
        .withTimestamp(payload.getUpdatedAt())
        .withEntity(payload);
  }

  public ChangeEvent buildChangeEvent(
      String updateBy, EventType eventType, ConversationReply reply) {
    Conversation conversation = getEventPayload(reply.getConversationId());
    conversation.withReplies(List.of(reply));
    return buildChangeEvent(updateBy, eventType, conversation);
  }

  void validateSourceInvariants(Conversation conversation) {
    if (conversation.getSource() == ConversationSource.User) {
      validateMessage(conversation.getMessage());
      if (conversation.getCreatedBy() == null || conversation.getActivityEventId() != null) {
        throw BadRequestException.of(
            "User conversations require a creator and cannot reference an activity");
      }
      return;
    }
    if (conversation.getSource() != ConversationSource.Activity
        || conversation.getActivityEventId() == null
        || !conversation.getId().equals(conversation.getActivityEventId())
        || conversation.getMessage() != null
        || conversation.getCreatedBy() != null
        || Boolean.TRUE.equals(conversation.getResolved())) {
      throw BadRequestException.of(
          "Activity conversations must be immutable containers keyed by ActivityEvent ID");
    }
  }

  private ConversationFilter buildFilter(
      SecurityContext securityContext,
      String entityLink,
      UUID userId,
      ConversationFilterType filterType,
      Boolean resolved,
      Long startTs,
      Long endTs,
      String before,
      String after) {
    SubjectContext subject = getSubjectContext(securityContext);
    boolean domainOnly = subject != null && !subject.isAdmin() && subject.hasDomainOnlyAccessRole();
    List<String> domainFqnHashes =
        subject == null || nullOrEmpty(subject.getUserDomains())
            ? List.of()
            : subject.getUserDomains().stream()
                .map(EntityReference::getFullyQualifiedName)
                .map(FullyQualifiedName::buildHash)
                .toList();
    return ConversationFilter.builder()
        .entityLink(entityLink)
        .userId(userId)
        .filterType(filterType)
        .resolved(resolved)
        .startTs(startTs)
        .endTs(endTs)
        .before(before)
        .after(after)
        .applyDomainFilter(domainOnly)
        .domainFqnHashes(domainFqnHashes)
        .teamIds(getTeamIds(userId))
        .build();
  }

  private List<UUID> getTeamIds(UUID userId) {
    if (userId == null) {
      return List.of();
    }
    User user = Entity.getEntity(Entity.USER, userId, "teams", ALL);
    return nullOrEmpty(user.getTeams())
        ? List.of()
        : user.getTeams().stream().map(EntityReference::getId).toList();
  }

  private ResultList<Conversation> rootResult(
      List<Conversation> conversations, String before, String after, boolean hasMore, int total) {
    String beforeCursor = null;
    String afterCursor = null;
    if (!conversations.isEmpty()) {
      if (before != null) {
        beforeCursor = hasMore ? rootCursor(conversations.getFirst()) : null;
        afterCursor = rootCursor(conversations.getLast());
      } else {
        beforeCursor = after == null ? null : rootCursor(conversations.getFirst());
        afterCursor = hasMore ? rootCursor(conversations.getLast()) : null;
      }
    }
    return new ResultList<>(conversations, beforeCursor, afterCursor, total);
  }

  private ResultList<ConversationReply> listRepliesInternal(
      UUID conversationId, String before, String after, int requestedLimit) {
    RestUtil.validateCursors(before, after);
    int limit = Math.min(requestedLimit, MAX_REPLY_PAGE_SIZE);
    ReplySql page = replySql(before, after);
    List<CollectionDAO.ConversationReplyRow> rows =
        conversationDAO.listReplies(
            conversationId.toString(), page.condition(), page.order(), page.params(), limit + 1);
    boolean hasMore = rows.size() > limit;
    if (hasMore) {
      rows = new ArrayList<>(rows.subList(0, limit));
    }
    List<ConversationReply> replies = rows.stream().map(this::toReply).toList();
    if (before != null) {
      Collections.reverse(replies);
    }
    hydrateReplies(replies);
    int total = conversationDAO.countReplies(conversationId.toString());
    return replyResult(replies, before, after, hasMore, total);
  }

  private ReplySql replySql(String before, String after) {
    if (before == null && after == null) {
      return new ReplySql("", "createdAt ASC, id ASC", Map.of());
    }
    ConversationFilter.Cursor cursor =
        ConversationFilter.Cursor.parse(before == null ? after : before);
    Map<String, Object> params =
        Map.of("cursorCreatedAt", cursor.updatedAt(), "cursorId", cursor.id());
    if (before != null) {
      return new ReplySql(
          "AND (createdAt < :cursorCreatedAt OR (createdAt = :cursorCreatedAt AND id < :cursorId))",
          "createdAt DESC, id DESC",
          params);
    }
    return new ReplySql(
        "AND (createdAt > :cursorCreatedAt OR (createdAt = :cursorCreatedAt AND id > :cursorId))",
        "createdAt ASC, id ASC",
        params);
  }

  private ResultList<ConversationReply> replyResult(
      List<ConversationReply> replies, String before, String after, boolean hasMore, int total) {
    String beforeCursor = null;
    String afterCursor = null;
    if (!replies.isEmpty()) {
      if (before != null) {
        beforeCursor = hasMore ? replyCursor(replies.getFirst()) : null;
        afterCursor = replyCursor(replies.getLast());
      } else {
        beforeCursor = after == null ? null : replyCursor(replies.getFirst());
        afterCursor = hasMore ? replyCursor(replies.getLast()) : null;
      }
    }
    return new ResultList<>(replies, beforeCursor, afterCursor, total);
  }

  private void persistReply(Conversation conversation, ConversationReply reply) {
    inWriteTransaction(
        handle -> {
          CollectionDAO.ConversationDAO dao = handle.attach(CollectionDAO.ConversationDAO.class);
          findRootForUpdate(dao, conversation.getId());
          insertReply(dao, reply);
          replaceMentions(
              dao,
              conversation.getId(),
              REPLY_TARGET,
              reply.getId(),
              reply.getMessage(),
              reply.getCreatedAt());
          dao.updateReplyCount(conversation.getId().toString(), 1, reply.getCreatedAt());
          return null;
        });
  }

  private void insertReply(CollectionDAO.ConversationDAO dao, ConversationReply reply) {
    dao.insertReply(JsonUtils.pojoToJson(reply));
  }

  private ConversationReply newReply(
      SecurityContext securityContext, UUID conversationId, String message) {
    EntityReference author = currentUser(securityContext);
    long now = System.currentTimeMillis();
    return new ConversationReply()
        .withId(UUID.randomUUID())
        .withConversationId(conversationId)
        .withMessage(message)
        .withAuthor(author)
        .withCreatedAt(now)
        .withUpdatedAt(now)
        .withUpdatedBy(author.getName())
        .withImpersonatedBy(ImpersonationContext.getImpersonatedBy());
  }

  private Conversation activityContainer(ActivityEvent event, Target target) {
    return new Conversation()
        .withId(event.getId())
        .withSource(ConversationSource.Activity)
        .withAbout(event.getAbout())
        .withEntityRef(target.reference())
        .withActivityEventId(event.getId())
        .withActivityTimestamp(event.getTimestamp())
        .withDomains(target.domains())
        .withCreatedAt(event.getTimestamp())
        .withUpdatedAt(event.getTimestamp())
        .withResolved(false)
        .withReplyCount(0)
        .withReplies(List.of());
  }

  private int insertRoot(
      CollectionDAO.ConversationDAO dao, Conversation conversation, boolean ifAbsent) {
    validateSourceInvariants(conversation);
    MessageParser.EntityLink about = MessageParser.EntityLink.parse(conversation.getAbout());
    String entityFqnHash = FullyQualifiedName.buildHash(about.getEntityFQN());
    String json = boundedJson(conversation);
    return ifAbsent
        ? dao.insertIfAbsent(entityFqnHash, entityFqnHash, json)
        : dao.insert(entityFqnHash, entityFqnHash, json);
  }

  private String boundedJson(Conversation conversation) {
    Conversation bounded = JsonUtils.deepCopy(conversation, Conversation.class);
    bounded.withReplies(List.of()).withHref(null);
    return JsonUtils.pojoToJson(bounded);
  }

  private Conversation boundedEventPayload(Conversation conversation) {
    Conversation payload = JsonUtils.deepCopy(conversation, Conversation.class);
    List<ConversationReply> replies = emptyIfNull(payload.getReplies());
    if (replies.size() > EMBEDDED_REPLY_LIMIT) {
      payload.withReplies(
          new ArrayList<>(replies.subList(replies.size() - EMBEDDED_REPLY_LIMIT, replies.size())));
    }
    return payload;
  }

  private void storeDomains(CollectionDAO.ConversationDAO dao, Conversation conversation) {
    for (EntityReference domain : emptyIfNull(conversation.getDomains())) {
      dao.insertDomain(conversation.getId().toString(), domain.getId().toString());
    }
  }

  private int syncDomains(
      CollectionDAO.ConversationDAO dao,
      UUID entityId,
      String entityType,
      List<EntityReference> domains) {
    List<String> conversationIds = dao.listIdsByEntity(entityType, entityId.toString());
    int updated = 0;
    if (!conversationIds.isEmpty()) {
      updated =
          dao.updateDomainsByEntity(entityType, entityId.toString(), JsonUtils.pojoToJson(domains));
      replaceDomainProjection(dao, conversationIds, domains);
    }
    return updated;
  }

  private void replaceDomainProjection(
      CollectionDAO.ConversationDAO dao,
      List<String> conversationIds,
      List<EntityReference> domains) {
    dao.deleteDomains(conversationIds);
    for (String conversationId : conversationIds) {
      for (EntityReference domain : domains) {
        dao.insertDomain(conversationId, domain.getId().toString());
      }
    }
  }

  private void replaceMentions(
      CollectionDAO.ConversationDAO dao,
      UUID conversationId,
      String targetType,
      UUID targetId,
      String message,
      long createdAt) {
    dao.deleteMentions(targetType, targetId.toString());
    if (nullOrEmpty(message)) {
      return;
    }
    MessageParser.getEntityLinks(message).stream()
        .distinct()
        .map(this::resolveMention)
        .filter(Objects::nonNull)
        .forEach(
            mention ->
                dao.insertMention(
                    conversationId.toString(),
                    targetType,
                    targetId.toString(),
                    mention.getType(),
                    mention.getId().toString(),
                    createdAt));
  }

  private EntityReference resolveMention(MessageParser.EntityLink mention) {
    try {
      return Entity.getEntityReferenceByName(mention.getEntityType(), mention.getEntityFQN(), ALL);
    } catch (EntityNotFoundException exception) {
      LOG.debug("Skipping unresolved conversation mention {}", mention.getLinkString());
      return null;
    }
  }

  void hydrate(List<Conversation> conversations, int recentReplyLimit) {
    if (nullOrEmpty(conversations)) {
      return;
    }
    List<String> conversationIds =
        conversations.stream().map(value -> value.getId().toString()).toList();
    List<CollectionDAO.ConversationReplyRow> replyRows =
        recentReplyLimit == 0
            ? List.of()
            : conversationDAO.listRecentReplies(conversationIds, recentReplyLimit);
    List<CollectionDAO.ConversationDomainRow> domainRows =
        conversationDAO.listDomains(conversationIds);
    Map<UUID, EntityReference> users = loadUserReferences(conversations, replyRows);
    Map<UUID, EntityReference> domains = loadDomainReferences(domainRows);
    Map<UUID, Conversation> byId = new HashMap<>();
    conversations.forEach(
        conversation -> {
          conversation.withReplies(new ArrayList<>());
          hydrateReactionUsers(conversation.getReactions(), users);
          byId.put(conversation.getId(), conversation);
        });
    attachReplies(replyRows, byId, users);
    attachDomains(domainRows, byId, domains);
  }

  private void hydrateReplies(List<ConversationReply> replies) {
    if (nullOrEmpty(replies)) {
      return;
    }
    Set<UUID> userIds = new LinkedHashSet<>();
    replies.forEach(
        reply -> {
          userIds.add(reply.getAuthor().getId());
          addReactionUserIds(userIds, reply.getReactions());
        });
    Map<UUID, EntityReference> users = loadReferences(Entity.USER, userIds);
    replies.forEach(
        reply -> {
          reply.withAuthor(referenceOrDeleted(users, reply.getAuthor().getId()));
          hydrateReactionUsers(reply.getReactions(), users);
        });
  }

  private void attachReplies(
      List<CollectionDAO.ConversationReplyRow> rows,
      Map<UUID, Conversation> conversations,
      Map<UUID, EntityReference> users) {
    for (CollectionDAO.ConversationReplyRow row : rows) {
      ConversationReply reply = toReply(row);
      reply.withAuthor(referenceOrDeleted(users, reply.getAuthor().getId()));
      hydrateReactionUsers(reply.getReactions(), users);
      Conversation conversation = conversations.get(reply.getConversationId());
      if (conversation != null) {
        conversation.getReplies().add(reply);
      }
    }
  }

  private void attachDomains(
      List<CollectionDAO.ConversationDomainRow> rows,
      Map<UUID, Conversation> conversations,
      Map<UUID, EntityReference> domains) {
    conversations.values().forEach(conversation -> conversation.withDomains(new ArrayList<>()));
    for (CollectionDAO.ConversationDomainRow row : rows) {
      Conversation conversation = conversations.get(UUID.fromString(row.conversationId()));
      EntityReference domain = domains.get(UUID.fromString(row.domainId()));
      if (conversation != null && domain != null) {
        conversation.getDomains().add(domain);
      }
    }
  }

  private Map<UUID, EntityReference> loadUserReferences(
      List<Conversation> conversations, List<CollectionDAO.ConversationReplyRow> replies) {
    Set<UUID> ids = new LinkedHashSet<>();
    conversations.forEach(conversation -> addReactionUserIds(ids, conversation.getReactions()));
    replies.forEach(
        row -> {
          ids.add(UUID.fromString(row.authorId()));
          addReactionUserIds(ids, row.reactions());
        });
    return loadReferences(Entity.USER, ids);
  }

  private void addReactionUserIds(Set<UUID> userIds, List<Reaction> reactions) {
    emptyIfNull(reactions).stream()
        .map(Reaction::getUser)
        .filter(Objects::nonNull)
        .map(EntityReference::getId)
        .filter(Objects::nonNull)
        .forEach(userIds::add);
  }

  private void hydrateReactionUsers(List<Reaction> reactions, Map<UUID, EntityReference> users) {
    for (Reaction reaction : emptyIfNull(reactions)) {
      if (reaction.getUser() != null && reaction.getUser().getId() != null) {
        reaction.withUser(referenceOrDeleted(users, reaction.getUser().getId()));
      }
    }
  }

  private Map<UUID, EntityReference> loadDomainReferences(
      List<CollectionDAO.ConversationDomainRow> domains) {
    Set<UUID> ids = new LinkedHashSet<>();
    domains.forEach(row -> ids.add(UUID.fromString(row.domainId())));
    return loadReferences(Entity.DOMAIN, ids);
  }

  private Map<UUID, EntityReference> loadReferences(String type, Set<UUID> ids) {
    if (ids.isEmpty()) {
      return Map.of();
    }
    try {
      List<EntityReference> references =
          Entity.getEntityReferencesByIds(type, new ArrayList<>(ids), ALL);
      Map<UUID, EntityReference> byId = new LinkedHashMap<>();
      references.forEach(reference -> byId.put(reference.getId(), reference));
      return byId;
    } catch (EntityNotFoundException exception) {
      LOG.debug("Some {} references used by conversations no longer exist", type);
      return Map.of();
    }
  }

  private ConversationReply toReply(CollectionDAO.ConversationReplyRow row) {
    UUID authorId = UUID.fromString(row.authorId());
    return new ConversationReply()
        .withId(UUID.fromString(row.id()))
        .withConversationId(UUID.fromString(row.conversationId()))
        .withMessage(row.message())
        .withAuthor(new EntityReference().withId(authorId).withType(Entity.USER))
        .withCreatedAt(row.createdAt())
        .withUpdatedAt(row.updatedAt())
        .withUpdatedBy(row.updatedBy())
        .withImpersonatedBy(row.impersonatedBy())
        .withReactions(new ArrayList<>(emptyIfNull(row.reactions())));
  }

  private EntityReference referenceOrDeleted(Map<UUID, EntityReference> users, UUID userId) {
    return users.getOrDefault(
        userId,
        new EntityReference()
            .withId(userId)
            .withType(Entity.USER)
            .withName(DELETED_USER_NAME)
            .withDisplayName(DELETED_USER_DISPLAY));
  }

  private Conversation findRoot(UUID conversationId) {
    String json = conversationDAO.findById(conversationId.toString());
    if (json == null) {
      throw conversationNotFound(conversationId);
    }
    return JsonUtils.readValue(json, Conversation.class);
  }

  private Conversation findRootForUpdate(CollectionDAO.ConversationDAO dao, UUID conversationId) {
    String json = dao.findByIdForUpdate(conversationId.toString());
    if (json == null) {
      throw conversationNotFound(conversationId);
    }
    return JsonUtils.readValue(json, Conversation.class);
  }

  private <T> T inWriteTransaction(Function<Handle, T> transaction) {
    return DeadlockRetry.execute(() -> Entity.getJdbi().inTransaction(transaction::apply));
  }

  private Conversation findPublicRoot(UUID conversationId) {
    Conversation conversation = findRoot(conversationId);
    if (conversation.getSource() != ConversationSource.User) {
      throw conversationNotFound(conversationId);
    }
    return conversation;
  }

  private ConversationReply findReply(UUID conversationId, UUID replyId) {
    CollectionDAO.ConversationReplyRow row =
        conversationDAO.findReply(conversationId.toString(), replyId.toString());
    if (row == null) {
      throw replyNotFound(replyId);
    }
    ConversationReply reply = toReply(row);
    hydrateReplies(List.of(reply));
    return reply;
  }

  private void putReaction(
      UUID conversationId,
      String targetType,
      UUID targetId,
      EntityReference user,
      ReactionType reactionType) {
    mutateReaction(conversationId, targetType, targetId, user, reactionType, true);
  }

  private void deleteReaction(
      UUID conversationId,
      String targetType,
      UUID targetId,
      EntityReference user,
      ReactionType reactionType) {
    mutateReaction(conversationId, targetType, targetId, user, reactionType, false);
  }

  private void mutateReaction(
      UUID conversationId,
      String targetType,
      UUID targetId,
      EntityReference user,
      ReactionType reactionType,
      boolean add) {
    long now = System.currentTimeMillis();
    inWriteTransaction(
        handle -> {
          CollectionDAO.ConversationDAO dao = handle.attach(CollectionDAO.ConversationDAO.class);
          Conversation root = findRootForUpdate(dao, conversationId);
          if (ROOT_TARGET.equals(targetType)) {
            root.withReactions(updatedReactions(root.getReactions(), user, reactionType, add))
                .withUpdatedAt(now);
            dao.update(conversationId.toString(), boundedJson(root));
            return null;
          }
          CollectionDAO.ConversationReplyRow row =
              dao.findReplyForUpdate(conversationId.toString(), targetId.toString());
          if (row == null) {
            throw replyNotFound(targetId);
          }
          ConversationReply reply = toReply(row);
          reply.withReactions(updatedReactions(reply.getReactions(), user, reactionType, add));
          dao.updateReply(
              conversationId.toString(), targetId.toString(), JsonUtils.pojoToJson(reply));
          dao.updateReplyCount(conversationId.toString(), 0, now);
          return null;
        });
  }

  List<Reaction> updatedReactions(
      List<Reaction> existing, EntityReference user, ReactionType reactionType, boolean add) {
    List<Reaction> reactions = new ArrayList<>(emptyIfNull(existing));
    boolean present = reactions.stream().anyMatch(value -> isReaction(value, user, reactionType));
    if (add && !present) {
      reactions.add(new Reaction().withReactionType(reactionType).withUser(user));
    } else if (!add) {
      reactions.removeIf(value -> isReaction(value, user, reactionType));
    }
    return reactions;
  }

  private boolean isReaction(Reaction reaction, EntityReference user, ReactionType reactionType) {
    return reaction != null
        && reaction.getUser() != null
        && Objects.equals(reaction.getUser().getId(), user.getId())
        && reaction.getReactionType() == reactionType;
  }

  private Target resolveTarget(String about, Include include) {
    MessageParser.EntityLink link = MessageParser.EntityLink.parse(about);
    EntityReference reference = EntityUtil.validateEntityLink(link);
    EntityInterface entity =
        Entity.getEntity(
            reference.getType(), reference.getId(), Entity.FIELD_DOMAINS, include, false);
    return new Target(entity.getEntityReference(), emptyIfNull(entity.getDomains()));
  }

  private ActivityContext resolveActivityContext(UUID activityId) {
    ActivityEvent event = activityStreamRepository.getById(activityId);
    EntityReference eventTarget = event.getEntity();
    try {
      EntityInterface target =
          Entity.getEntity(
              eventTarget.getType(), eventTarget.getId(), Entity.FIELD_DOMAINS, ALL, false);
      return new ActivityContext(
          event, new Target(target.getEntityReference(), emptyIfNull(target.getDomains())), true);
    } catch (EntityNotFoundException exception) {
      return new ActivityContext(
          event, new Target(eventTarget, emptyIfNull(event.getDomains())), false);
    }
  }

  private void requireWritableActivity(ActivityContext context) {
    if (!context.liveTarget()) {
      throw BadRequestException.of(
          "Replies are read-only because the activity target no longer exists");
    }
  }

  private void requireWritableContainer(Conversation conversation) {
    if (conversation.getSource() == ConversationSource.Activity) {
      requireWritableActivity(resolveActivityContext(conversation.getActivityEventId()));
    }
  }

  private void authorizeRootCreate(
      SecurityContext securityContext,
      Authorizer authorizer,
      Conversation conversation,
      EntityReference target) {
    authorizer.authorizeRequests(
        securityContext,
        List.of(
            request(
                Entity.CONVERSATION,
                MetadataOperation.CREATE,
                new ConversationResourceContext(conversation)),
            request(
                target.getType(),
                MetadataOperation.VIEW_BASIC,
                new ResourceContext<>(target.getType(), target.getId(), null))),
        AuthorizationLogic.ALL);
  }

  private void authorizeList(SecurityContext securityContext, Authorizer authorizer) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.CONVERSATION, MetadataOperation.VIEW_BASIC),
        new ConversationResourceContext(null));
  }

  private void authorizeHiddenRead(
      SecurityContext securityContext, Authorizer authorizer, Conversation conversation) {
    SubjectContext subject = getSubjectContext(securityContext);
    if (!subject.isAdmin()
        && subject.hasDomainOnlyAccessRole()
        && !subject.hasDomains(conversation.getDomains())) {
      throw conversationNotFound(conversation.getId());
    }
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.CONVERSATION, MetadataOperation.VIEW_BASIC),
          new ConversationResourceContext(conversation));
    } catch (AuthorizationException exception) {
      throw conversationNotFound(conversation.getId());
    }
  }

  private void authorizeReplyOrReaction(
      SecurityContext securityContext, Authorizer authorizer, Conversation conversation) {
    if (conversation.getSource() == ConversationSource.Activity) {
      ActivityContext activity = resolveActivityContext(conversation.getActivityEventId());
      authorizeActivityRead(securityContext, authorizer, activity);
      requireWritableActivity(activity);
    } else {
      authorizeHiddenRead(securityContext, authorizer, conversation);
    }
    authorizeConversationCreate(securityContext, authorizer, conversation);
  }

  private void authorizeReplyContainerRead(
      SecurityContext securityContext, Authorizer authorizer, Conversation conversation) {
    if (conversation.getSource() == ConversationSource.Activity) {
      ActivityContext context = resolveActivityContext(conversation.getActivityEventId());
      authorizeActivityRead(securityContext, authorizer, context);
      return;
    }
    authorizeHiddenRead(securityContext, authorizer, conversation);
  }

  private void authorizeActivityRead(
      SecurityContext securityContext, Authorizer authorizer, ActivityContext context) {
    Conversation existing =
        conversationDAO.findById(context.event().getId().toString()) == null
            ? activityContainer(context.event(), context.target())
            : findRoot(context.event().getId());
    try {
      List<AuthRequest> requests = new ArrayList<>();
      requests.add(
          request(
              Entity.CONVERSATION,
              MetadataOperation.VIEW_BASIC,
              new ConversationResourceContext(existing)));
      if (context.liveTarget()) {
        requests.add(targetViewRequest(context.target().reference()));
      }
      authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ALL);
    } catch (AuthorizationException exception) {
      throw new EntityNotFoundException("ActivityEvent not found: " + context.event().getId());
    }
  }

  private void authorizeConversationCreate(
      SecurityContext securityContext, Authorizer authorizer, Conversation conversation) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.CONVERSATION, MetadataOperation.CREATE),
        new ConversationResourceContext(conversation));
  }

  private AuthRequest targetViewRequest(EntityReference target) {
    return request(
        target.getType(),
        MetadataOperation.VIEW_BASIC,
        new ResourceContext<>(target.getType(), target.getId(), null, ALL));
  }

  private AuthRequest request(
      String resource, MetadataOperation operation, ResourceContextInterface resourceContext) {
    return new AuthRequest(new OperationContext(resource, operation), resourceContext);
  }

  private void authorizeMutation(
      SecurityContext securityContext,
      Authorizer authorizer,
      MetadataOperation operation,
      ResourceContextInterface context) {
    authorizer.authorize(
        securityContext, new OperationContext(Entity.CONVERSATION, operation), context);
  }

  private EntityReference currentUser(SecurityContext securityContext) {
    return Entity.getEntityReferenceByName(
        Entity.USER, currentUserName(securityContext), NON_DELETED);
  }

  private String currentUserName(SecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }

  private void validateTimeRange(Long startTs, Long endTs) {
    if (startTs != null && endTs != null && startTs > endTs) {
      throw BadRequestException.of("startTs must be less than or equal to endTs");
    }
  }

  private void validateMessage(String message) {
    if (message == null || message.isBlank()) {
      throw BadRequestException.of("message must not be blank");
    }
    if (message.length() > 10_000) {
      throw BadRequestException.of("message must be at most 10000 characters");
    }
  }

  private void validatePatchPaths(JsonPatch patch, Set<String> allowedPaths) {
    if (patch == null || patch.toJsonArray().isEmpty()) {
      throw BadRequestException.of("Patch must contain at least one operation");
    }
    for (JsonValue value : patch.toJsonArray()) {
      JsonObject operation = value.asJsonObject();
      String path = operation.getString("path", "");
      if (!allowedPaths.contains(path)) {
        throw BadRequestException.of("Patch path is not allowed: " + path);
      }
    }
  }

  private void restoreRootImmutableFields(Conversation original, Conversation updated) {
    updated
        .withId(original.getId())
        .withSource(original.getSource())
        .withAbout(original.getAbout())
        .withEntityRef(original.getEntityRef())
        .withActivityEventId(original.getActivityEventId())
        .withActivityTimestamp(original.getActivityTimestamp())
        .withDomains(original.getDomains())
        .withCreatedBy(original.getCreatedBy())
        .withCreatedAt(original.getCreatedAt())
        .withReplyCount(original.getReplyCount())
        .withReplies(List.of())
        .withReactions(original.getReactions())
        .withImpersonatedBy(original.getImpersonatedBy());
  }

  private void restoreReplyImmutableFields(ConversationReply original, ConversationReply updated) {
    updated
        .withId(original.getId())
        .withConversationId(original.getConversationId())
        .withAuthor(original.getAuthor())
        .withCreatedAt(original.getCreatedAt())
        .withReactions(original.getReactions())
        .withImpersonatedBy(original.getImpersonatedBy());
  }

  private Conversation withHref(UriInfo uriInfo, Conversation conversation) {
    if (uriInfo != null) {
      conversation.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, conversation.getId()));
    }
    return conversation;
  }

  private String rootCursor(Conversation conversation) {
    return conversation.getUpdatedAt() + "|" + conversation.getId();
  }

  private String replyCursor(ConversationReply reply) {
    return reply.getCreatedAt() + "|" + reply.getId();
  }

  private EntityNotFoundException conversationNotFound(UUID id) {
    return new EntityNotFoundException("Conversation not found: " + id);
  }

  private EntityNotFoundException replyNotFound(UUID id) {
    return new EntityNotFoundException("ConversationReply not found: " + id);
  }

  private <T> List<T> emptyIfNull(List<T> values) {
    return values == null ? List.of() : values;
  }

  private record Target(EntityReference reference, List<EntityReference> domains) {}

  private record ActivityContext(ActivityEvent event, Target target, boolean liveTarget) {}

  private record ReplySql(String condition, String order, Map<String, Object> params) {}
}
