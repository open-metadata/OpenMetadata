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

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindJson;
import org.openmetadata.service.util.jdbi.BindUUID;

/** One row per native concept and bound catalog asset, ordered by asset id within a concept. */
public interface OntologyConceptBindingDAO {
  String COLUMNS = "conceptId, assetId, assetType, assetFqnHash, columnBindings";
  String BOUND_CONCEPTS =
      "FROM ontology_concept_binding binding "
          + "JOIN ontology_concept_entity concept ON concept.id = binding.conceptId "
          + "WHERE concept.ontologyId = :ontologyId AND concept.deleted = FALSE";

  record BindingRow(
      UUID conceptId,
      UUID assetId,
      OntologyBindingAssetType assetType,
      String assetFqnHash,
      List<OntologyColumnBinding> columns) {
    public static Map<OntologyBindingAssetType, List<UUID>> assetIdsByType(
        final List<BindingRow> rows) {
      final Map<OntologyBindingAssetType, List<UUID>> ids =
          new EnumMap<>(OntologyBindingAssetType.class);
      for (final BindingRow row : rows) {
        ids.computeIfAbsent(row.assetType(), type -> new ArrayList<>()).add(row.assetId());
      }
      return ids;
    }
  }

  record ConceptAssetCount(UUID conceptId, long assetCount) {}

  record BindingPosition(UUID conceptId, UUID assetId) {}

  record LiveAsset(UUID id, String serviceType) {}

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_concept_binding("
              + COLUMNS
              + ") VALUES (:conceptId, :assetId, :assetType, :assetFqnHash, :columnBindings) "
              + "ON DUPLICATE KEY UPDATE assetType = VALUES(assetType), "
              + "assetFqnHash = VALUES(assetFqnHash), columnBindings = VALUES(columnBindings)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_concept_binding("
              + COLUMNS
              + ") VALUES (:conceptId, :assetId, :assetType, :assetFqnHash, "
              + "(:columnBindings :: jsonb)) "
              + "ON CONFLICT (conceptId, assetId) DO UPDATE SET assetType = EXCLUDED.assetType, "
              + "assetFqnHash = EXCLUDED.assetFqnHash, columnBindings = EXCLUDED.columnBindings",
      connectionType = POSTGRES)
  void upsert(
      @BindUUID("conceptId") UUID conceptId,
      @BindUUID("assetId") UUID assetId,
      @Bind("assetType") String assetType,
      @Bind("assetFqnHash") String assetFqnHash,
      @BindJson("columnBindings") String columnBindings);

  @SqlUpdate(
      "DELETE FROM ontology_concept_binding WHERE conceptId = :conceptId AND assetId = :assetId")
  int delete(@BindUUID("conceptId") UUID conceptId, @BindUUID("assetId") UUID assetId);

  @SqlUpdate(
      "DELETE FROM ontology_concept_binding WHERE conceptId = :conceptId "
          + "AND assetId IN (<assetIds>)")
  void deleteAssets(
      @BindUUID("conceptId") UUID conceptId, @BindList("assetIds") List<String> assetIds);

  @SqlUpdate("DELETE FROM ontology_concept_binding WHERE conceptId = :conceptId")
  void deleteConcept(@BindUUID("conceptId") UUID conceptId);

  @SqlQuery(
      "SELECT "
          + COLUMNS
          + " FROM ontology_concept_binding WHERE conceptId = :conceptId AND assetId = :assetId")
  @RegisterRowMapper(BindingRowMapper.class)
  BindingRow find(@BindUUID("conceptId") UUID conceptId, @BindUUID("assetId") UUID assetId);

  @SqlQuery(
      "SELECT "
          + COLUMNS
          + " FROM ontology_concept_binding WHERE conceptId = :conceptId AND assetId > :after "
          + "ORDER BY assetId ASC LIMIT :limit")
  @RegisterRowMapper(BindingRowMapper.class)
  List<BindingRow> listAfter(
      @BindUUID("conceptId") UUID conceptId, @Bind("after") String after, @Bind("limit") int limit);

  @SqlQuery(
      "SELECT "
          + COLUMNS
          + " FROM ontology_concept_binding WHERE conceptId IN (<conceptIds>) "
          + "AND (:hasAfter = FALSE OR conceptId > :afterConceptId "
          + "OR (conceptId = :afterConceptId AND assetId > :afterAssetId)) "
          + "ORDER BY conceptId ASC, assetId ASC LIMIT :limit")
  @RegisterRowMapper(BindingRowMapper.class)
  List<BindingRow> listForConceptsAfter(
      @BindList("conceptIds") List<String> conceptIds,
      @Bind("hasAfter") boolean hasAfter,
      @Bind("afterConceptId") String afterConceptId,
      @Bind("afterAssetId") String afterAssetId,
      @Bind("limit") int limit);

  @SqlQuery(
      "SELECT binding.conceptId, COUNT(*) AS assetCount "
          + BOUND_CONCEPTS
          + " GROUP BY binding.conceptId, concept.name "
          + "ORDER BY assetCount DESC, concept.name ASC, binding.conceptId ASC "
          + "LIMIT :limit OFFSET :offset")
  @RegisterRowMapper(ConceptAssetCountMapper.class)
  List<ConceptAssetCount> listBoundConcepts(
      @BindUUID("ontologyId") UUID ontologyId,
      @Bind("limit") int limit,
      @Bind("offset") int offset);

  @SqlQuery("SELECT COUNT(DISTINCT binding.conceptId) " + BOUND_CONCEPTS)
  int countBoundConcepts(@BindUUID("ontologyId") UUID ontologyId);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) AS serviceType "
              + "FROM <table> WHERE id IN (<ids>) AND deleted = FALSE",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, json ->> 'serviceType' AS serviceType "
              + "FROM <table> WHERE id IN (<ids>) AND deleted = FALSE",
      connectionType = POSTGRES)
  @RegisterRowMapper(LiveAssetMapper.class)
  List<LiveAsset> findLiveAssets(@Define("table") String table, @BindList("ids") List<String> ids);

  class BindingRowMapper implements RowMapper<BindingRow> {
    @Override
    public BindingRow map(final ResultSet rs, final StatementContext ctx) throws SQLException {
      return new BindingRow(
          UUID.fromString(rs.getString("conceptId")),
          UUID.fromString(rs.getString("assetId")),
          OntologyBindingAssetType.fromValue(rs.getString("assetType")),
          rs.getString("assetFqnHash"),
          JsonUtils.readObjects(rs.getString("columnBindings"), OntologyColumnBinding.class));
    }
  }

  class ConceptAssetCountMapper implements RowMapper<ConceptAssetCount> {
    @Override
    public ConceptAssetCount map(final ResultSet rs, final StatementContext ctx)
        throws SQLException {
      return new ConceptAssetCount(
          UUID.fromString(rs.getString("conceptId")), rs.getLong("assetCount"));
    }
  }

  class LiveAssetMapper implements RowMapper<LiveAsset> {
    @Override
    public LiveAsset map(final ResultSet rs, final StatementContext ctx) throws SQLException {
      return new LiveAsset(UUID.fromString(rs.getString("id")), rs.getString("serviceType"));
    }
  }
}
