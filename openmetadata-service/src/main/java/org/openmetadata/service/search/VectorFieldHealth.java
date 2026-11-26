package org.openmetadata.service.search;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import java.util.stream.Collectors;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

/**
 * The search indexes whose live {@code embedding} field cannot hold the vectors of the configured
 * embedding model, and why. Vector writes and vector search leave them out, server start and
 * {@code migrate} report them in one error, and the status page shows them, until a rebuild gives
 * them a field for the model. Such an index is read again on the node whose rebuild replaces it,
 * when the status page is opened, and at most once a minute when a write or a search consults it,
 * so a rebuild run anywhere clears it without a restart (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 */
public final class VectorFieldHealth {
  static final Duration RECHECK_AFTER = Duration.ofMinutes(1);

  static final String WAY_OUT =
      "Rebuild them with this model: run ./bootstrap/openmetadata-ops.sh reindex, which rebuilds "
          + "exactly these, or Search Indexing for all entities, or configure the previous "
          + "embedding model again.";

  /**
   * One name the server writes vectors to that cannot hold the model's vectors.
   *
   * @param name the index or alias the server writes to
   * @param liveIndexes the indexes behind it that cannot hold them
   * @param reason what they hold instead, for an operator to read
   */
  public record Mismatch(String name, Set<String> liveIndexes, String reason) {}

  private record Entry(Mismatch mismatch, AtomicLong checkedAtNanos) {}

  private final ConcurrentMap<String, Entry> mismatches = new ConcurrentHashMap<>();
  private final ConcurrentMap<String, String> unreadable = new ConcurrentHashMap<>();
  private final Consumer<String> recheck;
  private final LongSupplier nanoTime;

  /**
   * @param recheck reads the field of one name again and records the result here
   */
  public VectorFieldHealth(Consumer<String> recheck) {
    this(recheck, System::nanoTime);
  }

  VectorFieldHealth(Consumer<String> recheck, LongSupplier nanoTime) {
    this.recheck = recheck;
    this.nanoTime = nanoTime;
  }

  /** Records what {@code live}, decided as {@code update} for {@code model}, means for vectors. */
  public void record(LiveEmbeddingField live, EmbeddingModel model, EmbeddingFieldUpdate update) {
    if (!live.readable()) {
      recordUnreadable(live.name(), live.readFailure());
    } else if (update == EmbeddingFieldUpdate.LEAVE_OUT) {
      recordCannotHold(live.name(), live.indexesThatCannotHold(model), live.describe(model));
    } else {
      forget(live.name());
    }
  }

  /** Records that the model's vectors cannot go to {@code name}, for {@code reason}. */
  public void recordCannotHold(String name, Set<String> liveIndexes, String reason) {
    Mismatch mismatch = new Mismatch(name, Set.copyOf(liveIndexes), reason);
    mismatches.put(name, new Entry(mismatch, new AtomicLong(nanoTime.getAsLong())));
    unreadable.remove(name);
  }

  /** Forgets {@code name}, an index that no longer exists or is no longer checked. */
  public void forget(String name) {
    mismatches.remove(name);
    unreadable.remove(name);
  }

  // A name already known to be unusable stays so while its field cannot be read again.
  private void recordUnreadable(String name, String failure) {
    Entry known = mismatches.get(name);
    if (known == null) {
      unreadable.put(name, failure);
    } else {
      known.checkedAtNanos().set(nanoTime.getAsLong());
    }
  }

  /**
   * Whether vectors may be written to, or searched in, {@code index}: a name the server writes to
   * or an index behind one. An unknown name can.
   */
  public boolean canHold(String index) {
    Optional<Entry> entry = entryFor(index);
    if (entry.filter(this::claimRecheck).isPresent()) {
      recheck.accept(entry.get().mismatch().name());
      entry = entryFor(index);
    }
    return entry.isEmpty();
  }

  /** Reads the field of {@code name} now and records the result. */
  public void check(String name) {
    recheck.accept(name);
  }

  /**
   * Reads {@code name} again now if it is recorded as unable to hold the model's vectors or as
   * unreadable, as after a rebuild has replaced the index behind it.
   */
  public void refresh(String name) {
    if (mismatches.containsKey(name) || unreadable.containsKey(name)) {
      recheck.accept(name);
    }
  }

  /** Reads every name that cannot hold the model's vectors, or could not be read, again now. */
  public void recheckAll() {
    Set<String> names = new TreeSet<>(mismatches.keySet());
    names.addAll(unreadable.keySet());
    names.forEach(recheck);
  }

  public List<Mismatch> mismatches() {
    return mismatches.values().stream()
        .map(Entry::mismatch)
        .sorted(Comparator.comparing(Mismatch::name))
        .toList();
  }

  /** Every name, and every index behind one, that vector search has to leave out. */
  public Set<String> unusableIndexes() {
    Set<String> unusable = new TreeSet<>();
    mismatches()
        .forEach(
            mismatch -> {
              unusable.add(mismatch.name());
              unusable.addAll(mismatch.liveIndexes());
            });
    return unusable;
  }

  /**
   * The one message that tells an operator which indexes need a rebuild for {@code model}, what
   * each holds, and the way out; empty when every vector index can hold the model's vectors and
   * every field could be read.
   */
  public Optional<String> report(EmbeddingModel model) {
    List<String> parts = new ArrayList<>();
    List<Mismatch> current = mismatches();
    if (!current.isEmpty()) {
      parts.add(
          String.format(
              "Semantic search needs a rebuild of %d search %s, which cannot hold the vectors of "
                  + "the configured embedding model %s (%d dimensions): %s. Vector writes and "
                  + "vector search leave them out until then. %s",
              current.size(),
              current.size() == 1 ? "index" : "indexes",
              model.id(),
              model.dimension(),
              current.stream()
                  .map(mismatch -> mismatch.name() + " (" + mismatch.reason() + ")")
                  .collect(Collectors.joining(", ")),
              WAY_OUT));
    }
    Map<String, String> failures = new TreeMap<>(unreadable);
    if (!failures.isEmpty()) {
      parts.add(
          String.format(
              "The embedding field of %d search %s could not be read, so it was left as it is: "
                  + "%s.",
              failures.size(),
              failures.size() == 1 ? "index" : "indexes",
              failures.entrySet().stream()
                  .map(failure -> failure.getKey() + " (" + failure.getValue() + ")")
                  .collect(Collectors.joining(", "))));
    }
    return parts.isEmpty() ? Optional.empty() : Optional.of(String.join(" ", parts));
  }

  private Optional<Entry> entryFor(String index) {
    Entry direct = index == null ? null : mismatches.get(index);
    return direct != null
        ? Optional.of(direct)
        : mismatches.values().stream()
            .filter(entry -> entry.mismatch().liveIndexes().contains(index))
            .findFirst();
  }

  // Only the caller that moves the timestamp reads the field again, so one name is read at most
  // once a minute however many writes consult it.
  private boolean claimRecheck(Entry entry) {
    long last = entry.checkedAtNanos().get();
    long now = nanoTime.getAsLong();
    return now - last >= RECHECK_AFTER.toNanos() && entry.checkedAtNanos().compareAndSet(last, now);
  }
}
