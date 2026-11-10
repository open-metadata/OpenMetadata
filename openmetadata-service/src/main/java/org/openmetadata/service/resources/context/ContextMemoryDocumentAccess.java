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
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.drive.ContextFileVisibility;

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

  private static final String RELATED_ENTITIES = "relatedEntities";
  private static final List<String> SINGLE_LINKS =
      List.of("primaryEntity", "sourceEntity", "sourceFile");
  private static final List<String> LINKS =
      Stream.concat(SINGLE_LINKS.stream(), Stream.of(RELATED_ENTITIES)).toList();
  private static final String NAME = "name";
  private static final List<String> CHANGE_DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final List<String> VALUES = List.of("oldValue", "newValue");

  @FunctionalInterface
  interface FileAccess {
    boolean canRead(EntityReference file);
  }

  private ContextMemoryDocumentAccess() {}

  /** Every version as the caller may read it now: its links and the changes it recorded. */
  public static EntityHistory redactVersions(
      EntityHistory history, SecurityContext securityContext) {
    return history.withVersions(
        redactVersions(history.getVersions(), callerAccess(securityContext)));
  }

  /** One version as the caller may read it now. */
  public static ContextMemory redactVersion(
      ContextMemory version, SecurityContext securityContext) {
    return JsonUtils.readValue(
        redactVersion(version, callerAccess(securityContext)), ContextMemory.class);
  }

  /**
   * The memories as read now. Their links are current, which their readers may read; the change
   * their last write recorded may name a file as it was linked before.
   */
  public static void redactChanges(List<ContextMemory> memories, SecurityContext securityContext) {
    redactChanges(memories, callerAccess(securityContext));
  }

  static List<Object> redactVersions(List<Object> versions, FileAccess access) {
    return listOrEmpty(versions).stream()
        .map(version -> (Object) redactVersion(version, access))
        .toList();
  }

  static String redactVersion(Object version, FileAccess access) {
    JsonNode memory =
        JsonUtils.readTree(version instanceof String json ? json : JsonUtils.pojoToJson(version));
    if (memory instanceof ObjectNode links) {
      SINGLE_LINKS.forEach(field -> redactAt(links, field, access));
      redactAt(links, RELATED_ENTITIES, access);
      CHANGE_DESCRIPTIONS.forEach(change -> redactChangeNode(links.get(change), access));
    }
    return JsonUtils.pojoToJson(memory);
  }

  static void redactChanges(List<ContextMemory> memories, FileAccess access) {
    for (ContextMemory memory : listOrEmpty(memories)) {
      redactChange(memory.getChangeDescription(), access);
      redactChange(memory.getIncrementalChangeDescription(), access);
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

  private static void redactChangeNode(JsonNode change, FileAccess access) {
    if (change instanceof ObjectNode) {
      for (String fields : CHANGE_LISTS) {
        for (JsonNode field : change.path(fields)) {
          if (field instanceof ObjectNode entry && isLinkChange(entry.path(NAME).asText(null))) {
            VALUES.forEach(value -> redactValueNode(entry, value, access));
          }
        }
      }
    }
  }

  private static void redactValueNode(ObjectNode entry, String key, FileAccess access) {
    JsonNode value = entry.get(key);
    if (value != null && !value.isNull()) {
      Object redacted = redactValue(value.isTextual() ? value.asText() : value, access);
      entry.set(key, JsonUtils.valueToTree(redacted));
    }
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

  private static void redactAt(ObjectNode memory, String field, FileAccess access) {
    JsonNode links = memory.get(field);
    if (links != null && !links.isNull()) {
      memory.set(field, redacted(links, access));
    }
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
        : decidedOncePerFile(file -> mayRead(file, caller));
  }

  /** A file gone for good reads to no one but an admin, as its sharing can no longer be checked. */
  private static boolean mayRead(EntityReference file, String caller) {
    ContextFile stored = Entity.getEntityOrNull(file, Entity.FIELD_OWNERS, Include.ALL);
    return stored != null && ContextFileVisibility.isVisibleToUser(stored, caller, false);
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
