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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ConversationSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;

/** Idempotently promotes legacy Conversation threads into Conversation V2 storage. */
@Slf4j
public final class ConversationMigration {
  static final List<String> LEGACY_THREAD_TABLES =
      List.of("thread_entity", "thread_entity_legacy", "thread_entity_archived");
  static final int BATCH_SIZE = 500;
  private static final int CACHE_MAX_SIZE = 1_000;
  private static final String ROOT_TARGET = "Root";
  private static final String REPLY_TARGET = "Reply";

  private final Handle handle;
  private final ConnectionType connectionType;
  private final Map<String, EntityReference> users = boundedCache();
  private final Map<String, EntityReference> entityReferences = boundedCache();

  private ConversationMigration(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  public static MigrationSummary migrate(Handle handle, ConnectionType connectionType) {
    return new ConversationMigration(handle, connectionType).run();
  }

  static String findLegacyThreadTable(Handle handle) {
    String result = null;
    for (String table : LEGACY_THREAD_TABLES) {
      if (tableExists(handle, table)) {
        result = table;
        break;
      }
    }
    return result;
  }

  private MigrationSummary run() {
    String table = findLegacyThreadTable(handle);
    MigrationSummary summary = MigrationSummary.empty();
    if (table == null) {
      LOG.info("No legacy thread table found, skipping Conversation V2 migration");
    } else {
      MigrationCounts counts = new MigrationCounts(table);
      counts.chatbotsSkipped = countChatbotThreads(table);
      counts.ownedByDedicatedMigration = countThreadsOwnedByOtherMigrations(table);
      migrateConversations(table, counts);
      summary = counts.toSummary();
      logSummary(summary, table);
    }
    return summary;
  }

  private void logSummary(MigrationSummary summary, String table) {
    LOG.info("Conversation V2 migration complete: {}", summary);
    if (summary.chatbotsSkipped() > 0) {
      LOG.warn(
          "Skipped {} Chatbot threads; they remain recoverable only from {}",
          summary.chatbotsSkipped(),
          table);
    }
  }

  private void migrateConversations(String table, MigrationCounts counts) {
    String afterId = "";
    boolean hasMore = true;
    while (hasMore) {
      List<Map<String, Object>> batch = listConversationBatch(table, afterId);
      for (Map<String, Object> row : batch) {
        migrateRow(row, counts);
      }
      hasMore = batch.size() == BATCH_SIZE;
      if (hasMore) {
        afterId = batch.getLast().get("id").toString();
      }
    }
  }

  /**
   * Keyset pagination on the primary key: each batch is a single index seek followed by a short
   * sequential read, so the migration never holds more than {@link #BATCH_SIZE} legacy threads on
   * the heap and never pays the row-skipping cost that OFFSET charges on later pages. Threads owned
   * by the task and announcement migrations are excluded through the indexed {@code type} column so
   * their json is never transferred or parsed.
   */
  private List<Map<String, Object>> listConversationBatch(String table, String afterId) {
    return handle
        .createQuery(
            "SELECT id, json FROM "
                + table
                + " WHERE (type = :type OR type IS NULL) AND id > :afterId"
                + " ORDER BY id LIMIT :limit")
        .bind("type", ThreadType.Conversation.value())
        .bind("afterId", afterId)
        .bind("limit", BATCH_SIZE)
        .mapToMap()
        .list();
  }

  private int countChatbotThreads(String table) {
    return handle
        .createQuery("SELECT COUNT(*) FROM " + table + " WHERE type = :type")
        .bind("type", ThreadType.Chatbot.value())
        .mapTo(Integer.class)
        .findOne()
        .orElse(0);
  }

  private int countThreadsOwnedByOtherMigrations(String table) {
    return handle
        .createQuery(
            "SELECT COUNT(*) FROM "
                + table
                + " WHERE type IS NOT NULL AND type NOT IN (:conversationType, :chatbotType)")
        .bind("conversationType", ThreadType.Conversation.value())
        .bind("chatbotType", ThreadType.Chatbot.value())
        .mapTo(Integer.class)
        .findOne()
        .orElse(0);
  }

  private void migrateRow(Map<String, Object> row, MigrationCounts counts) {
    try {
      Thread thread = JsonUtils.readValue(row.get("json").toString(), Thread.class);
      migrateConversation(thread, counts);
    } catch (RuntimeException exception) {
      counts.errors++;
      LOG.warn("Could not migrate legacy conversation row: {}", exception.getMessage());
    }
  }

  private void migrateConversation(Thread thread, MigrationCounts counts) {
    List<LegacyReply> replies = mapReplies(thread);
    if (thread.getGeneratedBy() == Thread.GeneratedBy.SYSTEM) {
      migrateActivityConversation(thread, replies, counts);
    } else {
      migrateUserConversation(thread, replies, counts);
    }
  }

  private void migrateUserConversation(
      Thread thread, List<LegacyReply> replies, MigrationCounts counts) {
    EntityReference target = resolveThreadTarget(thread);
    if (!isMigratable(thread, target)) {
      counts.errors++;
      return;
    }
    long createdAt = timestamp(thread.getThreadTs(), thread.getUpdatedAt());
    long updatedAt = latestTimestamp(createdAt, thread.getUpdatedAt(), replies);
    EntityReference creator = resolveUser(thread.getCreatedBy(), null);
    Conversation conversation =
        new Conversation()
            .withId(thread.getId())
            .withSource(ConversationSource.User)
            .withAbout(thread.getAbout())
            .withEntityRef(target)
            .withDomains(domainReferences(thread.getDomains()))
            .withMessage(thread.getMessage())
            .withCreatedBy(creator)
            .withCreatedAt(createdAt)
            .withUpdatedAt(updatedAt)
            .withUpdatedBy(valueOrDefault(thread.getUpdatedBy(), creator.getName()))
            .withResolved(Boolean.TRUE.equals(thread.getResolved()))
            .withReplyCount(replies.size())
            .withReplies(List.of())
            .withReactions(normalizeReactions(thread.getReactions()))
            .withImpersonatedBy(thread.getImpersonatedBy());
    persistConversation(conversation, replies);
    counts.userConversations++;
    counts.replies += replies.size();
  }

  private void migrateActivityConversation(
      Thread thread, List<LegacyReply> replies, MigrationCounts counts) {
    if (nullOrEmpty(replies)) {
      counts.activitiesWithoutReplies++;
      return;
    }
    ActivityEvent activity = findActivity(thread.getId());
    if (activity == null || activity.getEntity() == null) {
      counts.errors++;
      LOG.warn("No ActivityEvent found for legacy system thread {}", thread.getId());
      return;
    }
    long timestamp = activity.getTimestamp();
    Conversation conversation =
        new Conversation()
            .withId(activity.getId())
            .withSource(ConversationSource.Activity)
            .withAbout(activity.getAbout())
            .withEntityRef(activity.getEntity())
            .withActivityEventId(activity.getId())
            .withActivityTimestamp(timestamp)
            .withDomains(activity.getDomains())
            .withCreatedAt(timestamp)
            .withUpdatedAt(latestTimestamp(timestamp, thread.getUpdatedAt(), replies))
            .withResolved(false)
            .withReplyCount(replies.size())
            .withReplies(List.of())
            .withReactions(List.of());
    persistConversation(conversation, replies);
    counts.activityConversations++;
    counts.replies += replies.size();
  }

  private List<LegacyReply> mapReplies(Thread thread) {
    List<LegacyReply> replies = new ArrayList<>();
    for (Post post : listOrEmpty(thread.getPosts())) {
      if (post.getId() != null && !nullOrEmpty(post.getMessage())) {
        long timestamp = timestamp(post.getPostTs(), thread.getThreadTs());
        EntityReference author = resolveUser(post.getFrom(), null);
        ConversationReply reply =
            new ConversationReply()
                .withId(post.getId())
                .withConversationId(thread.getId())
                .withMessage(post.getMessage())
                .withAuthor(author)
                .withCreatedAt(timestamp)
                .withUpdatedAt(timestamp)
                .withUpdatedBy(author.getName())
                .withReactions(normalizeReactions(post.getReactions()));
        replies.add(new LegacyReply(reply));
      }
    }
    return replies;
  }

  private void persistConversation(Conversation conversation, List<LegacyReply> replies) {
    boolean rootCreated = insertRoot(conversation);
    insertDomains(conversation);
    insertMentions(
        conversation.getId(),
        ROOT_TARGET,
        conversation.getId(),
        conversation.getMessage(),
        conversation.getCreatedAt());
    for (LegacyReply legacyReply : replies) {
      ConversationReply reply = legacyReply.reply();
      insertReply(reply);
      insertMentions(
          reply.getConversationId(),
          REPLY_TARGET,
          reply.getId(),
          reply.getMessage(),
          reply.getCreatedAt());
    }
    // A root inserted by this run already carries the reply count computed above, and replies
    // cannot outlive their root (FK cascade). Only a root left by an earlier run needs a recount.
    if (!rootCreated) {
      reconcileReplyCount(conversation.getId(), conversation.getUpdatedAt());
    }
  }

  private boolean insertRoot(Conversation conversation) {
    MessageParser.EntityLink link = MessageParser.EntityLink.parse(conversation.getAbout());
    String fqnHash = FullyQualifiedName.buildHash(link.getEntityFQN());
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:entityFqnHash, :aboutFqnHash, :json::jsonb) ON CONFLICT DO NOTHING"
            : "INSERT IGNORE INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:entityFqnHash, :aboutFqnHash, :json)";
    return handle
            .createUpdate(sql)
            .bind("entityFqnHash", fqnHash)
            .bind("aboutFqnHash", fqnHash)
            .bind("json", JsonUtils.pojoToJson(conversation))
            .execute()
        > 0;
  }

