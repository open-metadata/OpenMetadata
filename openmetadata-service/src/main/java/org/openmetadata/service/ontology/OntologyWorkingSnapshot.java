package org.openmetadata.service.ontology;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyEntityRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.jdbi3.OntologyStateDAO;
import org.openmetadata.service.util.FreshReadScope;

/** One authorized, bounded view of mutable ontology content under its state lock. */
public final class OntologyWorkingSnapshot {
  private static final int PAGE_SIZE = 1_000;
  static final Duration TIMEOUT = Duration.ofSeconds(30);
  static final int UNLOCKED_ATTEMPTS = 3;
  private static final long TIMEOUT_NANOS = TIMEOUT.toNanos();
  private final OntologyRepository ontologies;
  private final Map<MemberKind, OntologyEntityRepository<?>> definitions;

  public record Entry(MemberKind kind, OntologyDefinition definition) {}

  public record Snapshot(OntologyState state, List<Entry> entries) {
    public Ontology root() {
      return (Ontology) entries.getFirst().definition();
    }
  }

  public OntologyWorkingSnapshot(
      final OntologyRepository ontologies,
      final Map<MemberKind, OntologyEntityRepository<?>> definitions) {
    this.ontologies = ontologies;
    this.definitions = Map.copyOf(definitions);
  }

  public static OntologyWorkingSnapshot production() {
    return new OntologyWorkingSnapshot(
        (OntologyRepository) Entity.getEntityRepository(Entity.ONTOLOGY),
        Map.of(
            MemberKind.CONCEPT,
            (OntologyEntityRepository<?>) Entity.getEntityRepository(Entity.ONTOLOGY_CONCEPT),
            MemberKind.PROPERTY,
            (OntologyEntityRepository<?>) Entity.getEntityRepository(Entity.ONTOLOGY_PROPERTY),
            MemberKind.AXIOM,
            (OntologyEntityRepository<?>) Entity.getEntityRepository(Entity.ONTOLOGY_AXIOM)));
  }

  /** Reads under the `ontology_state` row lock, so the callback runs with every writer excluded. */
  public <T> T read(
      final UUID ontologyId,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final Function<Snapshot, T> callback) {
    return read(ontologyId, authorize, callback, true);
  }

  /**
   * Reads without the row lock, so authors keep writing while a reader pages the ontology. Every
   * write advances the working revision under the lock, so a revision that moved between the first
   * and the last page means the pages may disagree; the read starts over, and after
   * {@link #UNLOCKED_ATTEMPTS} torn reads it fails with 412. Whether a later statement sees a
   * write committed meanwhile depends on the connection's isolation: REPEATABLE READ keeps the
   * whole read on one snapshot, READ COMMITTED makes the revision check fire.
   */
  public <T> T readUnlocked(
      final UUID ontologyId,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final Function<Snapshot, T> callback) {
    PreconditionFailedException torn = null;
    for (int attempt = 0; attempt < UNLOCKED_ATTEMPTS; attempt++) {
      try {
        return read(ontologyId, authorize, callback, false);
      } catch (PreconditionFailedException changed) {
        torn = changed;
      }
    }
    throw torn;
  }

  private <T> T read(
      final UUID ontologyId,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final Function<Snapshot, T> callback,
      final boolean locked) {
    return ontologies.executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            final var dao = ontologies.getDaoCollection().ontologyStateDAO();
            final OntologyState state =
                locked ? lockedState(dao, ontologyId) : unlockedState(dao, ontologyId);
            final long deadline = System.nanoTime() + TIMEOUT_NANOS;
            final List<Entry> entries = new ArrayList<>();
            final Ontology root =
                ontologies.get(
                    null,
                    ontologyId,
                    ontologies.getFields("owners,reviewers"),
                    Include.NON_DELETED,
                    false);
            authorize.accept(List.of(root));
            long bytes = add(entries, MemberKind.ONTOLOGY, root, 0L, deadline);
            for (final var source : definitions.entrySet()) {
              bytes =
                  addPages(
                      ontologyId,
                      source.getKey(),
                      source.getValue(),
                      authorize,
                      entries,
                      bytes,
                      deadline);
            }
            requireTime(deadline);
            if (!locked) {
              requireUnchanged(state, dao.get(ontologyId));
            }
            final T result = callback.apply(new Snapshot(state, List.copyOf(entries)));
            requireTime(deadline);
            return result;
          }
        });
  }

  private static OntologyState lockedState(final OntologyStateDAO dao, final UUID ontologyId) {
    dao.initialize(ontologyId);
    return dao.lock(ontologyId);
  }

  /**
   * MySQL's {@code INSERT ... ON DUPLICATE KEY UPDATE} takes an exclusive lock on the existing row
   * for the rest of the transaction, so an unlocked read must not initialize a row that exists, or
   * every writer would queue behind it exactly as behind the locked read.
   */
  private static OntologyState unlockedState(final OntologyStateDAO dao, final UUID ontologyId) {
    final OntologyState existing = dao.get(ontologyId);
    if (existing != null) {
      return existing;
    }
    dao.initialize(ontologyId);
    return dao.get(ontologyId);
  }

  private static void requireUnchanged(final OntologyState before, final OntologyState after) {
    if (after == null
        || !Objects.equals(after.getWorkingRevision(), before.getWorkingRevision())
        || !Objects.equals(after.getActivationRevision(), before.getActivationRevision())) {
      throw new PreconditionFailedException("Ontology changed while it was read; retry");
    }
  }

  private static <T extends OntologyDefinition> long addPages(
      final UUID ontologyId,
      final MemberKind kind,
      final OntologyEntityRepository<T> repository,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final List<Entry> entries,
      long bytes,
      final long deadline) {
    final ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("ontologyId", ontologyId.toString());
    String after = null;
    do {
      requireTime(deadline);
      final ResultList<T> page =
          repository.listAfter(null, repository.getFields(""), filter, PAGE_SIZE, after);
      authorize.accept(page.getData());
      for (final T entity : page.getData()) {
        bytes = add(entries, kind, entity, bytes, deadline);
      }
      after = page.getPaging().getAfter();
    } while (after != null);
    return bytes;
  }

  private static long add(
      final List<Entry> entries,
      final MemberKind kind,
      final OntologyDefinition definition,
      final long bytes,
      final long deadline) {
    requireTime(deadline);
    if (entries.size() >= OntologyReleaseManifest.MAX_MEMBERS) {
      throw new BadRequestException(OntologyReleaseManifest.memberLimitMessage("An ontology"));
    }
    final int memberBytes =
        OntologyReleaseManifest.canonicalPayload(kind, OntologyReleaseContent.project(definition))
            .toString()
            .getBytes(StandardCharsets.UTF_8)
            .length;
    if (memberBytes > OntologyReleaseManifest.MAX_MEMBER_BYTES) {
      throw new BadRequestException(
          OntologyReleaseManifest.memberByteLimitMessage("An ontology member"));
    }
    final long total = bytes + memberBytes;
    if (total > OntologyReleaseManifest.MAX_RELEASE_BYTES) {
      throw new BadRequestException(OntologyReleaseManifest.byteLimitMessage("Ontology content"));
    }
    entries.add(new Entry(kind, definition));
    return total;
  }

  private static void requireTime(final long deadline) {
    if (System.nanoTime() >= deadline) {
      throw new BadRequestException(
          "Ontology snapshot exceeded its " + TIMEOUT.toSeconds() + " second budget");
    }
  }
}
