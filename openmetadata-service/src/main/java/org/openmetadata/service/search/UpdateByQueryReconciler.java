package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.SearchRetryUtil.IOOperation;

/**
 * Runs a synchronous update-by-query so that the documents a concurrent write held are not left
 * behind. With {@code conflicts=proceed}, a document whose version changed between the query's
 * snapshot and its write is counted as a conflict and left as it was. The reconciler refreshes the
 * target, so the next attempt reads the newer version, and runs the query again, at most {@link
 * #MAX_ATTEMPTS} times in all. Refreshing explicitly also covers an attempt in which every document
 * conflicted, so the query's own refresh had nothing to make visible.
 *
 * <p>A query runs again only when that is safe: the next attempt applies the script again to every
 * document the query still matches, including those the previous attempt already rewrote. Shard
 * failures are never retried; they are reported. See
 * ADR:2026-10-09-synchronous-update-by-query-retries-version-conflicts.
 */
@Slf4j
public final class UpdateByQueryReconciler {

  public static final int MAX_ATTEMPTS = 3;

  private UpdateByQueryReconciler() {}

  /** What the attempts of one update-by-query did. */
  public interface Outcome<O extends Outcome<O>> {
    long updatedDocuments();

    long versionConflicts();

    List<String> failureReasons();

    /** The same outcome with the documents every attempt updated and the attempts made. */
    O afterAttempts(long updatedDocuments, int attempts);
  }

  @FunctionalInterface
  public interface Attempt<O> {
    O run() throws IOException;
  }

  public static <O extends Outcome<O>> O reconcile(
      Attempt<O> attempt, IOOperation refresh, boolean replaySafe) throws IOException {
    O outcome = attempt.run();
    long updatedDocuments = outcome.updatedDocuments();
    int attempts = 1;
    while (replaySafe
        && attempts < MAX_ATTEMPTS
        && outcome.versionConflicts() > 0
        && outcome.failureReasons().isEmpty()) {
      LOG.debug(
          "Retrying update-by-query after {} version conflict(s)", outcome.versionConflicts());
      refresh.execute();
      outcome = attempt.run();
      updatedDocuments += outcome.updatedDocuments();
      attempts++;
    }
    return outcome.afterAttempts(updatedDocuments, attempts);
  }

  /**
   * Whether a prefix rename ({@code old} and {@code old.*} become {@code new} and {@code new.*}) can
   * run twice. It cannot when the new prefix nests under the old one: the query still matches a
   * renamed document, and a second run would nest it again.
   */
  public static boolean prefixRenameIsReplaySafe(String oldPrefix, String newPrefix) {
    return !newPrefix.startsWith(oldPrefix + ".");
  }
}
