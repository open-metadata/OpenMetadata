package org.openmetadata.service.rdf.translator;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.ontology.OntologyReleaseReader;

/**
 * Reads an asset's binding rows and keeps those whose concept, and for a column assignment whose
 * property, is a member of the active release of a live ontology, under the IRI that release gives
 * it. A concept outside every active release is described by no graph, so its binding projects
 * nothing until a release that holds it is activated.
 */
public final class DatabaseConceptBindingLookup implements ConceptBindingLookup {
  private final CollectionDAO dao;

  public DatabaseConceptBindingLookup(final CollectionDAO dao) {
    this.dao = dao;
  }

  @Override
  public Map<UUID, List<ServedBinding>> servedBindings(final Collection<UUID> assetIds) {
    final List<BindingRow> rows =
        EntityDAO.queryInChunks(
            assetIds.stream().map(UUID::toString).toList(),
            dao.ontologyConceptBindingDAO()::listForAssets);
    final Map<UUID, String> concepts =
        servedIris(MemberKind.CONCEPT, rows.stream().map(BindingRow::conceptId).toList());
    final List<BindingRow> served =
        rows.stream().filter(row -> concepts.containsKey(row.conceptId())).toList();
    final Map<UUID, String> properties = servedIris(MemberKind.PROPERTY, propertyIds(served));
    return byAsset(served, concepts, properties);
  }

  private Map<UUID, String> servedIris(final MemberKind kind, final List<UUID> ids) {
    final Map<UUID, String> iris = new HashMap<>();
    if (!ids.isEmpty()) {
      EntityDAO.queryInChunks(
              ids.stream().map(UUID::toString).distinct().toList(),
              chunk -> dao.ontologyReleaseDAO().listActiveMembers(kind.value(), chunk))
          .forEach(member -> iris.put(member.getMemberId(), iri(member)));
    }
    return iris;
  }

  private static String iri(final OntologyReleaseMember member) {
    final URI iri =
        switch (OntologyReleaseReader.definition(member)) {
          case OntologyConcept concept -> concept.getIri();
          case OntologyProperty property -> property.getIri();
          default -> throw new IllegalStateException(
              "A binding names release member "
                  + member.getMemberId()
                  + " of kind "
                  + member.getMemberKind());
        };
    return iri.toString();
  }

  private static List<UUID> propertyIds(final List<BindingRow> rows) {
    return rows.stream()
        .flatMap(row -> row.columns().stream())
        .map(OntologyColumnBinding::getPropertyId)
        .toList();
  }

  private static Map<UUID, List<ServedBinding>> byAsset(
      final List<BindingRow> rows,
      final Map<UUID, String> concepts,
      final Map<UUID, String> properties) {
    final Map<UUID, List<ServedBinding>> bindings = new LinkedHashMap<>();
    for (final BindingRow row : rows) {
      bindings
          .computeIfAbsent(row.assetId(), id -> new ArrayList<>())
          .add(new ServedBinding(concepts.get(row.conceptId()), columns(row, properties)));
    }
    return bindings;
  }

  private static List<ServedColumn> columns(
      final BindingRow row, final Map<UUID, String> properties) {
    return row.columns().stream()
        .filter(column -> properties.containsKey(column.getPropertyId()))
        .map(
            column ->
                new ServedColumn(properties.get(column.getPropertyId()), column.getColumnPath()))
        .toList();
  }
}
