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
package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;

class TaskTargetOperationsTest {
  private static final String RESOLVER = "resolver";
  private static final String GUARDED_TYPE = "taskTargetOperationsGuardedType";

  @BeforeAll
  static void registerFieldOverride() {
    ResourceRegistry.mapEntityFieldOperation(
        GUARDED_TYPE, Entity.FIELD_DESCRIPTION, MetadataOperation.EDIT_ALL);
  }

  @Test
  void anotherUsersProfileNeedsEditAll() {
    assertEquals(
        MetadataOperation.EDIT_ALL,
        TaskTargetOperations.forTarget(
            about(Entity.USER, "someone"), MetadataOperation.EDIT_DESCRIPTION, RESOLVER));
  }

  @Test
  void theResolversOwnProfileKeepsTheTaskOperation() {
    assertEquals(
        MetadataOperation.EDIT_DESCRIPTION,
        TaskTargetOperations.forTarget(
            about(Entity.USER, RESOLVER), MetadataOperation.EDIT_DESCRIPTION, RESOLVER));
  }

  @Test
  void anEntityTypesFieldOverrideApplies() {
    assertEquals(
        MetadataOperation.EDIT_ALL,
        TaskTargetOperations.forTarget(
            about(GUARDED_TYPE, "x"), MetadataOperation.EDIT_DESCRIPTION, RESOLVER));
  }

  @Test
  void anEntityWithoutOverridesKeepsTheTaskOperation() {
    for (MetadataOperation operation :
        List.of(
            MetadataOperation.EDIT_DESCRIPTION,
            MetadataOperation.EDIT_TAGS,
            MetadataOperation.EDIT_TIER,
            MetadataOperation.EDIT_ALL)) {
      assertEquals(
          operation,
          TaskTargetOperations.forTarget(about(Entity.TABLE, "t"), operation, RESOLVER),
          operation.value());
    }
    assertNull(TaskTargetOperations.forTarget(about(Entity.TABLE, "t"), null, RESOLVER));
  }

  @Test
  void aTierTaskNamingAClassificationTagNeedsEditTags() {
    Task task =
        task(TaskEntityType.TierUpdate, Map.of("newTier", classificationTag("PII.NonSensitive")));
    assertEquals(
        Set.of(MetadataOperation.EDIT_TAGS), TaskTargetOperations.forTagLabels(task, null, null));
  }

  @Test
  void aTagTaskAddingATierNeedsEditTier() {
    Task task =
        task(
            TaskEntityType.TagUpdate,
            Map.of("tagsToAdd", List.of(classificationTag("Tier.Tier1"))));
    assertEquals(
        Set.of(MetadataOperation.EDIT_TIER), TaskTargetOperations.forTagLabels(task, null, null));
  }

  @Test
  void removedLabelsAndGlossaryTermsCount() {
    Task task =
        task(
            TaskEntityType.TagUpdate,
            Map.of(
                "tagsToAdd", List.of(glossaryTerm("Business.Revenue")),
                "tagsToRemove", List.of(classificationTag("Certification.Gold"))));
    assertEquals(
        Set.of(MetadataOperation.EDIT_GLOSSARY_TERMS, MetadataOperation.EDIT_CERTIFICATION),
        TaskTargetOperations.forTagLabels(task, null, null));
  }

  @Test
  void labelsTheResolveRequestBringsCount() {
    Task task = task(TaskEntityType.TierUpdate, Map.of("newTier", classificationTag("Tier.Tier2")));
    Map<String, Object> requestPayload = Map.of("newTier", classificationTag("PII.Sensitive"));
    String newValue = JsonUtils.pojoToJson(List.of(glossaryTerm("Business.Revenue")));

    Set<MetadataOperation> operations =
        TaskTargetOperations.forTagLabels(task, requestPayload, newValue);

    assertEquals(
        Set.of(
            MetadataOperation.EDIT_TIER,
            MetadataOperation.EDIT_TAGS,
            MetadataOperation.EDIT_GLOSSARY_TERMS),
        operations);
  }

  @Test
  void aJsonEncodedSuggestedValueCounts() {
    Task task =
        task(
            TaskEntityType.TagUpdate,
            Map.of(
                "suggestedValue",
                JsonUtils.pojoToJson(List.of(classificationTag("Certification.Gold")))));
    assertEquals(
        Set.of(MetadataOperation.EDIT_CERTIFICATION),
        TaskTargetOperations.forTagLabels(task, null, null));
  }

  @Test
  void valuesThatAreNotLabelsNameNone() {
    Task task = task(TaskEntityType.TagUpdate, Map.of("tagsToAdd", List.of("PII.Sensitive")));
    assertTrue(TaskTargetOperations.forTagLabels(task, null, "not json").isEmpty());
    assertTrue(TaskTargetOperations.forTagLabels(task, null, "[\"PII.Sensitive\"]").isEmpty());
  }

  @Test
  void onlyLabelTasksAreChecked() {
    Task task =
        task(
            TaskEntityType.DescriptionUpdate,
            Map.of("tagsToAdd", List.of(classificationTag("Tier.Tier1"))));
    assertTrue(TaskTargetOperations.forTagLabels(task, null, null).isEmpty());
  }

  private static EntityReference about(String type, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
  }

  private static Task task(TaskEntityType type, Map<String, Object> payload) {
    return new Task().withId(UUID.randomUUID()).withType(type).withPayload(payload);
  }

  private static TagLabel classificationTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static TagLabel glossaryTerm(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
