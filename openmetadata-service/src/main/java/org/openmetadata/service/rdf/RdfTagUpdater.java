package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/**
 * Deferral scope for the create-flush batch collector in {@code EntityRepository}.
 *
 * <p>This class used to also issue hand-built SPARQL to write/remove {@code om:hasTag} /
 * {@code om:hasGlossaryTerm} triples inline on every tag mutation. That writer built invalid IRIs
 * for tag FQNs with special characters, used non-canonical URIs even when it parsed, and wrote to
 * Fuseki's default graph instead of the named knowledge graph (#33474). None of it was necessary:
 * {@code RdfUpdater.updateEntity} already reloads the entity and reconciles its tag triples with
 * canonical URIs in the right graph on every path that calls it. The inline writer and its
 * SPARQL-building helpers were removed; only the deferral scope remains, since the create-flush
 * collector in {@code EntityRepository} still opens and drains it.
 */
@Slf4j
public class RdfTagUpdater {

  /**
   * When a deferral scope is open on the calling thread, callers can capture closures here instead
   * of running them inline. The create flush opens a scope before its DB transaction so no Fuseki
   * call runs while a pooled connection is held, then drains the captured closures after commit.
   * {@code null} means "no scope active".
   */
  private static final ThreadLocal<List<Runnable>> DEFERRED_RDF = new ThreadLocal<>();

  private RdfTagUpdater() {
    // Private constructor for utility class
  }

  /**
   * Open a deferral scope on the current thread. Returns {@code true} if this call opened the
   * scope (caller owns draining/closing it), {@code false} if a scope was already open (nested
   * call — the outer owner stays responsible). Always pair a {@code true} result with a {@code
   * finally} that calls {@link #drainDeferredToList()} after the transaction commits and {@link
   * #clearDeferred()} on failure.
   */
  public static boolean beginDeferral() {
    boolean opened = DEFERRED_RDF.get() == null;
    if (opened) {
      DEFERRED_RDF.set(new ArrayList<>());
    }
    return opened;
  }

  /**
   * Number of closures captured in the currently-open scope, or {@code 0} when no scope is open. A
   * nested (non-owning) caller records this before contributing so it can {@link
   * #rollbackToCheckpoint(int)} its own contributions on a deadlock replay without disturbing
   * closures the outer owner captured.
   */
  public static int checkpoint() {
    List<Runnable> deferred = DEFERRED_RDF.get();
    return deferred == null ? 0 : deferred.size();
  }

  /** Drop every closure captured after {@code checkpoint} so a retried nested flush re-captures cleanly. */
  public static void rollbackToCheckpoint(int checkpoint) {
    List<Runnable> deferred = DEFERRED_RDF.get();
    if (deferred != null) {
      while (deferred.size() > checkpoint) {
        deferred.removeLast();
      }
    }
  }

  /**
   * Remove and return the closures captured since {@link #beginDeferral} (closing the scope)
   * without running them. The caller drains and runs them via {@link
   * #runDeferredClosures(List)} synchronously after the wrapped transaction commits, so any
   * deferred work runs post-commit (outside the DB transaction handle) rather than while it is
   * held.
   */
  public static List<Runnable> drainDeferredToList() {
    List<Runnable> deferred = DEFERRED_RDF.get();
    DEFERRED_RDF.remove();
    return deferred == null ? List.of() : deferred;
  }

  /** Run a previously-drained closure list, each guarded so one failure does not abort the rest. */
  public static void runDeferredClosures(List<Runnable> closures) {
    for (Runnable closure : closures) {
      runDeferredClosure(closure);
    }
  }

  private static void runDeferredClosure(Runnable closure) {
    try {
      closure.run();
    } catch (Exception e) {
      LOG.warn("Deferred RDF operation failed", e);
    }
  }

  /** Discard captured closures and close the scope without running them (failed transaction). */
  public static void clearDeferred() {
    DEFERRED_RDF.remove();
  }
}