  private void insertReply(ConversationReply reply) {
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO conversation_reply(json) VALUES (:json::jsonb) ON CONFLICT DO NOTHING"
            : "INSERT IGNORE INTO conversation_reply(json) VALUES (:json)";
    handle.createUpdate(sql).bind("json", JsonUtils.pojoToJson(reply)).execute();
  }

  private void insertDomains(Conversation conversation) {
    for (EntityReference domain : listOrEmpty(conversation.getDomains())) {
      String sql =
          connectionType == ConnectionType.POSTGRES
              ? "INSERT INTO conversation_domain(conversationId, domainId) "
                  + "VALUES (:conversationId, :domainId) ON CONFLICT DO NOTHING"
              : "INSERT IGNORE INTO conversation_domain(conversationId, domainId) "
                  + "VALUES (:conversationId, :domainId)";
      handle
          .createUpdate(sql)
          .bind("conversationId", conversation.getId().toString())
          .bind("domainId", domain.getId().toString())
          .execute();
    }
  }

  private void insertMentions(
      UUID conversationId, String targetType, UUID targetId, String message, long createdAt) {
    if (nullOrEmpty(message)) {
      return;
    }
    for (MessageParser.EntityLink link :
        MessageParser.getEntityLinks(message).stream().distinct().toList()) {
      EntityReference mention = resolveMention(link);
      if (mention != null) {
        insertMention(conversationId, targetType, targetId, mention, createdAt);
      }
    }
  }

