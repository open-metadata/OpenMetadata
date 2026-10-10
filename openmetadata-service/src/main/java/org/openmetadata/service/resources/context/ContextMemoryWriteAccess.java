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

package org.openmetadata.service.resources.context;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * What a writer who is neither an admin nor a bot may put in a context memory, beyond the policy
 * check on the operation. Every user may create memories
 * (ADR:2026-10-09-data-consumers-create-context-memories), and a memory's owners and references
 * decide who reads it and what it reveals: Collate injects the private user-global memories a user
 * owns into that user's agent prompt as their preferences, and a stored memory echoes the name of
 * every entity it points at. So such a writer may own only their own memories, may not hand them to
 * anyone else, and may point them only at entities they can view.
 *
 * <p>Admins write for others (file and page extraction run as admin), and so do bots; a bot acting
 * for a user writes as that user.
 */
public final class ContextMemoryWriteAccess {

  private static final Logger LOG = LoggerFactory.getLogger(ContextMemoryWriteAccess.class);

  static final String UNVIEWABLE_REFERENCE = "%s must reference an entity you can view";
  static final String OWNED_BY_SOMEONE_ELSE =
      "Only an admin can create a context memory owned by someone else";
  static final String OWNERS_CHANGED = "Only an admin can change who owns a context memory";
  static final String MISSING_WRITER = "A context memory requires an authenticated writer";
  static final String EXTRACTION_SOURCE =
      "Only an admin or bot can claim file or page extraction provenance";

  /** Whether a writer may read the entity a memory field points at. */
  @FunctionalInterface
  interface ReferenceAccess {
    boolean canView(String writer, EntityReference reference);
  }

  private ContextMemoryWriteAccess() {}

  /** Whether an explicitly named writer may write memories for others or claim extraction provenance. */
  public static boolean isPrivilegedWriter(String writer) {
    return writer != null
        && (Entity.ADMIN_USER_NAME.equalsIgnoreCase(writer) || isAdminOrBot(writer));
  }

  public static void requireWriter(String writer) {
    if (nullOrEmpty(writer) || writer.isBlank()) {
      throw new AuthorizationException(MISSING_WRITER);
    }
  }

  /** An ordinary writer may preserve extraction provenance, but cannot establish it. */
  public static void requireSourceTypeAllowed(
      ContextMemorySourceType original, ContextMemorySourceType updated) {
    if (original != updated && isAutomatedSource(updated)) {
      throw new AuthorizationException(EXTRACTION_SOURCE);
    }
  }

  /** Sources whose pills the file/page extraction engine regenerates and reuses. */
  public static boolean isAutomatedSource(ContextMemorySourceType type) {
    return type == ContextMemorySourceType.FILE_EXTRACTION
        || type == ContextMemorySourceType.PAGE_EXTRACTION;
  }

  private static boolean isAdminOrBot(String writer) {
    boolean privileged = false;
    try {
      SubjectContext subject = SubjectContext.getSubjectContext(writer);
      privileged = subject.isAdmin() || subject.isBot();
    } catch (EntityNotFoundException e) {
      LOG.debug("Memory writer {} is not a known user", writer, e);
    }
    return privileged;
  }

  /** The owners a new memory names, if any, must be its writer alone. */
  public static void requireOwnedByWriter(List<EntityReference> owners, EntityReference writer) {
    if (!listOrEmpty(owners).stream().allMatch(owner -> writer.getId().equals(owner.getId()))) {
      throw new AuthorizationException(OWNED_BY_SOMEONE_ELSE);
    }
  }

  /** An update that names owners must name the ones the memory already has. */
  public static void requireOwnersUnchanged(
      List<EntityReference> original, List<EntityReference> updated) {
    if (updated != null && !ownerIds(original).equals(ownerIds(updated))) {
      throw new AuthorizationException(OWNERS_CHANGED);
    }
  }

  private static Set<UUID> ownerIds(List<EntityReference> owners) {
    return listOrEmpty(owners).stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  /**
   * Every entity the memory points at must be one {@code writer} can view. A missing entity is
   * refused with the same error, so the answer does not reveal whether an id exists.
   */
  public static void requireViewableReferences(ContextMemory memory, String writer) {
    requireViewableReferences(memory, writer, ContextMemoryWriteAccess::canView);
  }

  static void requireViewableReferences(
      ContextMemory memory, String writer, ReferenceAccess access) {
    requireViewable(
        ContextMemoryRepository.FIELD_PRIMARY_ENTITY, memory.getPrimaryEntity(), writer, access);
    listOrEmpty(memory.getRelatedEntities())
        .forEach(
            related ->
                requireViewable(
                    ContextMemoryRepository.FIELD_RELATED_ENTITIES, related, writer, access));
    requireViewable(
        ContextMemoryRepository.FIELD_SOURCE_ENTITY, memory.getSourceEntity(), writer, access);
    requireViewable(
        ContextMemoryRepository.FIELD_SOURCE_FILE, memory.getSourceFile(), writer, access);
    requireViewable(
        ContextMemoryRepository.FIELD_ROOT_MEMORY, memory.getRootMemory(), writer, access);
    requireViewable(
        ContextMemoryRepository.FIELD_PARENT_MEMORY, memory.getParentMemory(), writer, access);
  }

  private static void requireViewable(
      String field, EntityReference reference, String writer, ReferenceAccess access) {
    if (reference != null && !access.canView(writer, reference)) {
      throw new BadRequestException(String.format(UNVIEWABLE_REFERENCE, field));
    }
  }

  /** A memory is read by its own visibility rule; any other entity by the anchor rule. */
  private static boolean canView(String writer, EntityReference reference) {
    return Entity.CONTEXT_MEMORY.equals(reference.getType())
        ? canReadMemory(writer, reference)
        : ContextMemoryAnchorAccess.canView(writer, reference);
  }

  private static boolean canReadMemory(String writer, EntityReference reference) {
    boolean readable = false;
    try {
      ContextMemory memory =
          Entity.getEntity(
              reference,
              ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, ""),
              Include.NON_DELETED);
      readable = ContextMemoryVisibility.isVisibleToUser(memory, writer, false);
    } catch (EntityNotFoundException e) {
      LOG.debug("Memory {} that {} points at does not exist", reference.getId(), writer, e);
    }
    return readable;
  }
}
