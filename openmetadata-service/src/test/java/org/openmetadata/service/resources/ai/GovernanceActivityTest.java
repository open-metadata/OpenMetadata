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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.type.AIDetection;
import org.openmetadata.schema.type.AIDetectionSource;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

class GovernanceActivityTest {

  @Test
  void eventsForLlmModelIncludesPendingReviewSubmissionEvent() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("llmmodel", Entity.LLM_MODEL);
    LLMModel model =
        model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2000L)
            .withDetection(
                new AIDetection()
                    .withSource(AIDetectionSource.OutboundApiTraffic)
                    .withDetectedAt(1000L));

    List<Map<String, Object>> events = GovernanceActivity.eventsFor(model);

    assertEquals(List.of("ShadowAIDetected", "SubmittedForReview"), eventTypes(events));
    assertEquals(2000L, event(events, "SubmittedForReview").get("at"));
    assertEquals("alice", event(events, "SubmittedForReview").get("who"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void eventsForLlmModelIncludesApprovedAndSubmissionEventsFromHistory() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("llmmodel", Entity.LLM_MODEL);
    LLMModel model = model(LLMModel.GovernanceStatus.APPROVED, 3000L);
    LLMModel pendingReview =
        model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2000L)
            .withId(model.getId())
            .withUpdatedBy("bob");
    EntityRepository<LLMModel> repository = mock(EntityRepository.class);
    EntityHistory history =
        new EntityHistory()
            .withVersions(
                List.of(JsonUtils.pojoToJson(model), JsonUtils.pojoToJson(pendingReview)));
    when(repository.listVersions(model.getId())).thenReturn(history);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.LLM_MODEL)).thenReturn(repository);

      List<Map<String, Object>> events = GovernanceActivity.eventsFor(model);

      assertEquals(List.of("SubmittedForReview", "Approved"), eventTypes(events));
      assertEquals(2000L, event(events, "SubmittedForReview").get("at"));
      assertEquals("bob", event(events, "SubmittedForReview").get("who"));
      assertEquals(3000L, event(events, "Approved").get("at"));
      assertEquals("alice", event(events, "Approved").get("who"));
    }
  }

  private LLMModel model(LLMModel.GovernanceStatus status, long updatedAt) {
    return new LLMModel()
        .withId(UUID.randomUUID())
        .withName("claimsCopilot")
        .withDisplayName("Claims Copilot")
        .withFullyQualifiedName("claimsCopilot")
        .withGovernanceStatus(status)
        .withUpdatedAt(updatedAt)
        .withUpdatedBy("alice");
  }

  private List<Object> eventTypes(List<Map<String, Object>> events) {
    return events.stream().map(event -> event.get("type")).toList();
  }

  private Map<String, Object> event(List<Map<String, Object>> events, String type) {
    return events.stream()
        .filter(event -> type.equals(event.get("type")))
        .findFirst()
        .orElseThrow();
  }
}
