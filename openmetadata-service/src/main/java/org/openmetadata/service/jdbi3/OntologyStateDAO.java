package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface OntologyStateDAO {
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_state (ontologyId) VALUES (:ontologyId) "
              + "ON DUPLICATE KEY UPDATE ontologyId = ontologyId",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value = "INSERT INTO ontology_state (ontologyId) VALUES (:ontologyId) ON CONFLICT DO NOTHING",
      connectionType = POSTGRES)
  void initialize(@BindUUID("ontologyId") UUID ontologyId);

  @SqlQuery("SELECT * FROM ontology_state WHERE ontologyId = :ontologyId")
  @RegisterRowMapper(StateMapper.class)
  OntologyState get(@BindUUID("ontologyId") UUID ontologyId);

  @SqlQuery("SELECT * FROM ontology_state WHERE ontologyId = :ontologyId FOR UPDATE")
  @RegisterRowMapper(StateMapper.class)
  OntologyState lock(@BindUUID("ontologyId") UUID ontologyId);

  @SqlQuery(
      "SELECT s.ontologyId FROM ontology_state s JOIN ontology_entity o ON o.id = s.ontologyId "
          + "WHERE s.activeReleaseId IS NOT NULL AND o.deleted = FALSE AND s.ontologyId > :after "
          + "ORDER BY s.ontologyId LIMIT :limit")
  List<String> listActive(@Bind("after") String after, @Bind("limit") int limit);

  @SqlUpdate(
      "UPDATE ontology_state SET workingRevision = workingRevision + 1 WHERE ontologyId = :ontologyId")
  int advanceWorkingRevision(@BindUUID("ontologyId") UUID ontologyId);

  @SqlUpdate(
      "UPDATE ontology_state SET lastReleaseRevision = lastReleaseRevision + 1 "
          + "WHERE ontologyId = :ontologyId AND lastReleaseRevision = :expectedRevision")
  int allocateReleaseRevision(
      @BindUUID("ontologyId") UUID ontologyId, @Bind("expectedRevision") long expectedRevision);

  @SqlUpdate(
      "UPDATE ontology_state SET activeReleaseId = :releaseId, activationRevision = activationRevision + 1 "
          + "WHERE ontologyId = :ontologyId AND activationRevision = :expectedRevision "
          + "AND EXISTS (SELECT 1 FROM ontology_release_entity r WHERE r.id = :releaseId "
          + "AND r.ontologyId = :ontologyId AND r.sealedAt IS NOT NULL "
          + "AND COALESCE(r.deleted, false) = false AND r.entityStatus = 'Approved')")
  int activate(
      @BindUUID("ontologyId") UUID ontologyId,
      @BindUUID("releaseId") UUID releaseId,
      @Bind("expectedRevision") long expectedRevision);

  class StateMapper implements RowMapper<OntologyState> {
    @Override
    public OntologyState map(final ResultSet rows, final StatementContext context)
        throws SQLException {
      final String activeRelease = rows.getString("activeReleaseId");
      return new OntologyState()
          .withOntologyId(UUID.fromString(rows.getString("ontologyId")))
          .withWorkingRevision(rows.getLong("workingRevision"))
          .withLastReleaseRevision(rows.getLong("lastReleaseRevision"))
          .withActiveReleaseId(activeRelease == null ? null : UUID.fromString(activeRelease))
          .withActivationRevision(rows.getLong("activationRevision"));
    }
  }
}
