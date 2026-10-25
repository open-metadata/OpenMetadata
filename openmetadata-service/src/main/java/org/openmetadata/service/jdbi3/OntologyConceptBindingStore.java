package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingPosition;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.ConceptAssetCount;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.LiveAsset;
import org.openmetadata.service.ontology.OntologyClassHierarchy;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Operational catalog associations share the ontology lock without advancing semantic revisions.
 * Bindings are {@code ontology_concept_binding} rows; the per-concept revision stays in the {@code
 * ontology.conceptBindings} extension document and is compared under the ontology lock.
 */
public final class OntologyConceptBindingStore {
  public static final String EXTENSION = "ontology.conceptBindings";
  private static final String SCHEMA = "ontologyConceptBindings";
  private static final String FIRST_PAGE = "";
  private static final int MAX_ANCESTORS = OntologyReleaseManifest.MAX_MEMBERS;
  private final CollectionDAO dao;

  /** Runs under the ontology lock and returns the revision to commit; the current one is a no-op. */
  @FunctionalInterface
  public interface Mutation {
    long apply(OntologyConcept concept, OntologyConceptBindingStore locked, long currentRevision);
  }

  public OntologyConceptBindingStore(final CollectionDAO dao) {
    this.dao = dao;
  }

  public long revision(final UUID conceptId) {
    final String json = dao.entityExtensionDAO().getExtension(conceptId, EXTENSION);
    return json == null
        ? 0L
        : JsonUtils.readValue(json, OntologyConceptBindings.class).getRevision();
  }

  public void requireLiveOntology(final OntologyConcept concept) {
    dao.ontologyEntityDAO().findEntityById(concept.getOntology().getId());
  }

  public BindingRow find(final UUID conceptId, final UUID assetId) {
    return dao.ontologyConceptBindingDAO().find(conceptId, assetId);
  }

  public List<BindingRow> page(final UUID conceptId, final UUID after, final int limit) {
    return dao.ontologyConceptBindingDAO()
        .listAfter(conceptId, after == null ? FIRST_PAGE : after.toString(), limit);
  }

  public List<BindingRow> rows(final UUID conceptId) {
    return dao.ontologyConceptBindingDAO().list(conceptId);
  }

  public List<BindingRow> page(
      final Collection<UUID> conceptIds, final BindingPosition after, final int limit) {
    return conceptIds.isEmpty()
        ? List.of()
        : dao.ontologyConceptBindingDAO()
            .listForConceptsAfter(
                conceptIds.stream().map(UUID::toString).toList(),
                after != null,
                after == null ? FIRST_PAGE : after.conceptId().toString(),
                after == null ? FIRST_PAGE : after.assetId().toString(),
                limit);
  }

  public List<ConceptAssetCount> boundConcepts(
      final UUID ontologyId, final int limit, final int offset) {
    return dao.ontologyConceptBindingDAO().listBoundConcepts(ontologyId, limit, offset);
  }

  public int countBoundConcepts(final UUID ontologyId) {
    return dao.ontologyConceptBindingDAO().countBoundConcepts(ontologyId);
  }

  /** The assets of {@code rows} that are not deleted, with their service type, one query per type. */
  public Map<UUID, LiveAsset> liveAssets(final List<BindingRow> rows) {
    final Map<UUID, LiveAsset> live = new HashMap<>();
    BindingRow.assetIdsByType(rows)
        .forEach(
            (type, ids) -> {
              final String table = Entity.getEntityRepository(type.value()).getDao().getTableName();
              EntityDAO.queryInChunks(
                      ids.stream().map(UUID::toString).distinct().toList(),
                      chunk -> dao.ontologyConceptBindingDAO().findLiveAssets(table, chunk))
                  .forEach(asset -> live.put(asset.id(), asset));
            });
    return live;
  }

  public long update(final OntologyConcept concept, final Mutation mutation) {
    return dao.inTransaction(
        transaction ->
            new OntologyConceptBindingStore(transaction).updateLocked(concept, mutation));
  }

  private long updateLocked(final OntologyConcept concept, final Mutation mutation) {
    final UUID ontologyId = concept.getOntology().getId();
    dao.ontologyStateDAO().initialize(ontologyId);
    dao.ontologyStateDAO().lock(ontologyId);
    try (final var ignored = FreshReadScope.enter()) {
      final var currentConcept = dao.ontologyConceptDAO().findEntityById(concept.getId());
      requireLiveOntology(currentConcept);
      final long current = revision(currentConcept.getId());
      final long next = mutation.apply(currentConcept, this, current);
      if (next != current) {
        dao.entityExtensionDAO()
            .insert(
                currentConcept.getId(),
                EXTENSION,
                SCHEMA,
                JsonUtils.pojoToJson(new OntologyConceptBindings().withRevision(next)));
      }
      return next;
    }
  }

  public void save(final UUID conceptId, final OntologyAssetBinding asset, final String fqnHash) {
    dao.ontologyConceptBindingDAO()
        .upsert(
            conceptId,
            asset.getAssetId(),
            asset.getAssetType().value(),
            fqnHash,
            JsonUtils.pojoToJson(listOrEmpty(asset.getColumns())));
  }

  public void remove(final UUID conceptId, final UUID assetId) {
    dao.ontologyConceptBindingDAO().delete(conceptId, assetId);
  }

  public void remove(final UUID conceptId, final Collection<UUID> assetIds) {
    if (!assetIds.isEmpty()) {
      EntityDAO.updateInChunks(
          assetIds.stream().map(UUID::toString).distinct().toList(),
          chunk -> dao.ontologyConceptBindingDAO().deleteAssets(conceptId, chunk));
    }
  }

  public void deleteConcept(final UUID conceptId) {
    dao.ontologyConceptBindingDAO().deleteConcept(conceptId);
  }

  public Set<String> ancestors(final OntologyConcept concept) {
    final Set<String> visited = new HashSet<>();
    Set<String> pending = Set.of(concept.getIri().toString());
    int traversed = 0;
    while (!pending.isEmpty()) {
      visited.addAll(pending);
      final var axioms =
          dao.ontologyReferenceDAO()
              .ancestors(
                  concept.getOntology().getId(),
                  pending.stream().map(DigestUtils::sha256Hex).toList(),
                  MAX_ANCESTORS + 1,
                  "");
      traversed += axioms.size();
      requireBound(Math.max(visited.size(), traversed));
      pending = parents(axioms, pending, visited);
    }
    return Set.copyOf(visited);
  }

  private static Set<String> parents(
      final List<String> rows, final Set<String> pending, final Set<String> visited) {
    final Set<String> result = new HashSet<>();
    for (final String json : rows) {
      final var axiom = JsonUtils.readValue(json, OntologyAxiom.class);
      if (pending.contains(axiom.getSubjectIri().toString())) {
        OntologyClassHierarchy.namedParents(axiom).stream()
            .map(URI::toString)
            .filter(iri -> !visited.contains(iri))
            .forEach(result::add);
        requireBound(result.size());
      }
    }
    return result;
  }

  private static void requireBound(final int size) {
    if (size > MAX_ANCESTORS) {
      throw new BadRequestException("Binding property inheritance exceeds the 10000 axiom limit");
    }
  }
}
