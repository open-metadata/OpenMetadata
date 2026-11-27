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
package org.openmetadata.service.governance.workflows.util;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;
import org.openmetadata.service.governance.workflows.util.ApprovalCycle.ReviewedRange;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * The stored versions of an entity's approval cycle. Each version's change is relative to its
 * recorded predecessor, so skipped automation and consolidated edits can be handled before a
 * preview or rollback is built.
 *
 * <p>The walk follows each change's previous version, one stored row at a time, rather than paging
 * the version list: that list is ordered by its extension name, which sorts 10.0 before 9.0.
 * ADR:2026-11-27-approval-rejection-restores-the-reviewed-edit.
 */
@Slf4j
public final class ApprovalCycleHistory {
  static final int MAX_VERSIONS = 200;
  private static final double FIRST_VERSION_BASE = 0.0;

  /**
   * The changes of an approval cycle, oldest first. {@code complete} is true when the history
   * walk reached the base.
   */
  public record CycleChanges(List<ChangeDescription> changes, boolean complete) {
    public CycleChanges {
      changes = List.copyOf(changes);
    }
  }

  /** Reads one stored version of an entity; empty when its history has no readable row for it. */
  @FunctionalInterface
  public interface StoredVersions {
    Optional<EntityInterface<?>> read(UUID id, double version);
  }

  private final StoredVersions storedVersions;
  private final Predicate<EntityInterface<?>> governedVersion;

  ApprovalCycleHistory(StoredVersions storedVersions) {
    this(storedVersions, version -> true);
  }

  ApprovalCycleHistory(
      StoredVersions storedVersions, Predicate<EntityInterface<?>> governedVersion) {
    this.storedVersions = storedVersions;
    this.governedVersion = governedVersion;
  }

