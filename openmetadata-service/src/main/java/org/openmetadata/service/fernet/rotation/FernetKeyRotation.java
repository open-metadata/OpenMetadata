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

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementExceptions;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.RedisCacheProvider;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.rotation.TokenStores.Discovery;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.security.session.RedisSessionStore;

/**
 * The {@code rotate-fernet-key} operation: re-encrypts the stored Fernet tokens it reads under the
 * primary key, then reads them again and says whether an older key can be removed. By default it
 * leaves out the large tables that cannot hold a secret, so only a run of {@link Scope#EVERY_TABLE}
 * vouches that an older key can go. Without {@link Mode#APPLY} it only reads. It refuses before any
 * read or write when it cannot run safely.
 */
@Slf4j
public final class FernetKeyRotation {
  public enum Mode {
    REPORT,
    APPLY
  }

  public enum Scope {
    EVERY_TABLE,
    SKIP_LARGE_TABLES
  }

  /**
   * @param confirmed asked once, before anything is read, when the mode is {@link Mode#APPLY}
   */
  public record Options(Mode mode, Scope scope, BooleanSupplier confirmed) {
    public static Options of(boolean apply, boolean everyTable, BooleanSupplier confirmed) {
      return new Options(
          apply ? Mode.APPLY : Mode.REPORT,
          everyTable ? Scope.EVERY_TABLE : Scope.SKIP_LARGE_TABLES,
          confirmed);
    }
  }

  /** Thrown before any read or write; the message says what to change. Nothing was changed. */
  public static final class Refused extends RuntimeException {
    Refused(String message) {
      super(message);
    }
  }

  /** Renders a table of rows, as {@code OpenMetadataOperations.printToAsciiTable} does. */
  @FunctionalInterface
  public interface TablePrinter {
    void print(List<String> columns, List<List<String>> rows, String emptyText);
  }

  /** What was read: how many tables and columns, and how many Redis keys under which keyspace. */
  public record Coverage(int tables, int columns, Optional<Long> redisKeys, String keyspace) {
    String line() {
      String sql = "Read " + tables + " tables (" + columns + " text columns)";
      return redisKeys
          .map(keys -> sql + " and " + keys + " Redis keys under \"" + keyspace + "\".")
          .orElse(sql + ".");
    }
  }

  private FernetKeyRotation() {}

  /**
   * Opens a {@link RedisCacheProvider} when {@code cache.provider} is {@code redis} and closes it
   * before returning.
   *
   * @throws Refused when the run cannot proceed; nothing was read or written
   */
  public static Report run(
      Options options, KeyRing keys, Jdbi jdbi, ConnectionType dialect, CacheConfig cache) {
    refuseUnlessRunnable(options, keys);
    Optional<RedisCacheProvider> redis = openRedis(cache);
    try {
      if (options.mode() == Mode.APPLY && !options.confirmed().getAsBoolean()) {
        throw new Refused("The rotation was not confirmed.");
      }
      Optional<RedisTokenStore> redisStore =
          redis.map(
              provider ->
                  new RedisTokenStore(
                      provider.getSyncCommands(), redisPrefixes(cache.redis.keyspace)));
      return jdbi.withHandle(
          handle -> sweep(options, keys, handle, Dialect.of(dialect), redisStore));
    } finally {
      redis.ifPresent(RedisCacheProvider::close);
    }
  }

  private static void refuseUnlessRunnable(Options options, KeyRing keys) {
    if (keys.size() == 0) {
      throw new Refused(
          "No Fernet key is configured ("
              + Fernet.FERNET_NO_ENCRYPTION
              + "), so there is nothing to rotate.");
    }
    if (options.mode() == Mode.APPLY && keys.size() == 1) {
      throw new Refused(
          "--apply needs FERNET_KEY to list the new key first and the old key second; only one key is configured.");
    }
    if (options.mode() == Mode.APPLY && keys.isPrimaryTheShippedDefault()) {
      throw new Refused(
          "The primary key is the default key shipped in openmetadata.yaml; put a new key first.");
    }
  }

