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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/** Lifecycle rules for status changes, supersession, and disputes. */
public final class ContextMemoryLifecycle {

  static final String FIELD_SUPERSEDED_BY = "supersededBy";
  static final String FIELD_DISPUTES = "disputes";

  private static final Map<ContextMemoryStatus, Set<ContextMemoryStatus>> VALID_TRANSITIONS =
      Map.of(
          ContextMemoryStatus.DRAFT,
          Set.of(ContextMemoryStatus.ACTIVE, ContextMemoryStatus.ARCHIVED),
          ContextMemoryStatus.ACTIVE,
          Set.of(
              ContextMemoryStatus.ARCHIVED,
              ContextMemoryStatus.SUPERSEDED,
              ContextMemoryStatus.INVALIDATED),
          ContextMemoryStatus.SUPERSEDED,
          Set.of(ContextMemoryStatus.ACTIVE, ContextMemoryStatus.ARCHIVED),
          ContextMemoryStatus.INVALIDATED,
          Set.of(ContextMemoryStatus.ACTIVE, ContextMemoryStatus.ARCHIVED),
          ContextMemoryStatus.ARCHIVED,
          Set.of(ContextMemoryStatus.ACTIVE));

  @FunctionalInterface
  interface MemoryResolver {
    EntityReference resolve(EntityReference reference, String field);
  }

  private ContextMemoryLifecycle() {}

  public static ContextMemoryStatus effectiveStatus(ContextMemoryStatus status) {
    return status == null ? ContextMemoryStatus.ACTIVE : status;
  }

  static void validateTransition(ContextMemoryStatus from, ContextMemoryStatus to) {
    if (to == null) {
      throw new BadRequestException("A context memory requires a status");
    }
    ContextMemoryStatus current = effectiveStatus(from);
    Set<ContextMemoryStatus> allowed = VALID_TRANSITIONS.get(current);
    if (current != to && !allowed.contains(to)) {
      throw new BadRequestException(
          String.format(
              "Invalid memory status transition from %s to %s. Allowed transitions from %s: %s",
              current.value(), to.value(), current.value(), allowed));
    }
  }

  static void applyUpdate(ContextMemory original, ContextMemory updated, MemoryResolver resolver) {
    if (original.getStatus() == null && updated.getStatus() == null) {
      updated.setStatus(ContextMemoryStatus.ACTIVE);
    }
    validateTransition(original.getStatus(), updated.getStatus());
    applyStatusChange(original, updated);
    validateSupersession(updated);
    resolveReferences(original, updated, resolver);
  }

  static void applyCreate(ContextMemory memory, MemoryResolver resolver) {
    validateSupersession(memory);
    resolveReferences(null, memory, resolver);
  }

  private static void applyStatusChange(ContextMemory original, ContextMemory updated) {
    boolean statusChanged = effectiveStatus(original.getStatus()) != updated.getStatus();
    if (statusChanged && original.getStatus() == ContextMemoryStatus.SUPERSEDED) {
      updated.setSupersededBy(null);
    }
    if (statusChanged && Objects.equals(original.getStatusReason(), updated.getStatusReason())) {
      updated.setStatusReason(null);
    }
  }

  private static void validateSupersession(ContextMemory memory) {
    boolean superseded = memory.getStatus() == ContextMemoryStatus.SUPERSEDED;
    if (superseded != (memory.getSupersededBy() != null)) {
      throw new BadRequestException(
          superseded
              ? "A Superseded memory requires supersededBy"
              : "supersededBy is only allowed on a Superseded memory");
    }
  }

  private static void resolveReferences(
      ContextMemory original, ContextMemory updated, MemoryResolver resolver) {
    resolveSuccessor(original, updated, resolver);
    for (MemoryDispute dispute : addedDisputes(original, updated)) {
      validateDispute(dispute);
      dispute.setMemory(resolveMemory(updated, dispute.getMemory(), FIELD_DISPUTES, resolver));
    }
  }

  private static void resolveSuccessor(
      ContextMemory original, ContextMemory updated, MemoryResolver resolver) {
    EntityReference stored = original == null ? null : original.getSupersededBy();
    EntityReference requested = updated.getSupersededBy();
    if (requested != null) {
      updated.setSupersededBy(
          isSameMemory(stored, requested)
              ? stored
              : resolveMemory(updated, requested, FIELD_SUPERSEDED_BY, resolver));
    }
  }

  private static List<MemoryDispute> addedDisputes(ContextMemory original, ContextMemory updated) {
    List<MemoryDispute> existing = listOrEmpty(original == null ? null : original.getDisputes());
    return listOrEmpty(updated.getDisputes()).stream()
        .filter(dispute -> !existing.contains(dispute))
        .toList();
  }

  private static void validateDispute(MemoryDispute dispute) {
    if (dispute == null || dispute.getMemory() == null || isBlank(dispute.getReason())) {
      throw new BadRequestException("A memory dispute requires a memory and a non-blank reason");
    }
  }

  private static EntityReference resolveMemory(
      ContextMemory memory, EntityReference reference, String field, MemoryResolver resolver) {
    requireMemoryReference(reference, field);
    EntityReference resolved = resolver.resolve(reference, field);
    if (resolved.getId().equals(memory.getId())) {
      throw new BadRequestException(
          String.format("A context memory cannot reference itself as %s", field));
    }
    return resolved;
  }

  private static void requireMemoryReference(EntityReference reference, String field) {
    boolean identified = reference.getId() != null || reference.getFullyQualifiedName() != null;
    if (!identified || !Entity.CONTEXT_MEMORY.equals(reference.getType())) {
      throw new BadRequestException(
          String.format(
              "%s must reference a %s by id or fullyQualifiedName", field, Entity.CONTEXT_MEMORY));
    }
  }

  private static boolean isSameMemory(EntityReference stored, EntityReference requested) {
    return stored != null && stored.getId() != null && stored.getId().equals(requested.getId());
  }

  private static boolean isBlank(String value) {
    return nullOrEmpty(value) || value.isBlank();
  }
}
