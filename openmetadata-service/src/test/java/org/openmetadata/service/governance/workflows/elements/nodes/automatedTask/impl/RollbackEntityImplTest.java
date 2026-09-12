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
package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import java.io.StringReader;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.RollbackEntityImpl.RejectionOutcome;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class RollbackEntityImplTest {
  private static final String REVIEWER = "reviewer";

  private final RollbackEntityImpl rollbackEntity = new RollbackEntityImpl();

  @Test
  void rejectionRollsBackToMostRecentApprovedVersionAndSkipsRejectedVersion() {
    UUID metricId = UUID.randomUUID();
    Metric olderApproved = metric(metricId, 0.1, EntityStatus.APPROVED, "older definition");
    Metric approved = metric(metricId, 0.2, EntityStatus.APPROVED, "approved definition");
    Metric rejected = metric(metricId, 0.3, EntityStatus.REJECTED, "rejected definition");
    Metric current = metric(metricId, 0.4, EntityStatus.IN_REVIEW, "pending definition");
    EntityRepository<Metric> repository =
        repositoryWithHistory(current, olderApproved, rejected, approved);

    RejectionOutcome outcome = rollbackEntity.applyRejection(repository, current, REVIEWER);

    Metric patched = capturedPatchedMetric(repository, current);
    assertEquals("rollback", outcome.action());
    assertEquals(0.2, outcome.toVersion());
    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
    assertEquals("approved definition", patched.getDescription());
  }

  @Test
  void rejectionWithoutApprovedBaselineSetsRejectedAtAnyCurrentVersion() {
    UUID metricId = UUID.randomUUID();
    Metric draft = metric(metricId, 0.1, EntityStatus.DRAFT, "draft definition");
    Metric rejected = metric(metricId, 0.4, EntityStatus.REJECTED, "previous rejection");
    Metric current = metric(metricId, 0.7, EntityStatus.IN_REVIEW, "pending definition");
    EntityRepository<Metric> repository = repositoryWithHistory(current, rejected, draft);

    RejectionOutcome outcome = rollbackEntity.applyRejection(repository, current, REVIEWER);

    Metric patched = capturedPatchedMetric(repository, current);
    assertEquals("reject", outcome.action());
    assertEquals(0.7, outcome.fromVersion());
    assertNull(outcome.toVersion());
    assertEquals(EntityStatus.REJECTED, patched.getEntityStatus());
    assertEquals("pending definition", patched.getDescription());
  }

  @Test
  void rejectionSkipsUnreviewedVersionThatInheritedApprovedStatus() {
    UUID metricId = UUID.randomUUID();
    Metric approved = reviewedMetric(metricId, 0.2, REVIEWER, "approved definition");
    Metric unreviewed = reviewedMetric(metricId, 0.3, "author", "pending definition");
    Metric current =
        reviewedMetric(metricId, 0.4, "author", "pending definition")
            .withEntityStatus(EntityStatus.IN_REVIEW);
    EntityRepository<Metric> repository = repositoryWithHistory(current, approved, unreviewed);

    RejectionOutcome outcome = rollbackEntity.applyRejection(repository, current, REVIEWER);

    Metric patched = capturedPatchedMetric(repository, current);
    assertEquals(0.2, outcome.toVersion());
    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
    assertEquals("approved definition", patched.getDescription());
  }

  @Test
  void rejectionRecognizesRecordedApprovalTransition() {
    UUID metricId = UUID.randomUUID();
    Metric approved =
        reviewedMetric(metricId, 0.2, "former-reviewer", "approved definition")
            .withIncrementalChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName(Entity.FIELD_ENTITY_STATUS)
                                .withNewValue(EntityStatus.APPROVED.value()))));
    Metric current =
        reviewedMetric(metricId, 0.3, "author", "pending definition")
            .withEntityStatus(EntityStatus.IN_REVIEW);
    EntityRepository<Metric> repository = repositoryWithHistory(current, approved);

    RejectionOutcome outcome = rollbackEntity.applyRejection(repository, current, REVIEWER);

    assertEquals(0.2, outcome.toVersion());
    assertEquals(
        "approved definition", capturedPatchedMetric(repository, current).getDescription());
  }

  @Test
  void rejectionKeepsApprovedVersionAuthoredByTeamReviewer() {
    UUID metricId = UUID.randomUUID();
    EntityReference reviewerTeam =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEAM).withName("reviewers");
    Metric approved =
        metric(metricId, 0.2, EntityStatus.APPROVED, "team-approved definition")
            .withUpdatedBy("team-member")
            .withReviewers(List.of(reviewerTeam));
    Metric current =
        metric(metricId, 0.3, EntityStatus.IN_REVIEW, "pending definition")
            .withUpdatedBy("author")
            .withReviewers(List.of(reviewerTeam));
    EntityRepository<Metric> repository = repositoryWithHistory(current, approved);
    SubjectContext reviewerContext = mock(SubjectContext.class);

    try (MockedStatic<SubjectContext> subjectContexts = mockStatic(SubjectContext.class)) {
      subjectContexts
          .when(() -> SubjectContext.getSubjectContext("team-member"))
          .thenReturn(reviewerContext);
      when(reviewerContext.isReviewer(List.of(reviewerTeam))).thenReturn(true);

      RejectionOutcome outcome = rollbackEntity.applyRejection(repository, current, REVIEWER);

      assertEquals(0.2, outcome.toVersion());
      assertEquals(
          "team-approved definition", capturedPatchedMetric(repository, current).getDescription());
    }
  }

  @Test
  void rejectionSkipsTeamReviewerVersionWhenHistoricalAuthorNoLongerExists() {
    UUID metricId = UUID.randomUUID();
    Metric olderApproved = metric(metricId, 0.1, EntityStatus.APPROVED, "approved definition");
    EntityReference reviewerTeam =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEAM).withName("reviewers");
    Metric unavailableAuthor =
        metric(metricId, 0.2, EntityStatus.APPROVED, "unverified definition")
            .withUpdatedBy("deleted-member")
            .withReviewers(List.of(reviewerTeam));
    Metric current =
        metric(metricId, 0.3, EntityStatus.IN_REVIEW, "pending definition")
            .withReviewers(List.of(reviewerTeam));
    EntityRepository<Metric> repository =
        repositoryWithHistory(current, olderApproved, unavailableAuthor);

    try (MockedStatic<SubjectContext> subjectContexts = mockStatic(SubjectContext.class)) {
      subjectContexts
          .when(() -> SubjectContext.getSubjectContext("deleted-member"))
          .thenThrow(EntityNotFoundException.byMessage("deleted user"));

      RejectionOutcome outcome = rollbackEntity.applyRejection(repository, current, REVIEWER);

      assertEquals(0.1, outcome.toVersion());
      assertEquals(
          "approved definition", capturedPatchedMetric(repository, current).getDescription());
    }
  }

  @Test
  void workflowExecutionRejectsWithoutBaselineAndPublishesOutcomeVariables() throws Exception {
    UUID metricId = UUID.randomUUID();
    Metric current = metric(metricId, 0.8, EntityStatus.IN_REVIEW, "pending definition");
    EntityRepository<Metric> repository = repositoryWithHistory(current);
    DelegateExecution execution = mock(DelegateExecution.class);
    Expression inputNamespaces = mock(Expression.class);
    injectField(rollbackEntity, "inputNamespaceMapExpr", inputNamespaces);
    when(inputNamespaces.getValue(execution))
        .thenReturn(Map.of("relatedEntity", "global", "updatedBy", "approval"));
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::metric::orders>");
    when(execution.getVariable("approval_updatedBy")).thenReturn(REVIEWER);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () -> Entity.getEntity(any(MessageParser.EntityLink.class), eq(""), eq(Include.ALL)))
          .thenReturn(current);
      entity.when(() -> Entity.getEntityRepository("metric")).thenReturn(repository);

      rollbackEntity.execute(execution);
    }

    Metric patched = capturedPatchedMetric(repository, current);
    assertEquals(EntityStatus.REJECTED, patched.getEntityStatus());
    verify(execution).setVariable("rollbackAction", "reject");
    verify(execution).setVariable("rollbackFromVersion", 0.8);
    verify(execution).setVariable("rollbackEntityId", metricId.toString());
    verify(execution).setVariable("rollbackEntityType", "metric");
  }

  @SuppressWarnings("unchecked")
  private EntityRepository<Metric> repositoryWithHistory(
      Metric current, Metric... earlierVersions) {
    EntityRepository<Metric> repository = mock(EntityRepository.class);
    List<Object> serializedVersions =
        List.of(earlierVersions).stream()
            .map(JsonUtils::pojoToJson)
            .map(Object.class::cast)
            .toList();
    when(repository.listVersions(current.getId()))
        .thenReturn(new EntityHistory().withVersions(serializedVersions));
    when(repository.getVersion(current.getId(), current.getVersion().toString()))
        .thenReturn(current);
    for (Metric earlierVersion : earlierVersions) {
      when(repository.getVersion(current.getId(), earlierVersion.getVersion().toString()))
          .thenReturn(earlierVersion);
    }
    return repository;
  }

  private Metric capturedPatchedMetric(EntityRepository<Metric> repository, Metric current) {
    ArgumentCaptor<JsonPatch> patchCaptor = ArgumentCaptor.forClass(JsonPatch.class);
    verify(repository)
        .patch(isNull(), eq(current.getFullyQualifiedName()), eq(REVIEWER), patchCaptor.capture());
    return applyPatch(current, patchCaptor.getValue());
  }

  private Metric applyPatch(Metric source, JsonPatch patch) {
    try (JsonReader reader = Json.createReader(new StringReader(JsonUtils.pojoToJson(source)))) {
      JsonObject patched = patch.apply(reader.readObject()).asJsonObject();
      return JsonUtils.readValue(patched.toString(), Metric.class);
    }
  }

  private Metric metric(UUID id, double version, EntityStatus status, String description) {
    return new Metric()
        .withId(id)
        .withName("orders")
        .withFullyQualifiedName("orders")
        .withVersion(version)
        .withEntityStatus(status)
        .withDescription(description);
  }

  private Metric reviewedMetric(UUID id, double version, String updatedBy, String description) {
    return metric(id, version, EntityStatus.APPROVED, description)
        .withUpdatedBy(updatedBy)
        .withReviewers(
            List.of(
                new EntityReference()
                    .withType(Entity.USER)
                    .withName(REVIEWER)
                    .withFullyQualifiedName(REVIEWER)));
  }

  private void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