  private static Optional<RedisCacheProvider> openRedis(CacheConfig cache) {
    Optional<RedisCacheProvider> redis = Optional.empty();
    if (cache != null && cache.provider == CacheConfig.Provider.redis) {
      RedisCacheProvider provider = new RedisCacheProvider(cache);
      if (!provider.available()) {
        provider.close();
        throw new Refused(
            "Redis is configured (cacheConfig.provider: redis) but cannot be reached.");
      }
      redis = Optional.of(provider);
    }
    return redis;
  }

  // The entity cache writes under the configured keyspace as it is, the session store under its
  // effective one, so a blank keyspace leaves keys under both.
  static List<String> redisPrefixes(String configured) {
    return Stream.of(
            String.valueOf(new CacheKeys(configured).ns),
            RedisSessionStore.effectiveKeyspace(configured))
        .distinct()
        .toList();
  }

  private static Report sweep(
      Options options,
      KeyRing keys,
      Handle handle,
      Dialect dialect,
      Optional<RedisTokenStore> redis) {
    // A statement's exception would otherwise render its bound values, which may be tokens.
    handle
        .getConfig(StatementExceptions.class)
        .setMessageRendering(StatementExceptions.MessageRendering.NONE);
    Discovery discovery = TokenStores.discover(handle, dialect, redis, options.scope());
    Optional<FernetSweep.Result> writes =
        options.mode() == Mode.APPLY
            ? Optional.of(FernetSweep.rewrite(discovery.stores(), keys))
            : Optional.empty();
    FernetSweep.Result check = FernetSweep.check(discovery.stores(), keys);
    return Report.of(options.mode(), keys, discovery, redis, writes, check);
  }

