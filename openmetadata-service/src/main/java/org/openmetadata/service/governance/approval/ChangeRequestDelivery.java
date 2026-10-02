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

package org.openmetadata.service.governance.approval;

import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_REVISION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_WORKFLOW_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Hands a committed revision to its review workflow at least once. A lease-guarded claim makes
 * concurrent deliverers (request thread and recovery scanner) exclusive; a duplicate Flowable start
 * is tolerated because task creation supersedes per requester and decisions are unique per revision.
 */
@Slf4j
public final class ChangeRequestDelivery {
  static final long LEASE_MILLIS = 60_000L;
  static final int MAX_ATTEMPTS = 5;
  private static final long MAX_BACKOFF_MILLIS = 300_000L;

  private ChangeRequestDelivery() {}

  public static void deliver(UUID changeRequestId) {
    String token = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    if (dao().claimForDelivery(changeRequestId, token, now + LEASE_MILLIS, now) == 1) {
      deliverClaimed(dao().findById(changeRequestId), token);
    }
  }

  private static void deliverClaimed(ChangeRequest request, String token) {
    try {
      WorkflowHandler.getInstance()
          .triggerWithRequiredSignal(
              ChangeRequestKeys.submittedSignalId(workflowName(request), request.getEntityType()),
              variables(request));
      dao().completeDelivery(request.getId(), token);
      ChangeRequestMetrics.delivery("delivered");
    } catch (Exception e) {
      LOG.warn(
          "[ChangeRequest] Delivery of {} failed on attempt {}",
          request.getId(),
          request.getDeliveryAttempts(),
          e);
      DeliveryStatus next = nextStatus(request);
      dao().releaseDelivery(request.getId(), token, next.value(), nextAttemptAt(request));
      ChangeRequestMetrics.delivery(
          next == DeliveryStatus.ATTENTION_REQUIRED ? "attentionRequired" : "retrying");
    }
  }

  // Flowable's signal API takes an untyped variable map; this is the only place one is built.
  private static Map<String, Object> variables(ChangeRequest request) {
    Map<String, Object> variables = new LinkedHashMap<>();
    variables.put(
        global(RELATED_ENTITY_VARIABLE),
        new MessageParser.EntityLink(request.getEntityType(), request.getEntityFullyQualifiedName())
            .getLinkString());
    variables.put(global(RELATED_ENTITY_ID_VARIABLE), request.getEntityId().toString());
    variables.put(global(UPDATED_BY_VARIABLE), request.getRequestedBy());
    variables.put(global(CHANGE_REQUEST_ID_VARIABLE), request.getId().toString());
    variables.put(global(CHANGE_REQUEST_REVISION_VARIABLE), request.getActiveRevisionNumber());
    variables.put(global(CHANGE_REQUEST_WORKFLOW_VARIABLE), workflowName(request));
    return variables;
  }

  private static String workflowName(ChangeRequest request) {
    return Entity.getEntityReferenceById(
            Entity.WORKFLOW_DEFINITION, request.getWorkflowDefinitionId(), Include.ALL)
        .getName();
  }

  private static String global(String name) {
    return getNamespacedVariableName(GLOBAL_NAMESPACE, name);
  }

  private static DeliveryStatus nextStatus(ChangeRequest request) {
    return request.getDeliveryAttempts() >= MAX_ATTEMPTS
        ? DeliveryStatus.ATTENTION_REQUIRED
        : DeliveryStatus.PENDING;
  }

  private static long nextAttemptAt(ChangeRequest request) {
    long backoff =
        Math.min(MAX_BACKOFF_MILLIS, 5_000L << Math.min(request.getDeliveryAttempts(), 6));
    return System.currentTimeMillis() + backoff;
  }

  private static ChangeRequestDAO dao() {
    return ChangeRequestService.dao().changeRequestDAO();
  }
}
