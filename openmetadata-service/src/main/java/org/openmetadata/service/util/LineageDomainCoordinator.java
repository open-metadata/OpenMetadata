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

package org.openmetadata.service.util;

import com.google.common.annotations.VisibleForTesting;
import java.nio.ByteBuffer;
import java.util.Collection;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.DomainLineageGuardDAO;
import org.openmetadata.service.util.LineageDomainRollups.DomainPair;

/**
 * Serializes the writers of domain lineage rollups. Each lock is a row of {@code
 * domain_lineage_guard} held until the caller's transaction ends:
 *
 * <ul>
 *   <li>a domain write holds {@code domain-move} exclusively, taken as its transaction's first
 *       statement, so no lineage write reads the domains it is replacing or counts into a pair it is
 *       moving;
 *   <li>a lineage write holds {@code domain-move} shared, then the stripe of its edge, then the
 *       stripes of the domain pairs it counts into, in sorted order, and runs at READ COMMITTED so
 *       what it reads after a wait is what the writer it waited for committed.
 * </ul>
 *
 * Every transaction takes these locks in that order, so they cannot deadlock one another. A stripe
 * row exists whether or not the rollup it covers does, so two lineage writes creating the same
 * rollup still run one after the other.
 * ADR:2026-11-26-domain-lineage-rollup-writers-lock-guard-rows-in-one-order
 */
public final class LineageDomainCoordinator {

  private static final int STRIPE_BITS = 6;
  static final int STRIPES = 1 << STRIPE_BITS;
  static final String DOMAIN_MOVE = "domain-move";
  static final String EDGE_PREFIX = "edge";
  static final String PAIR_PREFIX = "pair";

  /** A point a test can stop a writer at, inside its transaction and holding its locks. */
  public enum Stage {
    /** A domain write has moved its rollups and not committed yet. */
    DOMAIN_ROLLUPS_MOVED,
    /** A lineage write has read its ends' domains and not counted its edge into them yet. */
    LINEAGE_DOMAINS_READ
  }

  /** A writer reaching {@code stage}; {@code subjectId} is the entity moved or the edge's from-end. */
  public record Checkpoint(Stage stage, UUID subjectId) {}

  private static final Consumer<Checkpoint> NO_CHECKPOINTS = checkpoint -> {};
  private static volatile Consumer<Checkpoint> checkpoints = NO_CHECKPOINTS;

  private LineageDomainCoordinator() {}

  public static void lockDomainMoves() {
    if (hasDatabase()) {
      require(DOMAIN_MOVE, guard().lockExclusive(DOMAIN_MOVE));
    }
  }

  public static void lockLineageWrites() {
    if (hasDatabase()) {
      require(DOMAIN_MOVE, guard().lockShared(DOMAIN_MOVE));
    }
  }

  /** Locks for a write to the lineage edge {@code fromId -> toId}. */
  public static void lockEdgeWrite(final UUID fromId, final UUID toId) {
    lockLineageWrites();
    if (hasDatabase()) {
      final String stripe = stripe(EDGE_PREFIX, fromId, toId);
      require(stripe, guard().lockExclusive(stripe));
    }
  }

  /** Locks the stripes of these domain pairs, each once, in sorted order. */
  public static void lockDomainPairs(final Collection<DomainPair> pairs) {
    if (hasDatabase()) {
      pairs.stream()
          .map(pair -> stripe(PAIR_PREFIX, pair.fromId(), pair.toId()))
          .distinct()
          .sorted()
          .forEach(stripe -> require(stripe, guard().lockExclusive(stripe)));
    }
  }

  public static void reach(final Stage stage, final UUID subjectId) {
    checkpoints.accept(new Checkpoint(stage, subjectId));
  }

  /**
   * Runs {@code listener} at every checkpoint until the returned handle is closed. Integration tests
   * use it to stop a writer while it holds its locks and interleave another one deterministically.
   */
  @VisibleForTesting
  public static AutoCloseable onCheckpoint(final Consumer<Checkpoint> listener) {
    checkpoints = listener;
    return () -> checkpoints = NO_CHECKPOINTS;
  }

  /** The guard row for an ordered pair of ids: {@code <prefix>-00} to {@code <prefix>-63}. */
  static String stripe(final String prefix, final UUID first, final UUID second) {
    final ByteBuffer bytes = ByteBuffer.allocate(4 * Long.BYTES);
    bytes
        .putLong(first.getMostSignificantBits())
        .putLong(first.getLeastSignificantBits())
        .putLong(second.getMostSignificantBits())
        .putLong(second.getLeastSignificantBits());
    // FNV-1a's low bits depend only on the low bits of each byte, so ids that differ in one byte
    // would share a few stripes; its top bits mix every byte in.
    final int index = fnv1a(bytes.array()) >>> (Integer.SIZE - STRIPE_BITS);
    return String.format("%s-%02d", prefix, index);
  }

  private static int fnv1a(final byte[] bytes) {
    int hash = 0x811C9DC5;
    for (byte value : bytes) {
      hash ^= value & 0xFF;
      hash *= 0x01000193;
    }
    return hash;
  }

  private static void require(final String id, final String locked) {
    if (locked == null) {
      throw new IllegalStateException(
          String.format(
              "domain_lineage_guard row '%s' is missing; run `./bootstrap/openmetadata-ops.sh"
                  + " migrate`",
              id));
    }
  }

  // Without a database (code run against stubbed DAOs) there is no transaction to hold a lock.
  private static boolean hasDatabase() {
    return Entity.getJdbi() != null;
  }

  private static DomainLineageGuardDAO guard() {
    return Entity.getCollectionDAO().domainLineageGuardDAO();
  }
}
