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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.AIGovernanceActivityEvent;
import org.openmetadata.schema.api.ai.AIGovernanceActivityResponse;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.AIDetection;
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
final class GovernanceActivity {

  private static final Set<String> SUPPORTED_TYPES =
      Set.of(Entity.AI_APPLICATION, Entity.LLM_MODEL, Entity.MCP_SERVER);
  private static final int PAGE_SIZE = 500;

  private GovernanceActivity() {}

  static AIGovernanceActivityResponse compute(String entityType, String entityId, int limit) {
    List<EntityInterface> assets = new ArrayList<>();
    boolean singleEntity = entityType != null && entityId != null;
    if (singleEntity) {
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

    List<AIGovernanceActivityEvent> events = new ArrayList<>();
    for (EntityInterface entity : assets) {
      events.addAll(eventsFor(entity, singleEntity));
    }
    events.sort(Comparator.comparing(AIGovernanceActivityEvent::getAt).reversed());
    int effective = Math.min(limit > 0 ? limit : 50, events.size());

    return new AIGovernanceActivityResponse().withEvents(events.subList(0, effective));
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

  static List<AIGovernanceActivityEvent> eventsFor(EntityInterface entity) {
    return eventsFor(entity, true);
  }

  /**
   * @param reconstructHistory when true, an approved LLM model's original submission time is
   *     recovered from its version history ({@code listVersions}). The estate/type feed passes
   *     false to avoid an N+1 version lookup per approved model; a single-entity timeline passes
   *     true so both submission and approval events are shown.
   */
  static List<AIGovernanceActivityEvent> eventsFor(
      EntityInterface entity, boolean reconstructHistory) {
    List<AIGovernanceActivityEvent> events = new ArrayList<>();
    String entityType =
        entity.getEntityReference() == null ? null : entity.getEntityReference().getType();
    ActivityGovernance governance = governance(entity, reconstructHistory);

    if (!governance.isEmpty()) {
      AIDetection detection = governance.detection();
      if (detection != null && detection.getDetectedAt() != null) {
        events.add(
            event(
                entity,
                entityType,
                "ShadowAIDetected",
                String.format(
                    "Detected via %s",
                    detection.getSource() == null ? "manual upload" : detection.getSource()),
                detection.getDetectedAt(),
                governance.registeredBy()));
      }

      Long registeredAt = governance.registeredAt();
      if (registeredAt != null) {
        events.add(
            event(
                entity,
                entityType,
                "SubmittedForReview",
                "Submitted to Risk Council for review",
                registeredAt,
                governance.registeredBy()));
      }

      Long approvedAt = governance.approvedAt();
      if (approvedAt != null) {
        events.add(
            event(
                entity,
                entityType,
                "Approved",
                "Approved by Risk Council",
                approvedAt,
                governance.approvedBy()));
      }

      AICompliance aiCompliance = governance.aiCompliance();
      if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
        for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
          Long assessedAt = record.getAssessedAt();
          if (assessedAt != null) {
            String framework = enumValue(record.getFramework());
            events.add(
                event(
                    entity,
                    entityType,
                    "Assessed",
                    String.format("%s assessment completed", framework),
                    assessedAt,
                    record.getAssessedBy()));
          }
          Long nextReview = record.getNextReviewDate();
          if (nextReview != null) {
            String framework = enumValue(record.getFramework());
            long loggedAt = assessedAt != null ? assessedAt : reviewFallback(governance, entity);
            events.add(
                scheduledEvent(
                    entity,
                    entityType,
                    "NextReviewScheduled",
                    String.format("%s next review scheduled", framework),
                    loggedAt,
                    nextReview,
                    null));
          }
        }
      }
    }
    return events;
  }

  private static AIGovernanceActivityEvent event(
      EntityInterface entity, String entityType, String type, String text, long at, Object who) {
    AIGovernanceActivityEvent event =
        new AIGovernanceActivityEvent()
            .withEntityType(entityType)
            .withEntityId(entity.getId() == null ? null : entity.getId().toString())
            .withEntityName(entity.getName())
            .withEntityDisplayName(entity.getDisplayName())
            .withEntityFqn(entity.getFullyQualifiedName())
            .withType(type)
            .withText(text)
            .withAt(at)
            .withCreatedAt(at);
    if (who != null) {
      event.setWho(who.toString());
    }
    return event;
  }

  /**
   * A future-dated event (e.g. a scheduled reassessment). {@code at}/{@code createdAt}
   * is when the event was logged so the feed sorts chronologically, while
   * {@code scheduledAt} carries the future date the event refers to.
   */
  private static AIGovernanceActivityEvent scheduledEvent(
      EntityInterface entity,
      String entityType,
      String type,
      String text,
      long at,
      long scheduledAt,
      Object who) {
    AIGovernanceActivityEvent event = event(entity, entityType, type, text, at, who);
    event.setScheduledAt(scheduledAt);
    return event;
  }

