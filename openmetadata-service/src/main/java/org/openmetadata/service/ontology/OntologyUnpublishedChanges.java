package org.openmetadata.service.ontology;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO.MemberVersion;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO.WorkingVersion;

/**
 * Counts the rows the working diff of each ontology would return, for a page of ontologies, without
 * running that diff. Membership by id and entity version settles most definitions from two small
 * queries per kind. Only a definition whose version moved since the active release is read in full
 * and compared by content, exactly as the working diff compares it.
 */
public final class OntologyUnpublishedChanges {
  private record Source(MemberKind kind, String table, String ownerColumn) {}

  private record Member(MemberKind kind, UUID id) {}

  private static final List<Source> SOURCES =
      List.of(
          new Source(MemberKind.ONTOLOGY, "ontology_entity", "id"),
          new Source(MemberKind.CONCEPT, "ontology_concept_entity", "ontologyId"),
          new Source(MemberKind.PROPERTY, "ontology_property_entity", "ontologyId"),
          new Source(MemberKind.AXIOM, "ontology_axiom_entity", "ontologyId"));

  private final CollectionDAO dao;

  public OntologyUnpublishedChanges(final CollectionDAO dao) {
    this.dao = dao;
  }

  /** The count per ontology; the active release id is null for an ontology that has none. */
  public Map<UUID, Integer> count(final Map<UUID, UUID> activeReleaseByOntology) {
    if (activeReleaseByOntology.isEmpty()) {
      return Map.of();
    }
    final List<String> ontologyIds =
        activeReleaseByOntology.keySet().stream().map(UUID::toString).toList();
    final Map<UUID, Map<Member, Double>> working = new HashMap<>();
    for (final Source source : SOURCES) {
      for (final WorkingVersion row :
          EntityDAO.queryInChunks(
              ontologyIds,
              chunk ->
                  dao.ontologyReleaseDAO()
                      .listWorkingVersions(source.table(), source.ownerColumn(), chunk))) {
        working
            .computeIfAbsent(UUID.fromString(row.ontologyId()), id -> new HashMap<>())
            .put(new Member(source.kind(), UUID.fromString(row.id())), parse(row.version()));
      }
    }
    final Map<UUID, Map<Member, Double>> published = publishedMembers(activeReleaseByOntology);
    final Map<UUID, Integer> counts = new HashMap<>();
    final Map<MemberKind, Set<UUID>> stale = new HashMap<>();
    final Map<UUID, UUID> staleOwner = new HashMap<>();
    for (final UUID ontologyId : activeReleaseByOntology.keySet()) {
      final Map<Member, Double> now = working.getOrDefault(ontologyId, Map.of());
      final Map<Member, Double> then = published.getOrDefault(ontologyId, Map.of());
      int changes = 0;
      for (final var entry : now.entrySet()) {
        if (!then.containsKey(entry.getKey())) {
          changes++;
        } else if (!OntologyDefinitionStatusResolver.sameVersion(
            entry.getValue(), then.get(entry.getKey()))) {
          stale
              .computeIfAbsent(entry.getKey().kind(), kind -> new HashSet<>())
              .add(entry.getKey().id());
          staleOwner.put(entry.getKey().id(), ontologyId);
        }
      }
      changes += (int) then.keySet().stream().filter(member -> !now.containsKey(member)).count();
      counts.put(ontologyId, changes);
    }
    changedByContent(stale, activeReleaseByOntology, staleOwner)
        .forEach(ontologyId -> counts.merge(ontologyId, 1, Integer::sum));
    return counts;
  }

  private Map<UUID, Map<Member, Double>> publishedMembers(
      final Map<UUID, UUID> activeReleaseByOntology) {
    final Map<UUID, UUID> ontologyByRelease = new HashMap<>();
    activeReleaseByOntology.forEach(
        (ontologyId, releaseId) -> {
          if (releaseId != null) {
            ontologyByRelease.put(releaseId, ontologyId);
          }
        });
    final Map<UUID, Map<Member, Double>> published = new HashMap<>();
    if (ontologyByRelease.isEmpty()) {
      return published;
    }
    final List<String> releaseIds =
        ontologyByRelease.keySet().stream().map(UUID::toString).toList();
    for (final MemberVersion row :
        EntityDAO.queryInChunks(releaseIds, dao.ontologyReleaseDAO()::listAllMemberVersions)) {
      final MemberKind kind = MemberKind.fromValue(row.memberKind());
      if (SOURCES.stream().noneMatch(source -> source.kind() == kind)) {
        continue;
      }
      published
          .computeIfAbsent(
              ontologyByRelease.get(UUID.fromString(row.releaseId())), id -> new HashMap<>())
          .put(new Member(kind, UUID.fromString(row.memberId())), row.sourceVersion());
    }
    return published;
  }

  private List<UUID> changedByContent(
      final Map<MemberKind, Set<UUID>> stale,
      final Map<UUID, UUID> activeReleaseByOntology,
      final Map<UUID, UUID> staleOwner) {
    final List<UUID> changedOwners = new ArrayList<>();
    final List<String> releaseIds =
        activeReleaseByOntology.values().stream()
            .filter(Objects::nonNull)
            .map(UUID::toString)
            .distinct()
            .toList();
    for (final Source source : SOURCES) {
      final Set<UUID> ids = stale.getOrDefault(source.kind(), Set.of());
      if (ids.isEmpty()) {
        continue;
      }
      final Map<UUID, OntologyDefinition> current = new HashMap<>();
      workingDefinitions(source.kind(), List.copyOf(ids))
          .forEach(definition -> current.put(definition.getId(), definition));
      for (final OntologyReleaseMember member :
          EntityDAO.queryInChunks(
              ids.stream().map(UUID::toString).toList(),
              chunk ->
                  dao.ontologyReleaseDAO()
                      .listMemberPayloads(releaseIds, source.kind().value(), chunk))) {
        final OntologyDefinition now = current.get(member.getMemberId());
        final UUID owner = staleOwner.get(member.getMemberId());
        if (now != null
            && activeReleaseByOntology.get(owner).equals(member.getReleaseId())
            && !OntologyReleaseComparison.sameContent(
                now, OntologyReleaseReader.definition(member))) {
          changedOwners.add(owner);
        }
      }
    }
    return changedOwners;
  }

  private List<? extends OntologyDefinition> workingDefinitions(
      final MemberKind kind, final List<UUID> ids) {
    return switch (kind) {
      case ONTOLOGY -> dao.ontologyEntityDAO().findEntitiesByIds(ids, Include.NON_DELETED);
      case CONCEPT -> dao.ontologyConceptDAO().findEntitiesByIds(ids, Include.NON_DELETED);
      case PROPERTY -> dao.ontologyPropertyDAO().findEntitiesByIds(ids, Include.NON_DELETED);
      case AXIOM -> dao.ontologyAxiomDAO().findEntitiesByIds(ids, Include.NON_DELETED);
      default -> throw new IllegalArgumentException("Unsupported working member kind " + kind);
    };
  }

  private static Double parse(final String version) {
    try {
      return version == null ? null : Double.valueOf(version);
    } catch (NumberFormatException exception) {
      return null;
    }
  }
}
