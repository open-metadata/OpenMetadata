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

import static org.openmetadata.schema.type.Relationship.CONTAINS;
import static org.openmetadata.service.jdbi3.ListFilter.escapeApostrophe;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.statement.UseRowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelMapper;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindConcat;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindListFQN;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface ClassificationTagDAOs {
  @CreateSqlObject
  ClassificationDAO classificationDAO();

  @CreateSqlObject
  TagDAO tagDAO();

  @CreateSqlObject
  TagUsageDAO tagUsageDAO();

  interface ClassificationDAO extends EntityDAO<Classification> {
    @Override
    default String getTableName() {
      return "classification";
    }

    @Override
    default Class<Classification> getEntityClass() {
      return Classification.class;
    }

    // Much more efficient: Use IN clause with proper index usage
    @SqlQuery(
        "SELECT classificationHash, COUNT(*) AS termCount "
            + "FROM tag "
            + "WHERE classificationHash IN (<hashArray>) "
            + "AND deleted = FALSE "
            + "GROUP BY classificationHash")
    @RegisterRowMapper(TermCountMapper.class)
    List<Pair<String, Integer>> bulkGetTermCounts(@BindList("hashArray") List<String> hashArray);

    class TermCountMapper implements RowMapper<Pair<String, Integer>> {
      @Override
      public Pair<String, Integer> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Pair.of(rs.getString("classificationHash"), rs.getInt("termCount"));
      }
    }
  }

  interface TagDAO extends EntityDAO<Tag> {
    @Override
    default String getTableName() {
      return "tag";
    }

    @Override
    default Class<Tag> getEntityClass() {
      return Tag.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    private Pair<String, String> buildTagQueryConditions(ListFilter filter) {
      String parent = filter.getQueryParam("parent");
      boolean disabled = Boolean.parseBoolean(filter.getQueryParam("classification.disabled"));

      String baseJoin =
          String.format(
              "INNER JOIN entity_relationship er ON tag.id=er.toId AND er.relation=%s AND er.fromEntity='%s' "
                  + "INNER JOIN classification c ON er.fromId=c.id",
              CONTAINS.ordinal(), Entity.CLASSIFICATION);

      StringBuilder mySqlCondition = new StringBuilder(baseJoin);
      StringBuilder postgresCondition = new StringBuilder(baseJoin);

      if (parent != null) {
        String parentFqnHash = FullyQualifiedName.buildHash(parent);
        filter.queryParams.put("parentFqnPrefix", parentFqnHash + ".%");
        mySqlCondition.append(" AND tag.fqnHash LIKE :parentFqnPrefix");
        postgresCondition.append(" AND tag.fqnHash LIKE :parentFqnPrefix");
      }

      if (disabled) {
        mySqlCondition.append(
            " AND (JSON_EXTRACT(c.json, '$.disabled') = TRUE OR JSON_EXTRACT(tag.json, '$.disabled') = TRUE)");
        postgresCondition.append(
            " AND (COALESCE((c.json->>'disabled')::boolean, FALSE) = TRUE OR COALESCE((tag.json->>'disabled')::boolean, FALSE) = TRUE)");
      } else if (filter.getQueryParam("classification.disabled") != null) {
        mySqlCondition.append(
            " AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = FALSE) AND (JSON_EXTRACT(tag.json, '$.disabled') IS NULL OR JSON_EXTRACT(tag.json, '$.disabled') = FALSE)");
        postgresCondition.append(
            " AND COALESCE((c.json->>'disabled')::boolean, FALSE) = FALSE AND COALESCE((tag.json->>'disabled')::boolean, FALSE) = FALSE");
      }

      String tagCondition = filter.getCondition("tag");
      if (!tagCondition.isEmpty()) {
        mySqlCondition.append(" ").append(tagCondition);
        postgresCondition.append(" ").append(tagCondition);
      }

      return Pair.of(mySqlCondition.toString(), postgresCondition.toString());
    }

    @Override
    default int listCount(ListFilter filter) {
      Pair<String, String> conditions = buildTagQueryConditions(filter);
      return listCount(
          getTableName(),
          getNameHashColumn(),
          filter.getQueryParams(),
          conditions.getLeft(),
          conditions.getRight());
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      Pair<String, String> conditions = buildTagQueryConditions(filter);
      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          conditions.getLeft(),
          conditions.getRight(),
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      Pair<String, String> conditions = buildTagQueryConditions(filter);
      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          conditions.getLeft(),
          conditions.getRight(),
          limit,
          afterName,
          afterId);
    }

    @SqlQuery("select json FROM tag where fqnhash LIKE :concatFqnhash")
    List<String> getTagsStartingWithPrefix(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE tag SET json = JSON_SET(json, '$.recognizers', CAST(:recognizers AS JSON)) "
                + "WHERE JSON_EXTRACT(json, '$.fullyQualifiedName') = :tagFqn",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE tag SET json = json::jsonb || json_build_object("
                + "'recognizers', :recognizers::jsonb "
                + ")::jsonb WHERE json->>'fullyQualifiedName' = :tagFqn",
        connectionType = POSTGRES)
    void patchRecognizers(@Bind("tagFqn") String tagFqn, @Bind("recognizers") String recognizers);
  }

  @RegisterRowMapper(TagLabelMapper.class)
  interface TagUsageDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, reason, appliedBy, metadata) VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :reason, :appliedBy, :metadata)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, reason, appliedBy, metadata) VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :reason, :appliedBy, :metadata :: jsonb) ON CONFLICT (source, tagFQNHash, targetFQNHash) DO NOTHING",
        connectionType = POSTGRES)
    void applyTag(
        @Bind("source") int source,
        @Bind("tagFQN") String tagFQN,
        @BindFQN("tagFQNHash") String tagFQNHash,
        @BindFQN("targetFQNHash") String targetFQNHash,
        @Bind("labelType") int labelType,
        @Bind("state") int state,
        @Bind("reason") String reason,
        @Bind("appliedBy") String appliedBy,
        @Bind("metadata") String metadata);

    default void applyTag(
        int source,
        String tagFQN,
        String tagFQNHash,
        String targetFQNHash,
        int labelType,
        int state,
        String reason,
        String appliedBy,
        TagLabelMetadata metadata) {
      this.applyTag(
          source,
          tagFQN,
          tagFQNHash,
          targetFQNHash,
          labelType,
          state,
          reason,
          appliedBy,
          JsonUtils.pojoToJson(metadata));
    }

    default void applyTag(
        int source,
        String tagFQN,
        String tagFQNHash,
        String targetFQNHash,
        int labelType,
        int state,
        String reason,
        String appliedBy) {
      this.applyTag(
          source,
          tagFQN,
          tagFQNHash,
          targetFQNHash,
          labelType,
          state,
          reason,
          appliedBy,
          (String) null);
    }

    default List<TagLabel> getTags(String targetFQN) {
      List<TagLabel> tags = getTagsInternal(targetFQN);
      tags.forEach(TagLabelUtil::applyTagCommonFieldsGracefully);
      return tags;
    }

    default Map<String, List<TagLabel>> getTagsByPrefix(
        String targetFQNPrefix, String postfix, boolean requiresFqnHash) {
      String targetFQNPrefixHash =
          requiresFqnHash ? FullyQualifiedName.buildHash(targetFQNPrefix) : targetFQNPrefix;
      Map<String, List<TagLabel>> resultSet = new LinkedHashMap<>();
      List<Pair<String, TagLabel>> tags = getTagsInternalByPrefix(targetFQNPrefixHash, postfix);
      tags.forEach(
          pair -> {
            String targetHash = pair.getLeft();
            TagLabel tagLabel = pair.getRight();
            List<TagLabel> listOfTarget = new ArrayList<>();
            if (resultSet.containsKey(targetHash)) {
              listOfTarget = resultSet.get(targetHash);
              listOfTarget.add(tagLabel);
            } else {
              listOfTarget.add(tagLabel);
            }
            resultSet.put(targetHash, listOfTarget);
          });
      return resultSet;
    }

    @SqlQuery(
        "SELECT source, tagFQN,  labelType, state, reason, appliedAt, appliedBy, metadata FROM tag_usage WHERE targetFQNHash = :targetFQNHash ORDER BY tagFQN")
    List<TagLabel> getTagsInternal(@BindFQN("targetFQNHash") String targetFQNHash);

    @SqlQuery(
        "SELECT targetFQNHash, source, tagFQN, labelType, state, reason, appliedAt, appliedBy, metadata "
            + "FROM tag_usage "
            + "WHERE targetFQNHash IN (<targetFQNHashes>) "
            + "ORDER BY targetFQNHash, tagFQN")
    @UseRowMapper(TagLabelWithFQNHashMapper.class)
    List<TagLabelWithFQNHash> getTagsInternalBatch(
        @BindListFQN("targetFQNHashes") List<String> targetFQNHashes);

    @SqlQuery(
        "SELECT targetFQNHash, source, tagFQN, labelType, state, reason, appliedAt, appliedBy, metadata "
            + "FROM tag_usage "
            + "WHERE source = :source "
            + "AND targetFQNHash IN (<targetFQNHashes>) "
            + "AND tagFQNHash LIKE :tagFQNHashPrefix "
            + "ORDER BY targetFQNHash, tagFQN")
    @UseRowMapper(TagLabelWithFQNHashMapper.class)
    List<TagLabelWithFQNHash> getCertTagsInternalBatch(
        @Bind("source") int source,
        @BindListFQN("targetFQNHashes") List<String> targetFQNHashes,
        @Bind("tagFQNHashPrefix") String tagFQNHashPrefix);

    /**
     * Batch fetch derived tags for multiple glossary term FQNs. Returns a map from glossary term
     * FQN to its derived tags (tags that target that glossary term).
     */
    default Map<String, List<TagLabel>> getDerivedTagsBatch(List<String> glossaryTermFqns) {
      if (glossaryTermFqns == null || glossaryTermFqns.isEmpty()) {
        return Collections.emptyMap();
      }
      List<TagLabelWithFQNHash> tagUsages = getTagsInternalBatch(glossaryTermFqns);
      Map<String, List<TagLabel>> result = new HashMap<>();

      for (TagLabelWithFQNHash usage : tagUsages) {
        String targetFqn = usage.getTargetFQNHash();
        TagLabel tagLabel =
            new TagLabel()
                .withSource(TagLabel.TagSource.values()[usage.getSource()])
                .withTagFQN(usage.getTagFQN())
                .withLabelType(TagLabel.LabelType.DERIVED)
                .withState(TagLabel.State.values()[usage.getState()])
                .withReason(usage.getReason())
                .withAppliedAt(usage.toTagLabel().getAppliedAt());
        if (usage.getReason() != null) {
          tagLabel.withReason(usage.getReason());
        }
        TagLabelUtil.applyTagCommonFieldsGracefully(tagLabel);
        result.computeIfAbsent(targetFqn, k -> new ArrayList<>()).add(tagLabel);
      }
      return result;
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT tu.source, tu.tagFQN, tu.labelType, tu.targetFQNHash, tu.state, tu.reason, tu.appliedAt, tu.appliedBy, tu.metadata, "
                + "CASE "
                + "  WHEN tu.source = 1 THEN gterm.json "
                + "  WHEN tu.source = 0 THEN ta.json "
                + "END as json "
                + "FROM tag_usage tu "
                + "LEFT JOIN glossary_term_entity gterm ON tu.source = 1 AND gterm.fqnHash = tu.tagFQNHash "
                + "LEFT JOIN tag ta ON tu.source = 0 AND ta.fqnHash = tu.tagFQNHash "
                + "WHERE tu.targetfqnhash_lower LIKE LOWER(:targetFQNHash)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT tu.source, tu.tagFQN, tu.labelType, tu.targetFQNHash, tu.state, tu.reason, tu.appliedAt, tu.appliedBy, tu.metadata, "
                + "CASE "
                + "  WHEN tu.source = 1 THEN gterm.json "
                + "  WHEN tu.source = 0 THEN ta.json "
                + "END as json "
                + "FROM tag_usage tu "
                + "LEFT JOIN glossary_term_entity gterm ON tu.source = 1 AND gterm.fqnHash = tu.tagFQNHash "
                + "LEFT JOIN tag ta ON tu.source = 0 AND ta.fqnHash = tu.tagFQNHash "
                + "WHERE tu.targetfqnhash_lower LIKE LOWER(:targetFQNHash)",
        connectionType = POSTGRES)
    @RegisterRowMapper(TagLabelRowMapperWithTargetFqnHash.class)
    List<Pair<String, TagLabel>> getTagsInternalByPrefix(
        @BindConcat(
                value = "targetFQNHash",
                parts = {":targetFQNHashPrefix", ":postfix"})
            String... targetFQNHash);

    @SqlQuery(
        "SELECT tu.source, tu.tagFQN, tu.labelType, tu.targetFQNHash, tu.state, tu.reason, tu.appliedAt, tu.appliedBy, tu.metadata, "
            + "CASE "
            + "  WHEN tu.source = 1 THEN gterm.json "
            + "  WHEN tu.source = 0 THEN ta.json "
            + "END as json "
            + "FROM tag_usage tu "
            + "LEFT JOIN glossary_term_entity gterm ON tu.source = 1 AND gterm.fqnHash = tu.tagFQNHash "
            + "LEFT JOIN tag ta ON tu.source = 0 AND ta.fqnHash = tu.tagFQNHash "
            + "WHERE tu.targetFQNHash IN (<targetFQNHashes>)")
    @RegisterRowMapper(TagLabelRowMapperWithTargetFqnHash.class)
    List<Pair<String, TagLabel>> getTagsInternalByTargetHashes(
        @BindList("targetFQNHashes") List<String> targetFQNHashes);

    int TAG_BATCH_CHUNK_SIZE = 1000;

    default Map<String, List<TagLabel>> getTagsByTargetFQNHashes(List<String> targetFQNHashes) {
      Map<String, List<TagLabel>> resultSet = new LinkedHashMap<>();
      if (targetFQNHashes == null || targetFQNHashes.isEmpty()) {
        return resultSet;
      }
      for (int i = 0; i < targetFQNHashes.size(); i += TAG_BATCH_CHUNK_SIZE) {
        List<String> chunk =
            targetFQNHashes.subList(i, Math.min(i + TAG_BATCH_CHUNK_SIZE, targetFQNHashes.size()));
        for (Pair<String, TagLabel> pair : getTagsInternalByTargetHashes(chunk)) {
          resultSet.computeIfAbsent(pair.getLeft(), k -> new ArrayList<>()).add(pair.getRight());
        }
      }
      return resultSet;
    }

    @SqlQuery("SELECT * FROM tag_usage")
    @Deprecated(since = "Release 1.1")
    @RegisterRowMapper(TagLabelMapperMigration.class)
    List<TagLabelMigration> listAll();

    @SqlQuery(
        "SELECT COUNT(*) FROM tag_usage "
            + "WHERE (tagFQNHash LIKE :concatTagFQNHash OR tagFQNHash = :tagFqnHash) "
            + "AND source = :source")
    int getTagCount(
        @Bind("source") int source,
        @BindConcat(
                value = "concatTagFQNHash",
                original = "tagFqnHash",
                parts = {":tagFqnHash", ".%"},
                hash = true)
            String tagFqnHash);

    /**
     * Get tag usage counts for multiple tags.
     * This method retrieves counts for exact tag matches and their children in one query.
     */
    @SqlQuery(
        "SELECT tagFQN, count FROM ("
            + "  SELECT ? as tagFQN, COUNT(DISTINCT targetFQNHash) as count "
            + "  FROM tag_usage "
            + "  WHERE source = ? AND (tagFQNHash = MD5(?) OR tagFQNHash LIKE CONCAT(MD5(?), '.%'))"
            + ") t WHERE tagFQN IN (<tagFQNs>)")
    @RegisterRowMapper(TagCountMapper.class)
    @Deprecated
    List<Map.Entry<String, Integer>> getTagCountsBulkComplex(
        @Bind("tagFQN") String sampleTagFQN,
        @Bind("source") int source,
        @Bind("tagFQNHash") String tagFQNHash,
        @Bind("tagFQNHashPrefix") String tagFQNHashPrefix,
        @BindList("tagFQNs") List<String> tagFQNs);

    default Map<String, Integer> getTagCountsBulk(int source, List<String> tagFQNs) {
      if (tagFQNs == null || tagFQNs.isEmpty()) {
        return Collections.emptyMap();
      }

      Map<String, Integer> resultMap = new HashMap<>();

      // Process tags in batches to create a single efficient query
      // We'll use a UNION ALL approach which is more compatible with JDBI
      StringBuilder queryBuilder = new StringBuilder();
      List<String> params = new ArrayList<>();

      for (int i = 0; i < tagFQNs.size(); i++) {
        if (i > 0) {
          queryBuilder.append(" UNION ALL ");
        }
        queryBuilder.append(
            "SELECT ? as tagFQN, COUNT(DISTINCT targetFQNHash) as count "
                + "FROM tag_usage "
                + "WHERE source = ? AND (tagFQNHash = MD5(?) OR tagFQNHash LIKE CONCAT(MD5(?), '.%'))");
        params.add(tagFQNs.get(i)); // tagFQN for selection
        params.add(String.valueOf(source)); // source
        params.add(tagFQNs.get(i)); // tagFQN for MD5
        params.add(tagFQNs.get(i)); // tagFQN for LIKE
      }

      // For now, fall back to individual queries until we have a better solution
      // This ensures correctness while we work on optimization
      for (String tagFQN : tagFQNs) {
        int count = getTagCount(source, tagFQN);
        resultMap.put(tagFQN, count);
      }

      return resultMap;
    }

    @SqlUpdate("DELETE FROM tag_usage where targetFQNHash = :targetFQNHash")
    void deleteTagsByTarget(@BindFQN("targetFQNHash") String targetFQNHash);

    @SqlUpdate(
        "DELETE FROM tag_usage WHERE source = :source AND tagFQN LIKE :tagFQNPrefix AND targetFQNHash = :targetFQNHash")
    void deleteTagsByPrefixAndTarget(
        @Bind("source") int source,
        @Bind("tagFQNPrefix") String tagFQNPrefix,
        @BindFQN("targetFQNHash") String targetFQNHash);

    @SqlUpdate("DELETE FROM tag_usage WHERE targetFQNHash IN (<targetFQNHashes>)")
    void deleteTagsByTargets(@BindListFQN("targetFQNHashes") List<String> targetFQNs);

    @SqlUpdate(
        "DELETE FROM tag_usage WHERE source = :source AND tagFQN LIKE :tagFQNPrefix AND targetFQNHash IN (<targetFQNHashes>)")
    void deleteTagsByPrefixAndTargets(
        @Bind("source") int source,
        @Bind("tagFQNPrefix") String tagFQNPrefix,
        @BindListFQN("targetFQNHashes") List<String> targetFQNHashes);

    @SqlUpdate(
        "DELETE FROM tag_usage where tagFQNHash = :tagFqnHash AND targetFQNHash LIKE :targetFQNHash")
    void deleteTagsByTagAndTargetEntity(
        @BindFQN("tagFqnHash") String tagFqnHash,
        @BindConcat(
                value = "targetFQNHash",
                parts = {":targetFQNHashPrefix", "%"},
                hash = true)
            String targetFQNHashPrefix);

    @SqlUpdate("DELETE FROM tag_usage where tagFQNHash = :tagFQNHash AND source = :source")
    void deleteTagLabels(@Bind("source") int source, @BindFQN("tagFQNHash") String tagFQNHash);

    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM tag_usage where tagFQNHash = :tagFQNHash ORDER BY tagFQN",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM tag_usage where tagFQNHash = :tagFQNHash",
        connectionType = POSTGRES)
    void deleteTagLabelsByFqn(@BindFQN("tagFQNHash") String tagFQNHash);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM tag_usage where targetFQNHash = :targetFQNHash OR targetFQNHash LIKE :concatTargetFQNHash ORDER BY tagFQN",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM tag_usage where targetFQNHash = :targetFQNHash OR targetFQNHash LIKE :concatTargetFQNHash",
        connectionType = POSTGRES)
    void deleteTagLabelsByTargetPrefix(
        @BindConcat(
                value = "concatTargetFQNHash",
                original = "targetFQNHash",
                parts = {":targetFQNHashPrefix", ".%"},
                hash = true)
            String targetFQNHashPrefix);

    @Deprecated(since = "Release 1.1")
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, targetFQN)"
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :targetFQN) "
                + "ON DUPLICATE KEY UPDATE tagFQNHash = :tagFQNHash, targetFQNHash = :targetFQNHash",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, targetFQN) "
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :targetFQN) "
                + "ON CONFLICT (source, tagFQN, targetFQN) "
                + "DO UPDATE SET tagFQNHash = EXCLUDED.tagFQNHash, targetFQNHash = EXCLUDED.targetFQNHash",
        connectionType = POSTGRES)
    void upsertFQNHash(
        @Bind("source") int source,
        @Bind("tagFQN") String tagFQN,
        @Bind("tagFQNHash") String tagFQNHash,
        @Bind("targetFQNHash") String targetFQNHash,
        @Bind("labelType") int labelType,
        @Bind("state") int state,
        @Bind("targetFQN") String targetFQN);

    /** Update all the tagFQN starting with oldPrefix to start with newPrefix due to tag or glossary name change */
    default void updateTagPrefix(int source, String oldPrefix, String newPrefix) {
      String update =
          String.format(
              "UPDATE tag_usage SET tagFQN = REPLACE(tagFQN, '%s.', '%s.'), tagFQNHash = REPLACE(tagFQNHash, '%s.', '%s.') WHERE source = %s AND tagFQNHash LIKE '%s.%%'",
              escapeApostrophe(oldPrefix),
              escapeApostrophe(newPrefix),
              FullyQualifiedName.buildHash(oldPrefix),
              FullyQualifiedName.buildHash(newPrefix),
              source,
              FullyQualifiedName.buildHash(oldPrefix));
      updateTagPrefixInternal(update);
    }

    default void updateTargetFQNHashPrefix(
        int source, String oldTargetFQNHashPrefix, String newTargetFQNHashPrefix) {
      String update =
          String.format(
              "UPDATE tag_usage SET targetFQNHash = REPLACE(targetFQNHash, '%s.', '%s.') WHERE source = %s AND targetFQNHash LIKE '%s.%%'",
              FullyQualifiedName.buildHash(oldTargetFQNHashPrefix),
              FullyQualifiedName.buildHash(newTargetFQNHashPrefix),
              source,
              FullyQualifiedName.buildHash(oldTargetFQNHashPrefix));
      updateTagPrefixInternal(update);
    }

    default void rename(int source, String oldFQN, String newFQN) {
      renameInternal(source, oldFQN, newFQN, newFQN); // First rename tagFQN from oldFQN to newFQN
      updateTagPrefix(
          source, oldFQN,
          newFQN); // Rename all the tagFQN prefixes starting with the oldFQN to newFQN
    }

    default void renameByTargetFQNHash(
        int source, String oldTargetFQNHash, String newTargetFQNHash) {
      updateTargetFQNHashPrefix(
          source,
          oldTargetFQNHash,
          newTargetFQNHash); // Rename all the targetFQN prefixes starting with the oldFQN to newFQN
    }

    /** Rename the tagFQN */
    @SqlUpdate(
        "Update tag_usage set tagFQN = :newFQN, tagFQNHash = :newFQNHash WHERE source = :source AND tagFQNHash = :oldFQNHash")
    void renameInternal(
        @Bind("source") int source,
        @BindFQN("oldFQNHash") String oldFQNHash,
        @Bind("newFQN") String newFQN,
        @BindFQN("newFQNHash") String newFQNHash);

    @SqlUpdate(
        "UPDATE tag_usage SET targetFQNHash = :newTargetFQNHash WHERE targetFQNHash = :oldTargetFQNHash")
    void updateTargetFQNHash(
        @BindFQN("oldTargetFQNHash") String oldTargetFQNHash,
        @BindFQN("newTargetFQNHash") String newTargetFQNHash);

    @SqlUpdate("<update>")
    void updateTagPrefixInternal(@Define("update") String update);

    @SqlQuery("select targetFQNHash FROM tag_usage where tagFQNHash = :tagFQNHash")
    @RegisterRowMapper(TagLabelMapper.class)
    List<String> getTargetFQNHashForTag(@BindFQN("tagFQNHash") String tagFQNHash);

    @SqlQuery("select targetFQNHash FROM tag_usage where tagFQNHash LIKE :tagFQNHash")
    @RegisterRowMapper(TagLabelMapper.class)
    List<String> getTargetFQNHashForTagPrefix(
        @BindConcat(
                value = "tagFQNHash",
                parts = {":tagFQNHashPrefix", ".%"},
                hash = true)
            String tagFQNHashPrefix);

    class TagLabelMapper implements RowMapper<TagLabel> {
      @Override
      public TagLabel map(ResultSet r, StatementContext ctx) throws SQLException {
        TagLabelMetadata metadata = null;
        try {
          metadata = JsonUtils.readValue(r.getString("metadata"), TagLabelMetadata.class);
        } catch (Exception e) {
          // Ignore unknown fields from future schema versions — metadata is best-effort
        }
        return new TagLabel()
            .withSource(TagLabel.TagSource.values()[r.getInt("source")])
            .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
            .withState(TagLabel.State.values()[r.getInt("state")])
            .withTagFQN(r.getString("tagFQN"))
            .withReason(r.getString("reason"))
            .withAppliedAt(r.getTimestamp("appliedAt"))
            .withAppliedBy(r.getString("appliedBy"))
            .withMetadata(metadata);
      }
    }

    class TagCountMapper implements RowMapper<Map.Entry<String, Integer>> {
      @Override
      public Map.Entry<String, Integer> map(ResultSet r, StatementContext ctx) throws SQLException {
        String tagFQN = r.getString("tagFQN");
        int count = r.getInt("count");
        return new AbstractMap.SimpleEntry<>(tagFQN, count);
      }
    }

    class TagLabelRowMapperWithTargetFqnHash implements RowMapper<Pair<String, TagLabel>> {
      @Override
      public Pair<String, TagLabel> map(ResultSet r, StatementContext ctx) throws SQLException {
        TagLabel label =
            new TagLabel()
                .withSource(TagLabel.TagSource.values()[r.getInt("source")])
                .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
                .withState(TagLabel.State.values()[r.getInt("state")])
                .withTagFQN(r.getString("tagFQN"))
                .withReason(r.getString("reason"))
                .withAppliedAt(r.getTimestamp("appliedAt"))
                .withAppliedBy(r.getString("appliedBy"))
                .withMetadata(JsonUtils.readValue(r.getString("metadata"), TagLabelMetadata.class));
        TagLabel.TagSource source = TagLabel.TagSource.values()[r.getInt("source")];
        if (source == TagLabel.TagSource.CLASSIFICATION) {
          Tag tag = JsonUtils.readValue(r.getString("json"), Tag.class);
          label.setName(tag.getName());
          label.setDisplayName(tag.getDisplayName());
          label.setDescription(tag.getDescription());
          label.setStyle(tag.getStyle());
        } else if (source == TagLabel.TagSource.GLOSSARY) {
          GlossaryTerm glossaryTerm = JsonUtils.readValue(r.getString("json"), GlossaryTerm.class);
          label.setName(glossaryTerm.getName());
          label.setDisplayName(glossaryTerm.getDisplayName());
          label.setDescription(glossaryTerm.getDescription());
          label.setStyle(glossaryTerm.getStyle());
        } else {
          throw new IllegalArgumentException("Invalid source type " + source);
        }
        return Pair.of(r.getString("targetFQNHash"), label);
      }
    }

    class TagLabelWithFQNHashMapper implements RowMapper<TagLabelWithFQNHash> {
      @Override
      public TagLabelWithFQNHash map(ResultSet rs, StatementContext ctx) throws SQLException {
        TagLabelMetadata metadata = null;
        try {
          metadata = JsonUtils.readValue(rs.getString("metadata"), TagLabelMetadata.class);
        } catch (Exception e) {
          // Ignore unknown fields from future schema versions — metadata is best-effort
        }
        TagLabelWithFQNHash tag = new TagLabelWithFQNHash();
        tag.setTargetFQNHash(rs.getString("targetFQNHash"));
        tag.setSource(rs.getInt("source"));
        tag.setTagFQN(rs.getString("tagFQN"));
        tag.setLabelType(rs.getInt("labelType"));
        tag.setState(rs.getInt("state"));
        tag.setReason(rs.getString("reason"));
        tag.setAppliedAt(rs.getTimestamp("appliedAt"));
        tag.setAppliedBy(rs.getString("appliedBy"));
        tag.setMetadata(metadata);
        return tag;
      }
    }

    @Getter
    @Setter
    class TagLabelWithFQNHash {
      private String targetFQNHash;
      private int source;
      private String tagFQN;
      private int labelType;
      private int state;
      private String reason;
      private Date appliedAt;
      private String appliedBy;
      private TagLabelMetadata metadata;

      public TagLabel toTagLabel() {
        TagLabel tagLabel = new TagLabel();
        TagLabel.TagSource[] sources = TagLabel.TagSource.values();
        tagLabel.setSource(
            this.source >= 0 && this.source < sources.length
                ? sources[this.source]
                : TagLabel.TagSource.CLASSIFICATION);
        tagLabel.setTagFQN(this.tagFQN);
        TagLabel.LabelType[] labelTypes = TagLabel.LabelType.values();
        tagLabel.setLabelType(
            this.labelType >= 0 && this.labelType < labelTypes.length
                ? labelTypes[this.labelType]
                : TagLabel.LabelType.MANUAL);
        TagLabel.State[] states = TagLabel.State.values();
        tagLabel.setState(
            this.state >= 0 && this.state < states.length
                ? states[this.state]
                : TagLabel.State.CONFIRMED);
        tagLabel.setReason(this.reason);
        tagLabel.setAppliedAt(this.appliedAt);
        tagLabel.setAppliedBy(this.appliedBy);
        tagLabel.setMetadata(this.metadata);
        return tagLabel;
      }
    }

    @Getter
    @Setter
    @Deprecated(since = "Release 1.1")
    class TagLabelMigration {
      private int source;
      private String tagFQN;
      private String targetFQN;
      private int labelType;
      private int state;
      private String tagFQNHash;
      private String targetFQNHash;
    }

    @Deprecated(since = "Release 1.1")
    class TagLabelMapperMigration implements RowMapper<TagLabelMigration> {
      @Override
      public TagLabelMigration map(ResultSet r, StatementContext ctx) throws SQLException {
        TagLabelMigration tagLabel = new TagLabelMigration();

        tagLabel.setSource(r.getInt("source"));
        tagLabel.setLabelType(r.getInt("labelType"));
        tagLabel.setState(r.getInt("state"));
        tagLabel.setTagFQN(r.getString("tagFQN"));
        // TODO : Ugly ,  but this is present is lower version and removed on higher version
        try {
          // This field is removed in latest
          tagLabel.setTargetFQN(r.getString("targetFQN"));
        } catch (Exception ex) {
          // Nothing to do
        }
        try {
          tagLabel.setTagFQNHash(r.getString("tagFQNHash"));
        } catch (Exception ex) {
          // Nothing to do
        }
        try {
          tagLabel.setTargetFQNHash(r.getString("targetFQNHash"));
        } catch (Exception ex) {
          // Nothing to do
        }
        return tagLabel;
      }
    }

    record TagUsageBatchRow(
        int source,
        String tagFQN,
        String tagFQNHash,
        String targetFQNHash,
        int labelType,
        int state,
        String reason,
        String appliedBy,
        String metadata) {}

    record TagUsageDeleteRow(int source, String tagFQNHash, String targetFQNHash) {}

    private static String buildTagUsageKey(int source, String tagFQNHash, String targetFQNHash) {
      return source + "|" + tagFQNHash + "|" + targetFQNHash;
    }

    private static String buildTagUsageKey(TagUsageBatchRow row) {
      return buildTagUsageKey(row.source(), row.tagFQNHash(), row.targetFQNHash());
    }

    private static String buildTagUsageKey(TagUsageDeleteRow row) {
      return buildTagUsageKey(row.source(), row.tagFQNHash(), row.targetFQNHash());
    }

    Logger TAG_USAGE_LOG = LoggerFactory.getLogger(TagUsageDAO.class);
    int TAG_USAGE_MAX_ATTEMPTS = 2;
    AtomicLong TAG_USAGE_DEADLOCK_RETRY_COUNT = new AtomicLong(0);

    private static boolean isTransientDeadlock(Throwable throwable) {
      for (Throwable current = throwable; current != null; current = current.getCause()) {
        if (current instanceof SQLException sqlException) {
          int errorCode = sqlException.getErrorCode();
          String sqlState = sqlException.getSQLState();
          if (errorCode == 1213
              || errorCode == 1205
              || "40001".equals(sqlState)
              || "40P01".equals(sqlState)) {
            return true;
          }
        }
      }
      return false;
    }

    default void executeWithDeadlockRetry(Runnable operation) {
      for (int attempt = 1; attempt <= TAG_USAGE_MAX_ATTEMPTS; attempt++) {
        try {
          operation.run();
          return;
        } catch (RuntimeException ex) {
          if (!isTransientDeadlock(ex) || attempt == TAG_USAGE_MAX_ATTEMPTS) {
            throw ex;
          }
          try {
            Thread.sleep(20L + (long) (Math.random() * 80));
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw ex;
          }
          long retryCount = TAG_USAGE_DEADLOCK_RETRY_COUNT.incrementAndGet();
          TAG_USAGE_LOG.debug(
              "Retrying tag_usage batch after transient deadlock (attempt {}/{}), total retries={}",
              attempt + 1,
              TAG_USAGE_MAX_ATTEMPTS,
              retryCount);
        }
      }
    }

    /**
     * Apply multiple tags in batch to improve performance
     */
    default void applyTagsBatch(List<TagLabel> tagLabels, String targetFQN) {
      if (tagLabels == null || tagLabels.isEmpty()) {
        return;
      }

      String targetFQNHash = FullyQualifiedName.buildHash(targetFQN);
      List<TagUsageBatchRow> rows = new ArrayList<>(tagLabels.size());

      for (TagLabel tagLabel : tagLabels) {
        rows.add(
            new TagUsageBatchRow(
                tagLabel.getSource().ordinal(),
                tagLabel.getTagFQN(),
                FullyQualifiedName.buildHash(tagLabel.getTagFQN()),
                targetFQNHash,
                tagLabel.getLabelType().ordinal(),
                tagLabel.getState().ordinal(),
                tagLabel.getReason(),
                tagLabel.getAppliedBy(),
                JsonUtils.pojoToJson(tagLabel.getMetadata())));
      }

      // De-duplicate duplicate tag applications within the same batch.
      LinkedHashMap<String, TagUsageBatchRow> uniqueRows = new LinkedHashMap<>(rows.size());
      for (TagUsageBatchRow row : rows) {
        uniqueRows.put(buildTagUsageKey(row), row);
      }
      rows = new ArrayList<>(uniqueRows.values());

      // Deterministic lock acquisition order reduces deadlocks under concurrent upserts.
      rows.sort(
          java.util.Comparator.comparing(TagUsageBatchRow::targetFQNHash)
              .thenComparing(TagUsageBatchRow::tagFQNHash)
              .thenComparingInt(TagUsageBatchRow::source));

      List<Integer> sources = new ArrayList<>(rows.size());
      List<String> tagFQNs = new ArrayList<>(rows.size());
      List<String> tagFQNHashes = new ArrayList<>(rows.size());
      List<String> targetFQNHashes = new ArrayList<>(rows.size());
      List<Integer> labelTypes = new ArrayList<>(rows.size());
      List<Integer> states = new ArrayList<>(rows.size());
      List<String> reasons = new ArrayList<>(rows.size());
      List<String> appliedBys = new ArrayList<>(rows.size());
      List<String> metadataList = new ArrayList<>(rows.size());
      for (TagUsageBatchRow row : rows) {
        sources.add(row.source());
        tagFQNs.add(row.tagFQN());
        tagFQNHashes.add(row.tagFQNHash());
        targetFQNHashes.add(row.targetFQNHash());
        labelTypes.add(row.labelType());
        states.add(row.state());
        reasons.add(row.reason());
        appliedBys.add(row.appliedBy());
        metadataList.add(row.metadata());
      }

      executeWithDeadlockRetry(
          () ->
              applyTagsBatchInternal(
                  sources,
                  tagFQNs,
                  tagFQNHashes,
                  targetFQNHashes,
                  labelTypes,
                  states,
                  reasons,
                  appliedBys,
                  metadataList));
    }

    /**
     * Apply multiple tags in batch to multiple targets. Each entry in the map represents
     * a target FQN and its associated tags.
     */
    default void applyTagsBatchMultiTarget(Map<String, List<TagLabel>> tagsByTarget) {
      if (tagsByTarget == null || tagsByTarget.isEmpty()) {
        return;
      }

      List<TagUsageBatchRow> rows = new ArrayList<>();

      for (Map.Entry<String, List<TagLabel>> entry : tagsByTarget.entrySet()) {
        String targetFQN = entry.getKey();
        List<TagLabel> tagLabels = entry.getValue();
        if (tagLabels == null || tagLabels.isEmpty()) {
          continue;
        }

        String targetFQNHash = FullyQualifiedName.buildHash(targetFQN);
        for (TagLabel tagLabel : tagLabels) {
          if (tagLabel.getLabelType().equals(TagLabel.LabelType.DERIVED)) {
            continue;
          }
          rows.add(
              new TagUsageBatchRow(
                  tagLabel.getSource().ordinal(),
                  tagLabel.getTagFQN(),
                  FullyQualifiedName.buildHash(tagLabel.getTagFQN()),
                  targetFQNHash,
                  tagLabel.getLabelType().ordinal(),
                  tagLabel.getState().ordinal(),
                  tagLabel.getReason(),
                  tagLabel.getAppliedBy(),
                  JsonUtils.pojoToJson(tagLabel.getMetadata())));
        }
      }

      if (!rows.isEmpty()) {
        // De-duplicate duplicate tag applications within the same batch.
        LinkedHashMap<String, TagUsageBatchRow> uniqueRows = new LinkedHashMap<>(rows.size());
        for (TagUsageBatchRow row : rows) {
          uniqueRows.put(buildTagUsageKey(row), row);
        }
        rows = new ArrayList<>(uniqueRows.values());

        // Deterministic lock acquisition order reduces deadlocks under concurrent upserts.
        rows.sort(
            java.util.Comparator.comparing(TagUsageBatchRow::targetFQNHash)
                .thenComparing(TagUsageBatchRow::tagFQNHash)
                .thenComparingInt(TagUsageBatchRow::source));

        List<Integer> sources = new ArrayList<>(rows.size());
        List<String> tagFQNs = new ArrayList<>(rows.size());
        List<String> tagFQNHashes = new ArrayList<>(rows.size());
        List<String> targetFQNHashes = new ArrayList<>(rows.size());
        List<Integer> labelTypes = new ArrayList<>(rows.size());
        List<Integer> states = new ArrayList<>(rows.size());
        List<String> reasons = new ArrayList<>(rows.size());
        List<String> appliedBys = new ArrayList<>(rows.size());
        List<String> metadataList = new ArrayList<>(rows.size());
        for (TagUsageBatchRow row : rows) {
          sources.add(row.source());
          tagFQNs.add(row.tagFQN());
          tagFQNHashes.add(row.tagFQNHash());
          targetFQNHashes.add(row.targetFQNHash());
          labelTypes.add(row.labelType());
          states.add(row.state());
          reasons.add(row.reason());
          appliedBys.add(row.appliedBy());
          metadataList.add(row.metadata());
        }

        executeWithDeadlockRetry(
            () ->
                applyTagsBatchInternal(
                    sources,
                    tagFQNs,
                    tagFQNHashes,
                    targetFQNHashes,
                    labelTypes,
                    states,
                    reasons,
                    appliedBys,
                    metadataList));
      }
    }

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, reason, appliedBy, metadata) "
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :reason, :appliedBy, :metadata) "
                + "ON DUPLICATE KEY UPDATE labelType = VALUES(labelType), state = VALUES(state), reason = VALUES(reason), metadata = VALUES(metadata)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, reason, appliedBy, metadata) "
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :reason, :appliedBy, :metadata :: jsonb) "
                + "ON CONFLICT (source, tagFQNHash, targetFQNHash) DO UPDATE SET labelType = EXCLUDED.labelType, "
                + "state = EXCLUDED.state, reason = EXCLUDED.reason, metadata = EXCLUDED.metadata",
        connectionType = POSTGRES)
    void applyTagsBatchInternal(
        @Bind("source") List<Integer> sources,
        @Bind("tagFQN") List<String> tagFQNs,
        @Bind("tagFQNHash") List<String> tagFQNHashes,
        @Bind("targetFQNHash") List<String> targetFQNHashes,
        @Bind("labelType") List<Integer> labelTypes,
        @Bind("state") List<Integer> states,
        @Bind("reason") List<String> reasons,
        @Bind("appliedBy") List<String> appliedBys,
        @Bind("metadata") List<String> metadataList);

    /**
     * Delete multiple tags in batch to improve performance
     */
    default void deleteTagsBatch(List<TagLabel> tagLabels, String targetFQN) {
      if (tagLabels == null || tagLabels.isEmpty()) {
        return;
      }

      String targetFQNHash = FullyQualifiedName.buildHash(targetFQN);
      List<TagUsageDeleteRow> rows = new ArrayList<>(tagLabels.size());

      for (TagLabel tagLabel : tagLabels) {
        rows.add(
            new TagUsageDeleteRow(
                tagLabel.getSource().ordinal(),
                FullyQualifiedName.buildHash(tagLabel.getTagFQN()),
                targetFQNHash));
      }

      LinkedHashMap<String, TagUsageDeleteRow> uniqueRows = new LinkedHashMap<>(rows.size());
      for (TagUsageDeleteRow row : rows) {
        uniqueRows.put(buildTagUsageKey(row), row);
      }
      rows = new ArrayList<>(uniqueRows.values());

      rows.sort(
          java.util.Comparator.comparing(TagUsageDeleteRow::targetFQNHash)
              .thenComparing(TagUsageDeleteRow::tagFQNHash)
              .thenComparingInt(TagUsageDeleteRow::source));

      List<Integer> sources = new ArrayList<>(rows.size());
      List<String> tagFQNHashes = new ArrayList<>(rows.size());
      List<String> targetFQNHashes = new ArrayList<>(rows.size());
      for (TagUsageDeleteRow row : rows) {
        sources.add(row.source());
        tagFQNHashes.add(row.tagFQNHash());
        targetFQNHashes.add(row.targetFQNHash());
      }

      executeWithDeadlockRetry(
          () -> deleteTagsBatchInternal(sources, tagFQNHashes, targetFQNHashes));
    }

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "DELETE FROM tag_usage WHERE source = :source AND tagFQNHash = :tagFQNHash AND targetFQNHash = :targetFQNHash",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "DELETE FROM tag_usage WHERE source = :source AND tagFQNHash = :tagFQNHash AND targetFQNHash = :targetFQNHash",
        connectionType = POSTGRES)
    void deleteTagsBatchInternal(
        @Bind("source") List<Integer> sources,
        @Bind("tagFQNHash") List<String> tagFQNHashes,
        @Bind("targetFQNHash") List<String> targetFQNHashes);

    @SqlQuery("SELECT COUNT(*) FROM tag_usage")
    long getTotalTagUsageCount();

    @SqlQuery(
        "SELECT source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, reason, appliedAt, appliedBy, metadata FROM tag_usage ORDER BY source, tagFQNHash LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(TagUsageObjectMapper.class)
    List<TagUsageObject> getAllTagUsagesPaginated(
        @Bind("offset") long offset, @Bind("limit") int limit);

    @SqlUpdate(
        "DELETE FROM tag_usage WHERE source = :source AND tagFQNHash = :tagFQNHash AND targetFQNHash = :targetFQNHash")
    int deleteTagUsage(
        @Bind("source") int source,
        @Bind("tagFQNHash") String tagFQNHash,
        @Bind("targetFQNHash") String targetFQNHash);
  }

  @Getter
  @Builder
  class TagUsageObject {
    private int source;
    private String tagFQN;
    private String tagFQNHash;
    private String targetFQNHash;
    private int labelType;
    private int state;
    private String reason;
    private Date appliedAt;
    private String appliedBy;
    private TagLabelMetadata metadata;
  }

  class TagUsageObjectMapper implements RowMapper<TagUsageObject> {
    @Override
    public TagUsageObject map(ResultSet r, StatementContext ctx) throws SQLException {
      return TagUsageObject.builder()
          .source(r.getInt("source"))
          .tagFQN(r.getString("tagFQN"))
          .tagFQNHash(r.getString("tagFQNHash"))
          .targetFQNHash(r.getString("targetFQNHash"))
          .labelType(r.getInt("labelType"))
          .state(r.getInt("state"))
          .reason(r.getString("reason"))
          .appliedAt(r.getTimestamp("appliedAt"))
          .appliedBy(r.getString("appliedBy"))
          .metadata(JsonUtils.readValue(r.getString("metadata"), TagLabelMetadata.class))
          .build();
    }
  }
}
