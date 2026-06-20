/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.tasks.RecognizerFeedbackTaskPayloadKeys;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class TaskRepositoryTest {

  @Test
  void setFieldsNormalizesLegacyRecognizerFeedbackPayload() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      TaskRepository repository = createRepository(entityMock);
      Task task =
          new Task()
              .withId(UUID.randomUUID())
              .withType(TaskEntityType.DataQualityReview)
              .withPayload(
                  Map.of(
                      RecognizerFeedbackTaskPayloadKeys.LEGACY_DATA,
                      Map.of("feedbackType", "FalsePositive"),
                      RecognizerFeedbackTaskPayloadKeys.METADATA,
                      Map.of(RecognizerFeedbackTaskPayloadKeys.RECOGNIZER, Map.of("id", "pii"))));

      repository.setFields(task, Fields.EMPTY_FIELDS, RelationIncludes.fromInclude(null));

      JsonNode payload = JsonUtils.valueToTree(task.getPayload());
      assertTrue(payload.has(RecognizerFeedbackTaskPayloadKeys.FEEDBACK));
      assertTrue(payload.has(RecognizerFeedbackTaskPayloadKeys.RECOGNIZER));
      assertEquals(
          "FalsePositive",
          payload.get(RecognizerFeedbackTaskPayloadKeys.FEEDBACK).get("feedbackType").asText());
      assertEquals(
          "pii",
          payload.get(RecognizerFeedbackTaskPayloadKeys.RECOGNIZER).get("id").asText());
    }
  }

  @Test
  void setFieldsLeavesNonObjectPayloadUnchanged() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      TaskRepository repository = createRepository(entityMock);
      Task task =
          new Task().withId(UUID.randomUUID()).withType(TaskEntityType.DataQualityReview).withPayload("legacy");

      repository.setFields(task, Fields.EMPTY_FIELDS, RelationIncludes.fromInclude(null));

      assertEquals("legacy", task.getPayload());
    }
  }

  @Test
  void setFieldsLeavesNonDataQualityReviewPayloadUnchanged() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      TaskRepository repository = createRepository(entityMock);
      Task task =
          new Task()
              .withId(UUID.randomUUID())
              .withType(TaskEntityType.PipelineReview)
              .withPayload(
                  Map.of(
                      RecognizerFeedbackTaskPayloadKeys.LEGACY_DATA,
                      Map.of("feedbackType", "FalsePositive"),
                      RecognizerFeedbackTaskPayloadKeys.METADATA,
                      Map.of(RecognizerFeedbackTaskPayloadKeys.RECOGNIZER, Map.of("id", "pii"))));

      repository.setFields(task, Fields.EMPTY_FIELDS, RelationIncludes.fromInclude(null));

      JsonNode payload = JsonUtils.valueToTree(task.getPayload());
      assertTrue(payload.has(RecognizerFeedbackTaskPayloadKeys.LEGACY_DATA));
      assertFalse(payload.has(RecognizerFeedbackTaskPayloadKeys.FEEDBACK));
      assertFalse(payload.has(RecognizerFeedbackTaskPayloadKeys.RECOGNIZER));
    }
  }

  private TaskRepository createRepository(MockedStatic<Entity> entityMock) {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TaskDAO taskDAO = mock(CollectionDAO.TaskDAO.class);
    when(dao.taskDAO()).thenReturn(taskDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityMock.when(Entity::getJobDAO).thenReturn(mock(JobDAO.class));
    entityMock.when(Entity::getSearchRepository).thenReturn(mock(SearchRepository.class));
    entityMock
        .when(() -> Entity.getEntityFields(Task.class))
        .thenReturn(
            new HashSet<>(
                Arrays.asList(
                    TaskRepository.FIELD_ASSIGNEES,
                    TaskRepository.FIELD_REVIEWERS,
                    TaskRepository.FIELD_WATCHERS,
                    TaskRepository.FIELD_ABOUT,
                    TaskRepository.FIELD_COMMENTS,
                    TaskRepository.FIELD_RESOLUTION,
                    TaskRepository.FIELD_CREATED_BY,
                    TaskRepository.FIELD_PAYLOAD,
                    Entity.FIELD_DOMAINS)));

    return new TaskRepository();
  }
}
