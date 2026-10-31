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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.Getter;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.BindMethods;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel.TagSource;

public interface OntologyDAO {
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
  String ACTIVE_CANDIDATE_TERM_RELATION =
      "candidate.deleted = FALSE AND candidate.fromEntity = :entityType "
          + "AND candidate.toEntity = :entityType "
          + "AND candidate.relation IN (:containsRelation, :relatedRelation)";
  String ONTOLOGY_RELATION_CONTEXT =
      " JOIN glossary_term_entity sourceTerm ON sourceTerm.id = relation.fromId "
          + "JOIN glossary_term_entity targetTerm ON targetTerm.id = relation.toId "
          + "WHERE sourceTerm.deleted = FALSE AND targetTerm.deleted = FALSE AND "
          + SCOPE_FROM
          + " AND "
          + SCOPE_TO
          + " AND EXISTS (SELECT 1 FROM tag_usage sourceUsage "
          + "WHERE sourceUsage.tagFQNHash = sourceTerm.fqnHash "
          + "AND sourceUsage.source = :tagSource) "
          + "AND EXISTS (SELECT 1 FROM tag_usage targetUsage "
          + "WHERE targetUsage.tagFQNHash = targetTerm.fqnHash "
          + "AND targetUsage.source = :tagSource) "
          + "ORDER BY relation.fromId ASC, relation.toId ASC, relation.relation ASC "
          + "LIMIT :relationLimit";

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
  List<TermAssetCountRow> listAssetTerms(@BindBean OntologyQueryParameters parameters);

  @SqlQuery(
      "SELECT relation.fromId, relation.toId, relation.relation, relation.json FROM "
          + "(SELECT candidate.fromId, candidate.toId, candidate.relation, candidate.json "
          + "FROM entity_relationship candidate WHERE "
          + ACTIVE_CANDIDATE_TERM_RELATION
          + " AND candidate.fromId IN (<termIds>) "
          + "ORDER BY candidate.fromId ASC, candidate.toId ASC, candidate.relation ASC, "
          + "candidate.relationType ASC LIMIT :candidateLimit) relation"
          + ONTOLOGY_RELATION_CONTEXT)
  @RegisterRowMapper(OntologyRelationRowMapper.class)
  List<OntologyRelationRow> listOntologyRelationsFrom(
      @BindList("termIds") List<String> termIds,
      @BindBean OntologyQueryParameters parameters,
      @Bind("candidateLimit") int candidateLimit,
      @Bind("relationLimit") int relationLimit);

  @SqlQuery(
      "SELECT relation.fromId, relation.toId, relation.relation, relation.json FROM "
          + "(SELECT candidate.fromId, candidate.toId, candidate.relation, candidate.json "
          + "FROM entity_relationship candidate WHERE "
          + ACTIVE_CANDIDATE_TERM_RELATION
          + " AND candidate.toId IN (<termIds>) "
          + "ORDER BY candidate.toId ASC, candidate.fromId ASC, candidate.relation ASC, "
          + "candidate.relationType ASC LIMIT :candidateLimit) relation"
          + ONTOLOGY_RELATION_CONTEXT)
  @RegisterRowMapper(OntologyRelationRowMapper.class)
  List<OntologyRelationRow> listOntologyRelationsTo(
      @BindList("termIds") List<String> termIds,
      @BindBean OntologyQueryParameters parameters,
      @Bind("candidateLimit") int candidateLimit,
      @Bind("relationLimit") int relationLimit);

  @SqlQuery(
      "SELECT relation.fromId, relation.toId FROM "
          + "(SELECT candidate.fromId, candidate.toId FROM entity_relationship candidate "
          + "WHERE candidate.fromId IN (<assetIds>) "
          + "AND candidate.relation = :lineageRelation AND candidate.deleted = FALSE "
          + "ORDER BY candidate.fromId ASC, candidate.toId ASC, candidate.relationType ASC "
          + "LIMIT :candidateLimit) relation WHERE relation.toId IN (<assetIds>) "
          + "ORDER BY relation.fromId ASC, relation.toId ASC LIMIT :lineageEdgeLimit")
  @RegisterRowMapper(OntologyLineageRowMapper.class)
  List<OntologyLineageRow> listLineageEdges(
      @BindList("assetIds") List<String> assetIds,
      @Bind("lineageRelation") int lineageRelation,
      @Bind("candidateLimit") int candidateLimit,
      @Bind("lineageEdgeLimit") int lineageEdgeLimit);

