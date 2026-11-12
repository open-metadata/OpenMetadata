/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.fernet.rotation;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.rotation.FernetTokens.Finding;
import org.openmetadata.service.fernet.rotation.FernetTokens.Rewrite;

/**
 * Reads every store and classifies every value with {@link FernetTokens#rewrite}. The check pass
 * drops the replacement; the rewrite pass writes it with a compare-and-set, rereading and retrying
 * a value that changed in between up to {@value #MAX_ATTEMPTS} times before reporting it contended.
 * A store that throws while being read is unreadable, and the sweep goes on to the next store.
 */
@Slf4j
final class FernetSweep {
  static final int MAX_ATTEMPTS = 3;

  /** The tallies and problems of one pass, in store order. */
  record Result(List<StoreTally> tallies, Problems problems) {}

  private FernetSweep() {}

  static Result check(List<TokenStore> stores, KeyRing keys) {
    return sweep(stores, keys, false);
  }

  static Result rewrite(List<TokenStore> stores, KeyRing keys) {
    return sweep(stores, keys, true);
  }

  private static Result sweep(List<TokenStore> stores, KeyRing keys, boolean write) {
    List<StoreTally> tallies = new ArrayList<>();
    Problems problems = new Problems();
    for (TokenStore store : stores) {
      tallies.add(sweepStore(store, keys, write, problems));
    }
    return new Result(List.copyOf(tallies), problems);
  }

  private static StoreTally sweepStore(
      TokenStore store, KeyRing keys, boolean write, Problems problems) {
    Tally tally = new Tally(store.name());
    try (Stream<StoredText> candidates = store.candidates()) {
      candidates.forEach(value -> sweepValue(store, value, keys, write, tally, problems));
      LOG.info(
          "{} {}: {} values hold tokens {}",
          write ? "Rewrote" : "Read",
          store.name(),
          tally.values,
          tally.counts);
      return tally.frozen();
    } catch (RuntimeException e) {
      LOG.warn("{} could not be read: {}", store.name(), describe(e));
      return StoreTally.unreadable(store.name());
    }
  }

  private static void sweepValue(
      TokenStore store,
      StoredText value,
      KeyRing keys,
      boolean write,
      Tally tally,
      Problems problems) {
    Rewrite rewrite;
    try {
      rewrite = FernetTokens.rewrite(value, keys);
    } catch (RuntimeException e) {
      tally.values++;
      unrewritable(value.at(), "could not be classified", e, write, tally, problems);
      return;
    }
    if (!rewrite.findings().isEmpty()) {
      tally.values++;
      if (write && rewrite.replacement().isPresent()) {
        try {
          writeValue(store, value, rewrite, keys, tally, problems);
        } catch (RuntimeException e) {
          unrewritable(value.at(), "could not be written", e, false, tally, problems);
        }
      } else {
        record(value, rewrite.findings(), write, tally, problems);
      }
    }
  }

  // The message of a per-value failure is never kept: a constraint error carries the failing row,
  // tokens included.
  private static void unrewritable(
      Location at,
      String what,
      RuntimeException e,
      boolean checkFindsItAgain,
      Tally tally,
      Problems problems) {
    tally.count(Outcome.UNREWRITABLE, 1);
    report(
        new Problem(at, "", TokenKind.PLAIN, Outcome.UNREWRITABLE, what + " (" + failure(e) + ")"),
        checkFindsItAgain,
        problems);
  }

  private static String failure(RuntimeException e) {
    Throwable cause = e;
    while (cause != null && !(cause instanceof SQLException)) {
      cause = cause.getCause();
    }
    return e.getClass().getSimpleName()
        + (cause instanceof SQLException sql && sql.getSQLState() != null
            ? ", SQLState " + sql.getSQLState()
            : "");
  }

  /**
   * Keeps and logs a place. The read after the writes finds every place again except a lost race
   * and a failed write, so the write pass keeps only those.
   */
  private static void report(Problem problem, boolean checkFindsItAgain, Problems problems) {
    if (checkFindsItAgain) {
      return;
    }
    problems.add(problem);
    if (problem.outcome() == Outcome.OLDER_KEY) {
      LOG.debug("{}", problem.line());
    } else {
      LOG.warn("{}", problem.line());
    }
  }

  /** Writes with a compare-and-set, rereading the value after a lost race. */
  private static void writeValue(
      TokenStore store,
      StoredText value,
      Rewrite rewrite,
      KeyRing keys,
      Tally tally,
      Problems problems) {
    StoredText current = value;
    Rewrite plan = rewrite;
    for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (store.compareAndSet(current, plan.replacement().get())) {
        record(current, rekeyed(plan.findings()), true, tally, problems);
        return;
      }
      Optional<StoredText> reread = store.reread(current.at());
      if (reread.isEmpty()) {
        LOG.info("A value of {} was removed while it was re-encrypted", store.name());
        return;
      }
      current = reread.get();
      plan = FernetTokens.rewrite(current, keys);
      if (plan.replacement().isEmpty()) {
        record(current, plan.findings(), true, tally, problems);
        return;
      }
    }
    tally.count(Outcome.CONTENDED, 1);
    report(new Problem(current.at(), "", TokenKind.PLAIN, Outcome.CONTENDED, ""), false, problems);
  }

  private static List<Finding> rekeyed(List<Finding> findings) {
    return findings.stream()
        .map(
            finding ->
                finding.outcome() == Outcome.OLDER_KEY
                    ? new Finding(
                        finding.kind(), Outcome.REKEYED, finding.pointer(), finding.detail())
                    : finding)
        .toList();
  }

  private static void record(
      StoredText value,
      List<Finding> findings,
      boolean checkFindsItAgain,
      Tally tally,
      Problems problems) {
    for (Finding finding : findings) {
      tally.count(finding.outcome(), 1);
      if (finding.outcome() != Outcome.PRIMARY && finding.outcome() != Outcome.REKEYED) {
        report(
            new Problem(
                value.at(), finding.pointer(), finding.kind(), finding.outcome(), finding.detail()),
            checkFindsItAgain,
            problems);
      }
    }
  }

  // A statement's exception may render its bound values, so only the database's own message is
  // kept, and only its first line: PostgreSQL adds Detail and Where lines that quote row data.
  static String describe(RuntimeException e) {
    Throwable cause = e;
    while (cause.getCause() != null && !(cause instanceof SQLException)) {
      cause = cause.getCause();
    }
    return cause instanceof SQLException sql
        ? sql.getClass().getSimpleName()
            + " "
            + sql.getSQLState()
            + ": "
            + firstLine(sql.getMessage())
        : e.getClass().getName();
  }

  private static String firstLine(String message) {
    return message == null ? "" : message.lines().findFirst().orElse("");
  }

  /** Mutable counts of one store while it is read. */
  private static final class Tally {
    private final String store;
    private final Map<Outcome, Long> counts = new EnumMap<>(Outcome.class);
    private long values;

    Tally(String store) {
      this.store = store;
    }

    void count(Outcome outcome, long by) {
      counts.merge(outcome, by, Long::sum);
    }

    StoreTally frozen() {
      return new StoreTally(store, true, values, counts);
    }
  }
}