  private void insertMention(
      UUID conversationId,
      String targetType,
      UUID targetId,
      EntityReference mention,
      long createdAt) {
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO conversation_mention(conversationId, targetType, targetId, "
                + "mentionedEntityType, mentionedEntityId, createdAt) VALUES (:conversationId, "
                + ":targetType, :targetId, :mentionedEntityType, :mentionedEntityId, :createdAt) "
                + "ON CONFLICT DO NOTHING"
            : "INSERT IGNORE INTO conversation_mention(conversationId, targetType, targetId, "
                + "mentionedEntityType, mentionedEntityId, createdAt) VALUES (:conversationId, "
                + ":targetType, :targetId, :mentionedEntityType, :mentionedEntityId, :createdAt)";
    handle
        .createUpdate(sql)
        .bind("conversationId", conversationId.toString())
        .bind("targetType", targetType)
        .bind("targetId", targetId.toString())
        .bind("mentionedEntityType", mention.getType())
        .bind("mentionedEntityId", mention.getId().toString())
        .bind("createdAt", createdAt)
        .execute();
  }

  private void reconcileReplyCount(UUID conversationId, long updatedAt) {
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "UPDATE conversation_entity SET json = jsonb_set(jsonb_set(json, '{replyCount}', "
                + "to_jsonb((SELECT COUNT(*)::integer FROM conversation_reply "
                + "WHERE conversationId = :id))), '{updatedAt}', "
                + "to_jsonb(GREATEST(updatedAt, CAST(:updatedAt AS bigint)))) WHERE id = :id"
            : "UPDATE conversation_entity SET json = JSON_SET(json, '$.replyCount', "
                + "(SELECT COUNT(*) FROM conversation_reply WHERE conversationId = :id), "
                + "'$.updatedAt', GREATEST(updatedAt, :updatedAt)) WHERE id = :id";
    handle
        .createUpdate(sql)
        .bind("id", conversationId.toString())
        .bind("updatedAt", updatedAt)
        .execute();
  }

  private ActivityEvent findActivity(UUID id) {
    String json =
        handle
            .createQuery(
                "SELECT json FROM activity_stream WHERE id = :id ORDER BY timestamp DESC LIMIT 1")
            .bind("id", id.toString())
            .mapTo(String.class)
            .findOne()
            .orElse(null);
    return json == null ? null : JsonUtils.readValue(json, ActivityEvent.class);
  }

  private EntityReference resolveThreadTarget(Thread thread) {
    EntityReference reference = thread.getEntityRef();
    if (reference == null || reference.getId() == null || reference.getType() == null) {
      reference = resolveAboutTarget(thread);
    }
    return reference;
  }

  private EntityReference resolveAboutTarget(Thread thread) {
    EntityReference reference;
    try {
      MessageParser.EntityLink link = MessageParser.EntityLink.parse(thread.getAbout());
      reference = resolveEntityReference(link.getEntityType(), link.getEntityFQN());
    } catch (RuntimeException exception) {
      LOG.warn("Could not resolve target for legacy conversation {}", thread.getId());
      reference = null;
    }
    return reference;
  }

  /** Legacy threads crowd around the same assets, so cache both hits and misses of the lookup. */
  private EntityReference resolveEntityReference(String entityType, String entityFqn) {
    String key = entityType + "::" + entityFqn;
    if (!entityReferences.containsKey(key)) {
      entityReferences.put(key, findEntityReference(entityType, entityFqn));
    }
    return entityReferences.get(key);
  }

  private EntityReference findEntityReference(String entityType, String entityFqn) {
    EntityReference reference;
    try {
      reference = Entity.getEntityReferenceByName(entityType, entityFqn, Include.ALL);
    } catch (RuntimeException exception) {
      LOG.warn("Could not resolve legacy reference {}::{}", entityType, entityFqn);
      reference = null;
    }
    return reference;
  }

  private EntityReference resolveUser(String requestedName, EntityReference legacyReference) {
    if (legacyReference != null && legacyReference.getId() != null) {
      return legacyReference;
    }
    String name =
        valueOrDefault(requestedName, legacyReference == null ? null : legacyReference.getName());
    name = valueOrDefault(name, "system");
    EntityReference cached = users.get(name);
    if (cached == null) {
      cached = findUser(name);
      users.put(name, cached);
    }
    return cached;
  }

  private EntityReference findUser(String name) {
    String id =
        handle
            .createQuery("SELECT id FROM user_entity WHERE nameHash = :nameHash")
            .bind("nameHash", FullyQualifiedName.buildHash(name))
            .mapTo(String.class)
            .findOne()
            .orElse(null);
    UUID userId =
        id == null
            ? UUID.nameUUIDFromBytes(("legacy-user:" + name).getBytes(StandardCharsets.UTF_8))
            : UUID.fromString(id);
    return new EntityReference()
        .withId(userId)
        .withType(Entity.USER)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private EntityReference resolveMention(MessageParser.EntityLink link) {
    EntityReference mention;
    if (Entity.USER.equals(link.getEntityType())) {
      mention = resolveUser(link.getEntityFQN(), null);
    } else {
      mention = resolveEntityReference(link.getEntityType(), link.getEntityFQN());
    }
    return mention;
  }

  private boolean isMigratable(Thread thread, EntityReference target) {
    return thread.getId() != null
        && !nullOrEmpty(thread.getAbout())
        && !nullOrEmpty(thread.getMessage())
        && target != null
        && target.getId() != null
        && target.getType() != null;
  }

  private List<EntityReference> domainReferences(List<UUID> domainIds) {
    return listOrEmpty(domainIds).stream()
        .map(id -> new EntityReference().withId(id).withType(Entity.DOMAIN))
        .toList();
  }

  private List<Reaction> normalizeReactions(List<Reaction> legacyReactions) {
    Map<String, Reaction> reactions = new LinkedHashMap<>();
    for (Reaction reaction : listOrEmpty(legacyReactions)) {
      if (reaction == null || reaction.getReactionType() == null) {
        continue;
      }
      EntityReference user = resolveUser(null, reaction.getUser());
      String key = user.getId() + "|" + reaction.getReactionType().value();
      reactions.putIfAbsent(
          key, new Reaction().withReactionType(reaction.getReactionType()).withUser(user));
    }
    return new ArrayList<>(reactions.values());
  }

  private long latestTimestamp(long createdAt, Long legacyUpdatedAt, List<LegacyReply> replies) {
    long result = Math.max(createdAt, legacyUpdatedAt == null ? 0 : legacyUpdatedAt);
    for (LegacyReply reply : replies) {
      result = Math.max(result, reply.reply().getUpdatedAt());
    }
    return result;
  }

  private long timestamp(Long preferred, Long fallback) {
    return preferred != null ? preferred : fallback == null ? 0 : fallback;
  }

  private String valueOrDefault(String value, String fallback) {
    return nullOrEmpty(value) ? fallback : value;
  }

  private <T> List<T> listOrEmpty(List<T> values) {
    return values == null ? List.of() : values;
  }

  private static <V> Map<String, V> boundedCache() {
    return new LinkedHashMap<>(16, 0.75f, true) {
      @Override
      protected boolean removeEldestEntry(Map.Entry<String, V> eldest) {
        return size() > CACHE_MAX_SIZE;
      }
    };
  }

  private static boolean tableExists(Handle handle, String table) {
    boolean exists;
    try {
      handle.createQuery("SELECT 1 FROM " + table + " LIMIT 1").mapTo(Integer.class).findFirst();
      exists = true;
    } catch (RuntimeException exception) {
      exists = false;
    }
    return exists;
  }

  public record MigrationSummary(
      String sourceTable,
      int userConversations,
      int activityConversations,
      int replies,
      int activitiesWithoutReplies,
      int ownedByDedicatedMigration,
      int chatbotsSkipped,
      int errors) {
    static MigrationSummary empty() {
      return new MigrationSummary(null, 0, 0, 0, 0, 0, 0, 0);
    }
  }

  private static final class MigrationCounts {
    private final String sourceTable;
    private int userConversations;
    private int activityConversations;
    private int replies;
    private int activitiesWithoutReplies;
    private int ownedByDedicatedMigration;
    private int chatbotsSkipped;
    private int errors;

    private MigrationCounts(String sourceTable) {
      this.sourceTable = sourceTable;
    }

    private MigrationSummary toSummary() {
      return new MigrationSummary(
          sourceTable,
          userConversations,
          activityConversations,
          replies,
          activitiesWithoutReplies,
          ownedByDedicatedMigration,
          chatbotsSkipped,
          errors);
    }
  }

  private record LegacyReply(ConversationReply reply) {}
}