  /**
   * Both endpoints are filtered before the limit, so edges from a listed asset to unlisted ones
   * can never crowd out an edge between two listed assets.
   */
  @SqlQuery(
      "SELECT relation.fromId, relation.toId FROM entity_relationship relation "
          + "WHERE relation.fromId IN (<assetIds>) AND relation.toId IN (<assetIds>) "
          + "AND relation.relation = :lineageRelation AND relation.deleted = FALSE "
          + "ORDER BY relation.fromId ASC, relation.toId ASC LIMIT :lineageEdgeLimit")
  @RegisterRowMapper(OntologyLineageRowMapper.class)
  List<OntologyLineageRow> listLineageEdgesBetween(
      @BindList("assetIds") List<String> assetIds,
      @Bind("lineageRelation") int lineageRelation,
      @Bind("lineageEdgeLimit") int lineageEdgeLimit);

  /**
   * The loaded assets are materialized first, and each one probes {@code entity_relationship} by
   * {@code fromId}, so the work follows the loaded assets' outgoing lineage and not the size of the
   * table. MySQL copies the {@code assetId <= mark} predicates onto the equal relationship columns
   * and then prefers a range scan of {@code entity_relationship}; the JOIN_ORDER hint keeps the
   * loaded assets first, and PostgreSQL reads it as a comment. The concepts were authorized against
   * the ontology when the request was validated.
   */
  String PREFIX_LINEAGE_SQL =
      "SELECT /*+ JOIN_ORDER(loaded, relation) */ relation.fromId, relation.toId, "
          + "relation.fromEntity, relation.toEntity, relation.relationType "
          + "FROM (SELECT DISTINCT source.assetId, source.assetType "
          + "FROM ontology_concept_binding source WHERE <sourcePredicate>) loaded "
          + "JOIN entity_relationship relation ON relation.fromId = loaded.assetId "
          + "AND relation.fromEntity = loaded.assetType AND relation.relation = :query.relation "
          + "WHERE relation.deleted = FALSE "
          + "AND EXISTS (SELECT 1 FROM ontology_concept_binding target "
          + "WHERE target.assetId = relation.toId AND target.assetType = relation.toEntity "
          + "AND (<targetPredicate>)) "
          + "AND (:query.after.hasAfter = FALSE OR relation.fromId > :query.after.fromId "
          + "OR (relation.fromId = :query.after.fromId AND relation.toId > :query.after.toId) "
          + "OR (relation.fromId = :query.after.fromId AND relation.toId = :query.after.toId "
          + "AND relation.relationType > :query.after.relationType)) "
          + "ORDER BY relation.fromId, relation.toId, relation.relationType LIMIT :query.limit";

  @SqlQuery(PREFIX_LINEAGE_SQL)
  @RegisterRowMapper(PrefixLineageRowMapper.class)
  List<PrefixLineageRow> listLineageForPrefixes(
      @Define("sourcePredicate") String sourcePredicate,
      @Define("targetPredicate") String targetPredicate,
      @BindMap Map<String, String> prefixes,
      @BindMethods("query") PrefixLineageQuery query);

  record PrefixLineageQuery(String ontologyId, LineagePosition after, int limit) {
    public int relation() {
      return Relationship.UPSTREAM.ordinal();
    }
  }

  record LineagePosition(String fromId, String toId, String relationType) {
    public static final LineagePosition FIRST = new LineagePosition("", "", "");

    public boolean hasAfter() {
      return !fromId.isEmpty();
    }
  }

  record PrefixLineageRow(
      String fromId, String toId, String fromEntity, String toEntity, String relationType) {
    public LineagePosition position() {
      return new LineagePosition(fromId, toId, relationType);
    }
  }

  record PrefixFilter(int ranges, Map<String, String> bindings) {
    public static PrefixFilter of(final List<NativeOntologyLoadedPrefix> prefixes) {
      if (prefixes.size() > 60) {
        throw new IllegalArgumentException("At most 60 loaded prefixes are supported");
      }
      final List<NativeOntologyLoadedPrefix> ranges =
          prefixes.stream().filter(prefix -> prefix.getThroughAssetId() != null).toList();
      final Map<String, String> values = new LinkedHashMap<>();
      for (int index = 0; index < ranges.size(); index++) {
        values.put("concept" + index, ranges.get(index).getConceptId().toString());
        values.put("through" + index, ranges.get(index).getThroughAssetId().toString());
      }
      return new PrefixFilter(ranges.size(), values);
    }

