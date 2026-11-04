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
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextFinderAccess;
import org.openmetadata.service.security.Authorizer;

/**
 * A memory's Query evidence reads in full only to a caller who may view that Query
 * (ADR:2026-10-15-a-memory-cites-its-supporting-queries-and-their-retirement-holds-it-for-review).
 * A Query reference carries the question its SQL answered, and reading the memory does not entitle
 * anyone to that. A reference the caller may not view keeps only its id and type, so the list keeps
 * its order and an edit that sends the list back still names the Query. The same holds for the
 * references a change to the links records, in the memory and in every version.
 */
@Slf4j
public final class ContextMemoryEvidenceAccess {

  /** Distinct Queries one response decides on; a page holds few memories, each citing a few. */
  private static final int MAX_QUERY_DECISIONS = 500;

  private static final String RELATED_ENTITIES = "relatedEntities";
  private static final String NAME = "name";
  private static final List<String> CHANGE_DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final List<String> VALUES = List.of("oldValue", "newValue");

  @FunctionalInterface
  interface QueryAccess {
    boolean canView(EntityReference query);
  }

  private ContextMemoryEvidenceAccess() {}

  public static void redactUnviewableQueries(
      List<ContextMemory> memories, Authorizer authorizer, SecurityContext securityContext) {
    redactUnviewableQueries(memories, callerAccess(authorizer, securityContext));
  }

  /** A redacted copy, so the memory passed in, which others may hold, stays whole. */
  public static ContextMemory redactedCopy(
      ContextMemory memory, Authorizer authorizer, SecurityContext securityContext) {
    ContextMemory copy = JsonUtils.deepCopy(memory, ContextMemory.class);
    redactUnviewableQueries(List.of(copy), authorizer, securityContext);
    return copy;
  }

  /** Each version is the memory as it was written, its Query references included. */
  public static EntityHistory redactUnviewableQueries(
      EntityHistory history, Authorizer authorizer, SecurityContext securityContext) {
    return history.withVersions(
        redactVersions(history.getVersions(), callerAccess(authorizer, securityContext)));
  }

  static List<Object> redactVersions(List<Object> versions, QueryAccess access) {
    return listOrEmpty(versions).stream()
        .map(version -> (Object) redactVersion(version, access))
        .toList();
  }

  private static String redactVersion(Object version, QueryAccess access) {
    JsonNode memory =
        JsonUtils.readTree(version instanceof String json ? json : JsonUtils.pojoToJson(version));
    if (memory.get(RELATED_ENTITIES) instanceof ArrayNode related) {
      redactReferences(related, access);
    }
    CHANGE_DESCRIPTIONS.forEach(change -> redactChangeNode(memory.get(change), access));
    return JsonUtils.pojoToJson(memory);
  }

  static void redactUnviewableQueries(List<ContextMemory> memories, QueryAccess access) {
    for (ContextMemory memory : listOrEmpty(memories)) {
      if (memory.getRelatedEntities() != null) {
        memory.setRelatedEntities(
            memory.getRelatedEntities().stream()
                .map(reference -> isHidden(reference, access) ? idOnly(reference) : reference)
                .toList());
      }
      redactChange(memory.getChangeDescription(), access);
      redactChange(memory.getIncrementalChangeDescription(), access);
    }
  }

  /** A change to the links records the references themselves, so it is evidence too. */
  private static void redactChange(ChangeDescription change, QueryAccess access) {
    if (change != null) {
      Stream.of(change.getFieldsAdded(), change.getFieldsUpdated(), change.getFieldsDeleted())
          .flatMap(fields -> listOrEmpty(fields).stream())
          .filter(ContextMemoryEvidenceAccess::isLinkChange)
          .forEach(
              field ->
                  field
                      .withOldValue(redactValue(field.getOldValue(), access))
                      .withNewValue(redactValue(field.getNewValue(), access)));
    }
  }

  private static boolean isLinkChange(FieldChange field) {
    return field.getName() != null && field.getName().startsWith(RELATED_ENTITIES);
  }

  private static void redactChangeNode(JsonNode change, QueryAccess access) {
    if (change instanceof ObjectNode) {
      for (String fields : CHANGE_LISTS) {
        for (JsonNode field : change.path(fields)) {
          if (field instanceof ObjectNode entry
              && entry.path(NAME).asText("").startsWith(RELATED_ENTITIES)) {
            VALUES.forEach(value -> redactValueNode(entry, value, access));
          }
        }
      }
    }
  }

  private static void redactValueNode(ObjectNode entry, String key, QueryAccess access) {
    JsonNode value = entry.get(key);
    if (value != null && !value.isNull()) {
      Object redacted = redactValue(value.isTextual() ? value.asText() : value, access);
      entry.set(key, JsonUtils.valueToTree(redacted));
    }
  }

  /** A relationship change records its references as a JSON array, usually serialized. */
  private static Object redactValue(Object value, QueryAccess access) {
    Object redacted = value;
    JsonNode references = asReferences(value);
    if (references instanceof ArrayNode array) {
      redactReferences(array, access);
      redacted = value instanceof String ? JsonUtils.pojoToJson(array) : array;
    }
    return redacted;
  }

  private static JsonNode asReferences(Object value) {
    JsonNode node = null;
    try {
      node =
          value instanceof String text
              ? JsonUtils.readTree(text)
              : value == null ? null : JsonUtils.valueToTree(value);
    } catch (JsonParsingException notJson) {
      LOG.debug("A relatedEntities change value is not a reference list: {}", notJson.getMessage());
    }
    return node;
  }

  private static void redactReferences(ArrayNode references, QueryAccess access) {
    for (int index = 0; index < references.size(); index++) {
      EntityReference reference =
          JsonUtils.convertValueLenient(references.get(index), EntityReference.class);
      if (isHidden(reference, access)) {
        references.set(index, JsonUtils.valueToTree(idOnly(reference)));
      }
    }
  }

  private static boolean isHidden(EntityReference reference, QueryAccess access) {
    return reference != null
        && Entity.QUERY.equals(reference.getType())
        && !access.canView(reference);
  }

  private static EntityReference idOnly(EntityReference reference) {
    return new EntityReference().withId(reference.getId()).withType(reference.getType());
  }

  private static QueryAccess callerAccess(Authorizer authorizer, SecurityContext securityContext) {
    return decidedOncePerQuery(
        query ->
            AIContextFinderAccess.canView(
                Entity.QUERY, query.getFullyQualifiedName(), authorizer, securityContext));
  }

  private static QueryAccess decidedOncePerQuery(QueryAccess access) {
    Cache<UUID, Boolean> decisions =
        CacheBuilder.newBuilder().maximumSize(MAX_QUERY_DECISIONS).build();
    return query -> {
      Boolean decided = query.getId() == null ? null : decisions.getIfPresent(query.getId());
      if (decided == null) {
        decided = access.canView(query);
        if (query.getId() != null) {
          decisions.put(query.getId(), decided);
        }
      }
      return decided;
    };
  }
}
