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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ConversationSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.util.FullyQualifiedName;

@ExtendWith(TestNamespaceExtension.class)
class ConversationSchemaMigrationIT {
  @Test
  void conversationV2DdlIsIdempotentAndIndexedChildrenCascade() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    String schemaSql = conversationSchemaSql(connectionType);
    UUID conversationId = UUID.randomUUID();

    try {
      jdbi.useHandle(
          handle -> {
            handle.createScript(schemaSql).execute();
            assertFalse(columnExists(handle, connectionType, "activityTimestamp"));
            addLegacyActivityTimestampColumn(handle, connectionType);
            assertTrue(columnExists(handle, connectionType, "activityTimestamp"));
            handle.createScript(schemaSql).execute();
            assertFalse(columnExists(handle, connectionType, "activityTimestamp"));
            handle.createScript(schemaSql).execute();
            insertConversationGraph(handle, connectionType, conversationId);

            assertEquals(
                ConversationSource.User.value(),
                scalar(handle, "source", "conversation_entity", conversationId));
            assertEquals(
                Entity.TABLE, scalar(handle, "entityType", "conversation_entity", conversationId));
            assertEquals(1, count(handle, "conversation_reply", conversationId));
            assertEquals(1, storedReply(handle, conversationId).getReactions().size());
            assertEquals(1, count(handle, "conversation_mention", conversationId));
            assertEquals(1, count(handle, "conversation_domain", conversationId));

            handle
                .createUpdate("DELETE FROM conversation_entity WHERE id = :id")
                .bind("id", conversationId.toString())
                .execute();
            assertEquals(0, count(handle, "conversation_reply", conversationId));
            assertEquals(0, count(handle, "conversation_mention", conversationId));
            assertEquals(0, count(handle, "conversation_domain", conversationId));
          });
    } finally {
      jdbi.useHandle(
          handle ->
              handle
                  .createUpdate("DELETE FROM conversation_entity WHERE id = :id")
                  .bind("id", conversationId.toString())
                  .execute());
    }
  }

  @Test
  void legacyConversationDataMigrationIsRepeatableOnRealDatabase(TestNamespace ns)
      throws Exception {
    ConnectionType connectionType = currentConnectionType();
    Table table = createTestTable(ns);
    User admin = SdkClients.adminClient().users().getByName("admin");
    UUID conversationId = UUID.randomUUID();
    UUID replyId = UUID.randomUUID();
    long createdAt = System.currentTimeMillis() - 1_000;
    String deletedAuthor = "deleted-author-" + conversationId;
    String adminMention = "<#E::user::" + admin.getFullyQualifiedName() + ">";
    Thread legacy =
        new Thread()
            .withId(conversationId)
            .withType(ThreadType.Conversation)
            .withGeneratedBy(Thread.GeneratedBy.USER)
            .withAbout("<#E::table::" + table.getFullyQualifiedName() + ">")
            .withEntityRef(table.getEntityReference())
            .withMessage("Legacy root " + adminMention)
            .withCreatedBy(deletedAuthor)
            .withUpdatedBy(deletedAuthor)
            .withThreadTs(createdAt)
            .withUpdatedAt(createdAt + 100)
            .withResolved(true)
            .withReactions(
                List.of(
                    new Reaction()
                        .withReactionType(ReactionType.HEART)
                        .withUser(admin.getEntityReference())))
            .withPosts(
                List.of(
                    new Post()
                        .withId(replyId)
                        .withFrom(deletedAuthor)
                        .withMessage("Legacy reply " + adminMention)
                        .withPostTs(createdAt + 100)));

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              createTemporaryLegacyThreadTable(handle, connectionType);
              insertLegacyThread(handle, connectionType, legacy);
              try {
                ConversationMigration.MigrationSummary first =
                    ConversationMigration.migrate(handle, connectionType);
                ConversationMigration.MigrationSummary second =
                    ConversationMigration.migrate(handle, connectionType);

                assertEquals(1, first.userConversations());
                assertEquals(1, first.replies());
                assertEquals(0, first.errors());
                assertEquals(1, second.userConversations());
                assertEquals(0, second.errors());
                assertEquals(1, count(handle, "conversation_reply", conversationId));
                assertEquals(2, count(handle, "conversation_mention", conversationId));

                Conversation migrated = storedConversation(handle, conversationId);
                assertEquals(conversationId, migrated.getId());
                assertEquals(ConversationSource.User, migrated.getSource());
                assertEquals(table.getId(), migrated.getEntityRef().getId());
                assertEquals(deletedAuthor, migrated.getCreatedBy().getName());
                assertTrue(migrated.getResolved());
                assertEquals(1, migrated.getReplyCount());
                assertEquals(admin.getId(), migrated.getReactions().getFirst().getUser().getId());

                ConversationReply migratedReply = storedReply(handle, conversationId);
                assertEquals(replyId, migratedReply.getId());
                assertEquals(deletedAuthor, migratedReply.getAuthor().getName());
              } finally {
                handle
                    .createUpdate("DELETE FROM conversation_entity WHERE id = :id")
                    .bind("id", conversationId.toString())
                    .execute();
                dropTemporaryLegacyThreadTable(handle, connectionType);
              }
            });
  }

  private void insertConversationGraph(
      Handle handle, ConnectionType connectionType, UUID conversationId) {
    UUID entityId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();
    UUID replyId = UUID.randomUUID();
    long now = System.currentTimeMillis();
    String entityFqn = "service.database.schema." + conversationId;
    EntityReference entity =
        new EntityReference()
            .withId(entityId)
            .withType(Entity.TABLE)
            .withFullyQualifiedName(entityFqn);
    EntityReference user =
        new EntityReference().withId(userId).withType(Entity.USER).withName("migration-user");
    Conversation conversation =
        new Conversation()
            .withId(conversationId)
            .withSource(ConversationSource.User)
            .withAbout("<#E::table::" + entityFqn + ">")
            .withEntityRef(entity)
            .withMessage("Migration verification")
            .withCreatedBy(user)
            .withCreatedAt(now)
            .withUpdatedAt(now)
            .withUpdatedBy(user.getName())
            .withResolved(false)
            .withReplyCount(1)
            .withReplies(List.of());
    ConversationReply reply =
        new ConversationReply()
            .withId(replyId)
            .withConversationId(conversationId)
            .withMessage("Normalized reply")
            .withAuthor(user)
            .withCreatedAt(now)
            .withUpdatedAt(now)
            .withUpdatedBy(user.getName())
            .withReactions(
                List.of(new Reaction().withReactionType(ReactionType.HEART).withUser(user)));
    String rootInsert =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:hash, :hash, :json::jsonb)"
            : "INSERT INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:hash, :hash, :json)";
    handle
        .createUpdate(rootInsert)
        .bind("hash", FullyQualifiedName.buildHash(entityFqn))
        .bind("json", JsonUtils.pojoToJson(conversation))
        .execute();
    String replyInsert =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO conversation_reply(json) VALUES (:json::jsonb)"
            : "INSERT INTO conversation_reply(json) VALUES (:json)";
    handle.createUpdate(replyInsert).bind("json", JsonUtils.pojoToJson(reply)).execute();
    handle
        .createUpdate(
            "INSERT INTO conversation_mention(conversationId, targetType, targetId, "
                + "mentionedEntityType, mentionedEntityId, createdAt) VALUES (:conversationId, "
                + "'Reply', :replyId, 'user', :userId, :createdAt)")
        .bind("conversationId", conversationId.toString())
        .bind("replyId", replyId.toString())
        .bind("userId", userId.toString())
        .bind("createdAt", now)
        .execute();
    handle
        .createUpdate(
            "INSERT INTO conversation_domain(conversationId, domainId) "
                + "VALUES (:conversationId, :domainId)")
        .bind("conversationId", conversationId.toString())
        .bind("domainId", UUID.randomUUID().toString())
        .execute();
  }

  private ConversationReply storedReply(Handle handle, UUID conversationId) {
    String json =
        handle
            .createQuery("SELECT json FROM conversation_reply WHERE conversationId = :id")
            .bind("id", conversationId.toString())
            .mapTo(String.class)
            .one();
    return JsonUtils.readValue(json, ConversationReply.class);
  }

  private Conversation storedConversation(Handle handle, UUID conversationId) {
    String json =
        handle
            .createQuery("SELECT json FROM conversation_entity WHERE id = :id")
            .bind("id", conversationId.toString())
            .mapTo(String.class)
            .one();
    return JsonUtils.readValue(json, Conversation.class);
  }

  /**
   * Mirrors the generated id and type columns the real legacy table has carried since the 0.x
   * schema. The migration pages by the primary key and filters on the indexed type column, so a
   * json-only fixture would not exercise the query it actually runs against a customer database.
   */
  private void createTemporaryLegacyThreadTable(Handle handle, ConnectionType connectionType) {
    handle.execute(
        connectionType == ConnectionType.POSTGRES
            ? "CREATE TEMPORARY TABLE thread_entity ("
                + "id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL, "
                + "json JSONB NOT NULL, "
                + "type VARCHAR(64) GENERATED ALWAYS AS (json ->> 'type') STORED, "
                + "PRIMARY KEY (id))"
            : "CREATE TEMPORARY TABLE thread_entity ("
                + "id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL, "
                + "json JSON NOT NULL, "
                + "type VARCHAR(64) GENERATED ALWAYS AS (json ->> '$.type'), "
                + "PRIMARY KEY (id))");
  }

  private void insertLegacyThread(Handle handle, ConnectionType connectionType, Thread thread) {
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO thread_entity(json) VALUES (:json::jsonb)"
            : "INSERT INTO thread_entity(json) VALUES (:json)";
    handle.createUpdate(sql).bind("json", JsonUtils.pojoToJson(thread)).execute();
  }

  private void dropTemporaryLegacyThreadTable(Handle handle, ConnectionType connectionType) {
    handle.execute(
        connectionType == ConnectionType.MYSQL
            ? "DROP TEMPORARY TABLE IF EXISTS thread_entity"
            : "DROP TABLE IF EXISTS thread_entity");
  }

  private Table createTestTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix("conversation-migration-db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("conversation-migration-schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private String conversationSchemaSql(ConnectionType connectionType) throws Exception {
    Path root = Path.of(System.getProperty("user.dir"));
    if (root.endsWith("openmetadata-integration-tests")) {
      root = root.getParent();
    }
    String database = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    String sql =
        Files.readString(
            root.resolve("bootstrap/sql/migrations/native/2.1.0")
                .resolve(database)
                .resolve("schemaChanges.sql"));
    int start = sql.indexOf("CREATE TABLE IF NOT EXISTS conversation_entity");
    assertTrue(start >= 0, "Conversation V2 DDL must remain in the 2.1.0 migration");
    int domainStart = sql.indexOf("CREATE TABLE IF NOT EXISTS conversation_domain", start);
    String endMarker =
        connectionType == ConnectionType.MYSQL
            ? "DEALLOCATE PREPARE drop_conversation_activity_timestamp_stmt;"
            : "ALTER TABLE conversation_entity DROP COLUMN IF EXISTS activityTimestamp;";
    int end = sql.indexOf(endMarker, domainStart);
    assertTrue(domainStart >= start && end >= domainStart, "Conversation V2 DDL is incomplete");
    return sql.substring(start, end + endMarker.length());
  }

  private void addLegacyActivityTimestampColumn(Handle handle, ConnectionType connectionType) {
    String sql =
        connectionType == ConnectionType.MYSQL
            ? "ALTER TABLE conversation_entity ADD COLUMN activityTimestamp bigint "
                + "GENERATED ALWAYS AS (json_unquote(json_extract(json, "
                + "_utf8mb4'$.activityTimestamp'))) STORED"
            : "ALTER TABLE conversation_entity ADD COLUMN activityTimestamp bigint "
                + "GENERATED ALWAYS AS (((json ->> 'activityTimestamp'::text))::bigint) STORED";
    handle.execute(sql);
  }

  private boolean columnExists(Handle handle, ConnectionType connectionType, String columnName) {
    String sql =
        connectionType == ConnectionType.MYSQL
            ? "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                + "AND table_name = 'conversation_entity' AND column_name = :columnName"
            : "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() "
                + "AND table_name = 'conversation_entity' AND column_name = :columnName";
    String storedColumnName =
        connectionType == ConnectionType.POSTGRES
            ? columnName.toLowerCase(Locale.ROOT)
            : columnName;
    return handle.createQuery(sql).bind("columnName", storedColumnName).mapTo(Integer.class).one()
        == 1;
  }

  private String scalar(Handle handle, String column, String table, UUID conversationId) {
    return handle
        .createQuery("SELECT " + column + " FROM " + table + " WHERE id = :id")
        .bind("id", conversationId.toString())
        .mapTo(String.class)
        .one();
  }

  private int count(Handle handle, String table, UUID conversationId) {
    return handle
        .createQuery("SELECT COUNT(*) FROM " + table + " WHERE conversationId = :conversationId")
        .bind("conversationId", conversationId.toString())
        .mapTo(Integer.class)
        .one();
  }

  private ConnectionType currentConnectionType() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