  /**
   * The outcome of one run. The counts and problems come from the read after any writes, with the
   * re-encrypted and contended counts of the writes added, so the exit code states what is stored
   * now.
   */
  public record Report(
      Mode mode,
      List<String> fingerprints,
      boolean primaryIsShippedDefault,
      Coverage coverage,
      List<String> leftOut,
      List<StoreTally> stores,
      List<Problem> problems,
      long realProblems,
      long olderKeyPlaces) {

    static Report of(
        Mode mode,
        KeyRing keys,
        Discovery discovery,
        Optional<RedisTokenStore> redis,
        Optional<FernetSweep.Result> writes,
        FernetSweep.Result check) {
      List<StoreTally> tallies =
          writes.map(result -> merge(check.tallies(), result.tallies())).orElse(check.tallies());
      Problems problems =
          writes.map(result -> check.problems().plus(result.problems())).orElse(check.problems());
      Coverage coverage =
          new Coverage(
              discovery.tables(),
              discovery.columns(),
              redis.map(RedisTokenStore::keysScanned),
              redis.map(RedisTokenStore::keyspaces).orElse(""));
      return new Report(
          mode,
          keys.fingerprints(),
          keys.isPrimaryTheShippedDefault(),
          coverage,
          discovery.leftOut(),
          tallies,
          problems.shown(),
          problems.realCount(),
          problems.olderKeyCount());
    }

    private static List<StoreTally> merge(List<StoreTally> check, List<StoreTally> writes) {
      return IntStream.range(0, check.size())
          .mapToObj(i -> check.get(i).withWrites(writes.get(i)))
          .toList();
    }

    public int exitCode() {
      return Verdict.of(stores).exitCode;
    }

    /** Prints the report. Tokens, plaintexts and keys never appear; the sweep logged every place. */
    public void print(PrintStream out, TablePrinter printer) {
      out.println("Fernet keys on this host: " + describe(fingerprints));
      out.println(coverage.line());
      if (primaryIsShippedDefault) {
        out.println(
            "Warning: the primary key is the default key shipped in openmetadata.yaml; values encrypted with it are not protected.");
      }
      printer.print(columns(), rows(), "No stored value holds a token");
      List<Problem> printed = problems.stream().limit(Problems.RETAINED).toList();
      printed.stream().map(Problem::line).forEach(out::println);
      long olderKeyPrinted =
          printed.stream().filter(problem -> problem.outcome() == Outcome.OLDER_KEY).count();
      long realUnshown = realProblems - (printed.size() - olderKeyPrinted);
      if (realUnshown > 0) {
        out.println(realUnshown + " more problems are in the log.");
      }
      if (olderKeyPlaces > olderKeyPrinted) {
        out.println(
            (olderKeyPlaces - olderKeyPrinted)
                + " more places that still need an older key are in the debug log.");
      }
      if (!leftOut.isEmpty()) {
        out.println(
            "Large tables left out (--every-table reads them): " + String.join(", ", leftOut));
      }
      out.println(verdictLine());
    }

    private List<Outcome> columnOutcomes() {
      List<Outcome> outcomes =
          new ArrayList<>(
              List.of(
                  Outcome.PRIMARY,
                  Outcome.OLDER_KEY,
                  Outcome.NO_KEY,
                  Outcome.UNBOUND,
                  Outcome.UNREWRITABLE));
      if (mode == Mode.APPLY) {
        outcomes.addAll(List.of(Outcome.REKEYED, Outcome.CONTENDED));
      }
      return outcomes;
    }

    private List<String> columns() {
      return Stream.concat(
              Stream.of("Store", "Values"),
              columnOutcomes().stream().map(outcome -> outcome.column))
          .toList();
    }

    private List<List<String>> rows() {
      return stores.stream()
          .filter(store -> !store.readable() || store.values() > 0)
          .map(this::row)
          .toList();
    }

    private List<String> row(StoreTally store) {
      List<String> row = new ArrayList<>();
      row.add(store.store());
      row.add(store.readable() ? String.valueOf(store.values()) : "unreadable");
      columnOutcomes().forEach(outcome -> row.add(String.valueOf(store.count(outcome))));
      return row;
    }

    private String verdictLine() {
      long olderKey = total(Outcome.OLDER_KEY);
      long noKey = total(Outcome.NO_KEY);
      long notVouched =
          total(Outcome.UNBOUND)
              + total(Outcome.UNREWRITABLE)
              + total(Outcome.CONTENDED)
              + stores.stream().filter(store -> !store.readable()).count();
      return switch (Verdict.of(stores)) {
        case CLEAN -> cleanLine();
        case NOT_SAFE -> "Not safe to remove an older key: "
            + olderKey
            + " tokens still need one and "
            + notVouched
            + " places cannot be vouched for. "
            + (mode == Mode.APPLY || olderKey == 0
                ? "Run with " + applyFlags() + " again, or fix the listed places."
                : "Run with " + applyFlags() + ".");
        case ONLY_UNREADABLE_VALUES -> "No stored value needs an older configured key, but "
            + noKey
            + " tokens open with no configured key. They were unreadable before this run; if a server lists a key this host does not, add it here and run again.";
      };
    }

    // A rerun has to read what this run read, so a run of every table asks for one again.
    private String applyFlags() {
      return leftOut.isEmpty() ? "--apply --every-table" : "--apply";
    }

    // Only a run that left nothing out can say that every stored value opens with the primary key.
    private String cleanLine() {
      String primary = fingerprints.getFirst();
      String older = String.join(", ", fingerprints.subList(1, fingerprints.size()));
      String olderKeyLine =
          leftOut.isEmpty()
              ? " Key " + older + " can be removed from the servers."
              : " Before key " + older + " leaves the servers, confirm with --every-table.";
      return (leftOut.isEmpty() ? "Every stored value" : "Every value read")
          + " opens with key "
          + primary
          + "."
          + (older.isEmpty() ? "" : olderKeyLine);
    }

    private long total(Outcome outcome) {
      return stores.stream().mapToLong(store -> store.count(outcome)).sum();
    }

    private static String describe(List<String> fingerprints) {
      return IntStream.range(0, fingerprints.size())
          .mapToObj(i -> i == 0 ? fingerprints.get(i) + " (primary)" : fingerprints.get(i))
          .reduce((left, right) -> left + ", " + right)
          .orElse("");
    }
  }
}
