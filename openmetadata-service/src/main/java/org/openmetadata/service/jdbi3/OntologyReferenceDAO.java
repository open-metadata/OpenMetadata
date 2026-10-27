package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMethods;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyReferenceRole;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface OntologyReferenceDAO {
  String TARGET = " FROM ontology_reference WHERE ontologyId = :ontologyId AND iriHash = :iriHash ";
  String AFTER =
      " AND (sourceType > :afterType OR (sourceType = :afterType AND "
          + "(sourceId > :afterId OR (sourceId = :afterId AND role > :afterRole)))) "
          + "ORDER BY sourceType, sourceId, role LIMIT :limit";

  record AxiomPosition(String name, String id) {
    public static final AxiomPosition FIRST = new AxiomPosition("", "");

    public boolean hasAfter() {
      return !id.isEmpty();
    }
  }

  record EdgeAxiomRow(String name, UUID id, String json) {
    public AxiomPosition position() {
      return new AxiomPosition(name, id.toString());
    }
  }

  @SqlUpdate(
      "INSERT INTO ontology_reference (ontologyId, sourceType, sourceId, role, iri, iriHash) "
          + "VALUES (:ontologyId, :sourceType, :sourceId, :role, :iri, :iriHash)")
  void insert(
      @BindUUID("ontologyId") UUID ontologyId,
      @Bind("sourceType") String sourceType,
      @BindUUID("sourceId") UUID sourceId,
      @Bind("role") String role,
      @Bind("iri") String iri,
      @Bind("iriHash") String iriHash);

  default void insert(OntologyReference reference, String iriHash) {
    insert(
        reference.getOntologyId(),
        reference.getSource().getType(),
        reference.getSource().getId(),
        reference.getRole().value(),
        reference.getIri().toString(),
        iriHash);
  }

  @SqlUpdate(
      "DELETE FROM ontology_reference WHERE sourceType = :sourceType AND sourceId = :sourceId")
  void delete(@Bind("sourceType") String sourceType, @BindUUID("sourceId") UUID sourceId);

  @ConnectionAwareSqlQuery(
      value = "SELECT *" + TARGET + "AND BINARY iri = BINARY :iri" + AFTER,
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT *" + TARGET + "AND iri = :iri" + AFTER,
      connectionType = POSTGRES)
  @RegisterRowMapper(ReferenceMapper.class)
  List<OntologyReference> list(
      @BindUUID("ontologyId") UUID ontologyId,
      @Bind("iriHash") String iriHash,
      @Bind("iri") String iri,
      @Bind("afterType") String afterType,
      @Bind("afterId") String afterId,
      @Bind("afterRole") String afterRole,
      @Bind("limit") int limit);

  @ConnectionAwareSqlQuery(
      value = "SELECT COUNT(*)" + TARGET + "AND BINARY iri = BINARY :iri",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT COUNT(*)" + TARGET + "AND iri = :iri",
      connectionType = POSTGRES)
  int count(
      @BindUUID("ontologyId") UUID ontologyId,
      @Bind("iriHash") String iriHash,
      @Bind("iri") String iri);

  @SqlQuery(
      "SELECT * FROM ontology_reference WHERE ontologyId = :ontologyId AND iriHash IN (<iriHashes>) "
          + "ORDER BY sourceType, sourceId, role LIMIT :limit FOR UPDATE")
  @RegisterRowMapper(ReferenceMapper.class)
  List<OntologyReference> referencingForUpdate(
      @BindUUID("ontologyId") UUID ontologyId,
      @BindList("iriHashes") List<String> iriHashes,
      @Bind("limit") int limit);

  @SqlQuery(
      "SELECT a.json FROM ontology_axiom_entity a JOIN ontology_reference r "
          + "ON r.sourceId = a.id AND r.ontologyId = a.ontologyId "
          + "WHERE a.ontologyId = :ontologyId AND a.deleted = FALSE AND a.axiomType = 'SUBCLASS_OF' "
          + "AND r.sourceType = 'ontologyAxiom' AND r.role = 'AXIOM_SUBJECT' AND r.iriHash IN (<iriHashes>) "
          + "ORDER BY a.name, a.id LIMIT :limit <locking>")
  List<String> ancestors(
      @BindUUID("ontologyId") UUID ontologyId,
      @BindList("iriHashes") List<String> iriHashes,
      @Bind("limit") int limit,
      @Define("locking") String locking);

  @SqlQuery(
      "SELECT p.json FROM ontology_property_entity p JOIN ontology_reference r "
          + "ON r.sourceId = p.id AND r.ontologyId = p.ontologyId "
          + "WHERE p.ontologyId = :ontologyId AND p.deleted = FALSE "
          + "AND r.sourceType = 'ontologyProperty' AND r.role = 'INVERSE' AND r.iriHash IN (<iriHashes>) "
          + "ORDER BY p.name, p.id LIMIT :limit <locking>")
  List<String> incomingInverses(
      @BindUUID("ontologyId") UUID ontologyId,
      @BindList("iriHashes") List<String> iriHashes,
      @Bind("limit") int limit,
      @Define("locking") String locking);

  @SqlQuery(
      "SELECT a.json FROM ontology_axiom_entity a WHERE a.ontologyId IN (<ontologyIds>) "
          + "AND a.deleted = FALSE AND a.axiomType = 'SUBCLASS_OF' AND EXISTS "
          + "(SELECT 1 FROM ontology_reference r WHERE r.sourceId = a.id "
          + "AND r.sourceType = 'ontologyAxiom' AND r.role = :role AND r.iriHash IN (<iriHashes>)) "
          + "ORDER BY a.name, a.id LIMIT :limit")
  List<String> listHierarchyAxioms(
      @BindList("ontologyIds") List<String> ontologyIds,
      @BindList("iriHashes") List<String> iriHashes,
      @Bind("role") String role,
      @Bind("limit") int limit);

  String PROPERTY_EDGE_AXIOMS =
      "SELECT a.name, a.id, a.json FROM ontology_axiom_entity a WHERE a.ontologyId = :ontologyId "
          + "AND a.deleted = FALSE AND a.axiomType IN "
          + "('SUBCLASS_OF', 'EQUIVALENT_CLASS', 'OBJECT_PROPERTY_ASSERTION') AND EXISTS "
          + "(SELECT 1 FROM ontology_reference r WHERE r.sourceId = a.id "
          + "AND r.ontologyId = a.ontologyId AND r.sourceType = 'ontologyAxiom' "
          + "AND r.role = 'AXIOM_SUBJECT' AND r.iriHash IN (<iriHashes>)) ";

  @SqlQuery(
      PROPERTY_EDGE_AXIOMS
          + "AND (:after.hasAfter = FALSE OR a.name > :after.name "
          + "OR (a.name = :after.name AND (a.id > :after.id OR (:inclusive = TRUE AND a.id = :after.id)))) "
          + "ORDER BY a.name, a.id LIMIT :limit")
  @RegisterRowMapper(EdgeAxiomRowMapper.class)
  List<EdgeAxiomRow> listPropertyEdgeAxioms(
      @BindUUID("ontologyId") UUID ontologyId,
      @BindList("iriHashes") List<String> iriHashes,
      @BindMethods("after") AxiomPosition after,
      @Bind("limit") int limit,
      @Bind("inclusive") boolean inclusive);

  default List<EdgeAxiomRow> listPropertyEdgeAxioms(
      UUID ontologyId, List<String> iriHashes, AxiomPosition after, int limit) {
    return listPropertyEdgeAxioms(ontologyId, iriHashes, after, limit, false);
  }

  @SqlQuery(PROPERTY_EDGE_AXIOMS + "AND a.id = :id LIMIT 1")
  @RegisterRowMapper(EdgeAxiomRowMapper.class)
  EdgeAxiomRow findPropertyEdgeAxiomPosition(
      @BindUUID("ontologyId") UUID ontologyId,
      @BindList("iriHashes") List<String> iriHashes,
      @BindUUID("id") UUID id);

  class EdgeAxiomRowMapper implements RowMapper<EdgeAxiomRow> {
    @Override
    public EdgeAxiomRow map(final ResultSet rows, final StatementContext context)
        throws SQLException {
      return new EdgeAxiomRow(
          rows.getString("name"), UUID.fromString(rows.getString("id")), rows.getString("json"));
    }
  }

  class ReferenceMapper implements RowMapper<OntologyReference> {
    @Override
    public OntologyReference map(final ResultSet rows, final StatementContext context)
        throws SQLException {
      return new OntologyReference()
          .withOntologyId(UUID.fromString(rows.getString("ontologyId")))
          .withSource(
              new EntityReference()
                  .withType(rows.getString("sourceType"))
                  .withId(UUID.fromString(rows.getString("sourceId"))))
          .withRole(OntologyReferenceRole.fromValue(rows.getString("role")))
          .withIri(URI.create(rows.getString("iri")));
    }
  }
}
