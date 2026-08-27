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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.service.migration.utils.v210.ConversationMigration.BATCH_SIZE;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class ConversationMigrationTest {
  @Test
  void resolvesEverySupportedLegacyTableName() {
    for (int selected = 0;
        selected < ConversationMigration.LEGACY_THREAD_TABLES.size();
        selected++) {
      Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
      for (int missing = 0; missing < selected; missing++) {
        String table = ConversationMigration.LEGACY_THREAD_TABLES.get(missing);
        when(handle
                .createQuery("SELECT 1 FROM " + table + " LIMIT 1")
                .mapTo(Integer.class)
                .findFirst())
            .thenThrow(new IllegalStateException("missing"));
      }
      String expected = ConversationMigration.LEGACY_THREAD_TABLES.get(selected);
      when(handle
              .createQuery("SELECT 1 FROM " + expected + " LIMIT 1")
              .mapTo(Integer.class)
              .findFirst())
          .thenReturn(Optional.of(1));

      assertEquals(expected, ConversationMigration.findLegacyThreadTable(handle));
    }
  }

  @Test
  void returnsEmptySummaryWhenEveryLegacyTableIsMissing() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    for (String table : ConversationMigration.LEGACY_THREAD_TABLES) {
      when(handle
              .createQuery("SELECT 1 FROM " + table + " LIMIT 1")
              .mapTo(Integer.class)
              .findFirst())
          .thenThrow(new IllegalStateException("missing"));
    }

    ConversationMigration.MigrationSummary summary = ConversationMigration.migrate(handle, MYSQL);

    assertNull(summary.sourceTable());
    assertEquals(0, summary.userConversations());
  }

  @Test
  void countsThreadsOwnedByOtherMigrationsWithoutReadingTheirJson() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubLegacyTable(handle);
    stubConversationBatch(handle, "", List.of(row(userConversation())));
    when(handle
            .createQuery("SELECT COUNT(*) FROM thread_entity WHERE type = :type")
            .bind("type", "Chatbot")
            .mapTo(Integer.class)
            .findOne())
        .thenReturn(Optional.of(1));
    when(handle
            .createQuery(
                "SELECT COUNT(*) FROM thread_entity WHERE type IS NOT NULL "
                    + "AND type NOT IN (:conversationType, :chatbotType)")
            .bind("conversationType", "Conversation")
            .bind("chatbotType", "Chatbot")
            .mapTo(Integer.class)
            .findOne())
        .thenReturn(Optional.of(2));

    ConversationMigration.MigrationSummary summary = ConversationMigration.migrate(handle, MYSQL);

    assertEquals(1, summary.userConversations());
    assertEquals(1, summary.replies());
    assertEquals(2, summary.ownedByDedicatedMigration());
    assertEquals(1, summary.chatbotsSkipped());
    assertEquals(0, summary.errors());
    verify(handle, atLeastOnce()).createUpdate(contains("INSERT IGNORE INTO conversation_entity"));
    verify(handle, atLeastOnce()).createUpdate(contains("INSERT IGNORE INTO conversation_reply"));
    verify(handle, never()).createUpdate(contains("conversation_reaction"));
    verify(handle, atLeastOnce()).createUpdate(contains("conversation_mention"));
  }

  @Test
  void readsLegacyThreadsInKeysetPagedBatches() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubLegacyTable(handle);
    List<Map<String, Object>> firstBatch = new ArrayList<>();
    for (int index = 0; index < BATCH_SIZE; index++) {
      firstBatch.add(row(conversationWithId(threadId(index))));
    }
    String lastIdOfFirstBatch = threadId(BATCH_SIZE - 1);
    stubConversationBatch(handle, "", firstBatch);
    stubConversationBatch(
        handle, lastIdOfFirstBatch, List.of(row(conversationWithId(threadId(BATCH_SIZE)))));

    ConversationMigration.MigrationSummary summary = ConversationMigration.migrate(handle, MYSQL);

    assertEquals(BATCH_SIZE + 1, summary.userConversations());
    assertEquals(0, summary.errors());
    verify(handle, atLeastOnce())
        .createQuery(contains("WHERE (type = :type OR type IS NULL) AND id > :afterId"));
  }

  @Test
  void repeatExecutionUsesConflictSafePostgresWrites() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubLegacyTable(handle);
    stubConversationBatch(handle, "", List.of(row(userConversation())));

    ConversationMigration.migrate(handle, POSTGRES);
    ConversationMigration.migrate(handle, POSTGRES);

    verify(handle, atLeastOnce()).createUpdate(contains("ON CONFLICT DO NOTHING"));
  }

  @Test
  void recountsRepliesOnlyForConversationsAnEarlierRunLeftBehind() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubLegacyTable(handle);
    stubConversationBatch(handle, "", List.of(row(userConversation())));
    when(handle
            .createUpdate(
                "INSERT IGNORE INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                    + "VALUES (:entityFqnHash, :aboutFqnHash, :json)")
            .bind(anyString(), anyString())
            .bind(anyString(), anyString())
            .bind(anyString(), anyString())
            .execute())
        .thenReturn(1);

    ConversationMigration.migrate(handle, MYSQL);

    verify(handle, never()).createUpdate(contains("UPDATE conversation_entity SET json"));
  }

  @Test
  void systemConversationUsesSameActivityIdAndMigratesOnlyReplies() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    String activityId = "00000000-0000-0000-0000-000000000510";
    stubLegacyTable(handle);
    stubConversationBatch(handle, "", List.of(row(systemConversation(activityId))));
    when(handle
            .createQuery(
                "SELECT json FROM activity_stream WHERE id = :id ORDER BY timestamp DESC LIMIT 1")
            .bind("id", activityId)
            .mapTo(String.class)
            .findOne())
        .thenReturn(Optional.of(activity(activityId)));

    ConversationMigration.MigrationSummary summary = ConversationMigration.migrate(handle, MYSQL);

    assertEquals(0, summary.userConversations());
    assertEquals(1, summary.activityConversations());
    assertEquals(1, summary.replies());
    assertEquals(0, summary.errors());
  }

  private void stubLegacyTable(Handle handle) {
    when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).findFirst())
        .thenReturn(Optional.of(1));
  }

  private void stubConversationBatch(
      Handle handle, String afterId, List<Map<String, Object>> rows) {
    when(handle
            .createQuery(
                "SELECT id, json FROM thread_entity"
                    + " WHERE (type = :type OR type IS NULL) AND id > :afterId"
                    + " ORDER BY id LIMIT :limit")
            .bind("type", "Conversation")
            .bind("afterId", afterId)
            .bind("limit", BATCH_SIZE)
            .mapToMap()
            .list())
        .thenReturn(rows);
  }

  private String threadId(int index) {
    return "00000000-0000-0000-0000-%012d".formatted(index + 1000);
  }

  private Map<String, Object> row(String json) {
    return Map.of("id", JsonUtils.readTree(json).get("id").asText(), "json", json);
  }

  private String conversationWithId(String id) {
    return userConversation().replace("00000000-0000-0000-0000-000000000010", id);
  }

  private String userConversation() {
    return """
        {
          "id": "00000000-0000-0000-0000-000000000010",
          "type": "Conversation",
          "generatedBy": "user",
          "about": "<#E::table::service.database.schema.table>",
          "entityRef": {
            "id": "00000000-0000-0000-0000-000000000100",
            "type": "table",
            "fullyQualifiedName": "service.database.schema.table"
          },
          "message": "Please review <#E::user::deletedAuthor>",
          "createdBy": "deletedAuthor",
          "updatedBy": "deletedAuthor",
          "threadTs": 1700000000000,
          "updatedAt": 1700000001000,
          "resolved": true,
          "domains": ["00000000-0000-0000-0000-000000000200"],
          "reactions": [{
            "reactionType": "heart",
            "user": {"id": "00000000-0000-0000-0000-000000000300", "type": "user"}
          }],
          "posts": [{
            "id": "00000000-0000-0000-0000-000000000400",
            "message": "A migrated reply",
            "from": "removedReplyAuthor",
            "postTs": 1700000000500,
            "reactions": [{
              "reactionType": "eyes",
              "user": {"id": "00000000-0000-0000-0000-000000000301", "type": "user"}
            }]
          }]
        }
        """;
  }

  private String threadOfType(String type, String id) {
    return """
        {
          "id": "%s",
          "type": "%s",
          "about": "<#E::table::service.database.schema.table>",
          "message": "legacy"
        }
        """
        .formatted(id, type);
  }

  private String systemConversation(String id) {
    return """
        {
          "id": "%s",
          "type": "Conversation",
          "generatedBy": "system",
          "about": "<#E::table::service.database.schema.table::description>",
          "message": "Description changed",
          "createdBy": "system",
          "threadTs": 1700000000000,
          "updatedAt": 1700000001000,
          "reactions": [{
            "reactionType": "heart",
            "user": {"id": "00000000-0000-0000-0000-000000000520", "type": "user"}
          }],
          "posts": [{
            "id": "00000000-0000-0000-0000-000000000530",
            "message": "Why was this changed?",
            "from": "deletedAuthor",
            "postTs": 1700000000500
          }]
        }
        """
        .formatted(id);
  }

  private String activity(String id) {
    return """
        {
          "id": "%s",
          "eventType": "DescriptionUpdated",
          "entity": {
            "id": "00000000-0000-0000-0000-000000000100",
            "type": "table",
            "fullyQualifiedName": "service.database.schema.table"
          },
          "about": "<#E::table::service.database.schema.table::description>",
          "timestamp": 1700000000000
        }
        """
        .formatted(id);
  }
}
