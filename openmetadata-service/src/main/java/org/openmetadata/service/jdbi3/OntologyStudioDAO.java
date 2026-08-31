/*
 *  Copyright 2026 Collate.
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
import static org.openmetadata.schema.type.Relationship.RELATED_TO;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import lombok.Getter;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.schema.type.TagLabel.TagSource;

public interface OntologyStudioDAO {
  String SCOPE_TERM =
      "(:parentHash IS NULL OR term.fqnHash = :parentHash OR term.fqnHash LIKE :parentPattern)";
  String SCOPE_FROM =
      "(:parentHash IS NULL OR sourceTerm.fqnHash = :parentHash "
          + "OR sourceTerm.fqnHash LIKE :parentPattern)";
  String SCOPE_TO =
      "(:parentHash IS NULL OR targetTerm.fqnHash = :parentHash "
          + "OR targetTerm.fqnHash LIKE :parentPattern)";
  String ACTIVE_TERM_RELATION =
      "relation.deleted = FALSE AND relation.fromEntity = :entityType "
          + "AND relation.toEntity = :entityType "
          + "AND relation.relation IN (:containsRelation, :relatedRelation)";

  @SqlQuery(
      "SELECT term.json AS termJson, COUNT(DISTINCT tagUsage.targetFQNHash) AS assetCount "
          + "FROM glossary_term_entity term "
          + "JOIN tag_usage tagUsage ON tagUsage.tagFQNHash = term.fqnHash "
          + "AND tagUsage.source = :tagSource "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM
          + " GROUP BY term.id, term.name "
          + "ORDER BY assetCount DESC, term.name ASC, term.id ASC "
          + "LIMIT :limit OFFSET :offset")
  @RegisterRowMapper(TermAssetCountRowMapper.class)
  List<TermAssetCountRow> listAssetTerms(@BindBean OntologyStudioQueryParameters parameters);

  @SqlQuery(
      "SELECT relation.fromId, relation.toId, relation.relation, relation.json "
          + "FROM entity_relationship relation "
          + "JOIN glossary_term_entity sourceTerm ON sourceTerm.id = relation.fromId "
          + "JOIN glossary_term_entity targetTerm ON targetTerm.id = relation.toId "
          + "WHERE sourceTerm.deleted = FALSE AND targetTerm.deleted = FALSE AND "
          + ACTIVE_TERM_RELATION
          + " AND "
          + SCOPE_FROM
          + " AND "
          + SCOPE_TO
          + " AND (relation.fromId IN (<termIds>) OR relation.toId IN (<termIds>)) "
          + "AND EXISTS (SELECT 1 FROM tag_usage sourceUsage "
          + "WHERE sourceUsage.tagFQNHash = sourceTerm.fqnHash "
          + "AND sourceUsage.source = :tagSource) "
          + "AND EXISTS (SELECT 1 FROM tag_usage targetUsage "
          + "WHERE targetUsage.tagFQNHash = targetTerm.fqnHash "
          + "AND targetUsage.source = :tagSource) "
          + "ORDER BY sourceTerm.name ASC, targetTerm.name ASC, relation.relation ASC, "
          + "relation.fromId ASC, relation.toId ASC LIMIT :relationLimit")
  @RegisterRowMapper(StudioRelationRowMapper.class)
  List<StudioRelationRow> listTermRelations(
      @BindList("termIds") List<String> termIds,
      @BindBean OntologyStudioQueryParameters parameters,
      @Bind("relationLimit") int relationLimit);

  @SqlQuery(
      "SELECT relation.fromId, relation.toId FROM entity_relationship relation "
          + "WHERE relation.fromId IN (<assetIds>) AND relation.toId IN (<assetIds>) "
          + "AND relation.relation = :lineageRelation AND relation.deleted = FALSE "
          + "ORDER BY relation.fromId ASC, relation.toId ASC LIMIT :lineageEdgeLimit")
  @RegisterRowMapper(StudioLineageRowMapper.class)
  List<StudioLineageRow> listLineageEdges(
      @BindList("assetIds") List<String> assetIds,
      @Bind("lineageRelation") int lineageRelation,
      @Bind("lineageEdgeLimit") int lineageEdgeLimit);

  @SqlQuery(
      "SELECT COUNT(DISTINCT term.id) FROM glossary_term_entity term "
          + "JOIN tag_usage tagUsage ON tagUsage.tagFQNHash = term.fqnHash "
          + "AND tagUsage.source = :tagSource "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM)
  int countAssetTerms(@BindBean OntologyStudioQueryParameters parameters);

  @SqlQuery(
      "SELECT COUNT(*) FROM glossary_term_entity term "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM)
  int countTerms(@BindBean OntologyStudioQueryParameters parameters);

  @SqlQuery(
      "SELECT COUNT(*) FROM entity_relationship relation "
          + "JOIN glossary_term_entity sourceTerm ON sourceTerm.id = relation.fromId "
          + "JOIN glossary_term_entity targetTerm ON targetTerm.id = relation.toId "
          + "WHERE sourceTerm.deleted = FALSE AND targetTerm.deleted = FALSE AND "
          + ACTIVE_TERM_RELATION
          + " AND "
          + SCOPE_FROM
          + " AND "
          + SCOPE_TO)
  int countRelations(@BindBean OntologyStudioQueryParameters parameters);

  @SqlQuery(
      "SELECT COUNT(*) FROM glossary_term_entity term "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM
          + " AND NOT EXISTS (SELECT 1 FROM entity_relationship relation "
          + "WHERE "
          + ACTIVE_TERM_RELATION
          + " AND (relation.fromId = term.id OR relation.toId = term.id))")
  int countIsolatedTerms(@BindBean OntologyStudioQueryParameters parameters);

  @SqlQuery(
      "SELECT term.json FROM glossary_term_entity term "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM
          + " AND NOT EXISTS (SELECT 1 FROM entity_relationship relation "
          + "WHERE "
          + ACTIVE_TERM_RELATION
          + " AND (relation.fromId = term.id OR relation.toId = term.id)) "
          + "ORDER BY term.name ASC, term.id ASC LIMIT :limit OFFSET :offset")
  List<String> listIsolatedTerms(@BindBean OntologyStudioQueryParameters parameters);

  record TermAssetCountRow(String termJson, int assetCount) {}

  record StudioRelationRow(String fromId, String toId, int relation, String json) {}

  record StudioLineageRow(String fromId, String toId) {}

  final class TermAssetCountRowMapper implements RowMapper<TermAssetCountRow> {
    @Override
    public TermAssetCountRow map(ResultSet resultSet, StatementContext context)
        throws SQLException {
      return new TermAssetCountRow(resultSet.getString("termJson"), resultSet.getInt("assetCount"));
    }
  }

  final class StudioRelationRowMapper implements RowMapper<StudioRelationRow> {
    @Override
    public StudioRelationRow map(ResultSet resultSet, StatementContext context)
        throws SQLException {
      return new StudioRelationRow(
          resultSet.getString("fromId"),
          resultSet.getString("toId"),
          resultSet.getInt("relation"),
          resultSet.getString("json"));
    }
  }

  final class StudioLineageRowMapper implements RowMapper<StudioLineageRow> {
    @Override
    public StudioLineageRow map(ResultSet resultSet, StatementContext context) throws SQLException {
      return new StudioLineageRow(resultSet.getString("fromId"), resultSet.getString("toId"));
    }
  }

  @Getter
  final class OntologyStudioQueryParameters {
    private final String parentHash;
    private final String parentPattern;
    private final String entityType = GLOSSARY_TERM;
    private final int containsRelation = CONTAINS.ordinal();
    private final int relatedRelation = RELATED_TO.ordinal();
    private final int tagSource = TagSource.GLOSSARY.ordinal();
    private final int limit;
    private final int offset;

    public OntologyStudioQueryParameters(
        String parentHash, String parentPattern, int limit, int offset) {
      this.parentHash = parentHash;
      this.parentPattern = parentPattern;
      this.limit = limit;
      this.offset = offset;
    }
  }
}
