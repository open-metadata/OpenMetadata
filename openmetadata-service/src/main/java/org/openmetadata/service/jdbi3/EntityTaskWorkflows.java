/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.util.DescriptionSanitizer;
import org.openmetadata.service.util.EntityFieldUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Generic task-resolution workflows for description, tag, and approval tasks. Extracted from
 * EntityRepository as part of decomposing that class; the default {@code getTaskWorkflow} factory
 * still instantiates these.
 */
class DescriptionTaskWorkflow extends TaskWorkflow {
  DescriptionTaskWorkflow(ThreadContext threadContext) {
    super(threadContext);
  }

  @Override
  public EntityInterface performTask(String user, ResolveTask resolveTask) {
    EntityInterface aboutEntity = threadContext.getAboutEntity();
    aboutEntity.setDescription(DescriptionSanitizer.sanitize(resolveTask.getNewValue()));
    return aboutEntity;
  }
}

class TagTaskWorkflow extends TaskWorkflow {
  TagTaskWorkflow(ThreadContext threadContext) {
    super(threadContext);
  }

  @Override
  public EntityInterface performTask(String user, ResolveTask resolveTask) {
    List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
    EntityInterface aboutEntity = threadContext.getAboutEntity();
    aboutEntity.setTags(tags);
    return aboutEntity;
  }
}

/**
 * Generic approval task workflow usable for any entity. Checks that the acting user is a reviewer of
 * the entity, then delegates resolution to the governance WorkflowHandler. Falls back to a direct
 * entityStatus patch when the Flowable workflow record no longer exists.
 */
class ApprovalTaskWorkflow extends TaskWorkflow {
  private static final Logger LOG = LoggerFactory.getLogger(ApprovalTaskWorkflow.class);

  ApprovalTaskWorkflow(ThreadContext threadContext) {
    super(threadContext);
  }

  @Override
  public EntityInterface performTask(String user, ResolveTask resolveTask) {
    EntityInterface entity = threadContext.getAboutEntity();
    EntityRepository.verifyReviewer(entity, user);

    UUID taskId = threadContext.getThread().getId();
    Map<String, Object> variables = new HashMap<>();
    variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
    variables.put(UPDATED_BY_VARIABLE, user);
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    boolean workflowSuccess =
        workflowHandler.resolveLegacyThreadTask(
            taskId, workflowHandler.transformToNodeVariables(taskId, variables));

    if (!workflowSuccess) {
      LOG.warn("Workflow failed for taskId='{}', applying status directly", taskId);
      Boolean approved = (Boolean) variables.get(RESULT_VARIABLE);
      String entityStatus = (approved != null && approved) ? "Approved" : "Rejected";
      EntityFieldUtils.setEntityField(
          entity,
          threadContext.getAbout().getEntityType(),
          user,
          FIELD_ENTITY_STATUS,
          entityStatus,
          true);
    }

    return entity;
  }
}