    public String predicate(final String alias) {
      return ranges == 0
          ? "FALSE"
          : IntStream.range(0, ranges)
              .mapToObj(
                  index ->
                      "(%1$s.conceptId = :concept%2$d AND %1$s.assetId <= :through%2$d)"
                          .formatted(alias, index))
              .collect(Collectors.joining(" OR "));
    }
  }

  final class PrefixLineageRowMapper implements RowMapper<PrefixLineageRow> {
    @Override
    public PrefixLineageRow map(ResultSet rows, StatementContext context) throws SQLException {
      return new PrefixLineageRow(
          rows.getString("fromId"),
          rows.getString("toId"),
          rows.getString("fromEntity"),
          rows.getString("toEntity"),
          rows.getString("relationType"));
    }
  }

  @SqlQuery(
      "SELECT COUNT(DISTINCT term.id) FROM glossary_term_entity term "
          + "JOIN tag_usage tagUsage ON tagUsage.tagFQNHash = term.fqnHash "
          + "AND tagUsage.source = :tagSource "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM)
  int countAssetTerms(@BindBean OntologyQueryParameters parameters);

  @SqlQuery(
      "SELECT COUNT(*) FROM glossary_term_entity term "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM)
  int countTerms(@BindBean OntologyQueryParameters parameters);

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
  int countRelations(@BindBean OntologyQueryParameters parameters);

  @SqlQuery(
      "SELECT COUNT(*) FROM glossary_term_entity term "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM
          + " AND NOT EXISTS (SELECT 1 FROM entity_relationship relation "
          + "WHERE "
          + ACTIVE_TERM_RELATION
          + " AND (relation.fromId = term.id OR relation.toId = term.id))")
  int countIsolatedTerms(@BindBean OntologyQueryParameters parameters);

  @SqlQuery(
      "SELECT term.json FROM glossary_term_entity term "
          + "WHERE term.deleted = FALSE AND "
          + SCOPE_TERM
          + " AND NOT EXISTS (SELECT 1 FROM entity_relationship relation "
          + "WHERE "
          + ACTIVE_TERM_RELATION
          + " AND (relation.fromId = term.id OR relation.toId = term.id)) "
          + "ORDER BY term.name ASC, term.id ASC LIMIT :limit OFFSET :offset")
  List<String> listIsolatedTerms(@BindBean OntologyQueryParameters parameters);

  record TermAssetCountRow(String termJson, int assetCount) {}

  record OntologyRelationRow(String fromId, String toId, int relation, String json) {}

  record OntologyLineageRow(String fromId, String toId) {}

  final class TermAssetCountRowMapper implements RowMapper<TermAssetCountRow> {
    @Override
    public TermAssetCountRow map(ResultSet resultSet, StatementContext context)
        throws SQLException {
      return new TermAssetCountRow(resultSet.getString("termJson"), resultSet.getInt("assetCount"));
    }
  }

  final class OntologyRelationRowMapper implements RowMapper<OntologyRelationRow> {
    @Override
    public OntologyRelationRow map(ResultSet resultSet, StatementContext context)
        throws SQLException {
      return new OntologyRelationRow(
          resultSet.getString("fromId"),
          resultSet.getString("toId"),
          resultSet.getInt("relation"),
          resultSet.getString("json"));
    }
  }

  final class OntologyLineageRowMapper implements RowMapper<OntologyLineageRow> {
    @Override
    public OntologyLineageRow map(ResultSet resultSet, StatementContext context)
        throws SQLException {
      return new OntologyLineageRow(resultSet.getString("fromId"), resultSet.getString("toId"));
    }
  }

  @Getter
  final class OntologyQueryParameters {
    private final String parentHash;
    private final String parentPattern;
    private final String entityType = GLOSSARY_TERM;
    private final int containsRelation = CONTAINS.ordinal();
    private final int relatedRelation = RELATED_TO.ordinal();
    private final int tagSource = TagSource.GLOSSARY.ordinal();
    private final int limit;
    private final int offset;

    public OntologyQueryParameters(String parentHash, String parentPattern, int limit, int offset) {
      this.parentHash = parentHash;
      this.parentPattern = parentPattern;
      this.limit = limit;
      this.offset = offset;
    }
  }
}
