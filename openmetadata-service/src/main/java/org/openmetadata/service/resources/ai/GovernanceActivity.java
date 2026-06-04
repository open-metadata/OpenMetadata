/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Curated AI governance activity feed. Synthesizes timeline events from the
 * existing governance timestamps on each asset ({@code registeredAt},
 * {@code approvedAt}, {@code detection.detectedAt}, each compliance record's
 * {@code assessedAt} / {@code nextReviewDate}) rather than wiring into the
 * change-event subsystem. This keeps Phase 3 self-contained — a future
 * iteration can replace this with a real ChangeEvent stream filter.
 */
@Slf4j
@SuppressWarnings("unchecked")
final class GovernanceActivity {

  private static final Set<String> SUPPORTED_TYPES =
      Set.of(Entity.AI_APPLICATION, Entity.LLM_MODEL, Entity.MCP_SERVER);
  private static final int PAGE_SIZE = 500;

  private GovernanceActivity() {}

  static List<Map<String, Object>> compute(String entityType, String entityId, int limit) {
    List<EntityInterface> assets = new ArrayList<>();
    if (entityType != null && entityId != null) {
      EntityInterface single = loadSingle(entityType, entityId);
      if (single != null) {
        assets.add(single);
      }
    } else if (entityType != null) {
      collect(entityType, assets);
    } else {
      collect(Entity.AI_APPLICATION, assets);
      collect(Entity.MCP_SERVER, assets);
      collect(Entity.LLM_MODEL, assets);
    }

    List<Map<String, Object>> events = new ArrayList<>();
    for (EntityInterface entity : assets) {
      events.addAll(eventsFor(entity));
    }
    events.sort(Comparator.comparing((Map<String, Object> e) -> (Long) e.get("at")).reversed());
    int effective = Math.min(limit > 0 ? limit : 50, events.size());

    return events.subList(0, effective);
  }

  private static EntityInterface loadSingle(String entityType, String entityId) {
    EntityInterface result = null;
    if (SUPPORTED_TYPES.contains(entityType)) {
      try {
        EntityRepository<? extends EntityInterface> repo = Entity.getEntityRepository(entityType);
        result = repo.get(null, UUID.fromString(entityId), repo.getFields(fieldList(entityType)));
      } catch (Exception error) {
        LOG.warn("Activity feed: failed to load {}:{}", entityType, entityId, error);
      }
    }
    return result;
  }

  private static void collect(String entityType, List<EntityInterface> out) {
    try {
      EntityRepository<? extends EntityInterface> repo = Entity.getEntityRepository(entityType);
      Fields fields = repo.getFields(fieldList(entityType));
      ListFilter filter = new ListFilter();
      String after = null;
      do {
        ResultList<? extends EntityInterface> page =
            repo.listAfter(null, fields, filter, PAGE_SIZE, after);
        out.addAll(page.getData());
        after = page.getPaging() == null ? null : page.getPaging().getAfter();
      } while (after != null);
    } catch (Exception error) {
      LOG.warn("Activity feed: failed to list {}", entityType, error);
    }
  }

  private static String fieldList(String entityType) {
    return Entity.LLM_MODEL.equals(entityType)
        ? "owners,governanceStatus,detection"
        : "owners,governanceMetadata";
  }

  private static List<Map<String, Object>> eventsFor(EntityInterface entity) {
    List<Map<String, Object>> events = new ArrayList<>();
    String entityType =
        entity.getEntityReference() == null ? null : entity.getEntityReference().getType();
    Map<String, Object> json =
        (Map<String, Object>) JsonUtils.getObjectMapper().convertValue(entity, Map.class);
    Map<String, Object> governance = governance(entityType, json);

    if (governance != null) {
      Map<String, Object> detection = asMap(governance.get("detection"));
      if (detection != null && detection.get("detectedAt") instanceof Number number) {
        events.add(
            event(
                entity,
                entityType,
                "ShadowAIDetected",
                String.format(
                    "Detected via %s",
                    detection.get("source") == null ? "manual upload" : detection.get("source")),
                number.longValue(),
                governance.get("registeredBy")));
      }

      Long registeredAt = numberToLong(governance.get("registeredAt"));
      if (registeredAt != null) {
        events.add(
            event(
                entity,
                entityType,
                "SubmittedForReview",
                "Submitted to Risk Council for review",
                registeredAt,
                governance.get("registeredBy")));
      }

      Long approvedAt = numberToLong(governance.get("approvedAt"));
      if (approvedAt != null) {
        events.add(
            event(
                entity,
                entityType,
                "Approved",
                "Approved by Risk Council",
                approvedAt,
                governance.get("approvedBy")));
      }

      Map<String, Object> aiCompliance = asMap(governance.get("aiCompliance"));
      List<Object> records =
          aiCompliance == null ? null : asList(aiCompliance.get("complianceRecords"));
      if (records != null) {
        for (Object recordObj : records) {
          Map<String, Object> record = asMap(recordObj);
          if (record == null) {
            continue;
          }
          Long assessedAt = numberToLong(record.get("assessedAt"));
          if (assessedAt != null) {
            String framework = String.valueOf(record.get("framework"));
            events.add(
                event(
                    entity,
                    entityType,
                    "Assessed",
                    String.format("%s assessment completed", framework),
                    assessedAt,
                    record.get("assessedBy")));
          }
          Long nextReview = numberToLong(record.get("nextReviewDate"));
          if (nextReview != null) {
            String framework = String.valueOf(record.get("framework"));
            events.add(
                event(
                    entity,
                    entityType,
                    "NextReviewScheduled",
                    String.format("%s next review scheduled", framework),
                    nextReview,
                    null));
          }
        }
      }
    }
    return events;
  }

  private static Map<String, Object> event(
      EntityInterface entity, String entityType, String type, String text, long at, Object who) {
    Map<String, Object> event = new LinkedHashMap<>();
    event.put("entityType", entityType);
    event.put("entityId", entity.getId() == null ? null : entity.getId().toString());
    event.put("entityName", entity.getName());
    event.put("entityDisplayName", entity.getDisplayName());
    event.put("entityFqn", entity.getFullyQualifiedName());
    event.put("type", type);
    event.put("text", text);
    event.put("at", at);
    if (who != null) {
      event.put("who", who);
    }
    return event;
  }

  private static Map<String, Object> governance(String entityType, Map<String, Object> entityJson) {
    Map<String, Object> result = null;
    if (Entity.LLM_MODEL.equals(entityType)) {
      Map<String, Object> shim = new LinkedHashMap<>();
      if (entityJson.get("detection") != null) {
        shim.put("detection", entityJson.get("detection"));
      }
      if (!shim.isEmpty()) {
        result = shim;
      }
    } else {
      result = asMap(entityJson.get("governanceMetadata"));
    }
    return result;
  }

  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  private static List<Object> asList(Object value) {
    return value instanceof List<?> ? (List<Object>) value : null;
  }

  private static Long numberToLong(Object value) {
    return value instanceof Number n ? n.longValue() : null;
  }
}
