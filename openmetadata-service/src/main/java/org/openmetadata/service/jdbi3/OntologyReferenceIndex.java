package org.openmetadata.service.jdbi3;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyReferenceRole;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyReferences;
import org.openmetadata.service.util.RestUtil;

/** Maintains derived working references inside the definition writer's SQL transaction. */
final class OntologyReferenceIndex {
  private static final Set<String> SOURCE_TYPES =
      Set.of(Entity.ONTOLOGY_CONCEPT, Entity.ONTOLOGY_PROPERTY, Entity.ONTOLOGY_AXIOM);
  private final OntologyReferenceDAO dao;

  OntologyReferenceIndex(final CollectionDAO dao) {
    this.dao = dao.ontologyReferenceDAO();
  }

  void replace(
      final String sourceType,
      final UUID sourceId,
      final boolean existed,
      final OntologyDefinition current) {
    // Deleting a source that has no rows still takes a MySQL gap lock, and two concurrent creates
    // then deadlock on their inserts.
    if (existed) {
      dao.delete(sourceType, sourceId);
    }
    if (current != null) {
      for (final OntologyReference reference : OntologyReferences.collect(current)) {
        dao.insert(reference, DigestUtils.sha256Hex(reference.getIri().toString()));
      }
    }
  }

  ResultList<OntologyReference> list(
      final UUID ontologyId, final URI iri, final int limit, final String after) {
    if (iri == null || !iri.isAbsolute() || limit < 1 || limit > 1000) {
      throw new BadRequestException(
          "Reference lookup requires an absolute IRI and a limit from 1 to 1000");
    }
    final Cursor cursor = Cursor.parse(after);
    final String value = iri.toString();
    final String hash = DigestUtils.sha256Hex(value);
    final List<OntologyReference> matches =
        dao.list(ontologyId, hash, value, cursor.type(), cursor.id(), cursor.role(), limit + 1);
    final List<OntologyReference> page =
        List.copyOf(matches.subList(0, Math.min(limit, matches.size())));
    return new ResultList<>(
        page,
        null,
        matches.size() > limit ? Cursor.of(page.getLast()) : null,
        dao.count(ontologyId, hash, value));
  }

  private record Cursor(String type, String id, String role) {
    static Cursor parse(final String after) {
      if (after == null) {
        return new Cursor("", "", "");
      }
      try {
        final String[] fields = RestUtil.decodeCursor(after).split(":", -1);
        if (fields.length != 3 || !SOURCE_TYPES.contains(fields[0])) {
          throw new IllegalArgumentException();
        }
        return new Cursor(
            fields[0],
            UUID.fromString(fields[1]).toString(),
            OntologyReferenceRole.fromValue(fields[2]).value());
      } catch (IllegalArgumentException invalid) {
        throw new BadRequestException("Invalid ontology reference cursor");
      }
    }

    static String of(final OntologyReference reference) {
      return reference.getSource().getType()
          + ":"
          + reference.getSource().getId()
          + ":"
          + reference.getRole().value();
    }
  }
}
