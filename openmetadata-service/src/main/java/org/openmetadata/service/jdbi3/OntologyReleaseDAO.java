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
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.ontology.OntologyJson;
import org.openmetadata.service.util.jdbi.BindJson;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface OntologyReleaseDAO extends EntityDAO<OntologyRelease> {
  @ConnectionAwareSqlQuery(
      value =
          "SELECT json_unquote(json_extract(json, '$.semanticVersion')) FROM ontology_release_entity "
              + "WHERE ontologyId = :ontologyId AND sealedAt IS NOT NULL "
              + "AND json_unquote(json_extract(json, '$.semanticVersion')) IS NOT NULL "
              + "ORDER BY releaseRevision DESC LIMIT 1 FOR UPDATE",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT json ->> 'semanticVersion' FROM ontology_release_entity "
              + "WHERE ontologyId = :ontologyId AND sealedAt IS NOT NULL "
              + "AND json ->> 'semanticVersion' IS NOT NULL ORDER BY releaseRevision DESC LIMIT 1 FOR UPDATE",
      connectionType = POSTGRES)
  String findLatestSemanticVersion(@BindUUID("ontologyId") UUID ontologyId);

  @SqlQuery(
      "SELECT json FROM ontology_release_entity WHERE ontologyId = :ontologyId "
          + "AND entityStatus = :entityStatus AND (deleted IS NULL OR deleted = false) "
          + "ORDER BY releaseRevision")
  List<String> listByStatus(
      @BindUUID("ontologyId") UUID ontologyId, @Bind("entityStatus") String entityStatus);

  @SqlQuery(
      "SELECT json FROM ontology_release_entity WHERE entityStatus = :entityStatus "
          + "AND (deleted IS NULL OR deleted = false) "
          + "AND (updatedAt < :afterUpdatedAt OR (updatedAt = :afterUpdatedAt AND id > :afterId)) "
          + "ORDER BY updatedAt DESC, id LIMIT :limit")
  List<String> listAllByStatus(
      @Bind("entityStatus") String entityStatus,
      @Bind("limit") int limit,
      @Bind("afterUpdatedAt") long afterUpdatedAt,
      @Bind("afterId") String afterId);

  @SqlQuery(
      "SELECT COALESCE(MAX(releaseRevision), 0) FROM ontology_release_entity "
          + "WHERE ontologyId = :ontologyId AND sealedAt IS NOT NULL "
          + "AND (deleted IS NULL OR deleted = false)")
  long latestSealedRevision(@BindUUID("ontologyId") UUID ontologyId);

  @SqlQuery(
      "SELECT json FROM ontology_release_entity WHERE ontologyId = :ontologyId "
          + "AND sealedAt IS NOT NULL AND (deleted IS NULL OR deleted = false) "
          + "AND releaseRevision <= :highWater AND (:before = 0 OR releaseRevision < :before) "
          + "ORDER BY releaseRevision DESC LIMIT :limit")
  List<String> listChronological(
      @BindUUID("ontologyId") UUID ontologyId,
      @Bind("highWater") long highWater,
      @Bind("before") long before,
      @Bind("limit") int limit);

  @SqlQuery(
      "SELECT COUNT(*) FROM ontology_release_entity WHERE ontologyId = :ontologyId "
          + "AND sealedAt IS NOT NULL AND (deleted IS NULL OR deleted = false) "
          + "AND releaseRevision <= :highWater")
  int countChronological(
      @BindUUID("ontologyId") UUID ontologyId, @Bind("highWater") long highWater);

  @SqlQuery(
      "SELECT id FROM ontology_release_entity WHERE ontologyId = :ontologyId LIMIT 1 FOR UPDATE")
  String findRetainedReleaseForUpdate(@BindUUID("ontologyId") UUID ontologyId);

  default boolean hasReleases(final UUID ontologyId) {
    // A purge must see captures committed after its MySQL transaction snapshot began.
    return findRetainedReleaseForUpdate(ontologyId) != null;
  }

  @SqlQuery(
      "SELECT json FROM ontology_release_event WHERE releaseId = :releaseId "
          + "AND eventType = 'ACTIVATED' ORDER BY createdAt, id LIMIT 1")
  String findActivation(@BindUUID("releaseId") UUID releaseId);

  @Override
  default String getTableName() {
    return "ontology_release_entity";
  }

  @Override
  default Class<OntologyRelease> getEntityClass() {
    return OntologyRelease.class;
  }

  @Override
  default String getNameHashColumn() {
    return "fqnHash";
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_release_member (releaseId, memberKind, memberId, sourceVersion, "
              + "payload, payloadDigest, payloadBytes) "
              + "SELECT :releaseId, :memberKind, :memberId, :sourceVersion, "
              + ":payload, :payloadDigest, :payloadBytes FROM ontology_release_entity "
              + "WHERE id = :releaseId AND sealedAt IS NULL",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_release_member (releaseId, memberKind, memberId, sourceVersion, "
              + "payload, payloadDigest, payloadBytes) "
              + "SELECT :releaseId, :memberKind, :memberId, :sourceVersion, "
              + ":payload, :payloadDigest, :payloadBytes FROM ontology_release_entity "
              + "WHERE id = :releaseId AND sealedAt IS NULL",
      connectionType = POSTGRES)
  int insertMember(
      @BindUUID("releaseId") UUID releaseId,
      @Bind("memberKind") String memberKind,
      @BindUUID("memberId") UUID memberId,
      @Bind("sourceVersion") Double sourceVersion,
      @Bind("payload") String payload,
      @Bind("payloadDigest") String payloadDigest,
      @Bind("payloadBytes") long payloadBytes);

  default int insertMember(final OntologyReleaseMember member) {
    return insertMember(
        member.getReleaseId(),
        member.getMemberKind().value(),
        member.getMemberId(),
        member.getSourceVersion(),
        member.getPayload().toString(),
        member.getPayloadDigest(),
        member.getPayloadBytes());
  }

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE ontology_release_entity SET json = :json WHERE id = :id AND sealedAt IS NULL "
              + "AND (SELECT COUNT(*) FROM ontology_release_member WHERE releaseId = :id) = :memberCount",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE ontology_release_entity SET json = :json::jsonb WHERE id = :id AND sealedAt IS NULL "
              + "AND (SELECT COUNT(*) FROM ontology_release_member WHERE releaseId = :id) = :memberCount",
      connectionType = POSTGRES)
  int seal(
      @BindUUID("id") UUID id, @BindJson("json") String json, @Bind("memberCount") int memberCount);

  @SqlQuery(
      "SELECT m.* FROM ontology_release_member m JOIN ontology_release_entity r ON r.id = m.releaseId "
          + "WHERE m.releaseId = :releaseId AND m.memberKind = :memberKind AND m.memberId > :after "
          + "AND r.sealedAt IS NOT NULL ORDER BY m.memberId LIMIT :limit")
  @RegisterRowMapper(MemberMapper.class)
  List<OntologyReleaseMember> listMembers(
      @BindUUID("releaseId") UUID releaseId,
      @Bind("memberKind") String memberKind,
      @Bind("after") String after,
      @Bind("limit") int limit);

  @SqlQuery(
      "SELECT m.* FROM ontology_release_member m JOIN ontology_release_entity r ON r.id = m.releaseId "
          + "WHERE m.releaseId = :releaseId AND m.memberKind = :memberKind AND m.memberId = :memberId "
          + "AND r.sealedAt IS NOT NULL")
  @RegisterRowMapper(MemberMapper.class)
  OntologyReleaseMember getMember(
      @BindUUID("releaseId") UUID releaseId,
      @Bind("memberKind") String memberKind,
      @BindUUID("memberId") UUID memberId);

  @SqlQuery(
      "SELECT COUNT(*) FROM ontology_release_member m JOIN ontology_release_entity r ON r.id = m.releaseId "
          + "WHERE m.releaseId = :releaseId AND m.memberKind = :memberKind AND r.sealedAt IS NOT NULL")
  int countMembers(@BindUUID("releaseId") UUID releaseId, @Bind("memberKind") String kind);

  @SqlQuery("SELECT json FROM ontology_release_event WHERE releaseId = :releaseId AND id = :id")
  String findEvent(@BindUUID("releaseId") UUID releaseId, @BindUUID("id") UUID id);

  @SqlQuery(
      "SELECT json FROM ontology_release_event WHERE releaseId = :releaseId "
          + "AND (createdAt > :afterCreatedAt OR (createdAt = :afterCreatedAt AND id > :afterId)) "
          + "ORDER BY createdAt, id LIMIT :limit")
  List<String> listEvents(
      @BindUUID("releaseId") UUID releaseId,
      @Bind("afterCreatedAt") long afterCreatedAt,
      @Bind("afterId") String afterId,
      @Bind("limit") int limit);

  @SqlQuery("SELECT COUNT(*) FROM ontology_release_event WHERE releaseId = :releaseId")
  int countEvents(@BindUUID("releaseId") UUID releaseId);

  default void appendEvent(final OntologyReleaseEvent event) {
    appendEvent(
        event.getId(),
        event.getOntologyId(),
        event.getReleaseId(),
        event.getEventType().value(),
        event.getCreatedAt(),
        event.getCreatedBy(),
        JsonUtils.pojoToJson(event));
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_release_event (id, ontologyId, releaseId, eventType, createdAt, createdBy, json) "
              + "VALUES (:id, :ontologyId, :releaseId, :eventType, :createdAt, :createdBy, :json)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO ontology_release_event (id, ontologyId, releaseId, eventType, createdAt, createdBy, json) "
              + "VALUES (:id, :ontologyId, :releaseId, :eventType, :createdAt, :createdBy, :json::jsonb)",
      connectionType = POSTGRES)
  void appendEvent(
      @BindUUID("id") UUID id,
      @BindUUID("ontologyId") UUID ontologyId,
      @BindUUID("releaseId") UUID releaseId,
      @Bind("eventType") String eventType,
      @Bind("createdAt") long createdAt,
      @Bind("createdBy") String createdBy,
      @BindJson("json") String json);

  class MemberMapper implements RowMapper<OntologyReleaseMember> {
    @Override
    public OntologyReleaseMember map(final ResultSet rows, final StatementContext context)
        throws SQLException {
      return new OntologyReleaseMember()
          .withReleaseId(UUID.fromString(rows.getString("releaseId")))
          .withMemberKind(MemberKind.fromValue(rows.getString("memberKind")))
          .withMemberId(UUID.fromString(rows.getString("memberId")))
          .withSourceVersion(rows.getObject("sourceVersion", Double.class))
          .withPayload(OntologyJson.read(rows.getString("payload")))
          .withPayloadDigest(rows.getString("payloadDigest"))
          .withPayloadBytes(rows.getLong("payloadBytes"));
    }
  }
}