  private static long reviewFallback(ActivityGovernance governance, EntityInterface entity) {
    Long registeredAt = governance.registeredAt();
    long result;
    if (registeredAt != null) {
      result = registeredAt;
    } else if (entity.getUpdatedAt() != null) {
      result = entity.getUpdatedAt();
    } else {
      result = System.currentTimeMillis();
    }
    return result;
  }

  private static ActivityGovernance governance(EntityInterface entity, boolean reconstructHistory) {
    ActivityGovernance result = ActivityGovernance.EMPTY;
    if (entity instanceof AIApplication app) {
      result = governance(app.getGovernanceMetadata());
    } else if (entity instanceof McpServer server) {
      result = governance(server.getGovernanceMetadata());
    } else if (entity instanceof LLMModel llm) {
      result = llmGovernance(llm, reconstructHistory);
    }
    return result;
  }

  private static ActivityGovernance governance(GovernanceMetadata governance) {
    return governance == null
        ? ActivityGovernance.EMPTY
        : new ActivityGovernance(
            governance.getDetection(),
            governance.getRegisteredBy(),
            governance.getRegisteredAt(),
            governance.getApprovedBy(),
            governance.getApprovedAt(),
            governance.getAiCompliance());
  }

  private static ActivityGovernance governance(McpGovernanceMetadata governance) {
    return governance == null
        ? ActivityGovernance.EMPTY
        : new ActivityGovernance(
            governance.getDetection(),
            governance.getRegisteredBy(),
            governance.getRegisteredAt(),
            governance.getApprovedBy(),
            governance.getApprovedAt(),
            governance.getAiCompliance());
  }

  private static ActivityGovernance llmGovernance(LLMModel llm, boolean reconstructHistory) {
    String registeredBy = null;
    Long registeredAt = null;
    String approvedBy = null;
    Long approvedAt = null;
    if (llm.getGovernanceStatus() != null && llm.getUpdatedAt() != null) {
      if (llm.getGovernanceStatus() == LLMModel.GovernanceStatus.PENDING_REVIEW) {
        registeredAt = llm.getUpdatedAt();
        registeredBy = llm.getUpdatedBy();
      } else if (llm.getGovernanceStatus() == LLMModel.GovernanceStatus.APPROVED) {
        approvedAt = llm.getUpdatedAt();
        approvedBy = llm.getUpdatedBy();
        if (reconstructHistory) {
          LlmSubmission submission = llmSubmissionFromHistory(llm);
          registeredAt = submission.registeredAt();
          registeredBy = submission.registeredBy();
        }
      }
    }
    return new ActivityGovernance(
        llm.getDetection(), registeredBy, registeredAt, approvedBy, approvedAt, null);
  }

  private static LlmSubmission llmSubmissionFromHistory(LLMModel llm) {
    LlmSubmission result = LlmSubmission.EMPTY;
    if (llm == null || llm.getId() == null) {
      return result;
    }
    try {
      EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(Entity.LLM_MODEL);
      List<Object> versions = repository.listVersions(llm.getId()).getVersions();
      if (versions == null) {
        return result;
      }
      for (Object version : versions) {
        LLMModel versionModel = asLlmVersion(version);
        if (versionModel != null
            && versionModel.getGovernanceStatus() == LLMModel.GovernanceStatus.PENDING_REVIEW
            && versionModel.getUpdatedAt() != null) {
          result = new LlmSubmission(versionModel.getUpdatedBy(), versionModel.getUpdatedAt());
          break;
        }
      }
    } catch (Exception error) {
      LOG.debug(
          "Activity feed: unable to reconstruct LLM submission history for {}", llm.getId(), error);
    }
    return result;
  }

  private static LLMModel asLlmVersion(Object value) {
    LLMModel result = null;
    if (value instanceof LLMModel model) {
      result = model;
    } else if (value instanceof String json) {
      result = JsonUtils.readValue(json, LLMModel.class);
    } else if (value != null) {
      result = JsonUtils.getObjectMapper().convertValue(value, LLMModel.class);
    }
    return result;
  }

  private static String enumValue(Object value) {
    return value == null ? null : value.toString();
  }

  private record ActivityGovernance(
      AIDetection detection,
      String registeredBy,
      Long registeredAt,
      String approvedBy,
      Long approvedAt,
      AICompliance aiCompliance) {
    private static final ActivityGovernance EMPTY =
        new ActivityGovernance(null, null, null, null, null, null);

    private boolean isEmpty() {
      return detection == null
          && registeredAt == null
          && approvedAt == null
          && aiCompliance == null;
    }
  }

  private record LlmSubmission(String registeredBy, Long registeredAt) {
    private static final LlmSubmission EMPTY = new LlmSubmission(null, null);
  }
}
