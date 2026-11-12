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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * A memory's history names a file only to a caller who may read that file now
 * (ADR:2026-09-29-context-file-memory-reuse). A version keeps the links it was written with, and
 * the memory's current readers read every version, so one written while a private file anchored it
 * would name that file to everyone once an org-wide file anchors it again. A file the caller may
 * not read keeps only its id and type; an article reads to everyone, and an admin reads every file.
 */
@Slf4j
public final class ContextMemoryDocumentAccess {

  /** Distinct files one response decides on; a memory links few, and its history repeats them. */
  private static final int MAX_FILE_DECISIONS = 500;

  private static final List<String> LINKS =
      List.of("primaryEntity", "relatedEntities", "sourceEntity", "sourceFile");

  @FunctionalInterface
  interface FileAccess {
    boolean canRead(EntityReference file);
  }

  private ContextMemoryDocumentAccess() {}

  /**
   * Redacts a stored version as the caller may read it now: its links and the changes it recorded.
   * One operator serves one response, so it decides each file once.
   */
  public static UnaryOperator<ContextMemory> versionRedaction(SecurityContext securityContext) {
    return versionRedaction(callerAccess(securityContext));
  }

  /**
   * The memories as read now: owning a memory does not grant access to every document it names.
   */
  public static void redactDocuments(
      List<ContextMemory> memories, SecurityContext securityContext) {
    redactDocuments(memories, callerAccess(securityContext));
  }

  static UnaryOperator<ContextMemory> versionRedaction(FileAccess access) {
    return version -> redactVersion(version, access);
  }

  /** In place: each history read redacts the copy it read for this response. */
  private static ContextMemory redactVersion(ContextMemory version, FileAccess access) {
    version.setPrimaryEntity(visible(version.getPrimaryEntity(), access));
    version.setSourceEntity(visible(version.getSourceEntity(), access));
    version.setSourceFile(visible(version.getSourceFile(), access));
    if (version.getRelatedEntities() != null) {
      version.setRelatedEntities(
          version.getRelatedEntities().stream().map(related -> visible(related, access)).toList());
    }
    redactChange(version.getChangeDescription(), access);
    redactChange(version.getIncrementalChangeDescription(), access);
    return version;
  }

  static void redactDocuments(List<ContextMemory> memories, FileAccess access) {
    for (ContextMemory memory : listOrEmpty(memories)) {
      redactVersion(memory, access);
    }
  }

  private static void redactChange(ChangeDescription change, FileAccess access) {
    if (change != null) {
      Stream.of(change.getFieldsAdded(), change.getFieldsUpdated(), change.getFieldsDeleted())
          .flatMap(fields -> listOrEmpty(fields).stream())
          .filter(field -> isLinkChange(field.getName()))
          .forEach(field -> redactValues(field, access));
    }
  }

  private static void redactValues(FieldChange field, FileAccess access) {
    field
        .withOldValue(redactValue(field.getOldValue(), access))
        .withNewValue(redactValue(field.getNewValue(), access));
  }

  private static boolean isLinkChange(String field) {
    return field != null && LINKS.stream().anyMatch(field::startsWith);
  }

  /** A link change records a reference, or a list of them, usually serialized. */
  private static Object redactValue(Object value, FileAccess access) {
    JsonNode references = asJson(value);
    Object redacted = value;
    if (references != null && (references.isArray() || references.isObject())) {
      JsonNode visible = redacted(references, access);
      redacted = value instanceof String ? JsonUtils.pojoToJson(visible) : visible;
    }
    return redacted;
  }

  private static JsonNode asJson(Object value) {
    JsonNode node = null;
    try {
      node =
          value instanceof String text
              ? JsonUtils.readTree(text)
              : value == null ? null : JsonUtils.valueToTree(value);
    } catch (JsonParsingException notJson) {
      LOG.debug("A memory link change value is not a reference: {}", notJson.getMessage());
    }
    return node;
  }

  /** The reference, or each in a list, cut to its id and type when the caller may not read it. */
  private static JsonNode redacted(JsonNode node, FileAccess access) {
    if (node instanceof ArrayNode references) {
      for (int index = 0; index < references.size(); index++) {
        references.set(index, redacted(references.get(index), access));
      }
    }
    EntityReference reference =
        node instanceof ObjectNode
            ? JsonUtils.convertValueLenient(node, EntityReference.class)
            : null;
    return isHidden(reference, access) ? JsonUtils.valueToTree(idOnly(reference)) : node;
  }

  private static EntityReference visible(EntityReference reference, FileAccess access) {
    return isHidden(reference, access) ? idOnly(reference) : reference;
  }

  private static boolean isHidden(EntityReference reference, FileAccess access) {
    return reference != null
        && reference.getId() != null
        && Entity.CONTEXT_FILE.equals(reference.getType())
        && !access.canRead(reference);
  }

  private static EntityReference idOnly(EntityReference reference) {
    return new EntityReference().withId(reference.getId()).withType(reference.getType());
  }

  private static FileAccess callerAccess(SecurityContext securityContext) {
    String caller = ContextMemoryVisibility.callerName(securityContext);
    return ContextMemoryVisibility.isAdmin(securityContext)
        ? file -> true
        : decidedOncePerFile(file -> ContextMemoryAnchorAccess.canView(caller, file));
  }

  private static FileAccess decidedOncePerFile(FileAccess access) {
    Cache<UUID, Boolean> decisions =
        CacheBuilder.newBuilder().maximumSize(MAX_FILE_DECISIONS).build();
    return file -> {
      Boolean decided = decisions.getIfPresent(file.getId());
      if (decided == null) {
        decided = access.canRead(file);
        decisions.put(file.getId(), decided);
      }
      return decided;
    };
  }
}
