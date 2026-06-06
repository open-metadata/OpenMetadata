/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.service.jdbi3.ListFilter.escapeApostrophe;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindBeanList;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.statement.UseRowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindConcat;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface CoreRelationshipDAOs {
  @CreateSqlObject
  EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  FieldRelationshipDAO fieldRelationshipDAO();

  @CreateSqlObject
  EntityExtensionDAO entityExtensionDAO();

  interface EntityExtensionDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "REPLACE INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (id, extension) DO UPDATE SET jsonSchema = EXCLUDED.jsonSchema, json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @BindUUID("id") UUID id,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "REPLACE INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (id, extension) DO UPDATE SET jsonSchema = EXCLUDED.jsonSchema, json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertMany(
        @BindUUID("id") List<UUID> id,
        @Bind("extension") List<String> extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") List<String> json);

    @SqlQuery("SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
    String getExtension(@BindUUID("id") UUID id, @Bind("extension") String extension);

    @SqlQuery(
        "SELECT id, extension, json "
            + "FROM entity_extension "
            + "WHERE id IN (<ids>) AND extension LIKE :extension "
            + "ORDER BY id, extension")
    @RegisterRowMapper(ExtensionRecordWithIdMapper.class)
    List<ExtensionRecordWithId> getExtensionsBatchInternal(
        @BindList("ids") List<String> ids,
        @BindConcat(
                value = "extension",
                parts = {":extensionPrefix", ".%"})
            String extensionPrefix);

    default List<ExtensionRecordWithId> getExtensionsBatch(
        List<String> ids, String extensionPrefix) {
      return EntityDAO.queryInChunks(
          ids, chunk -> getExtensionsBatchInternal(chunk, extensionPrefix));
    }

    @SqlQuery(
        "SELECT id, extension, json "
            + "FROM entity_extension "
            + "WHERE id IN (<ids>) AND extension = :extension "
            + "ORDER BY id, extension")
    @RegisterRowMapper(ExtensionRecordWithIdMapper.class)
    List<ExtensionRecordWithId> getExtensionBatchInternal(
        @BindList("ids") List<String> ids, @Bind("extension") String extension);

    default List<ExtensionRecordWithId> getExtensionBatch(List<String> ids, String extension) {
      return EntityDAO.queryInChunks(ids, chunk -> getExtensionBatchInternal(chunk, extension));
    }

    @SqlQuery(
        "SELECT id, extension, json, jsonschema "
            + "FROM entity_extension "
            + "WHERE extension LIKE :extension "
            + "ORDER BY id, extension")
    @RegisterRowMapper(ExtensionWithIdAndSchemaRowMapper.class)
    List<ExtensionWithIdAndSchemaObject> getExtensionsByPrefixBatch(
        @BindConcat(
                value = "extension",
                parts = {":extensionPrefix", "%"})
            String extensionPrefix);

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO entity_extension (id, extension, json, jsonschema) "
                + "VALUES (:id, :extension, :json, :jsonschema) "
                + "ON DUPLICATE KEY UPDATE json = VALUES(json), jsonschema = VALUES(jsonschema)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO entity_extension (id, extension, json,jsonschema) VALUES (:id, :extension, :json::jsonb,:jsonschema) "
                + "ON CONFLICT (id, extension) DO UPDATE SET json = EXCLUDED.json , jsonschema = EXCLUDED.jsonschema",
        connectionType = POSTGRES)
    void bulkUpsertExtensions(
        @BindBean List<ExtensionWithIdAndSchemaObject> extensionWithIdObjects);

    @RegisterRowMapper(ExtensionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND extension "
            + "LIKE CONCAT (:extensionPrefix, '.%') "
            + "ORDER BY extension")
    List<ExtensionRecord> getExtensions(
        @BindUUID("id") UUID id, @Bind("extensionPrefix") String extensionPrefix);

    @RegisterRowMapper(ExtensionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND jsonschema = :jsonSchema "
            + "ORDER BY extension")
    List<ExtensionRecord> getExtensionsByJsonSchema(
        @BindUUID("id") UUID id, @Bind("jsonSchema") String jsonSchema);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT id, updatedAt, json FROM entity_extension "
                + "WHERE updatedAt >= :startTs "
                + "AND updatedAt <= :endTs "
                + "AND jsonSchema = :entityType "
                + "UNION "
                + "SELECT id, updatedAt, json FROM <table> "
                + "WHERE updatedAt >= :startTs AND "
                + "updatedAt <= :endTs "
                + ") combined WHERE 1=1 "
                + "<cursorCondition> "
                + "ORDER BY updatedAt DESC, id DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT id, updatedAt, json FROM entity_extension "
                + "WHERE updatedAt >= :startTs "
                + "AND updatedAt <= :endTs "
                + "AND jsonSchema = :entityType "
                + "UNION "
                + "SELECT id, updatedAt, json::jsonb FROM <table> "
                + "WHERE updatedAt >= :startTs AND "
                + "updatedAt <= :endTs "
                + ") combined WHERE 1=1 "
                + "<cursorCondition> "
                + "ORDER BY updatedAt DESC, id DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @RegisterRowMapper(ExtensionMapper.class)
    List<String> getEntityHistoryByTimestampRange(
        @Define("table") String table,
        @Bind("startTs") long startTs,
        @Bind("endTs") long endTs,
        @Define("cursorCondition") String cursorCondition,
        @Bind("entityType") String entityType,
        @Bind("cursorUpdatedAt") Long cursorUpdatedAt,
        @Bind("cursorId") String cursorId,
        @Bind("limit") int limit);

    @SqlQuery(
        value =
            "SELECT SUM(cnt) FROM ("
                + "SELECT COUNT(*) AS cnt FROM entity_extension "
                + "WHERE updatedAt >= :startTs "
                + "AND updatedAt <= :endTs "
                + "AND jsonSchema = :entityType "
                + "UNION ALL "
                + "SELECT COUNT(*) AS cnt FROM <table> "
                + "WHERE updatedAt >= :startTs AND "
                + "updatedAt <= :endTs"
                + ") total_counts")
    int getEntityHistoryByTimestampRangeCount(
        @Define("table") String table,
        @Bind("startTs") long startTs,
        @Bind("endTs") long endTs,
        @Bind("entityType") String entityType);

    @RegisterRowMapper(ExtensionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND extension "
            + "LIKE CONCAT (:extensionPrefix, '.%') "
            + "ORDER BY extension DESC "
            + "LIMIT :limit OFFSET :offset")
    List<ExtensionRecord> getExtensionsWithOffset(
        @BindUUID("id") UUID id,
        @Bind("extensionPrefix") String extensionPrefix,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlUpdate("DELETE FROM entity_extension WHERE id = :id AND extension = :extension")
    void delete(@BindUUID("id") UUID id, @Bind("extension") String extension);

    @SqlUpdate("DELETE FROM entity_extension WHERE extension = :extension")
    void deleteExtension(@Bind("extension") String extension);

    @SqlUpdate("DELETE FROM entity_extension WHERE id = :id")
    void deleteAll(@BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM entity_extension WHERE id IN (<ids>)")
    void deleteAllBatchInternal(@BindList("ids") List<String> ids);

    default void deleteAllBatch(List<String> ids) {
      EntityDAO.updateInChunks(ids, this::deleteAllBatchInternal);
    }
  }

  class EntityVersionPair {
    @Getter private final Double version;
    @Getter private final String entityJson;

    public EntityVersionPair(ExtensionRecord extensionRecord) {
      this.version = EntityUtil.getVersion(extensionRecord.extensionName());
      this.entityJson = extensionRecord.extensionJson();
    }
  }

  record ExtensionRecord(String extensionName, String extensionJson) {}

  record ExtensionRecordWithId(UUID id, String extensionName, String extensionJson) {}

  class ExtensionMapper implements RowMapper<ExtensionRecord> {
    @Override
    public ExtensionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new ExtensionRecord(rs.getString("extension"), rs.getString("json"));
    }
  }

  class ExtensionRecordWithIdMapper implements RowMapper<ExtensionRecordWithId> {
    @Override
    public ExtensionRecordWithId map(ResultSet rs, StatementContext ctx) throws SQLException {
      String id = rs.getString("id");
      String extensionName = rs.getString("extension");
      String extensionJson = rs.getString("json");
      return new ExtensionRecordWithId(UUID.fromString(id), extensionName, extensionJson);
    }
  }

  @Getter
  @Setter
  @Builder
  class ExtensionWithIdAndSchemaObject {
    private String id;
    private String extension;
    private String json;
    private String jsonschema;
  }

  class ExtensionWithIdAndSchemaRowMapper implements RowMapper<ExtensionWithIdAndSchemaObject> {
    @Override
    public ExtensionWithIdAndSchemaObject map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      String id = rs.getString("id");
      String extensionName = rs.getString("extension");
      String extensionJson = rs.getString("json");
      String jsonSchema = rs.getString("jsonschema");
      return new ExtensionWithIdAndSchemaObject(id, extensionName, extensionJson, jsonSchema);
    }
  }

  @Getter
  @Builder
  class EntityRelationshipRecord {
    private UUID id;
    private String type;
    private String json;
  }

  @Getter
  @Builder
  class EntityRelationshipCount {
    private UUID id;
    private Integer count;
  }

  @Getter
  @Builder
  class RelationTypeUsageCount {
    private String relationType;
    private Integer count;
  }

  @Getter
  @Builder
  class EntityRelationshipObject {
    private String fromId;
    private String toId;
    private String fromEntity;
    private String toEntity;
    private int relation;
    private String json;
    private String jsonSchema;
  }

  @Getter
  @Builder
  class ReportDataRow {
    private String rowNum;
    private ReportData reportData;
  }

  @Getter
  @Builder
  class QueryList {
    private String fqn;
    private Query query;
  }

  interface EntityRelationshipDAO {
    /** Map an {@link Include} filter to the trailing {@code deleted} SQL clause. */
    private static String deletedCondition(Include include) {
      String condition = "";
      if (include == null || include == Include.NON_DELETED) {
        condition = "AND deleted = FALSE";
      } else if (include == Include.DELETED) {
        condition = "AND deleted = TRUE";
      }
      return condition;
    }

    default void insert(UUID fromId, UUID toId, String fromEntity, String toEntity, int relation) {
      insert(fromId, toId, fromEntity, toEntity, relation, "", null);
    }

    default void insert(
        UUID fromId, UUID toId, String fromEntity, String toEntity, int relation, String json) {
      insert(fromId, toId, fromEntity, toEntity, relation, "", json);
    }

    default void bulkInsertToRelationship(
        UUID fromId, List<UUID> toIds, String fromEntity, String toEntity, int relation) {

      List<EntityRelationshipObject> insertToRelationship =
          toIds.stream()
              .map(
                  testCase ->
                      EntityRelationshipObject.builder()
                          .fromId(fromId.toString())
                          .toId(testCase.toString())
                          .fromEntity(fromEntity)
                          .toEntity(toEntity)
                          .relation(relation)
                          .build())
              .collect(Collectors.toList());

      bulkInsertTo(insertToRelationship);
    }

    default void bulkRemoveToRelationship(
        UUID fromId, List<UUID> toIds, String fromEntity, String toEntity, int relation) {

      List<String> toIdsAsString = toIds.stream().map(UUID::toString).toList();
      EntityDAO.updateInChunks(
          toIdsAsString, chunk -> bulkRemoveTo(fromId, chunk, fromEntity, toEntity, relation));
    }

    default void bulkRemoveFromRelationship(
        List<UUID> fromIds, UUID toId, String fromEntity, String toEntity, int relation) {

      List<String> fromIdsAsString = fromIds.stream().map(UUID::toString).toList();
      EntityDAO.updateInChunks(
          fromIdsAsString, chunk -> bulkRemoveFrom(chunk, toId, fromEntity, toEntity, relation));
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation, relationType, json) "
                + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation, :relationType, :json) "
                + "ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation, relationType, json) VALUES "
                + "(:fromId, :toId, :fromEntity, :toEntity, :relation, :relationType, (:json :: jsonb)) "
                + "ON CONFLICT (fromId, toId, relation, relationType) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("relationType") String relationType,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation) VALUES <values>",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation) VALUES <values>"
                + "ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    void bulkInsertTo(
        @BindBeanList(
                value = "values",
                propertyNames = {"fromId", "toId", "fromEntity", "toEntity", "relation"})
            List<EntityRelationshipObject> values);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "SELECT :fromId, t.id, :fromEntity, :toEntity, :relation "
                + "FROM <table> t",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "SELECT :fromId, t.id, :fromEntity, :toEntity, :relation "
                + "FROM <table> t "
                + "ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    void bulkInsertAllToRelationship(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Define("table") String table);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "SELECT :fromId, t.id, :fromEntity, :toEntity, :relation "
                + "FROM <table> t "
                + "WHERE t.id NOT IN (<exclusionIds>)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "SELECT :fromId, t.id, :fromEntity, :toEntity, :relation "
                + "FROM <table> t "
                + "WHERE t.id NOT IN (<exclusionIds>) "
                + "ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    void bulkInsertAllToRelationshipWithExclusions(
        @BindList("exclusionIds") List<String> excludedIds,
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Define("table") String table);

    @SqlUpdate(
        value =
            "DELETE FROM entity_relationship WHERE fromId = :fromId "
                + "AND fromEntity = :fromEntity AND toId IN (<toIds>) "
                + "AND toEntity = :toEntity AND relation = :relation")
    void bulkRemoveTo(
        @BindUUID("fromId") UUID fromId,
        @BindList("toIds") List<String> toIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE FROM entity_relationship "
            + "WHERE fromEntity = :fromEntity "
            + "AND fromId IN (<fromIds>) "
            + "AND toEntity = :toEntity "
            + "AND relation = :relation "
            + "AND toId = :toId")
    void bulkRemoveFrom(
        @BindList("fromIds") List<String> fromIds,
        @BindUUID("toId") UUID toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "UPDATE entity_relationship "
            + "SET fromId = :newFromId "
            + "WHERE fromId = :oldFromId "
            + "AND fromEntity = :fromEntity "
            + "AND toEntity = :toEntity "
            + "AND relation = :relation "
            + "AND toId IN (<toIds>)")
    void bulkUpdateFromIdInternal(
        @BindUUID("oldFromId") UUID oldFromId,
        @BindUUID("newFromId") UUID newFromId,
        @BindList("toIds") List<String> toIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    default void bulkUpdateFromId(
        UUID oldFromId,
        UUID newFromId,
        List<String> toIds,
        String fromEntity,
        String toEntity,
        int relation) {
      EntityDAO.updateInChunks(
          toIds,
          chunk ->
              bulkUpdateFromIdInternal(
                  oldFromId, newFromId, chunk, fromEntity, toEntity, relation));
    }

    //
    // Find to operations
    //
    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation IN (<relation>)")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findTo(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindList("relation") List<Integer> relation);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.toId WHERE er1.relation = 10 AND er1.fromEntity = 'domain' AND er2.fromId = :fromId AND er2.fromEntity = :fromEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findDownstreamDomains(
        @BindUUID("fromId") UUID fromId, @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.fromId WHERE er1.relation = 10 AND er1.fromEntity = 'domain' AND er2.toId = :toId AND er2.toEntity = :toEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findUpstreamDomains(
        @BindUUID("toId") UUID toId, @Bind("toEntity") String toEntity);

    @SqlQuery(
        "select count(*) from entity_relationship where fromId in (select toId from entity_relationship where fromId = :fromDomainId and fromEntity = 'domain' and relation = 10) AND toId in (select toId from entity_relationship where fromId = :toDomainId and fromEntity = 'domain' and relation = 10) and relation = 13")
    Integer countDomainChildAssets(
        @BindUUID("fromDomainId") UUID fromDomainId, @BindUUID("toDomainId") UUID toId);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.toId WHERE er1.relation = 10 AND er1.fromEntity = 'dataProduct' AND er2.fromId = :fromId AND er2.fromEntity = :fromEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findDownstreamDataProducts(
        @BindUUID("fromId") UUID fromId, @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.fromId WHERE er1.relation = 10 AND er1.fromEntity = 'dataProduct' AND er2.toId = :toId AND er2.toEntity = :toEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findUpstreamDataProducts(
        @BindUUID("toId") UUID toId, @Bind("toEntity") String toEntity);

    @SqlQuery(
        "select count(*) from entity_relationship where fromId in (select toId from entity_relationship where fromId = :fromDataProductId and fromEntity = 'dataProduct' and relation = 10) AND toId in (select toId from entity_relationship where fromId = :toDataProductId and fromEntity = 'dataProduct' and relation = 10) and relation = 13")
    Integer countDataProductsChildAssets(
        @BindUUID("fromDataProductId") UUID fromDataProductId,
        @BindUUID("toDataProductId") UUID toDataProductId);

    default List<EntityRelationshipRecord> findTo(UUID fromId, String fromEntity, int relation) {
      return findTo(fromId, fromEntity, List.of(relation));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchByFromAndToEntityInternal(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType,
        @Bind("toEntityType") String toEntityType);

    default List<EntityRelationshipObject> findToBatch(
        List<String> fromIds, int relation, String fromEntityType, String toEntityType) {
      return EntityDAO.queryInChunks(
          fromIds,
          chunk ->
              findToBatchByFromAndToEntityInternal(chunk, relation, fromEntityType, toEntityType));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchByToEntityInternal(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Bind("toEntityType") String toEntityType);

    default List<EntityRelationshipObject> findToBatch(
        List<String> fromIds, int relation, String toEntityType) {
      return EntityDAO.queryInChunks(
          fromIds, chunk -> findToBatchByToEntityInternal(chunk, relation, toEntityType));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "AND toEntity = :toEntityType "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchWithCondition(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Bind("toEntityType") String toEntityType,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findToBatch(
        List<String> fromIds, int relation, String toEntityType, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          fromIds, chunk -> findToBatchWithCondition(chunk, relation, toEntityType, condition));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType "
            + "AND toEntity = :toEntityType "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchWithCondition(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType,
        @Bind("toEntityType") String toEntityType,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findToBatch(
        List<String> fromIds,
        String fromEntityType,
        String toEntityType,
        int relation,
        Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          fromIds,
          chunk ->
              findToBatchWithCondition(chunk, relation, fromEntityType, toEntityType, condition));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchAllTypesWithCondition(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findToBatchAllTypes(
        List<String> fromIds, int relation, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          fromIds, chunk -> findToBatchAllTypesWithCondition(chunk, relation, condition));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation IN (<relations>) "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchAllTypesWithRelationsCondition(
        @BindList("fromIds") List<String> fromIds,
        @BindList("relations") List<Integer> relations,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findToBatchAllTypes(
        List<String> fromIds, List<Integer> relations, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          fromIds, chunk -> findToBatchAllTypesWithRelationsCondition(chunk, relations, condition));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND fromEntity = :fromEntity "
            + "AND relation IN (<relations>) "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatchWithRelationsAndCondition(
        @BindList("fromIds") List<String> fromIds,
        @Bind("fromEntity") String fromEntity,
        @BindList("relations") List<Integer> relations,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findToBatchWithRelations(
        List<String> fromIds, String fromEntity, List<Integer> relations, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          fromIds,
          chunk -> findToBatchWithRelationsAndCondition(chunk, fromEntity, relations, condition));
    }

    default List<EntityRelationshipObject> findToBatchWithRelations(
        List<String> fromIds, String fromEntity, List<Integer> relations) {
      return findToBatchWithRelations(fromIds, fromEntity, relations, Include.ALL);
    }

    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findTo(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT toId FROM entity_relationship  "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<UUID> findToIds(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT COUNT(*) FROM entity_relationship "
            + "WHERE fromId = :fromId AND toId = :toId AND fromEntity = :fromEntity AND toEntity = :toEntity AND relation = :relation")
    int existsRelationship(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromId, COUNT(toId) FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity "
            + "GROUP BY fromId")
    @RegisterRowMapper(ToRelationshipCountMapper.class)
    List<EntityRelationshipCount> countFindTo(
        @BindList("fromIds") List<String> fromIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromEntity = :fromEntity AND toEntity = :toEntity AND relation = :relation")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findAllByEntityTypes(
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT CASE WHEN relationType = '' THEN 'relatedTo' ELSE relationType END AS relationType, "
            + "COUNT(*) AS cnt FROM entity_relationship "
            + "WHERE fromEntity = :fromEntity AND toEntity = :toEntity AND relation = :relation "
            + "GROUP BY CASE WHEN relationType = '' THEN 'relatedTo' ELSE relationType END")
    @RegisterRowMapper(RelationTypeUsageCountMapper.class)
    List<RelationTypeUsageCount> countByRelationType(
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT COUNT(toId) FROM entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation IN (<relation>)")
    @RegisterRowMapper(ToRelationshipMapper.class)
    int countFindTo(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindList("relation") List<Integer> relation);

    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation IN (<relation>) ORDER BY toId LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findToWithOffset(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindList("relation") List<Integer> relation,
        @Bind("offset") int offset,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, json FROM entity_relationship "
                + "WHERE (JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) =:fromId OR fromId = :fromId) AND relation = :relation "
                + "ORDER BY toId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, json FROM entity_relationship "
                + "WHERE  (json->'pipeline'->>'id' =:fromId OR fromId = :fromId) AND relation = :relation "
                + "ORDER BY toId",
        connectionType = POSTGRES)
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findToPipeline(
        @BindUUID("fromId") UUID fromId, @Bind("relation") int relation);

    //
    // Find from operations
    //
    @SqlQuery(
        "SELECT fromId, fromEntity, json FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation AND fromEntity = :fromEntity ")
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFrom(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchByRelationInternal(
        @BindList("toIds") List<String> toIds, @Bind("relation") int relation);

    default List<EntityRelationshipObject> findFromBatch(List<String> toIds, int relation) {
      return EntityDAO.queryInChunks(
          toIds, chunk -> findFromBatchByRelationInternal(chunk, relation));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchWithCondition(
        @BindList("toIds") List<String> toIds,
        @Bind("relation") int relation,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findFromBatch(
        List<String> toIds, int relation, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          toIds, chunk -> findFromBatchWithCondition(chunk, relation, condition));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchWithEntityTypeAndCondition(
        @BindList("toIds") List<String> toIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findFromBatch(
        List<String> toIds, int relation, String fromEntityType, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          toIds,
          chunk ->
              findFromBatchWithEntityTypeAndCondition(chunk, relation, fromEntityType, condition));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND toEntity = :toEntityType "
            + "AND relation IN (<relations>) "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchWithRelationsAndCondition(
        @BindList("toIds") List<String> toIds,
        @Bind("toEntityType") String toEntityType,
        @BindList("relations") List<Integer> relations,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findFromBatchWithRelations(
        List<String> toIds, String toEntityType, List<Integer> relations, Include include) {
      String condition = deletedCondition(include);
      return EntityDAO.queryInChunks(
          toIds,
          chunk ->
              findFromBatchWithRelationsAndCondition(chunk, toEntityType, relations, condition));
    }

    default List<EntityRelationshipObject> findFromBatchWithRelations(
        List<String> toIds, String toEntityType, List<Integer> relations) {
      return findFromBatchWithRelations(toIds, toEntityType, relations, Include.ALL);
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType  "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchByFromEntityInternal(
        @BindList("toIds") List<String> toIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType);

    default List<EntityRelationshipObject> findFromBatch(
        List<String> toIds, int relation, String fromEntityType) {
      return EntityDAO.queryInChunks(
          toIds, chunk -> findFromBatchByFromEntityInternal(chunk, relation, fromEntityType));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchByToEntityInternal(
        @BindList("toIds") List<String> toIds,
        @Bind("toEntityType") String toEntityType,
        @Bind("relation") int relation);

    default List<EntityRelationshipObject> findFromBatch(
        List<String> toIds, String toEntityType, int relation) {
      return EntityDAO.queryInChunks(
          toIds, chunk -> findFromBatchByToEntityInternal(chunk, toEntityType, relation));
    }

    @SqlQuery(
        "SELECT fromId, fromEntity, json FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation")
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFrom(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    // Fetch relationships for specific relation types (TO direction: others -> entity)
    // Used for owners, followers, domains, dataProducts, reviewers
    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId = :entityId AND toEntity = :entityType "
            + "AND relation IN (<relations>) "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToRelationshipsForEntityWithCondition(
        @BindUUID("entityId") UUID entityId,
        @Bind("entityType") String entityType,
        @BindList("relations") List<Integer> relations,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findToRelationshipsForEntity(
        UUID entityId, String entityType, List<Integer> relations, Include include) {
      String condition = deletedCondition(include);
      return findToRelationshipsForEntityWithCondition(entityId, entityType, relations, condition);
    }

    default List<EntityRelationshipObject> findToRelationshipsForEntity(
        UUID entityId, String entityType, List<Integer> relations) {
      return findToRelationshipsForEntity(entityId, entityType, relations, Include.ALL);
    }

    // Fetch relationships for specific relation types (FROM direction: entity -> others)
    // Used for children, experts
    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId = :entityId AND fromEntity = :entityType "
            + "AND relation IN (<relations>) "
            + "<cond>")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromRelationshipsForEntityWithCondition(
        @BindUUID("entityId") UUID entityId,
        @Bind("entityType") String entityType,
        @BindList("relations") List<Integer> relations,
        @Define("cond") String condition);

    default List<EntityRelationshipObject> findFromRelationshipsForEntity(
        UUID entityId, String entityType, List<Integer> relations, Include include) {
      String condition = deletedCondition(include);
      return findFromRelationshipsForEntityWithCondition(
          entityId, entityType, relations, condition);
    }

    default List<EntityRelationshipObject> findFromRelationshipsForEntity(
        UUID entityId, String entityType, List<Integer> relations) {
      return findFromRelationshipsForEntity(entityId, entityType, relations, Include.ALL);
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatchByFromAndToEntityInternal(
        @BindList("toIds") List<String> toIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType,
        @Bind("toEntityType") String toEntityType);

    default List<EntityRelationshipObject> findFromBatch(
        List<String> toIds, int relation, String fromEntityType, String toEntityType) {
      return EntityDAO.queryInChunks(
          toIds,
          chunk ->
              findFromBatchByFromAndToEntityInternal(
                  chunk, relation, fromEntityType, toEntityType));
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT fromId, fromEntity, json FROM entity_relationship "
                + "WHERE (JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) = :toId OR toId = :toId) AND relation = :relation "
                + "ORDER BY fromId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT fromId, fromEntity, json FROM entity_relationship "
                + "WHERE  (json->'pipeline'->>'id' = :toId OR toId = :toId) AND relation = :relation "
                + "ORDER BY fromId",
        connectionType = POSTGRES)
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFromPipeline(
        @BindUUID("toId") UUID toId, @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source AND (toId = :toId AND toEntity = :toEntity) "
                + "AND relation = :relation ORDER BY fromId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE  json->>'source' = :source AND (toId = :toId AND toEntity = :toEntity) "
                + "AND relation = :relation ORDER BY fromId",
        connectionType = POSTGRES)
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findLineageBySource(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("source") String source,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE (JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) =:toId OR toId = :toId) AND relation = :relation "
                + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source ORDER BY toId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE (json->'pipeline'->>'id' =:toId OR toId = :toId) AND relation = :relation "
                + "AND json->>'source' = :source ORDER BY toId",
        connectionType = POSTGRES)
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findLineageBySourcePipeline(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("source") String source,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT count(*) FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity")
    int findIfAnyRelationExist(
        @Bind("fromEntity") String fromEntity, @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT json FROM entity_relationship WHERE fromId = :fromId "
            + " AND toId = :toId "
            + " AND relation = :relation ")
    String getRelation(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship WHERE fromId = :fromId "
            + " AND toId = :toId "
            + " AND relation = :relation ")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    EntityRelationshipObject getRecord(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship where relation = :relation ORDER BY fromId, toId LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> getRecordWithOffset(
        @Bind("relation") int relation, @Bind("offset") long offset, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship ORDER BY fromId, toId LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> getAllRelationshipsPaginated(
        @Bind("offset") long offset, @Bind("limit") int limit);

    @SqlQuery("SELECT COUNT(*) FROM entity_relationship")
    long getTotalRelationshipCount();

    //
    // Delete Operations
    //
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId "
            + "AND fromEntity = :fromEntity AND toId = :toId AND toEntity = :toEntity "
            + "AND relation = :relation")
    int delete(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "AND relationType = :relationType")
    int deleteWithRelationType(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("relationType") String relationType);

    // Delete all the entity relationship fromID --- relation --> entity of type toEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation = :relation AND toEntity = :toEntity")
    void deleteFrom(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    // Delete all the entity relationship toId <-- relation --  entity of type fromEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "AND fromEntity = :fromEntity")
    void deleteTo(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlUpdate(
        "DELETE from entity_relationship WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation")
    void deleteTo(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE toId IN (<toIds>) "
            + "AND toEntity = :toEntity AND relation = :relation AND fromEntity = :fromEntity")
    void deleteToMany(
        @BindList("toIds") List<String> toIds,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE toId IN (<toIds>) "
            + "AND toEntity = :toEntity AND relation = :relation")
    void deleteToMany(
        @BindList("toIds") List<String> toIds,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE fromId IN (<fromIds>) "
            + "AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity")
    void deleteFromMany(
        @BindList("fromIds") List<String> fromIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE fromId IN (<fromIds>) "
            + "AND fromEntity = :fromEntity AND relation = :relation")
    void deleteFromMany(
        @BindList("fromIds") List<String> fromIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation);

    // Optimized deleteAll implementation that splits OR query for better performance
    @Transaction
    default void deleteAll(UUID id, String entity) {
      // Split OR query into two separate deletes for better index usage
      deleteAllFrom(id, entity);
      deleteAllTo(id, entity);
    }

    @SqlUpdate("DELETE FROM entity_relationship WHERE fromId = :id AND fromEntity = :entity")
    void deleteAllFrom(@BindUUID("id") UUID id, @Bind("entity") String entity);

    @SqlUpdate("DELETE FROM entity_relationship WHERE toId = :id AND toEntity = :entity")
    void deleteAllTo(@BindUUID("id") UUID id, @Bind("entity") String entity);

    // Batch deletion methods for improved performance
    @Transaction
    default void batchDeleteRelationships(List<UUID> entityIds, String entityType) {
      if (entityIds == null || entityIds.isEmpty()) {
        return;
      }

      // Process in chunks of 500 to avoid hitting database query limits
      int batchSize = 500;
      for (int i = 0; i < entityIds.size(); i += batchSize) {
        int endIndex = Math.min(i + batchSize, entityIds.size());
        List<String> batch =
            entityIds.subList(i, endIndex).stream()
                .map(UUID::toString)
                .collect(Collectors.toList());

        batchDeleteFrom(batch, entityType);
        batchDeleteTo(batch, entityType);
      }
    }

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE fromId IN (<ids>) AND fromEntity = :entityType")
    void batchDeleteFrom(@BindList("ids") List<String> ids, @Bind("entityType") String entityType);

    @SqlUpdate("DELETE FROM entity_relationship WHERE toId IN (<ids>) AND toEntity = :entityType")
    void batchDeleteTo(@BindList("ids") List<String> ids, @Bind("entityType") String entityType);

    @SqlUpdate(
        "DELETE FROM entity_relationship "
            + "WHERE (toId IN (<ids>) AND toEntity = :entity) "
            + "   OR (fromId IN (<ids>) AND fromEntity = :entity)")
    void deleteAllByThreadIds(@BindList("ids") List<String> ids, @Bind("entity") String entity);

    @SqlUpdate("DELETE from entity_relationship WHERE fromId = :id or toId = :id")
    void deleteAllWithId(@BindUUID("id") UUID id);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source AND toId = :toId AND toEntity = :toEntity "
                + "AND relation = :relation",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE  json->>'source' = :source AND (toId = :toId AND toEntity = :toEntity) "
                + "AND relation = :relation",
        connectionType = POSTGRES)
    void deleteLineageBySource(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("source") String source,
        @Bind("relation") int relation);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE (JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) =:toId OR toId = :toId) AND relation = :relation "
                + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source ORDER BY toId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE (json->'pipeline'->>'id' =:toId OR toId = :toId) AND relation = :relation "
                + "AND json->>'source' = :source",
        connectionType = POSTGRES)
    void deleteLineageBySourcePipeline(
        @BindUUID("toId") UUID toId, @Bind("source") String source, @Bind("relation") int relation);

    class FromRelationshipMapper implements RowMapper<EntityRelationshipRecord> {
      @Override
      public EntityRelationshipRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipRecord.builder()
            .id(UUID.fromString(rs.getString("fromId")))
            .type(rs.getString("fromEntity"))
            .json(rs.getString("json"))
            .build();
      }
    }

    class ToRelationshipMapper implements RowMapper<EntityRelationshipRecord> {
      @Override
      public EntityRelationshipRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipRecord.builder()
            .id(UUID.fromString(rs.getString("toId")))
            .type(rs.getString("toEntity"))
            .json(rs.getString("json"))
            .build();
      }
    }

    class ToRelationshipCountMapper implements RowMapper<EntityRelationshipCount> {
      @Override
      public EntityRelationshipCount map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipCount.builder()
            .id(UUID.fromString(rs.getString(1)))
            .count(rs.getInt(2))
            .build();
      }
    }

    class RelationTypeUsageCountMapper implements RowMapper<RelationTypeUsageCount> {
      @Override
      public RelationTypeUsageCount map(ResultSet rs, StatementContext ctx) throws SQLException {
        return RelationTypeUsageCount.builder()
            .relationType(rs.getString("relationType"))
            .count(rs.getInt("cnt"))
            .build();
      }
    }

    class RelationshipObjectMapper implements RowMapper<EntityRelationshipObject> {
      @Override
      public EntityRelationshipObject map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipObject.builder()
            .fromId(rs.getString("fromId"))
            .fromEntity(rs.getString("fromEntity"))
            .toEntity(rs.getString("toEntity"))
            .toId(rs.getString("toId"))
            .relation(rs.getInt("relation"))
            .json(rs.getString("json"))
            .jsonSchema(rs.getString("jsonSchema"))
            .build();
      }
    }
  }

  interface FieldRelationshipDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, (:json :: jsonb)) "
                + "ON CONFLICT (fromFQNHash, toFQNHash, relation) DO NOTHING",
        connectionType = POSTGRES)
    void insert(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, :json) "
                + "ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (fromFQNHash, toFQNHash, relation) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void upsert(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlQuery(
        "SELECT json FROM field_relationship WHERE "
            + "fromFQNHash = :fromFQNHash AND toFQNHash = :toFQNHash AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    String find(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, fromType, json FROM field_relationship WHERE "
            + "toFQNHash = :toFQNHash AND toType = :toType AND relation = :relation")
    @RegisterRowMapper(FromFieldMapper.class)
    List<Triple<String, String, String>> findFrom(
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQNHash LIKE :concatFqnPrefixHash AND fromType = :fromType AND toType = :toType "
            + "AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listToByPrefix(
        @BindConcat(
                value = "concatFqnPrefixHash",
                parts = {":fqnPrefixHash", "%"},
                hash = true)
            String fqnPrefixHash,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @Deprecated(since = "Release 1.1")
    @SqlQuery(
        "SELECT DISTINCT fromFQN, toFQN FROM field_relationship WHERE fromFQNHash = '' or fromFQNHash is null or toFQNHash = '' or toFQNHash is null LIMIT :limit")
    @RegisterRowMapper(FieldRelationShipMapper.class)
    List<Pair<String, String>> migrationListDistinctWithOffset(@Bind("limit") int limit);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQNHash = :fqnHash AND fromType = :type AND toType = :otherType AND relation = :relation "
            + "UNION "
            + "SELECT toFQN, fromFQN, json FROM field_relationship WHERE "
            + "toFQNHash = :fqnHash AND toType = :type AND fromType = :otherType AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listBidirectional(
        @BindFQN("fqnHash") String fqnHash,
        @Bind("type") String type,
        @Bind("otherType") String otherType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQNHash LIKE :concatFqnPrefixHash AND fromType = :type AND toType = :otherType AND relation = :relation "
            + "UNION "
            + "SELECT toFQN, fromFQN, json FROM field_relationship WHERE "
            + "toFQNHash LIKE :concatFqnPrefixHash AND toType = :type AND fromType = :otherType AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listBidirectionalByPrefix(
        @BindConcat(
                value = "concatFqnPrefixHash",
                parts = {":fqnPrefixHash", "%"},
                hash = true)
            String fqnPrefixHash,
        @Bind("type") String type,
        @Bind("otherType") String otherType,
        @Bind("relation") int relation);

    default void deleteAllByPrefix(String fqn) {
      String prefix = String.format("%s%s%%", FullyQualifiedName.buildHash(fqn), Entity.SEPARATOR);
      String condition = "WHERE (toFQNHash LIKE :prefix OR fromFQNHash LIKE :prefix)";
      Map<String, String> bindMap = new HashMap<>();
      bindMap.put("prefix", prefix);
      deleteAllByPrefixInternal(condition, bindMap);
    }

    default void deleteAllByPrefixes(List<String> threadIds) {
      for (String threadId : threadIds) {
        deleteAllByPrefix(threadId);
      }
    }

    @SqlUpdate("DELETE from field_relationship <cond>")
    void deleteAllByPrefixInternal(
        @Define("cond") String cond, @BindMap Map<String, String> bindings);

    @SqlUpdate(
        "DELETE from field_relationship WHERE fromFQNHash = :fromFQNHash AND toFQNHash = :toFQNHash AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    void delete(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    default void renameByToFQN(String oldToFQN, String newToFQN) {
      renameByToFQNInternal(
          oldToFQN,
          FullyQualifiedName.buildHash(oldToFQN),
          newToFQN,
          FullyQualifiedName.buildHash(newToFQN)); // First rename targetFQN from oldFQN to newFQN
      renameByToFQNPrefix(oldToFQN, newToFQN);
      // Rename all the targetFQN prefixes starting with the oldFQN to newFQN
    }

    @SqlUpdate(
        "Update field_relationship set toFQN  = :newToFQN , toFQNHash  = :newToFQNHash "
            + "where fromtype = 'THREAD' AND relation='3' AND toFQN = :oldToFQN and toFQNHash =:oldToFQNHash ;")
    void renameByToFQNInternal(
        @Bind("oldToFQN") String oldToFQN,
        @Bind("oldToFQNHash") String oldToFQNHash,
        @Bind("newToFQN") String newToFQN,
        @Bind("newToFQNHash") String newToFQNHash);

    default void renameByToFQNPrefix(String oldToFQNPrefix, String newToFQNPrefix) {
      String update =
          String.format(
              "UPDATE field_relationship SET toFQN  = REPLACE(toFQN, '%s.', '%s.') , toFQNHash  = REPLACE(toFQNHash, '%s.', '%s.') where fromtype = 'THREAD' AND relation='3' AND  toFQN like '%s.%%' and toFQNHash like '%s.%%' ",
              escapeApostrophe(oldToFQNPrefix),
              escapeApostrophe(newToFQNPrefix),
              FullyQualifiedName.buildHash(oldToFQNPrefix),
              FullyQualifiedName.buildHash(newToFQNPrefix),
              escapeApostrophe(oldToFQNPrefix),
              FullyQualifiedName.buildHash(oldToFQNPrefix));
      renameByToFQNPrefixInternal(update);
    }

    @SqlUpdate("<update>")
    void renameByToFQNPrefixInternal(@Define("update") String update);

    class FromFieldMapper implements RowMapper<Triple<String, String, String>> {
      @Override
      public Triple<String, String, String> map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return Triple.of(rs.getString("fromFQN"), rs.getString("fromType"), rs.getString("json"));
      }
    }

    class ToFieldMapper implements RowMapper<Triple<String, String, String>> {
      @Override
      public Triple<String, String, String> map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return Triple.of(rs.getString("fromFQN"), rs.getString("toFQN"), rs.getString("json"));
      }
    }

    class FieldRelationShipMapper implements RowMapper<Pair<String, String>> {
      @Override
      public Pair<String, String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Pair.of(rs.getString("fromFQN"), rs.getString("toFQN"));
      }
    }

    @Getter
    @Setter
    class FieldRelationship {
      private String fromFQNHash;
      private String toFQNHash;
      private String fromFQN;
      private String toFQN;
      private String fromType;
      private String toType;
      private int relation;
      private String jsonSchema;
      private String json;
    }
  }
}
