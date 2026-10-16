package org.openmetadata.service.ontology;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.CollectionDAO;

/** Reads bounded, verified SQL snapshots without consulting mutable definition rows. */
public final class OntologyReleaseReader {
  private static final int PAGE_SIZE = 100;
  private final CollectionDAO dao;

  public OntologyReleaseReader(final CollectionDAO dao) {
    this.dao = dao;
  }

  public List<OntologyReleaseMember> read(
      final OntologyRelease release, final Consumer<OntologyDefinition> authorize) {
    authorize.accept(release);
    final List<OntologyReleaseMember> members = new ArrayList<>();
    long bytes = 0;
    for (final MemberKind kind : MemberKind.values()) {
      String after = "";
      List<OntologyReleaseMember> page;
      do {
        page =
            dao.ontologyReleaseDAO().listMembers(release.getId(), kind.value(), after, PAGE_SIZE);
        for (final var member : page) {
          bytes += member.getPayloadBytes();
          requireBounds(members.size() + 1, bytes);
          authorize.accept(definition(release, member));
          members.add(member);
        }
        if (!page.isEmpty()) {
          after = page.getLast().getMemberId().toString();
        }
      } while (page.size() == PAGE_SIZE);
    }
    OntologyReleaseManifest.verify(release, members);
    return List.copyOf(members);
  }

  public static void requireBounds(final int count, final long bytes) {
    if (count > OntologyReleaseManifest.MAX_MEMBERS
        || bytes > OntologyReleaseManifest.MAX_RELEASE_BYTES) {
      throw new BadRequestException("Ontology release exceeds its member or byte limit");
    }
  }

  public static OntologyDefinition definition(
      final OntologyRelease release, final OntologyReleaseMember member) {
    final OntologyDefinition value = definition(member);
    if (value instanceof Ontology ontology) {
      if (!Objects.equals(release.getOntology().getId(), ontology.getId())
          || !Objects.equals(release.getOntologyIri().toString(), ontology.getIri().toString())) {
        throw new BadRequestException("Ontology release root does not match its header");
      }
    } else if (value.getOntology() == null
        || !Objects.equals(release.getOntology().getId(), value.getOntology().getId())) {
      throw new BadRequestException("Ontology release contains a definition from another ontology");
    }
    return value;
  }

  public static OntologyDefinition definition(final OntologyReleaseMember member) {
    final Class<? extends OntologyDefinition> type =
        switch (member.getMemberKind()) {
          case ONTOLOGY -> Ontology.class;
          case CONCEPT -> OntologyConcept.class;
          case PROPERTY -> OntologyProperty.class;
          case AXIOM -> OntologyAxiom.class;
          default -> throw new BadRequestException(
              "Unsupported ontology release member: " + member.getMemberKind());
        };
    final var value = JsonUtils.getObjectMapper().convertValue(member.getPayload(), type);
    if (!Objects.equals(member.getMemberId(), value.getId())) {
      throw new BadRequestException("Ontology release member identity does not match its payload");
    }
    return value;
  }

  public static Ontology root(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    final var roots =
        members.stream().filter(member -> member.getMemberKind() == MemberKind.ONTOLOGY).toList();
    if (roots.size() != 1) {
      throw new BadRequestException("An ontology release requires exactly one ontology root");
    }
    return (Ontology) definition(release, roots.getFirst());
  }
}
