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
import java.util.Objects;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/** Lifecycle rules for status changes, supersession, and disputes. */
public final class ContextMemoryLifecycle {

  static final String FIELD_SUPERSEDED_BY = "supersededBy";
  static final String FIELD_DISPUTES = "disputes";

  @FunctionalInterface
  interface MemoryResolver {
    EntityReference resolve(EntityReference reference, String field);
  }

  private ContextMemoryLifecycle() {}

  static void applyUpdate(ContextMemory original, ContextMemory updated, MemoryResolver resolver) {
    applyStatusChange(original, updated);
    validateSupersession(updated);
    resolveReferences(original, updated, resolver);
  }

  static void applyCreate(ContextMemory memory, MemoryResolver resolver) {
    validateSupersession(memory);
    resolveReferences(null, memory, resolver);
  }

  private static void applyStatusChange(ContextMemory original, ContextMemory updated) {
    boolean statusChanged = original.getEntityStatus() != updated.getEntityStatus();
    if (statusChanged && isSuperseded(original.getEntityStatus())) {
      updated.setSupersededBy(null);
    }
    if (statusChanged
        && updated.getEntityStatus() != ContextMemoryStatus.DRAFT
        && Objects.equals(original.getStatusReason(), updated.getStatusReason())) {
      updated.setStatusReason(null);
    }
  }

  private static void validateSupersession(ContextMemory memory) {
    boolean superseded = isSuperseded(memory.getEntityStatus());
    if (superseded != (memory.getSupersededBy() != null)) {
      throw new BadRequestException(
          superseded
              ? String.format("A %s memory requires supersededBy", memory.getEntityStatus().value())
              : "supersededBy is only allowed on a Deprecated memory or a Superseded memory");
    }
  }

  private static boolean isSuperseded(ContextMemoryStatus status) {
    return status == ContextMemoryStatus.SUPERSEDED || status == ContextMemoryStatus.DEPRECATED;
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