  public static ApprovalCycleHistory forEntityType(String entityType) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    return new ApprovalCycleHistory(
        (id, version) -> storedVersion(repository, id, version),
        version ->
            !WorkflowEventConsumer.isHistoricalBotChange(
                version.getUpdatedBy(), version.getImpersonatedBy()));
  }

  public static EntityInterface<?> currentVersion(EntityRepository<?> repository, UUID entityId) {
    EntityInterface<?> entity = repository.find(entityId, Include.ALL, false);
    return repository.getVersion(entityId, entity.getVersion().toString());
  }

  /** The version {@code change} was made from: the one it records, else the version before. */
  public static double previousVersion(double version, ChangeDescription change) {
    Double recorded = change == null ? null : change.getPreviousVersion();
    return recorded != null && recorded < version ? recorded : EntityUtil.previousVersion(version);
  }

  public static double previousVersion(EntityInterface<?> entity) {
    return previousVersion(entity.getVersion(), entity.getChangeDescription());
  }

  /**
   * The governed changes newer than {@code base}. A partial walk can show attributed changes it
   * reached. Comparing snapshots alone would include unreviewed changes whose versions are missing.
   */
  public CycleChanges changesSince(EntityInterface<?> current, double base) {
    HistoryWindow window = historyOf(current, base);
    if (!window.complete()) {
      warnOfGap(current, base, window.newestFirst().getLast());
    }
    List<ChangeDescription> changes =
        !window.complete() || hasBypassedChanges(window.newestFirst())
            ? reconciledChanges(current, new ReviewedRange(base, current.getVersion()), window)
            : oldestFirst(window.newestFirst());
    return new CycleChanges(changes, window.complete());
  }

  /** Rolls back only attributed edits in the task's range and leaves later edits in place. */
  public ObjectNode undoReviewedChanges(EntityInterface<?> current, ReviewedRange range) {
    HistoryWindow window = historyOf(current, range.base());
    if (range.tipUpdatedAt() != null
        && window.newestFirst().stream()
            .anyMatch(
                version ->
                    version.getVersion() == range.tip()
                        && !Objects.equals(version.getUpdatedAt(), range.tipUpdatedAt()))) {
      throw new PreconditionFailedException(
          "The reviewed version changed after the approval task opened");
    }
    return revert(current, range, window).target();
  }

  private record HistoryWindow(
      List<EntityInterface<?>> newestFirst,
      Optional<EntityInterface<?>> oldestPredecessor,
      boolean complete) {}

  private HistoryWindow historyOf(EntityInterface<?> current, double base) {
    List<EntityInterface<?>> versions = versionsNewerThan(current, base).toList();
    boolean reached = reachesBase(versions, base);
    double previous = versions.isEmpty() ? FIRST_VERSION_BASE : previousVersion(versions.getLast());
    Optional<EntityInterface<?>> predecessor = Optional.empty();
    if (previous > FIRST_VERSION_BASE && (reached || versions.size() == MAX_VERSIONS)) {
      predecessor = storedVersions.read(current.getId(), previous);
    }
    return new HistoryWindow(
        versions,
        predecessor,
        reached && (previous <= FIRST_VERSION_BASE || predecessor.isPresent()));
  }

  /** The most recent recorded approval or rejection at the start of the cycle. */
  public Optional<String> priorDecision(EntityInterface<?> current, double base) {
    Optional<String> decision = Optional.empty();
    if (base > FIRST_VERSION_BASE) {
      decision =
          storedVersions.read(current.getId(), base).stream()
              .flatMap(version -> versionsNewerThan(version, FIRST_VERSION_BASE))
              .map(ApprovedBaseline::recordedDecision)
              .flatMap(Optional::stream)
              .findFirst();
    }
    return decision;
  }

  private boolean hasBypassedChanges(List<EntityInterface<?>> versions) {
    return versions.stream()
        .anyMatch(
            version ->
                !ApprovalCycleDiff.paths(version.getChangeDescription()).isEmpty()
                    && !governedVersion.test(version));
  }

  private List<ChangeDescription> reconciledChanges(
      EntityInterface<?> current, ReviewedRange range, HistoryWindow window) {
    RevertedContent reverted = revert(current, range, window);
    return List.of(
        ApprovalCycleDiff.describe(
            reverted.target(),
            ApprovalCycleDiff.contentOf(current),
            reverted.paths(),
            range.base()));
  }

  private record RevertedContent(ObjectNode target, Set<String> paths) {}

  private RevertedContent revert(
      EntityInterface<?> current, ReviewedRange range, HistoryWindow window) {
    ObjectNode target = ApprovalCycleDiff.contentOf(current);
    Set<String> paths = new HashSet<>();
    for (int index = 0; index < window.newestFirst().size(); index++) {
      EntityInterface<?> version = window.newestFirst().get(index);
      if (version.getVersion() <= range.tip() && governedVersion.test(version)) {
        paths.addAll(undoVersion(target, window, index));
      }
    }
    return new RevertedContent(target, paths);
  }

  private Set<String> undoVersion(ObjectNode target, HistoryWindow window, int index) {
    EntityInterface<?> version = window.newestFirst().get(index);
    Set<String> paths = ApprovalCycleDiff.paths(version.getChangeDescription());
    Optional<EntityInterface<?>> previous =
        index + 1 < window.newestFirst().size()
            ? Optional.of(window.newestFirst().get(index + 1))
            : window.oldestPredecessor();
    if (!paths.isEmpty()) {
      previous.ifPresent(
          before ->
              ApprovalCycleDiff.undo(
                  target,
                  ApprovalCycleDiff.contentOf(before),
                  ApprovalCycleDiff.contentOf(version),
                  paths));
    }
    return previous.isPresent() ? paths : Set.of();
  }

  private Stream<EntityInterface<?>> versionsNewerThan(EntityInterface<?> current, double base) {
    return Stream.iterate(
            Optional.<EntityInterface<?>>of(current).filter(version -> version.getVersion() > base),
            Optional::isPresent,
            version -> predecessorNewerThan(version.get(), base))
        .limit(MAX_VERSIONS)
        .map(Optional::get);
  }

  private Optional<EntityInterface<?>> predecessorNewerThan(
      EntityInterface<?> version, double base) {
    double previous = previousVersion(version);
    return previous > base
        ? storedVersions.read(version.getId(), previous)
        : Optional.<EntityInterface<?>>empty();
  }

  private static boolean reachesBase(List<EntityInterface<?>> newestFirst, double base) {
    return newestFirst.isEmpty() || previousVersion(newestFirst.getLast()) <= base;
  }

  private List<ChangeDescription> oldestFirst(List<EntityInterface<?>> newestFirst) {
    return newestFirst.reversed().stream()
        .filter(governedVersion)
        .map(EntityInterface::getChangeDescription)
        .filter(Objects::nonNull)
        .toList();
  }

  private static void warnOfGap(
      EntityInterface<?> current, double base, EntityInterface<?> oldestRead) {
    LOG.warn(
        "[ApprovalCycleHistory] The history of {} since version {} stops at version {}, on a"
            + " missing version or past {} versions; its approval preview is incomplete",
        current.getFullyQualifiedName(),
        base,
        oldestRead.getVersion(),
        MAX_VERSIONS);
  }

  private static Optional<EntityInterface<?>> storedVersion(
      EntityRepository<?> repository, UUID id, double version) {
    Optional<EntityInterface<?>> stored = Optional.empty();
    try {
      stored = Optional.of(repository.getVersion(id, Double.toString(version)));
    } catch (EntityNotFoundException | JsonParsingException unreadable) {
      LOG.warn(
          "[ApprovalCycleHistory] Version {} of {} {} is missing or unreadable",
          version,
          repository.getEntityType(),
          id,
          unreadable);
    }
    return stored;
  }
}
