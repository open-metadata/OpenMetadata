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

package org.openmetadata.service.projection;

import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.Handle;

/** Bounded pending facts and consumer obligations owned by one connection's transaction attempt. */
final class ProjectionCaptureBuffer {
  private static final int MAX_ENTRIES = 1000;
  private static final int MAX_BYTES = 1024 * 1024;
  private final List<MutationFacts> facts = new ArrayList<>();
  private final List<Long> consumers = new ArrayList<>();
  private final List<BufferedMembership> membership = new ArrayList<>();
  private ProjectionJournal journal;
  private Handle handle;
  private int bytes;
  private RuntimeException failure;

  void attach(final Handle owner) {
    handle = owner;
  }

  void append(final ProjectionJournal owner, final List<? extends MutationFacts> additions) {
    for (final MutationFacts fact : additions) {
      final int size = estimateBytes(fact);
      makeRoom(owner, size);
      facts.add(fact);
      grow(size);
    }
  }

  void retain(final ProjectionJournal owner, final List<BufferedMembership> rows) {
    for (final BufferedMembership row : rows) {
      final int size = row.estimateBytes();
      makeRoom(owner, size);
      membership.add(row);
      grow(size);
    }
  }

  void consumers(final ProjectionJournal owner, final List<Long> identifiers) {
    for (final long id : identifiers) {
      makeRoom(owner, Long.BYTES);
      consumers.add(id);
      bytes += Long.BYTES;
    }
  }

  private void grow(final int size) {
    bytes += size;
    if (bytes >= MAX_BYTES) {
      flush();
    }
  }

  private void makeRoom(final ProjectionJournal owner, final int additionalBytes) {
    if (journal != owner || entries() == MAX_ENTRIES || bytes + additionalBytes > MAX_BYTES) {
      flush();
    }
    journal = owner;
  }

  private int entries() {
    return facts.size() + consumers.size() + membership.size();
  }

  /**
   * A failed flush may already have written part of the buffer, and point writes capture without a
   * savepoint. The failure therefore poisons the transaction: commit fails until it rolls back.
   */
  void flush() {
    if (failure != null) {
      throw new IllegalStateException(
          "Projection capture failed earlier in this transaction", failure);
    }
    if (entries() > 0) {
      try {
        journal.persistBuffered(handle, facts, consumers, membership);
      } catch (RuntimeException persistFailure) {
        failure = persistFailure;
        throw persistFailure;
      }
      clearPending();
    }
  }

  /** Marks the transaction unable to commit until it rolls back; keeps the first cause. */
  void poison(final RuntimeException cause) {
    if (failure == null) {
      failure = cause;
    }
  }

  Snapshot snapshot() {
    return new Snapshot(
        journal,
        List.copyOf(facts),
        List.copyOf(consumers),
        List.copyOf(membership),
        bytes,
        failure);
  }

  void restore(final Snapshot snapshot) {
    clear();
    journal = snapshot.journal();
    facts.addAll(snapshot.facts());
    consumers.addAll(snapshot.consumers());
    membership.addAll(snapshot.membership());
    bytes = snapshot.bytes();
    failure = snapshot.failure();
  }

  void clear() {
    clearPending();
    journal = null;
    failure = null;
  }

  private void clearPending() {
    facts.clear();
    consumers.clear();
    membership.clear();
    bytes = 0;
  }

  private static int estimateBytes(final MutationFacts fact) {
    return switch (fact) {
      case EntityMutation entity -> 128
          + stringBytes(entity.entityType())
          + stringBytes(entity.beforeFqn())
          + stringBytes(entity.afterFqn());
      case EntityPrefixMutation prefix -> 128
          + stringBytes(prefix.entityType())
          + stringBytes(prefix.oldPrefix())
          + stringBytes(prefix.newPrefix());
      default -> 128;
    };
  }

  private static int stringBytes(final String value) {
    return value == null ? 0 : value.length() * Character.BYTES;
  }

  record Snapshot(
      ProjectionJournal journal,
      List<MutationFacts> facts,
      List<Long> consumers,
      List<BufferedMembership> membership,
      int bytes,
      RuntimeException failure) {}
}
