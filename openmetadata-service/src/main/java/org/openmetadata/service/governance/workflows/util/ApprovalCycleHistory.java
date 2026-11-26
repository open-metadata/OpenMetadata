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

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * The stored versions of an entity's approval cycle. Each version's change is relative to the version
 * its change records as previous, so folding the changes of every version newer than a cycle's base
 * gives the net change since that base.
 *
 * <p>The walk follows each change's previous version, one stored row at a time, rather than paging
 * the version list: that list is ordered by its extension name, which sorts 10.0 before 9.0. The
 * cap and the walk are ADR:2026-11-26-an-approval-preview-lists-the-change-since-its-cycle-began.
 */
@Slf4j
public final class ApprovalCycleHistory {
  static final int MAX_VERSIONS = 200;
  private static final double FIRST_VERSION_BASE = 0.0;

  /** Reads one stored version of an entity; empty when its history has no readable row for it. */
  @FunctionalInterface
  public interface StoredVersions {
    Optional<EntityInterface<?>> read(UUID id, double version);
  }

  private final StoredVersions storedVersions;

  ApprovalCycleHistory(StoredVersions storedVersions) {
    this.storedVersions = storedVersions;
  }

  public static ApprovalCycleHistory forEntityType(String entityType) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    return new ApprovalCycleHistory((id, version) -> storedVersion(repository, id, version));
  }

  /** The version {@code change} was made from: the one it records, else the version before. */
  public static double previousVersion(double version, ChangeDescription change) {
    Double recorded = change == null ? null : change.getPreviousVersion();
    return recorded != null && recorded < version ? recorded : EntityUtil.previousVersion(version);
  }

  public static double previousVersion(EntityInterface<?> entity) {
    return previousVersion(entity.getVersion(), entity.getChangeDescription());
  }

  /** The changes of every version of {@code current} newer than {@code base}, oldest first. */
  public List<ChangeDescription> changesSince(EntityInterface<?> current, double base) {
    List<EntityInterface<?>> newestFirst = versionsNewerThan(current, base).toList();
    warnWhenCapped(current, base, newestFirst);
    return newestFirst.reversed().stream()
        .map(EntityInterface::getChangeDescription)
        .filter(Objects::nonNull)
        .toList();
  }

  /** The newest version before {@code current} that a reviewer accepted. */
  public OptionalDouble approvedBaseline(EntityInterface<?> current) {
    return versionsNewerThan(current, FIRST_VERSION_BASE)
        .skip(1)
        .filter(ApprovedBaseline::isApprovedBaseline)
        .mapToDouble(EntityInterface::getVersion)
        .findFirst();
  }

  /** Where a cycle without a recorded base begins: the last approval, else the latest change. */
  public double lastApprovalOrLatestChange(EntityInterface<?> current) {
    return approvedBaseline(current).orElseGet(() -> previousVersion(current));
  }

  /** Where a cycle without a recorded base begins when only the latest change is known. */
  public double latestChange(EntityInterface<?> current) {
    return previousVersion(current);
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

  private static void warnWhenCapped(
      EntityInterface<?> current, double base, List<EntityInterface<?>> newestFirst) {
    if (newestFirst.size() == MAX_VERSIONS && previousVersion(newestFirst.getLast()) > base) {
      LOG.warn(
          "[ApprovalCycleHistory] {} changed in more than {} versions since version {}; its approval"
              + " preview lists the newest {}",
          current.getFullyQualifiedName(),
          MAX_VERSIONS,
          base,
          MAX_VERSIONS);
    }
  }

  private static Optional<EntityInterface<?>> storedVersion(
      EntityRepository<?> repository, UUID id, double version) {
    Optional<EntityInterface<?>> stored = Optional.empty();
    try {
      stored = Optional.of(repository.getVersion(id, Double.toString(version)));
    } catch (EntityNotFoundException | JsonParsingException unreadable) {
      LOG.warn(
          "[ApprovalCycleHistory] Version {} of {} {} is missing or unreadable; the approval"
              + " preview starts after it",
          version,
          repository.getEntityType(),
          id,
          unreadable);
    }
    return stored;
  }
}
