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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.AIGovernanceActivityEvent;
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

    List<AIGovernanceActivityEvent> events = GovernanceActivity.eventsFor(model);

    assertEquals(List.of("ShadowAIDetected", "SubmittedForReview"), eventTypes(events));
    assertEquals(2000L, event(events, "SubmittedForReview").getAt());
    assertEquals("alice", event(events, "SubmittedForReview").getWho());
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

      List<AIGovernanceActivityEvent> events = GovernanceActivity.eventsFor(model);

      assertEquals(List.of("SubmittedForReview", "Approved"), eventTypes(events));
      assertEquals(2000L, event(events, "SubmittedForReview").getAt());
      assertEquals("bob", event(events, "SubmittedForReview").getWho());
      assertEquals(3000L, event(events, "Approved").getAt());
      assertEquals("alice", event(events, "Approved").getWho());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void editWhilePendingReturnsOriginalSubmissionNotMostRecentEdit() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("llmmodel", Entity.LLM_MODEL);
    LLMModel current = model(LLMModel.GovernanceStatus.APPROVED, 3000L, "alice");
    LLMModel pendingLatestEdit = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2500L, "carol");
    LLMModel pendingMidEdit = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2200L, "bob");
    LLMModel pendingOriginal = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2000L, "dave");

    List<AIGovernanceActivityEvent> events =
        eventsFromHistory(current, pendingLatestEdit, pendingMidEdit, pendingOriginal);

    AIGovernanceActivityEvent submission = event(events, "SubmittedForReview");
    assertEquals(2000L, submission.getAt(), "should return the original submission timestamp");
    assertEquals("dave", submission.getWho(), "should return the original submitter");
  }

  @Test
  @SuppressWarnings("unchecked")
  void rejectThenResubmitReturnsResubmissionThatLedToApproval() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("llmmodel", Entity.LLM_MODEL);
    LLMModel current = model(LLMModel.GovernanceStatus.APPROVED, 3000L, "alice");
    LLMModel resubmission = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2200L, "bob");
    LLMModel rejected = model(LLMModel.GovernanceStatus.REJECTED, 2100L, "reviewer");
    LLMModel firstSubmission = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2000L, "dave");

    List<AIGovernanceActivityEvent> events =
        eventsFromHistory(current, resubmission, rejected, firstSubmission);

    AIGovernanceActivityEvent submission = event(events, "SubmittedForReview");
    assertEquals(2200L, submission.getAt(), "should return the resubmission timestamp");
    assertEquals("bob", submission.getWho(), "should return the resubmission submitter");
  }

  @Test
  @SuppressWarnings("unchecked")
  void resubmitThenEditWhilePendingReturnsResubmissionNotEdit() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("llmmodel", Entity.LLM_MODEL);
    LLMModel current = model(LLMModel.GovernanceStatus.APPROVED, 3000L, "alice");
    LLMModel editWhilePending = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2500L, "carol");
    LLMModel resubmission = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2200L, "bob");
    LLMModel rejected = model(LLMModel.GovernanceStatus.REJECTED, 2100L, "reviewer");
    LLMModel firstSubmission = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2000L, "dave");

    List<AIGovernanceActivityEvent> events =
        eventsFromHistory(current, editWhilePending, resubmission, rejected, firstSubmission);

    AIGovernanceActivityEvent submission = event(events, "SubmittedForReview");
    assertEquals(2200L, submission.getAt(), "should return the resubmission timestamp");
    assertEquals("bob", submission.getWho(), "should return the resubmission submitter");
  }

  @Test
  @SuppressWarnings("unchecked")
  void reapprovedModelReturnsLatestSubmissionTransition() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("llmmodel", Entity.LLM_MODEL);
    LLMModel current = model(LLMModel.GovernanceStatus.APPROVED, 3000L, "alice");
    LLMModel secondSubmission = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2500L, "bob");
    LLMModel priorApproval = model(LLMModel.GovernanceStatus.APPROVED, 2200L, "alice");
    LLMModel firstSubmission = model(LLMModel.GovernanceStatus.PENDING_REVIEW, 2000L, "dave");

    List<AIGovernanceActivityEvent> events =
        eventsFromHistory(current, secondSubmission, priorApproval, firstSubmission);

    AIGovernanceActivityEvent submission = event(events, "SubmittedForReview");
    assertEquals(2500L, submission.getAt());
    assertEquals("bob", submission.getWho());
  }

  private LLMModel model(LLMModel.GovernanceStatus status, long updatedAt) {
    return model(status, updatedAt, "alice");
  }

  private LLMModel model(LLMModel.GovernanceStatus status, long updatedAt, String updatedBy) {
    return new LLMModel()
        .withId(UUID.randomUUID())
        .withName("claimsCopilot")
        .withDisplayName("Claims Copilot")
        .withFullyQualifiedName("claimsCopilot")
        .withGovernanceStatus(status)
        .withUpdatedAt(updatedAt)
        .withUpdatedBy(updatedBy);
  }

  @SuppressWarnings("unchecked")
  private List<AIGovernanceActivityEvent> eventsFromHistory(
      LLMModel current, LLMModel... olderVersions) {
    UUID id = current.getId();
    List<Object> versions = new ArrayList<>();
    versions.add(JsonUtils.pojoToJson(current));
    for (LLMModel version : olderVersions) {
      version.withId(id);
      versions.add(JsonUtils.pojoToJson(version));
    }
    EntityRepository<LLMModel> repository = mock(EntityRepository.class);
    EntityHistory history = new EntityHistory().withVersions(versions);
    when(repository.listVersions(id)).thenReturn(history);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.LLM_MODEL)).thenReturn(repository);
      return GovernanceActivity.eventsFor(current);
    }
  }

  private List<String> eventTypes(List<AIGovernanceActivityEvent> events) {
    return events.stream().map(AIGovernanceActivityEvent::getType).toList();
  }

  private AIGovernanceActivityEvent event(List<AIGovernanceActivityEvent> events, String type) {
    return events.stream().filter(event -> type.equals(event.getType())).findFirst().orElseThrow();
  }
}
