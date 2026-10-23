package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.rdf.RdfUpdater;

/** Serializes a module's SQL writes with release capture on the caller's retained transaction. */
final class OntologyWorkingState {
  private static final ThreadLocal<Changes> CHANGES = new ThreadLocal<>();

  /**
   * Finalizers rerun until a pass records no change. A mutation still unsettled after this many
   * passes has a finalizer that never converges, so it fails instead of looping. See
   * ADR:2026-10-21-native-relations-instantiate-registry-relationship-types.
   */
  private static final int SETTLE_PASSES = 8;

  private final CollectionDAO dao;
  private final OntologyStateDAO states;
  private final OntologyReferenceIndex references;
  private final OntologyWorkingModel model;

  OntologyWorkingState(final CollectionDAO dao) {
    this.dao = dao;
    states = dao.ontologyStateDAO();
    references = new OntologyReferenceIndex(dao);
    model = new OntologyWorkingModel(dao);
  }

  <T extends OntologyDefinition, R> R mutate(
      final EntityDAO<T> entities, final List<T> definitions, final Supplier<R> work) {
    final boolean outermost = CHANGES.get() == null;
    if (outermost) {
      CHANGES.set(new Changes(new HashMap<>(), new HashSet<>(), new LinkedHashMap<>()));
    }
    try {
      final R result = mutateLocked(entities, definitions, work);
      if (outermost) {
        settle();
        CHANGES.get().definitions().entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(entry -> model.requireValid(entry.getKey(), net(entry.getValue())));
        CHANGES.get().graphs().stream()
            .sorted()
            .forEach(id -> RdfUpdater.enqueueOntologyGraph(dao, id));
      }
      return result;
    } finally {
      if (outermost) {
        CHANGES.remove();
      }
    }
  }

  /**
   * Registers work for the end of the outermost mutation in progress: it runs after every nested
   * write and before validation, sees each ontology's net changes so far, may write through the
   * repositories, and runs again until a pass adds no change. A key registers once per mutation.
   */
  void beforeValidation(
      final String key, final BiConsumer<UUID, List<OntologyWorkingModel.Change>> finalizer) {
    final Changes changes = CHANGES.get();
    if (changes == null) {
      throw new IllegalStateException("No ontology mutation is in progress");
    }
    changes.finalizers().putIfAbsent(key, finalizer);
  }

  private void settle() {
    final Changes changes = CHANGES.get();
    for (int pass = 0; !changes.finalizers().isEmpty(); pass++) {
      if (pass == SETTLE_PASSES) {
        throw new IllegalStateException(
            "Ontology writes did not settle within " + SETTLE_PASSES + " passes");
      }
      final int before = changes.count();
      for (final var finalizer : List.copyOf(changes.finalizers().values())) {
        for (final UUID ontologyId : changes.definitions().keySet().stream().sorted().toList()) {
          finalizer.accept(ontologyId, net(changes.definitions().get(ontologyId)));
        }
      }
      if (changes.count() == before) {
        return;
      }
    }
  }

  /**
   * One change per definition, from its state before the mutation to its latest. A nested write
   * of a definition already in the list, such as a finalizer's, supersedes the earlier state, so
   * validation never sees a row a later write has replaced.
   */
  private static List<OntologyWorkingModel.Change> net(
      final List<OntologyWorkingModel.Change> changes) {
    final Map<UUID, OntologyWorkingModel.Change> byId = new LinkedHashMap<>();
    for (final OntologyWorkingModel.Change change : changes) {
      final OntologyDefinition subject = change.after() == null ? change.before() : change.after();
      final OntologyWorkingModel.Change first = byId.get(subject.getId());
      byId.put(
          subject.getId(),
          first == null ? change : new OntologyWorkingModel.Change(first.before(), change.after()));
    }
    return List.copyOf(byId.values());
  }

  private <T extends OntologyDefinition, R> R mutateLocked(
      final EntityDAO<T> entities, final List<T> definitions, final Supplier<R> work) {
    definitions.stream()
        .map(OntologyWorkingState::ontologyId)
        .distinct()
        .sorted()
        .forEach(this::lock);
    final List<Baseline> baselines =
        definitions.stream()
            .sorted(Comparator.comparing(OntologyDefinition::getId))
            .map(entity -> lockCurrentRevision(entities, entity))
            .toList();
    final R result = work.get();
    final var changed = updateReferences(entities, baselines);
    changed.forEach(states::advanceWorkingRevision);
    return result;
  }

  private <T extends OntologyDefinition> Set<UUID> updateReferences(
      final EntityDAO<T> entities, final List<Baseline> baselines) {
    final Set<UUID> changed = new HashSet<>();
    for (final Baseline baseline : baselines) {
      final String json = entities.findJsonByIdForUpdate(baseline.entityId(), Include.ALL);
      if (!Objects.equals(baseline.json(), json)) {
        final T current =
            json == null ? null : JsonUtils.readValue(json, entities.getEntityClass());
        references.replace(
            Entity.getEntityTypeFromClass(entities.getEntityClass()), baseline.entityId(), current);
        CHANGES
            .get()
            .definitions()
            .computeIfAbsent(baseline.ontologyId(), ignored -> new ArrayList<>())
            .add(
                new OntologyWorkingModel.Change(
                    baseline.json() == null
                        ? null
                        : JsonUtils.readValue(baseline.json(), entities.getEntityClass()),
                    current));
        changed.add(baseline.ontologyId());
        if (entities.getEntityClass() == Ontology.class
            && baseline.json() != null
            && (json == null || isDeleted(baseline.json()) != isDeleted(json))) {
          CHANGES.get().graphs().add(baseline.ontologyId());
        }
      }
    }
    return changed;
  }

  void lock(final UUID ontologyId) {
    states.initialize(ontologyId);
    states.lock(ontologyId);
  }

  private static <T extends OntologyDefinition> Baseline lockCurrentRevision(
      final EntityDAO<T> entities, final T expected) {
    // Lock existing rows only: locking a missing MySQL key blocks unrelated inserts in its gap.
    final String existing =
        entities.findById(
            entities.getTableName(), expected.getId(), entities.getCondition(Include.ALL));
    final String json =
        existing == null ? null : entities.findJsonByIdForUpdate(expected.getId(), Include.ALL);
    if (json != null) {
      final T current = JsonUtils.readValue(json, entities.getEntityClass());
      if (!Objects.equals(expected.getVersion(), current.getVersion())
          || !Objects.equals(expected.getUpdatedAt(), current.getUpdatedAt())) {
        throw new PreconditionFailedException(
            "Ontology content changed before this write: " + expected.getFullyQualifiedName());
      }
    }
    return new Baseline(ontologyId(expected), expected.getId(), json);
  }

  private static UUID ontologyId(final OntologyDefinition entity) {
    return entity.getOntology() == null ? entity.getId() : entity.getOntology().getId();
  }

  private static boolean isDeleted(final String json) {
    return JsonUtils.readTree(json).path("deleted").asBoolean();
  }

  private record Changes(
      Map<UUID, List<OntologyWorkingModel.Change>> definitions,
      Set<UUID> graphs,
      Map<String, BiConsumer<UUID, List<OntologyWorkingModel.Change>>> finalizers) {
    int count() {
      return definitions.values().stream().mapToInt(List::size).sum();
    }
  }

  private record Baseline(UUID ontologyId, UUID entityId, String json) {}
}
