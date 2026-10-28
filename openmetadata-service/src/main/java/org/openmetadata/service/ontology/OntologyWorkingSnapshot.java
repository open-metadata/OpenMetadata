package org.openmetadata.service.ontology;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyEntityRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.util.FreshReadScope;

/** One authorized, bounded view of mutable ontology content under its state lock. */
public final class OntologyWorkingSnapshot {
  private static final int PAGE_SIZE = 100;
  private static final long TIMEOUT_NANOS = Duration.ofSeconds(30).toNanos();
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

  public <T> T read(
      final UUID ontologyId,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final Function<Snapshot, T> callback) {
    return ontologies.executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            final var dao = ontologies.getDaoCollection().ontologyStateDAO();
            dao.initialize(ontologyId);
            final OntologyState state = dao.lock(ontologyId);
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
            final T result = callback.apply(new Snapshot(state, List.copyOf(entries)));
            requireTime(deadline);
            return result;
          }
        });
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
      throw new BadRequestException("An ontology exceeds the 10000 member limit");
    }
    final int memberBytes =
        OntologyReleaseManifest.canonicalPayload(kind, OntologyReleaseContent.project(definition))
            .toString()
            .getBytes(StandardCharsets.UTF_8)
            .length;
    if (memberBytes > OntologyReleaseManifest.MAX_MEMBER_BYTES) {
      throw new BadRequestException("An ontology member exceeds the 1 MiB limit");
    }
    final long total = bytes + memberBytes;
    if (total > OntologyReleaseManifest.MAX_RELEASE_BYTES) {
      throw new BadRequestException("Ontology content exceeds the 64 MiB limit");
    }
    entries.add(new Entry(kind, definition));
    return total;
  }

  private static void requireTime(final long deadline) {
    if (System.nanoTime() >= deadline) {
      throw new BadRequestException("Ontology snapshot exceeded its 30 second budget");
    }
  }
}
